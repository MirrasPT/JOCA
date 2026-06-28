// MasterTools — Fase 1a control plane. PROVIDER-NEUTRAL orchestration registry: the tool defs
// (spawn_worker, send_to_worker, read_worker, list_workers, create_project, search_memory,
// read_diary) are described once via buildMasterToolDefs(ctx) and exposed to ANY brain:
//   - Claude Agent SDK  -> createMasterToolsServer() maps the defs through tool()+createSdkMcpServer.
//   - Ollama / OpenAI / Gemini function-calling -> consume def.jsonSchema + def.handler directly.
// Each verb executes against the REAL SessionManager singleton — the same instance the existing
// UI/WS use, so workers are visible in the terminal UI (the chosen MVP path: PTY-visible workers
// the human can watch / take over).
//
// Verified against @anthropic-ai/claude-agent-sdk@0.3.185:
//   tool(name, description, zodRawShape, handler): handler returns a CallToolResult
//     ({ content: [{ type: 'text', text }] }).
//   createSdkMcpServer({ name, version?, tools? }).
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { ZodRawShape } from 'zod';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import type { SessionManager } from '../session-manager';
import { buildWorkerBrief, makeDoneMatcher } from './worker-brief';
import { loadProjects, saveProjects, loadProjectMemory, saveProjectMemory } from '../project-store';
import type { Project } from '../project-store';
import { safePath } from '../security-fs';
import { searchLongMemory, readDiary } from './master-memory';
import { makeAutomation, upsertAutomation, loadAutomations, notifyAutomationsChanged, runAutomationByRef, type Schedule } from '../automations/store';
import { makeTask, upsertTask, loadTasks, moveTask, notifyTasksChanged, triggerTaskRun, type TaskStatus } from '../tasks/store';
import type { MasterProvider } from '../project-store';

export interface MasterToolsOptions {
  onProjectsChanged?: () => void; // called after create_project so the WS layer refreshes the UI
}

const ANSI_TAIL = 4000; // how much trailing plain-text buffer to hand back to the brain

interface WorkerMeta { nonce: string; donePattern: RegExp; objective: string }

// SHARED across all Master runs (module singleton). Each user message starts a fresh runMaster ->
// a fresh MasterTools server; a per-instance registry would forget workers between messages, so the
// Master would never see (and thus always re-open) terminals. Keying by SessionManager session id
// (= workerId) and persisting here lets the Master reuse idle workers across messages.
const workerRegistry = new Map<string, WorkerMeta>();
let cleanupHooked = false;

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Detect an interactive selection/confirmation prompt sitting in a worker's (stripped) buffer tail.
// Conservative on purpose: a Claude Code TUI ALWAYS shows the "❯" input caret, so the bare caret is
// NOT a signal (would false-positive on every idle worker). Real menus show ≥2 numbered options, or
// an explicit yes/no / "use arrow keys" phrasing. This is only a HINT — the brain still reads the menu.
const PROMPT_TAIL = 1800;
function detectSelectionPrompt(stripped: string): boolean {
  const tail = stripped.slice(-PROMPT_TAIL);
  if (/\(y\/n\)|\by\/n\b/i.test(tail)) return true;
  if (/Do you want to (proceed|continue|create|trust|make)/i.test(tail)) return true;
  if (/Use arrow keys|press (enter|return) to (select|confirm)/i.test(tail)) return true;
  const nums = tail.match(/(?:^|\n)\s*❯?\s*[1-9][.)]\s+\S/g);
  return !!nums && nums.length >= 2;
}

// Map a key token to the raw bytes a PTY expects. Lets the brain drive a TUI menu it can SEE via
// read_worker (numbered options, arrow-key lists, y/n). Sent through sm.input (raw keystroke path).
function mapKey(token: string): string | null {
  const t = token.toLowerCase();
  if (/^[1-9]$/.test(t)) return t;
  switch (t) {
    case 'enter': case 'return': return '\r';
    case 'up': return '\x1b[A';
    case 'down': return '\x1b[B';
    case 'right': return '\x1b[C';
    case 'left': return '\x1b[D';
    case 'esc': case 'escape': return '\x1b';
    case 'tab': return '\t';
    case 'space': return ' ';
    case 'y': return 'y';
    case 'n': return 'n';
    default: return null;
  }
}

// Context handed to every tool handler — keeps handler bodies behaving exactly as before.
export interface MasterToolsCtx {
  sm: SessionManager;
  opts: MasterToolsOptions;
  workers: Map<string, WorkerMeta>;
}

// Provider-neutral tool definition. zodShape feeds the Claude SDK tool(); jsonSchema feeds
// function-calling brains (Ollama/OpenAI/Gemini); handler is shared and returns a plain string.
export interface MasterToolDef {
  name: string;
  description: string;
  jsonSchema: Record<string, unknown>;
  zodShape: ZodRawShape;
  handler: (args: any) => Promise<string>;
}

// Ensure the registry is pruned when a PTY closes, so list/read never point at dead sessions.
// Idempotent across calls (module-level `cleanupHooked`).
function ensureCleanupHook(sm: SessionManager) {
  if (!cleanupHooked) {
    sm.on('closed', ({ sessionId }: { sessionId: string }) => workerRegistry.delete(sessionId));
    cleanupHooked = true;
  }
}

// Neutral registry of the orchestration verbs. Handlers carry the SAME logic and return the SAME
// strings as before — only the wrapper around them changed (return string, not CallToolResult).
export function buildMasterToolDefs(ctx: MasterToolsCtx): MasterToolDef[] {
  const { sm, opts, workers } = ctx;

  return [
    {
      name: 'spawn_worker',
      description: 'Abre 1 worker Claude Code NOVO e da-lhe um objectivo. PREFERE reutilizar um worker idle existente (ver list_workers + send_to_worker) — so abre novo se nenhum servir. Devolve o workerId. O brief canonico (anti-fabricacao, Step 0 Read skills, sentinela de fim com nonce) e montado automaticamente.',
      zodShape: {
        objective: z.string().describe('Objectivo do worker, 1-2 frases'),
        projectId: z.string().optional().describe('id do projecto JOCA, se aplicavel'),
        cwd: z.string().optional().describe('directorio de trabalho, se nao usar projectId'),
        constraints: z.string().optional(),
        doNot: z.string().optional(),
        skills: z.array(z.string()).optional().describe('skills que o worker deve Read() antes de agir'),
      },
      jsonSchema: {
        type: 'object',
        properties: {
          objective: { type: 'string', description: 'Objectivo do worker, 1-2 frases' },
          projectId: { type: 'string', description: 'id do projecto JOCA, se aplicavel' },
          cwd: { type: 'string', description: 'directorio de trabalho, se nao usar projectId' },
          constraints: { type: 'string' },
          doNot: { type: 'string' },
          skills: { type: 'array', items: { type: 'string' }, description: 'skills que o worker deve Read() antes de agir' },
        },
        required: ['objective'],
      },
      handler: async (args) => {
        // Resolve a JOCA projectId to its real path: the worker then runs IN the project folder
        // (cwd) and /resume's its context — same as the UI's "open project". Never fabricate a path.
        let cwd = args.cwd;
        let resumePath: string | undefined;
        if (args.projectId) {
          const project = loadProjects().find((p) => p.id === args.projectId);
          if (!project) {
            const list = loadProjects().map((p) => `${p.id} (${p.name})`).join(', ') || '(nenhum)';
            return `erro: projectId "${args.projectId}" nao existe. Projectos validos: ${list}`;
          }
          cwd = project.path;
          resumePath = project.path;
        }

        const brief = buildWorkerBrief({
          objective: args.objective,
          projectPath: cwd,
          constraints: args.constraints,
          doNot: args.doNot,
          skills: args.skills,
        });
        const session = sm.spawn({
          projectId: args.projectId,
          cwd,
          resumePath,
          sessionName: `worker: ${args.objective.slice(0, 40)}`,
          initialInput: brief.text,
        });
        workers.set(session.id, { nonce: brief.nonce, donePattern: brief.donePattern, objective: args.objective });
        const where = resumePath ? ` no projecto (${cwd})` : cwd ? ` em ${cwd}` : '';
        return `workerId=${session.id}\nO worker foi aberto${where} e o brief enviado. Le o output com read_worker quando quiseres acompanhar; ele imprime <<<JOCA_DONE:${brief.nonce}>>> quando terminar.`;
      },
    },
    {
      name: 'send_to_worker',
      description: 'Envia uma instrucao (texto) a um worker/terminal JA aberto. Usa para seguimentos E para REUTILIZAR um worker idle com uma nova tarefa — nesse caso poe armDone=true para re-armar a sentinela de fim (assim read_worker volta a detectar done).',
      zodShape: { workerId: z.string(), text: z.string(), armDone: z.boolean().optional().describe('true ao dar um NOVO objectivo a um worker reutilizado — re-arma a sentinela de fim') },
      jsonSchema: {
        type: 'object',
        properties: {
          workerId: { type: 'string' },
          text: { type: 'string' },
          armDone: { type: 'boolean', description: 'true ao dar um NOVO objectivo a um worker reutilizado — re-arma a sentinela de fim' },
        },
        required: ['workerId', 'text'],
      },
      handler: async (args) => {
        const exists = sm.get(args.workerId);
        if (!exists) return `erro: worker ${args.workerId} nao existe`;
        let text = args.text;
        if (args.armDone) {
          const nonce = randomUUID().slice(0, 8);
          workers.set(args.workerId, { nonce, donePattern: makeDoneMatcher(nonce), objective: args.text.slice(0, 40) });
          text = `${args.text}\n\nQUANDO TERMINARES a tarefa por completo, imprime numa linha SOZINHA, exactamente: <<<JOCA_DONE:${nonce}>>>`;
        }
        // submitMessage uses bracketed-paste + delayed CR so multi-line text is entered whole and
        // submitted once (raw newlines would submit only the first line into the Claude TUI).
        sm.submitMessage(args.workerId, text);
        return 'enviado (submit com bracketed-paste). CONFIRMA com read_worker que o worker recebeu e comecou a agir; se o texto ficou por enviar no input, reenvia.';
      },
    },
    {
      name: 'read_worker',
      description: 'Le o output recente (texto limpo) de um worker/terminal e diz o estado (working/idle) e se ja terminou (sentinela detectada).',
      zodShape: { workerId: z.string() },
      jsonSchema: {
        type: 'object',
        properties: { workerId: { type: 'string' } },
        required: ['workerId'],
      },
      handler: async (args) => {
        const buf = sm.readBuffer(args.workerId, { strip: true });
        if (buf === undefined) return `erro: worker ${args.workerId} nao existe`;
        const session = sm.get(args.workerId);
        const status = session ? sm.info(session).status : 'idle';
        const meta = workers.get(args.workerId);
        const pattern = meta?.donePattern ?? makeDoneMatcher('________');
        const done = pattern.test(buf);
        const awaitingChoice = !done && detectSelectionPrompt(buf);
        const tail = buf.slice(-ANSI_TAIL);
        const hint = awaitingChoice
          ? '\n⚠ MENU DE SELECCAO detectado — o worker esta a ESPERAR uma escolha e NAO avanca sozinho. Le as opcoes no tail. Se a escolha for reversivel e clara, escolhe a melhor com select_in_worker. Se for irreversivel ou ambigua, PERGUNTA ao Renato qual e espera a resposta dele antes de escolher.'
          : '';
        return `status=${status} done=${done} awaitingChoice=${awaitingChoice}${hint}\n--- output (tail) ---\n${tail}`;
      },
    },
    {
      name: 'select_in_worker',
      description: 'Responde a um MENU/PROMPT de seleccao que esta a prender um worker (ex.: opcoes numeradas 1./2./3., (y/n), listas de setas, prompts de permissao do Claude Code). Manda as teclas para o terminal. keys = tokens separados por espaco: digitos 1-9, enter, up, down, left, right, y, n, esc, tab, space. Tipicamente o numero da opcao + enter (ex.: keys="2 enter") ou navegacao (keys="down down enter"). Usa SO depois de read_worker mostrar awaitingChoice=true e de leres as opcoes. Confirma com read_worker que o menu fechou.',
      zodShape: { workerId: z.string(), keys: z.string().describe('teclas separadas por espaco, ex. "2 enter" ou "down enter"') },
      jsonSchema: {
        type: 'object',
        properties: {
          workerId: { type: 'string' },
          keys: { type: 'string', description: 'teclas separadas por espaco, ex. "2 enter" ou "down enter"' },
        },
        required: ['workerId', 'keys'],
      },
      handler: async (args) => {
        if (!sm.get(args.workerId)) return `erro: worker ${args.workerId} nao existe`;
        const tokens = String(args.keys ?? '').trim().split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return 'erro: keys vazio. Ex.: keys="2 enter" ou keys="down down enter".';
        const bytes: string[] = [];
        for (const t of tokens) {
          const b = mapKey(t);
          if (b === null) return `erro: tecla "${t}" desconhecida. Validas: 1-9, enter, up, down, left, right, y, n, esc, tab, space.`;
          bytes.push(b);
        }
        // Send sequentially with a small gap so the TUI registers each keystroke (a number then enter
        // sent in the same tick can be dropped). sm.input is the raw-keystroke path (no bracketed paste).
        for (let i = 0; i < bytes.length; i++) {
          sm.input(args.workerId, bytes[i]);
          if (i < bytes.length - 1) await sleep(140);
        }
        return `enviado: ${tokens.join(' ')}. CONFIRMA com read_worker que o menu fechou e o worker retomou; se ainda awaitingChoice=true, le de novo as opcoes (a navegacao pode precisar de mais teclas).`;
      },
    },
    {
      name: 'list_workers',
      description: 'Lista TODOS os terminais abertos (workers do Master E terminais que o utilizador abriu na UI), com estado, projecto e cwd. Usa ANTES de spawn_worker para reutilizar um idle adequado em vez de abrir novo.',
      zodShape: {},
      jsonSchema: { type: 'object', properties: {} },
      handler: async () => {
        const infos = sm.listInfo();
        if (infos.length === 0) return 'sem terminais abertos';
        const lines = infos.map((s) => {
          const kind = workers.has(s.id) ? 'worker' : 'terminal-do-utilizador';
          const proj = s.projectId ? ` projectId=${s.projectId}` : '';
          return `${s.id} [${s.status}] (${kind}) "${s.name}"${proj} cwd=${s.cwd}`;
        });
        return lines.join('\n');
      },
    },
    {
      name: 'create_project',
      description: 'Cria/regista um projecto no JOCA UI (passa a aparecer na barra lateral). O path tem de estar dentro das raizes permitidas (home + raizes extra). Por omissao o path tem de existir; passa createDir=true para criar a pasta. Devolve o projectId — depois abre workers nele com spawn_worker(projectId).',
      zodShape: {
        name: z.string().describe('Nome do projecto'),
        path: z.string().describe('Caminho da pasta do projecto'),
        color: z.string().optional().describe('cor hex opcional, ex #ff4500'),
        createDir: z.boolean().optional().describe('true para criar a pasta se ainda nao existir'),
      },
      jsonSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do projecto' },
          path: { type: 'string', description: 'Caminho da pasta do projecto' },
          color: { type: 'string', description: 'cor hex opcional, ex #ff4500' },
          createDir: { type: 'boolean', description: 'true para criar a pasta se ainda nao existir' },
        },
        required: ['name', 'path'],
      },
      handler: async (args) => {
        let resolved: string;
        try { resolved = safePath(args.path); }
        catch { return 'erro: path fora das raizes permitidas (tem de estar dentro da home ou raizes extra). NAO inventes outro path — pede o caminho ao utilizador.'; }
        if (!fs.existsSync(resolved)) {
          if (!args.createDir) return `erro: a pasta "${resolved}" nao existe. Para a criar, chama de novo com createDir=true.`;
          try { fs.mkdirSync(resolved, { recursive: true }); }
          catch (e) { return `erro a criar a pasta: ${e instanceof Error ? e.message : String(e)}`; }
        } else if (!fs.statSync(resolved).isDirectory()) {
          return `erro: "${resolved}" existe mas nao e uma pasta.`;
        }
        const projects = loadProjects();
        const dup = projects.find((p) => p.path === resolved);
        if (dup) return `projecto ja existe: projectId=${dup.id} ("${dup.name}"). Reutiliza esse id.`;
        const project: Project = {
          id: randomUUID(),
          name: (args.name?.trim() || path.basename(resolved) || resolved).slice(0, 120),
          path: resolved,
          color: args.color?.trim().slice(0, 50) || undefined,
        };
        projects.push(project);
        saveProjects(projects);
        const memory = loadProjectMemory();
        memory[project.id] = {
          projectId: project.id, color: project.color, path: project.path,
          recentSessions: [], favoriteSkills: [], favoriteAgents: [],
          quickCommands: ['save', 'compact', 'clear'], openFiles: [], rightPanel: 'files',
          updatedAt: new Date().toISOString(),
        };
        saveProjectMemory(memory);
        opts.onProjectsChanged?.();
        return `projecto criado: projectId=${project.id} name="${project.name}" path=${project.path}. Abre workers nele com spawn_worker(projectId=${project.id}).`;
      },
    },
    {
      name: 'search_memory',
      description: 'Pesquisa a memoria longa (resumos de janelas antigas da conversa) por palavras-chave. Usa para responder a perguntas sobre conversas/decisoes antigas que ja sairam da memoria recente. Devolve as janelas mais relevantes com id, titulo, tags e resumo; depois usa read_diary(id) se precisares do detalhe exacto.',
      zodShape: { query: z.string().describe('termos a procurar — projecto, tema, decisao') },
      jsonSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'termos a procurar — projecto, tema, decisao' } },
        required: ['query'],
      },
      handler: async (args) => {
        const hits = searchLongMemory(args.query);
        if (hits.length === 0) return 'sem resultados na memoria longa (ou ainda nao ha janelas arquivadas).';
        return hits.map((h) => `id=${h.id} | ${h.title} | tags: ${h.tags.join(', ')}\n${h.summary}`).join('\n\n---\n\n');
      },
    },
    {
      name: 'read_diary',
      description: 'Le a conversa COMPLETA (verbatim) de uma janela arquivada, pelo id devolvido por search_memory. Usa so quando precisas do detalhe exacto que o resumo nao da.',
      zodShape: { id: z.string().describe('id da janela, ex win-8') },
      jsonSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'id da janela, ex win-8' } },
        required: ['id'],
      },
      handler: async (args) => {
        const diary = readDiary(args.id);
        if (diary === null) return `erro: janela "${args.id}" nao existe no diario.`;
        return `--- diario ${args.id} ---\n${diary}`;
      },
    },
    {
      name: 'create_automation',
      description: 'Cria uma automação no JOCA UI (aparece em Automações). Uma automação = um objectivo em linguagem natural que um agente corre num horário. Usa quando o Renato pede "cria uma automação que todos os dias às 9h..." ou similar. O agente (provider) que a executa default = o Master actual; podes escolher claude/codex/ollama. O resultado é entregue no chat do Master.',
      zodShape: {
        name: z.string().describe('Nome curto da automação, ex: "Resumo Matinal"'),
        objective: z.string().describe('O que a automação faz, em linguagem natural (ex: "lê os meus emails não lidos com o gws e faz um resumo curto")'),
        frequency: z.enum(['manual', 'daily', 'weekly', 'interval']).optional().describe('manual=só correr à mão; daily/weekly precisam de time; interval precisa de everyMinutes. Default daily.'),
        time: z.string().optional().describe('hora "HH:MM" para daily/weekly (ex: "09:00")'),
        weekday: z.number().optional().describe('dia da semana para weekly: 0=Domingo … 6=Sábado'),
        everyMinutes: z.number().optional().describe('para frequency=interval: de quantos em quantos minutos'),
        provider: z.enum(['claude', 'codex', 'ollama']).optional().describe('agente que executa; default = o Master actual'),
        model: z.string().optional().describe('modelo (só claude): sonnet/opus/haiku'),
        skills: z.array(z.string()).optional().describe('skills/agentes do JOCA_Brain a usar (ex: ["img-gen"]) — o agente faz Read antes de agir'),
        requireConfirm: z.boolean().optional().describe('true para PARAR antes de acções irreversíveis (enviar email, apagar, deploy) e pedir OK ao Renato — usa em acções de envio'),
        input: z.string().optional().describe('para frequency=manual (uma ACÇÃO): o objectivo pode ter {{input}}; este texto preenche-o quando a corres já. Deixa vazio para só criar.'),
      },
      jsonSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome curto da automação' },
          objective: { type: 'string', description: 'O que a automação faz, em linguagem natural (pode ter {{input}})' },
          frequency: { type: 'string', enum: ['manual', 'daily', 'weekly', 'interval'], description: 'Default daily; manual = acção (corre à mão, com input)' },
          time: { type: 'string', description: 'hora "HH:MM" para daily/weekly' },
          weekday: { type: 'number', description: 'weekly: 0=Domingo … 6=Sábado' },
          everyMinutes: { type: 'number', description: 'interval: de quantos em quantos minutos' },
          provider: { type: 'string', enum: ['claude', 'codex', 'ollama'], description: 'agente que executa' },
          model: { type: 'string', description: 'modelo (só claude)' },
          skills: { type: 'array', items: { type: 'string' }, description: 'skills/agentes do JOCA a usar' },
          requireConfirm: { type: 'boolean', description: 'parar antes de acções irreversíveis e pedir OK' },
        },
        required: ['name', 'objective'],
      },
      handler: async (args) => {
        const freq: string = args.frequency ?? 'daily';
        let schedule: Schedule | undefined;
        let triggerType: 'schedule' | 'manual' = 'schedule';
        if (freq === 'manual') { triggerType = 'manual'; }
        else if (freq === 'interval') { schedule = { kind: 'interval', everyMinutes: Math.max(1, Math.floor(args.everyMinutes ?? 60)) }; }
        else if (freq === 'weekly') { schedule = { kind: 'weekly', time: args.time ?? '09:00', weekday: ((args.weekday ?? 1) % 7 + 7) % 7 }; }
        else { schedule = { kind: 'daily', time: args.time ?? '09:00' }; }

        const a = makeAutomation({
          name: args.name,
          enabled: true,
          provider: args.provider as MasterProvider | undefined,
          model: typeof args.model === 'string' && args.model.trim() ? args.model.trim() : undefined,
          skills: Array.isArray(args.skills) ? args.skills : undefined,
          requireConfirm: args.requireConfirm === true || undefined,
          trigger: { type: triggerType, schedule },
          nodes: [
            { id: '', type: 'master', objective: args.objective },
            { id: '', type: 'message', text: '{{input}}', title: args.name },
          ],
        });
        upsertAutomation(a);
        notifyAutomationsChanged();
        const when = a.trigger.type === 'manual' ? 'manual/acção (corre à mão)'
          : a.nextRunAt ? `próxima execução ${new Date(a.nextRunAt).toLocaleString('pt-PT')}` : 'agendada';
        // If it's a manual action AND an input was given, run it now too.
        let ran = '';
        if (a.trigger.type === 'manual' && typeof args.input === 'string' && args.input.trim()) {
          const r = await runAutomationByRef(a.id, args.input);
          ran = r ? `\nCorri-a já com o input dado → ${r.ok ? 'ok' : 'erro'}: ${(r.finalOutput || '').slice(0, 400)}` : '';
        }
        return `automação criada: id=${a.id} name="${a.name}" agente=${a.provider ?? 'default'} — ${when}. Aparece já no painel Automações.${ran}`;
      },
    },
    {
      name: 'run_automation',
      description: 'Corre AGORA uma automação/acção existente (por id ou nome). Para ACÇÕES (trigger manual) passa o input — preenche o {{input}} do objectivo (ex.: acção "Email formal" + input "reunião passou para as 11h"). Usa quando o Renato pede para correr uma acção/automação já criada.',
      zodShape: { ref: z.string().describe('id ou nome da automação/acção'), input: z.string().optional().describe('input para acções (preenche {{input}})') },
      jsonSchema: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'id ou nome da automação/acção' },
          input: { type: 'string', description: 'input para acções (preenche {{input}})' },
        },
        required: ['ref'],
      },
      handler: async (args) => {
        const r = await runAutomationByRef(args.ref, args.input);
        if (!r) return `erro: não consegui correr "${args.ref}" (runner não disponível).`;
        return `${r.ok ? 'ok' : 'erro'}: ${(r.finalOutput || '').slice(0, 1200)}`;
      },
    },
    {
      name: 'list_automations',
      description: 'Lista as automações existentes no JOCA UI (nome, horário, agente, estado). Usa para evitar duplicados antes de create_automation, ou quando o Renato pergunta que automações tem.',
      zodShape: {},
      jsonSchema: { type: 'object', properties: {} },
      handler: async () => {
        const list = loadAutomations();
        if (list.length === 0) return 'sem automações criadas.';
        return list.map((a) => {
          const s = a.trigger.schedule;
          const when = a.trigger.type === 'manual' ? 'manual'
            : s?.kind === 'daily' ? `diária ${s.time}`
            : s?.kind === 'weekly' ? `semanal d${s.weekday} ${s.time}`
            : s?.kind === 'interval' ? `cada ${s.everyMinutes}min` : 'agendada';
          return `${a.id} | "${a.name}" | ${when} | agente=${a.provider ?? 'default'} | ${a.enabled ? 'on' : 'off'} | último=${a.lastStatus ?? '—'}`;
        }).join('\n');
      },
    },
    {
      name: 'create_task',
      description: 'Cria uma tarefa no quadro Kanban do JOCA UI (separador Tarefas). Uma tarefa = um objectivo em linguagem natural que o Master executa quando estiver na coluna "A Executar" (puxa automaticamente). Usa quando o Renato pede "adiciona uma tarefa para...", "mete no quadro...", "tenho de fazer X". Por defeito fica em "A Definir" (rascunho); passa status="a-executar" para o pôr já na fila de execução.',
      zodShape: {
        title: z.string().describe('Título curto da tarefa'),
        description: z.string().optional().describe('O objectivo em linguagem natural (o que o worker deve fazer). Default = o título.'),
        status: z.enum(['a-definir', 'a-executar', 'em-execucao', 'concluida', 'arquivada']).optional().describe('Coluna inicial. Default "a-definir". Usa "a-executar" para o Master começar já.'),
        projectId: z.string().optional().describe('id do projecto a que a tarefa pertence (define o contexto/cwd)'),
        provider: z.enum(['claude', 'codex', 'ollama']).optional().describe('agente que a executa; default = o Master actual'),
        model: z.string().optional().describe('modelo (só claude): sonnet/opus/haiku'),
        skills: z.array(z.string()).optional().describe('skills/agentes do JOCA_Brain a usar (o worker faz Read antes de agir)'),
        requireConfirm: z.boolean().optional().describe('true para PARAR antes de acções irreversíveis e pedir OK ao Renato'),
      },
      jsonSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título curto da tarefa' },
          description: { type: 'string', description: 'Objectivo em linguagem natural (default = título)' },
          status: { type: 'string', enum: ['a-definir', 'a-executar', 'em-execucao', 'concluida', 'arquivada'], description: 'Coluna inicial; default "a-definir"' },
          projectId: { type: 'string', description: 'id do projecto' },
          provider: { type: 'string', enum: ['claude', 'codex', 'ollama'], description: 'agente que executa' },
          model: { type: 'string', description: 'modelo (só claude)' },
          skills: { type: 'array', items: { type: 'string' }, description: 'skills/agentes do JOCA a usar' },
          requireConfirm: { type: 'boolean', description: 'parar antes de acções irreversíveis' },
        },
        required: ['title'],
      },
      handler: async (args) => {
        const t = makeTask({
          title: args.title,
          description: typeof args.description === 'string' && args.description.trim() ? args.description.trim() : undefined,
          status: (args.status as TaskStatus | undefined),
          projectId: typeof args.projectId === 'string' ? args.projectId : undefined,
          provider: args.provider as MasterProvider | undefined,
          model: typeof args.model === 'string' && args.model.trim() ? args.model.trim() : undefined,
          skills: Array.isArray(args.skills) ? args.skills : undefined,
          requireConfirm: args.requireConfirm === true || undefined,
        });
        upsertTask(t);
        notifyTasksChanged();
        const queued = t.status === 'a-executar' ? ' — está na fila "A Executar", o Master vai puxá-la.' : ' — em "A Definir".';
        return `tarefa criada: id=${t.id} "${t.title}"${queued} Aparece no separador Tarefas.`;
      },
    },
    {
      name: 'move_task',
      description: 'Move uma tarefa para outra coluna do Kanban (por id). Usa "a-executar" para o Master começar a executá-la, "arquivada" para a arrumar. Colunas: a-definir, a-executar, em-execucao, concluida, arquivada.',
      zodShape: {
        id: z.string().describe('id da tarefa'),
        status: z.enum(['a-definir', 'a-executar', 'em-execucao', 'concluida', 'arquivada']).describe('coluna de destino'),
      },
      jsonSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'id da tarefa' },
          status: { type: 'string', enum: ['a-definir', 'a-executar', 'em-execucao', 'concluida', 'arquivada'], description: 'coluna de destino' },
        },
        required: ['id', 'status'],
      },
      handler: async (args) => {
        const moved = moveTask(args.id, args.status as TaskStatus);
        if (!moved) return `erro: tarefa ${args.id} não encontrada.`;
        notifyTasksChanged();
        if (moved.status === 'a-executar') { try { await triggerTaskRun(moved.id); } catch { /* engine offline */ } }
        return `tarefa "${moved.title}" movida para ${moved.status}.`;
      },
    },
    {
      name: 'list_tasks',
      description: 'Lista as tarefas do quadro Kanban (id, título, coluna, estado). Usa para evitar duplicados antes de create_task, ou quando o Renato pergunta que tarefas tem.',
      zodShape: {},
      jsonSchema: { type: 'object', properties: {} },
      handler: async () => {
        const list = loadTasks();
        if (list.length === 0) return 'sem tarefas no quadro.';
        return list.map((t) => `${t.id} | "${t.title}" | ${t.status} | último=${t.lastStatus ?? '—'}`).join('\n');
      },
    },
  ];
}

export function createMasterToolsServer(sm: SessionManager, opts: MasterToolsOptions = {}) {
  // Drop registry entries when their PTY closes, so list/read never point at dead sessions.
  ensureCleanupHook(sm);
  const workers = workerRegistry;

  // Build the SDK tools from the neutral defs: each def.handler returns a string, which we wrap in
  // the CallToolResult shape the SDK expects. Byte-for-byte equivalent to the previous tool() calls.
  const defs = buildMasterToolDefs({ sm, opts, workers });
  const tools = defs.map((def) =>
    tool(def.name, def.description, def.zodShape, async (args: any) => ok(await def.handler(args))),
  );

  const server = createSdkMcpServer({
    name: 'master',
    version: '0.1.0',
    tools,
  });

  return { server, workers };
}
