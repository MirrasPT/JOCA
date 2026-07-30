// The manager's tools — in-process MCP, scoped to ONE project.
//
// Design rules learned from the Master that was removed:
//   • Few tools. The old one had 16 and the model lost the thread; this has 9, each mapping 1:1 to
//     a function that already exists elsewhere in the backend.
//   • NOTHING blocks. A tool that waits for a worker would freeze the chat — which is the exact
//     pain we are removing. Dispatch returns immediately; completion arrives later as a wake.
//   • The manager never touches the filesystem: the SDK is configured with tools:[] so it has no
//     Bash/Read/Write at all. Everything it can do is in this file.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { z } from 'zod';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { sessionManager } from '../session-manager';
import { safePathForRead } from '../security-fs';
import { loadProjects } from '../project-store';
import { pushNotification } from '../notifications/store';
import {
  loadTasks, makeTask, upsertTask, moveTask, addTaskComment, getTask,
  TASK_STATUSES, type TaskStatus,
} from '../tasks/store';
import { dispatchTask } from '../tasks/engine';
import { dispatchToArea, listWorkers, getWorker, closeWorker } from './worker-pool';

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });
const fail = (text: string) => ({ content: [{ type: 'text' as const, text: `ERRO: ${text}` }], isError: true });

// ── Verificação (leitura) ─────────────────────────────────────────────────────
// O gestor precisa de CONFERIR o que os workers produziram — senão só sabe o que eles dizem que
// fizeram, e um agente que reporta sucesso sem produzir nada passa despercebido.
//
// Estas ferramentas são deliberadamente só de LEITURA. O gestor continua a correr com tools:[]
// (sem Bash/Write/Edit), portanto continua a não poder escrever código — que é a garantia que dá
// sentido à separação gestor/worker. Ver != alterar.
const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp',
};
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;   // acima disto o custo em tokens não compensa

// Resolve um path relativo contra a pasta do projecto e valida-o com as mesmas regras do resto do
// backend (dentro de HOME, fora de pastas sensíveis). O gestor nunca escolhe onde lê.
function resolveInProject(projectId: string, target: string): string {
  const project = loadProjects().find((p) => p.id === projectId);
  if (!project) throw new Error('projecto não encontrado');
  const abs = path.isAbsolute(target) ? target : path.join(project.path, target);
  return safePathForRead(abs);
}

// Keys a TUI menu understands. Recovered from the Master's select_in_worker — interactive menus are
// still a real failure mode and the manager must be able to unblock a worker.
const KEY_MAP: Record<string, string> = {
  enter: '\r', esc: '\x1b', tab: '\t', space: ' ',
  up: '\x1b[A', down: '\x1b[B', right: '\x1b[C', left: '\x1b[D',
  y: 'y', n: 'n',
};
function mapKey(token: string): string | null {
  const t = token.trim().toLowerCase();
  if (/^[1-9]$/.test(t)) return t;
  return KEY_MAP[t] ?? null;
}

// `actions` collects a human-readable trace of what the manager did this turn — shown under its
// message in the chat, so you can see it worked without reading terminals.
export function buildManagerTools(projectId: string, actions: string[]) {
  const note = (s: string) => { actions.push(s); };

  return createSdkMcpServer({
    name: 'joca',
    version: '1.0.0',
    instructions: 'Ferramentas de orquestração do JOCA para o projecto actual.',
    tools: [
      // ── Workers ──────────────────────────────────────────────────────────
      tool(
        'trabalhar',
        'Manda um worker fazer trabalho. Cada ÁREA (design, backend, frontend, conteúdo, testes…) tem o seu terminal, que é reutilizado. Devolve imediatamente — o worker trabalha em segundo plano e serás avisado quando terminar. Escreve a instrução completa e auto-suficiente, como se falasses com um programador que acabou de chegar.',
        {
          area: z.string().describe('Área do trabalho: design, backend, frontend, conteúdo, testes, geral…'),
          instrucao: z.string().describe('O trabalho a fazer, completo e específico (ficheiros, objectivo, critério de pronto).'),
          cli: z.enum(['claude', 'codex', 'agy', 'opencode']).optional().describe('CLI a usar; por omissão o predefinido.'),
          modelo: z.string().optional(),
        },
        async ({ area, instrucao, cli, modelo }) => {
          const r = dispatchToArea(projectId, area, instrucao, { cli, model: modelo });
          if (!r.ok || !r.worker) return fail(r.error ?? 'não foi possível despachar');
          note(`${r.reused ? 'enviou trabalho ao' : 'abriu'} worker de ${r.worker.area}`);
          return ok(`Trabalho entregue ao worker de "${r.worker.area}" (${r.reused ? 'reutilizado' : 'terminal novo'}). Vais ser avisado quando terminar. NÃO esperes nem perguntes se acabou — continua a conversa.`);
        },
      ),

      tool(
        'ver_workers',
        'Lista os workers deste projecto e o que cada um está a fazer. Usa ANTES de mandar trabalho, para saber o que já está ocupado.',
        {},
        async () => {
          const list = listWorkers(projectId);
          if (!list.length) return ok('Nenhum worker aberto neste projecto.');
          return ok(list.map((w) => {
            const s = sessionManager.get(w.sessionId);
            return `- ${w.area}: ${w.busy ? 'a trabalhar' : 'livre'}${s ? ` (terminal ${s.status})` : ' (terminal fechado)'}${w.currentJob ? ` — ${w.currentJob}` : ''}`;
          }).join('\n'));
        },
      ),

      tool(
        'ler_worker',
        'Lê o que um worker escreveu no terminal. Usa para confirmares um resultado ou perceberes onde ele está preso. Devolve só o fim do output.',
        {
          area: z.string(),
          linhas: z.number().optional().describe('Quantos caracteres do fim (por omissão 3000, máximo 12000).'),
        },
        async ({ area, linhas }) => {
          const w = getWorker(projectId, area);
          if (!w) return fail(`não há worker na área "${area}"`);
          const buf = sessionManager.readBuffer(w.sessionId, { strip: true });
          if (buf === undefined) return fail('o terminal desse worker já não existe');
          note(`leu o worker de ${w.area}`);
          return ok(buf.slice(-Math.max(200, Math.min(linhas ?? 3000, 12_000))));
        },
      ),

      tool(
        'responder_worker',
        'Responde a um worker que está à espera: texto livre, ou teclas para menus de escolha (1-9, enter, up, down, y, n, esc). Decide TU quando a escolha é reversível e sem risco; se for irreversível ou importante, pergunta primeiro ao utilizador no chat.',
        {
          area: z.string(),
          texto: z.string().optional().describe('Resposta em texto.'),
          teclas: z.array(z.string()).optional().describe('Teclas para um menu, por ordem. Ex.: ["2","enter"]'),
        },
        async ({ area, texto, teclas }) => {
          const w = getWorker(projectId, area);
          if (!w) return fail(`não há worker na área "${area}"`);
          if (teclas?.length) {
            const mapped = teclas.map(mapKey);
            const bad = teclas.filter((_, i) => mapped[i] === null);
            if (bad.length) return fail(`teclas não reconhecidas: ${bad.join(', ')}`);
            // Sent one at a time: a TUI drops keys that arrive in the same chunk.
            for (const k of mapped) {
              sessionManager.input(w.sessionId, k as string);
              await new Promise((r) => setTimeout(r, 80));
            }
            note(`respondeu ao menu do worker de ${w.area}`);
            return ok(`Teclas enviadas ao worker de "${w.area}".`);
          }
          if (!texto?.trim()) return fail('dá texto ou teclas');
          if (!sessionManager.submitMessage(w.sessionId, texto)) return fail('o terminal já não existe');
          note(`respondeu ao worker de ${w.area}`);
          return ok(`Resposta enviada ao worker de "${w.area}". Serás avisado quando ele terminar.`);
        },
      ),

      tool(
        'fechar_worker',
        'Fecha o terminal de uma área. Usa quando o trabalho dessa área terminou e não é preciso tão cedo, ou quando precisas de espaço para abrir outro.',
        { area: z.string() },
        async ({ area }) => {
          if (!closeWorker(projectId, area)) return fail(`não há worker na área "${area}"`);
          note(`fechou o worker de ${area}`);
          return ok(`Worker de "${area}" fechado.`);
        },
      ),

      // ── Tarefas ──────────────────────────────────────────────────────────
      tool(
        'tarefas',
        'Consulta e gere o quadro de tarefas deste projecto. Acções: listar | criar | mover | comentar. As tarefas NÃO arrancam sozinhas — para pôr uma a executar usa a ferramenta "executar_tarefa".',
        {
          accao: z.enum(['listar', 'criar', 'mover', 'comentar']),
          id: z.string().optional().describe('Id da tarefa (aceita o prefixo curto mostrado na listagem).'),
          titulo: z.string().optional(),
          descricao: z.string().optional(),
          coluna: z.enum(['a-definir', 'a-executar', 'em-execucao', 'concluida', 'arquivada']).optional(),
          para_humano: z.boolean().optional().describe('Marca a tarefa como sendo para o utilizador fazer, não para um worker.'),
          nota: z.string().optional().describe('Texto do comentário, para accao="comentar".'),
        },
        async ({ accao, id, titulo, descricao, coluna, para_humano, nota }) => {
          const mine = loadTasks().filter((t) => t.projectId === projectId);
          const find = () => {
            if (!id) return undefined;
            return mine.find((t) => t.id === id) ?? mine.find((t) => t.id.startsWith(id));
          };

          if (accao === 'listar') {
            if (!mine.length) return ok('Sem tarefas neste projecto.');
            const byCol = TASK_STATUSES.map((c) => {
              const inCol = mine.filter((t) => t.status === c).sort((a, b) => a.order - b.order);
              if (!inCol.length) return '';
              return `## ${c}\n` + inCol.map((t) => {
                const marks = [
                  t.lastStatus === 'error' ? '✗ erro' : '',
                  /\[para ti\]/i.test(t.title) ? '👤 humano' : '',
                  t.comments?.length ? `${t.comments.length} notas` : '',
                ].filter(Boolean).join(' · ');
                return `- ${t.id.slice(0, 8)} ${t.title}${marks ? `  (${marks})` : ''}`;
              }).join('\n');
            }).filter(Boolean).join('\n');
            return ok(byCol);
          }

          if (accao === 'criar') {
            if (!titulo?.trim()) return fail('titulo obrigatório');
            // Human-owned tasks are marked in the title so they read clearly on the board and in
            // any listing, without needing a schema migration.
            const finalTitle = para_humano ? `[para ti] ${titulo.trim()}` : titulo.trim();
            const t = makeTask({
              title: finalTitle,
              description: descricao,
              status: coluna ?? 'a-definir',
              projectId,
            });
            upsertTask(t);
            note(`criou a tarefa "${t.title}"`);
            return ok(`Tarefa criada: ${t.id.slice(0, 8)} — "${t.title}" (${t.status}).`);
          }

          const task = find();
          if (!task) return fail('tarefa não encontrada neste projecto');

          if (accao === 'mover') {
            if (!coluna) return fail('coluna obrigatória');
            if (task.status === 'em-execucao') return fail('essa tarefa está a ser executada — espera que termine');
            moveTask(task.id, coluna as TaskStatus);
            note(`moveu "${task.title}" para ${coluna}`);
            return ok(`"${task.title}" → ${coluna}.`);
          }

          if (!nota?.trim()) return fail('nota obrigatória');
          addTaskComment(task.id, { author: 'system', authorName: 'Gestor', text: nota });
          note(`comentou em "${task.title}"`);
          return ok('Nota adicionada.');
        },
      ),

      tool(
        'executar_tarefa',
        'Põe uma tarefa do quadro a executar num worker. As tarefas nunca arrancam sozinhas: és tu que decides quando cada uma começa, depois de leres o que ela pede.',
        { id: z.string().describe('Id da tarefa (aceita prefixo curto).') },
        async ({ id }) => {
          const mine = loadTasks().filter((t) => t.projectId === projectId);
          const task = mine.find((t) => t.id === id) ?? mine.find((t) => t.id.startsWith(id));
          if (!task) return fail('tarefa não encontrada neste projecto');
          if (/^\[para ti\]/i.test(task.title)) return fail('essa tarefa é para o utilizador fazer — não a despaches para um worker');
          const r = dispatchTask(task.id);
          if (!r.ok) return fail(r.reason ?? 'não foi possível arrancar');
          note(`pôs a tarefa "${task.title}" a executar`);
          return ok(`Tarefa "${task.title}" a executar. Serás avisado quando terminar.`);
        },
      ),

      // ── Utilizador ───────────────────────────────────────────────────────
      tool(
        'avisar_utilizador',
        'Envia uma notificação que chega ao utilizador mesmo com o JOCA fechado (inbox/telemóvel). Usa só para o que importa. Marca precisa_de_resposta quando NADA avança sem ele decidir — essas não são agrupadas nem silenciadas.',
        {
          texto: z.string(),
          titulo: z.string().optional(),
          precisa_de_resposta: z.boolean().optional().describe('true = estás bloqueado à espera dele; false (por omissão) = é só para ele saber.'),
        },
        async ({ texto, titulo, precisa_de_resposta }) => {
          const project = loadProjects().find((p) => p.id === projectId);
          pushNotification({
            kind: 'manager',
            title: titulo?.slice(0, 120) || `📋 ${project?.name ?? 'Gestor de projecto'}`,
            text: texto,
            priority: precisa_de_resposta ? 'action' : 'info',
            meta: { projectId },
            // Só o informativo agrupa: dois bloqueios são duas decisões, e juntá-los escondia uma.
            ...(precisa_de_resposta ? {} : { groupKey: `manager:${projectId}` }),
          });
          note(precisa_de_resposta ? 'pediu resposta ao utilizador' : 'avisou o utilizador');
          return ok('Notificação enviada.');
        },
      ),

      // ── Verificar o trabalho ─────────────────────────────────────────────
      tool(
        'ver_ficheiro',
        'Lê um ficheiro do projecto para CONFERIRES o que um worker produziu. Usa depois de um worker dizer que terminou — não acredites só na palavra dele. Caminho relativo à pasta do projecto.',
        {
          caminho: z.string().describe('Ex.: "src/App.tsx" ou "v1/header.html"'),
          linhas: z.number().optional().describe('Máximo de caracteres (por omissão 6000).'),
        },
        async ({ caminho, linhas }) => {
          try {
            const abs = resolveInProject(projectId, caminho);
            const stat = fs.statSync(abs);
            if (stat.isDirectory()) return fail(`"${caminho}" é uma pasta — usa listar_pasta`);
            const limit = Math.max(200, Math.min(linhas ?? 6000, 20_000));
            const text = fs.readFileSync(abs, 'utf8');
            note(`leu ${caminho}`);
            return ok(text.length > limit
              ? `${text.slice(0, limit)}\n\n[…truncado, ${text.length} caracteres no total]`
              : text || '(ficheiro vazio)');
          } catch (e) {
            return fail(e instanceof Error ? e.message : 'não foi possível ler');
          }
        },
      ),

      tool(
        'ver_imagem',
        'Abre uma imagem do projecto para a VERES — screenshot, mockup, logo, gráfico. Usa para validares trabalho visual em vez de perguntares ao utilizador se está bom.',
        { caminho: z.string() },
        async ({ caminho }) => {
          try {
            const abs = resolveInProject(projectId, caminho);
            const ext = path.extname(abs).toLowerCase();
            const mime = IMAGE_TYPES[ext];
            if (!mime) return fail(`"${ext}" não é uma imagem que eu consiga abrir (${Object.keys(IMAGE_TYPES).join(', ')})`);
            const buf = fs.readFileSync(abs);
            if (buf.length > MAX_IMAGE_BYTES) {
              return fail(`imagem demasiado grande (${Math.round(buf.length / 1024)}KB, máximo ${MAX_IMAGE_BYTES / 1024 / 1024}MB)`);
            }
            note(`viu ${path.basename(abs)}`);
            return {
              content: [{ type: 'image' as const, data: buf.toString('base64'), mimeType: mime }],
            };
          } catch (e) {
            return fail(e instanceof Error ? e.message : 'não foi possível abrir a imagem');
          }
        },
      ),

      tool(
        'listar_pasta',
        'Lista o que existe numa pasta do projecto. Usa para veres se os ficheiros que pediste foram mesmo criados, e onde.',
        { caminho: z.string().optional().describe('Por omissão, a raiz do projecto.') },
        async ({ caminho }) => {
          try {
            const abs = resolveInProject(projectId, caminho || '.');
            const entries = fs.readdirSync(abs, { withFileTypes: true })
              .filter((e) => !e.name.startsWith('.') || e.name === '.env.example')
              .slice(0, 200)
              .map((e) => {
                if (e.isDirectory()) return `${e.name}/`;
                try {
                  const s = fs.statSync(path.join(abs, e.name));
                  const mins = Math.round((Date.now() - s.mtimeMs) / 60000);
                  // A idade é o que distingue "o worker acabou de criar isto" de "já cá estava".
                  const when = mins < 1 ? 'agora' : mins < 60 ? `há ${mins}min` : `há ${Math.round(mins / 60)}h`;
                  return `${e.name}  (${s.size} bytes, ${when})`;
                } catch { return e.name; }
              });
            note(`listou ${caminho || 'a raiz'}`);
            return ok(entries.length ? entries.join('\n') : '(pasta vazia)');
          } catch (e) {
            return fail(e instanceof Error ? e.message : 'não foi possível listar');
          }
        },
      ),

      tool(
        'ver_pagina',
        'Abre uma página no browser e devolve-te o que aparece no ecrã. Usa para validares trabalho web (um site local, uma página que um worker mexeu). Se não houver browser instalado, diz-te como obter a imagem à mesma.',
        {
          url: z.string().describe('http://localhost:3000, https://exemplo.pt, …'),
          largura: z.number().optional().describe('Largura da janela (por omissão 1280). Usa 390 para ver como fica no telemóvel.'),
        },
        async ({ url, largura }) => {
          if (!/^https?:\/\//i.test(url)) return fail('o url tem de começar por http:// ou https://');
          const shot = path.join(os.tmpdir(), `joca-shot-${Date.now()}.png`);
          const width = Math.max(320, Math.min(largura ?? 1280, 2560));
          try {
            // execFile (não shell) com argumentos separados: o url nunca é interpretado por uma
            // shell, portanto não há injecção possível através dele.
            await new Promise<void>((resolve, reject) => {
              const child = execFile(
                'npx',
                ['--yes', 'playwright', 'screenshot', `--viewport-size=${width},900`, '--wait-for-timeout=2000', url, shot],
                { timeout: 60_000 },
                (err) => (err ? reject(err) : resolve()),
              );
              child.on('error', reject);
            });
            const buf = fs.readFileSync(shot);
            fs.rmSync(shot, { force: true });
            note(`viu a página ${url}`);
            return { content: [{ type: 'image' as const, data: buf.toString('base64'), mimeType: 'image/png' }] };
          } catch (e) {
            fs.rmSync(shot, { force: true });
            // Sem browser na máquina o caminho não fica fechado: o worker tem shell e pode tirar o
            // screenshot, e depois o gestor abre-o com ver_imagem.
            return fail(
              `não consegui abrir o browser (${e instanceof Error ? e.message.slice(0, 120) : 'erro'}).\n`
              + `Alternativa: manda um worker tirar o screenshot — trabalhar(area: "testes", instrucao: `
              + `"tira um screenshot de ${url} para screenshot.png na raiz do projecto") — e depois usa ver_imagem("screenshot.png").`,
            );
          }
        },
      ),

      tool(
        'estado_tarefa',
        'Vê uma tarefa em detalhe: descrição, estado da última execução e as notas (do utilizador, dos workers e do juiz).',
        { id: z.string() },
        async ({ id }) => {
          const mine = loadTasks().filter((t) => t.projectId === projectId);
          const task = mine.find((t) => t.id === id) ?? mine.find((t) => t.id.startsWith(id));
          if (!task) return fail('tarefa não encontrada neste projecto');
          const full = getTask(task.id)!;
          const lines = [
            `# ${full.title}`,
            `coluna: ${full.status}${full.lastStatus ? ` · última execução: ${full.lastStatus}` : ''}`,
            full.description ? `\n${full.description}` : '',
            full.result ? `\n[veredicto] ${full.result}` : '',
          ];
          if (full.comments?.length) {
            lines.push('\n## Notas');
            for (const c of full.comments.slice(-15)) {
              lines.push(`- [${c.author}${c.authorName ? `/${c.authorName}` : ''}] ${c.text}`);
            }
          }
          return ok(lines.filter(Boolean).join('\n'));
        },
      ),
    ],
  });
}
