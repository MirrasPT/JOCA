// Worker pool — one long-lived terminal per AREA of a project.
//
// The manager does not open a terminal per job. It asks for the worker of an area ("design",
// "backend", "conteúdo", …) and that terminal is reused for every job in that area. Two reasons:
//   • it is the natural guard against two agents editing the same files — different areas touch
//     different parts of the project, and the same area is serialised by construction;
//   • a reused worker keeps its context (it already ran /resume and knows the project), so the
//     second job in an area starts far cheaper than the first.
//
// The pool lives in memory: sessions themselves are already in-memory in the SessionManager, so
// persisting the mapping would only create a source of stale ids. It is rebuilt lazily from the
// session names (see adopt()) if the backend restarts while terminals are alive.
import { sessionManager, MAX_SESSIONS } from '../session-manager';
import type { Session } from '../session-manager';
import { loadProjects, loadUiSettings } from '../project-store';

export interface PooledWorker {
  sessionId: string;
  projectId: string;
  area: string;                 // free-form, chosen by the manager ('design', 'backend', …)
  busy: boolean;                // a job is dispatched and not yet reported done
  lastUsedAt: number;
  currentJob?: string;          // short description of what it is doing (for the UI / manager)
  manager?: boolean;            // terminal do gestor (area 'gestor') — abre sozinho, mas fecha como os outros
}

// projectId → area → worker
const pool = new Map<string, Map<string, PooledWorker>>();

// Session name carries the area so the pool can be rebuilt after a backend restart.
const NAME_PREFIX = 'Worker';

// Um agente novo não sabe que tem colegas — sem isto, tudo o que cruza duas áreas volta ao gestor.
const PEER_NOTE = [
  '[Contexto do JOCA] Não estás sozinho neste projecto: há outros agentes, um por área.',
  'Vê quem está aberto com `joca sessions`, lê o que outro anda a fazer com `joca read <id>` e fala com ele com `joca send <id> "..."`.',
  'Usa isso quando o teu trabalho cruza com o dele (mesmos ficheiros, mesmo contrato, mesma decisão) — é mais rápido do que passar tudo pelo gestor.',
  '',
  '',
].join('\n');
export const workerName = (area: string) => `${NAME_PREFIX} ${area}`.slice(0, 80);

function areaMap(projectId: string): Map<string, PooledWorker> {
  let m = pool.get(projectId);
  if (!m) { m = new Map(); pool.set(projectId, m); }
  return m;
}

// Drop entries whose PTY is gone (user closed the terminal, process exited).
function prune(projectId: string): void {
  const m = pool.get(projectId);
  if (!m) return;
  for (const [area, w] of m) if (!sessionManager.get(w.sessionId)) m.delete(area);
}

// Re-attach to terminals that already exist for this project (backend restarted, or the user
// reopened one). Matches on the "Worker <area>" naming convention.
function adopt(projectId: string): void {
  const m = areaMap(projectId);
  for (const s of sessionManager.list()) {
    if (s.projectId !== projectId || s.origin !== 'auto') continue;
    if (!s.name.startsWith(`${NAME_PREFIX} `)) continue;
    const area = s.name.slice(NAME_PREFIX.length + 1).trim();
    if (!area || m.has(area)) continue;
    m.set(area, { sessionId: s.id, projectId, area, busy: false, lastUsedAt: Date.now(), manager: area === MANAGER_AREA });
  }
}

/**
 * Todos os workers de todos os projectos. Existe para a varredura de workers encalhados
 * (`wake.ts`), que precisa de olhar para o pool inteiro sem saber que projectos existem.
 */
export function listAllWorkers(): PooledWorker[] {
  const out: PooledWorker[] = [];
  for (const porArea of pool.values()) out.push(...porArea.values());
  return out;
}

export function listWorkers(projectId: string): PooledWorker[] {
  prune(projectId);
  adopt(projectId);
  return [...areaMap(projectId).values()].sort((a, b) => a.area.localeCompare(b.area));
}

export function getWorker(projectId: string, area: string): PooledWorker | undefined {
  prune(projectId);
  adopt(projectId);
  return areaMap(projectId).get(area.trim());
}

export function findBySession(sessionId: string): PooledWorker | undefined {
  for (const m of pool.values()) for (const w of m.values()) if (w.sessionId === sessionId) return w;
  return undefined;
}

export interface DispatchResult {
  ok: boolean;
  worker?: PooledWorker;
  reused?: boolean;
  error?: string;
}

// Send a job to an area's worker, creating the terminal on first use.
//
// The first message of a brand-new worker is `/resume "<pasta>"` followed by the instruction — the
// SessionManager already does exactly that when given resumePath + initialInput, waiting for the
// TUI to settle between the two. Subsequent jobs are submitMessage() into the same terminal.
export function dispatchToArea(
  projectId: string,
  area: string,
  instruction: string,
  opts: { cli?: string; model?: string } = {},
): DispatchResult {
  const baseArea = area.trim().slice(0, 40) || 'geral';
  // A área 'gestor' é a identidade do terminal do gestor — despacho normal de trabalho não pode
  // injectar tarefas lá nem marcá-lo busy (auditoria #3). Quem quer falar com o gestor usa o
  // próprio terminal dele (ou `joca chat`), não o dispatch de áreas.
  if (baseArea === MANAGER_AREA) {
    return { ok: false, error: `a área "${MANAGER_AREA}" é reservada ao terminal do gestor — usa outra área para trabalho` };
  }
  // O CLI faz parte da identidade da área. Sem isto, pedir `cli:"agy"` numa área que já tinha um
  // worker Claude reutilizava o terminal Claude e o pedido do gestor era ignorado em SILÊNCIO —
  // ele julgava-se a falar com o Gemini. Um CLI diferente é um worker diferente.
  // Comparado contra o CLI POR DEFEITO, não contra 'claude': com o default em codex, pedir
  // `cli:"claude"` também tem de abrir um worker próprio.
  const defaultCli = loadUiSettings().defaultCli?.trim() || 'claude';
  const requestedCli = opts.cli?.trim();
  const cleanArea = requestedCli && requestedCli !== defaultCli ? `${baseArea} (${requestedCli})` : baseArea;
  const project = loadProjects().find((p) => p.id === projectId);
  if (!project) return { ok: false, error: 'projecto não encontrado' };

  prune(projectId);
  adopt(projectId);
  const m = areaMap(projectId);
  const existing = m.get(cleanArea);

  if (existing) {
    if (existing.busy) {
      return { ok: false, error: `o worker de "${cleanArea}" ainda está a trabalhar em: ${existing.currentJob ?? 'trabalho anterior'}. Espera que termine, ou usa outra área.` };
    }
    if (!sessionManager.submitMessage(existing.sessionId, instruction)) {
      m.delete(cleanArea);
      return { ok: false, error: 'o terminal desse worker desapareceu — tenta outra vez para abrir um novo' };
    }
    existing.busy = true;
    existing.lastUsedAt = Date.now();
    existing.currentJob = instruction.slice(0, 200);
    return { ok: true, worker: existing, reused: true };
  }

  if (sessionManager.size >= MAX_SESSIONS) {
    return { ok: false, error: `limite de ${MAX_SESSIONS} terminais atingido — fecha algum worker antes de abrir outro` };
  }

  const session: Session = sessionManager.spawn({
    resumePath: project.path,
    projectId,
    sessionName: workerName(cleanArea),
    origin: 'auto',
    cli: opts.cli,
    model: opts.model,
    // Só no terminal NOVO: num reutilizado o agente já viu esta nota na primeira mensagem.
    initialInput: PEER_NOTE + instruction,
  });
  const worker: PooledWorker = {
    sessionId: session.id, projectId, area: cleanArea,
    busy: true, lastUsedAt: Date.now(), currentJob: instruction.slice(0, 200),
  };
  m.set(cleanArea, worker);
  return { ok: true, worker, reused: false };
}

export function markIdle(sessionId: string): PooledWorker | undefined {
  const w = findBySession(sessionId);
  if (!w) return undefined;
  w.busy = false;
  w.currentJob = undefined;
  w.lastUsedAt = Date.now();
  return w;
}

export function closeWorker(projectId: string, area: string): boolean {
  const w = areaMap(projectId).get(area.trim());
  if (!w) return false;
  sessionManager.kill(w.sessionId);
  areaMap(projectId).delete(area.trim());
  return true;
}

// Área do terminal do gestor de projecto — abre sozinho, mas fecha como qualquer outro.
const MANAGER_AREA = 'gestor';

// Projectos cujo gestor JÁ foi aberto neste processo. Sem isto, o utilizador fechava o terminal do
// gestor e a próxima chamada a ensureManagerSession reabria-o logo — "fechável" a fingir. Fechado
// fica fechado; volta a abrir num reinício do JOCA ou se o utilizador o abrir à mão.
const managerOpened = new Set<string>();

/**
 * Abre o terminal do gestor do projecto (PTY real, `/resume` sozinho) UMA vez por processo. É um
 * terminal normal — o utilizador pode fechá-lo, e fechado não renasce sozinho. Chamado no arranque
 * do backend (projectos existentes) e na criação de um projecto novo.
 */
export function ensureManagerSession(projectId: string): PooledWorker | null {
  prune(projectId);
  adopt(projectId);
  const m = areaMap(projectId);
  const existing = m.get(MANAGER_AREA);
  if (existing && sessionManager.get(existing.sessionId)) return existing;
  if (managerOpened.has(projectId)) return null; // já abriu (e foi fechado) — respeitar o fecho

  const project = loadProjects().find((p) => p.id === projectId);
  if (!project) throw new Error('projecto não encontrado');

  managerOpened.add(projectId);
  const session = sessionManager.spawn({
    resumePath: project.path,
    projectId,
    sessionName: workerName(MANAGER_AREA),
    origin: 'auto',
    // `origin:'auto'` só cola o `/resume` à frente do `initialInput` quando este não é vazio (ver
    // session-manager.ts spawn()) — por isso não pode ser ''. Não é uma "tarefa": é só o contexto
    // de que este terminal é o do gestor do projecto, não um agente a que se atribui trabalho.
    initialInput: 'Este é o terminal do gestor deste projecto — falas aqui directamente com o dono, não é trabalho para reportar a ninguém.',
  });
  const worker: PooledWorker = {
    sessionId: session.id, projectId, area: MANAGER_AREA,
    busy: false, lastUsedAt: Date.now(), manager: true,
  };
  m.set(MANAGER_AREA, worker);
  return worker;
}

export function forgetSession(sessionId: string): void {
  for (const m of pool.values()) {
    for (const [area, w] of m) if (w.sessionId === sessionId) m.delete(area);
  }
}
