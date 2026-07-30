// The manager's tools — in-process MCP, scoped to ONE project.
//
// Design rules learned from the Master that was removed:
//   • Few tools. The old one had 16 and the model lost the thread; this has 9, each mapping 1:1 to
//     a function that already exists elsewhere in the backend.
//   • NOTHING blocks. A tool that waits for a worker would freeze the chat — which is the exact
//     pain we are removing. Dispatch returns immediately; completion arrives later as a wake.
//   • The manager never touches the filesystem: the SDK is configured with tools:[] so it has no
//     Bash/Read/Write at all. Everything it can do is in this file.
import { z } from 'zod';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { sessionManager } from '../session-manager';
import { pushNotification } from '../notifications/store';
import {
  loadTasks, makeTask, upsertTask, moveTask, addTaskComment, getTask,
  TASK_STATUSES, type TaskStatus,
} from '../tasks/store';
import { dispatchTask } from '../tasks/engine';
import { dispatchToArea, listWorkers, getWorker, closeWorker } from './worker-pool';

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });
const fail = (text: string) => ({ content: [{ type: 'text' as const, text: `ERRO: ${text}` }], isError: true });

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
        'Envia uma notificação que chega ao utilizador mesmo com o JOCA fechado (inbox/telemóvel). Usa só para o que importa: trabalho concluído que ele espera, bloqueios, decisões que precisam dele. NÃO uses para progresso trivial — para isso basta responderes no chat.',
        { texto: z.string(), titulo: z.string().optional() },
        async ({ texto, titulo }) => {
          pushNotification({ kind: 'system', title: titulo?.slice(0, 120) || '📋 Gestor de projecto', text: texto });
          note('avisou o utilizador');
          return ok('Notificação enviada.');
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
