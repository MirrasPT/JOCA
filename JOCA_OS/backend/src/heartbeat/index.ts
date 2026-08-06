// Heartbeat — the proactivity loop (OpenClaw-inspired). On a configurable interval, inside active
// hours, JOCA wakes up, reads a user-maintained scratch checklist + a cheap deterministic snapshot
// of system state (blocked tasks, failed automations, unread inbox, managers and agents), and asks
// a cheap no-tools model whether anything deserves the user's attention. Protocol: the model
// answers HEARTBEAT_OK to stay silent (suppressed, costs one small call) or a short pt-PT message
// that lands in the persistent inbox as a 'heartbeat' notification.
//
// Cost guards: no LLM call at all when the scratch is empty AND the state snapshot has no
// anomalies; model defaults to haiku; noTools + maxTurns:1; runs are recorded in runs.jsonl with
// their measured SDK cost.
//
// É também aqui que vive o orçamento de auto-wake dos gestores (`maxAutoWakes`, consumido por
// `manager/wake.ts`). Fica no HeartbeatConfig de propósito: é a mesma definição — "quanta
// proactividade automática é que o JOCA tem direito a gastar sozinho" — e um 2º sistema de
// definições só para um número seria mais uma coisa a manter em sincronia.
import path from 'path';
import { DATA_DIR, loadProjects, readJsonFile, writeJsonFile } from '../project-store';
import { claudeProvider } from '../providers/provider';
import { pushNotification, unreadCount } from '../notifications/store';
import { recordRun } from '../runs/store';
import { loadTasks } from '../tasks/store';
import { dispatchTask } from '../tasks/engine';
import { loadAutomations } from '../automations/store';
import { listWorkers } from '../manager/worker-pool';
// Ciclo de import assumido: o `wake.ts` já importa `getMaxAutoWakes` daqui. Os dois lados só se
// usam DENTRO de funções (nunca no corpo do módulo), que é o que torna o ciclo inofensivo — em
// CJS as duas metades estão prontas muito antes do primeiro beat. Não mover nada para o topo.
import { ignorarProximoReporte } from '../manager/wake';
import { sessionManager } from '../session-manager';

export interface HeartbeatConfig {
  enabled: boolean;
  everyMinutes: number;                        // >= 5
  activeHours?: { start: string; end: string } | null; // "HH:MM" local; null/undefined = always
  model: string;                               // cheap by default
  scratch: string;                             // user checklist injected into every beat (markdown)
  // Wakes automáticos consecutivos que um gestor pode gastar sem o utilizador falar. É o travão
  // anti-loop de `manager/wake.ts` — configurável, nunca removível.
  maxAutoWakes: number;
  // Vigia activo: além de avisar o utilizador, o beat vai ele próprio cutucar o gestor sobre
  // agentes e tarefas paradas, e manda os agentes ociosos guardar o que sabem (`/save`).
  crewWatch: boolean;
  // Custo de UM turno de gestor acima do qual a sessão SDK é rodada (resumo → sessão nova). Vive
  // aqui pela mesma razão que o `maxAutoWakes`: é a mesma definição — quanto é que o JOCA pode
  // gastar sozinho antes de intervir — e um 2º sistema de definições só para um número seria mais
  // uma coisa a manter em sincronia.
  rotateSessionUsd: number;
  lastRunAt?: number | null;
  lastDecision?: 'ok' | 'alert' | 'skipped' | 'error' | null;
  lastText?: string;
}

const HEARTBEAT_FILE = path.join(DATA_DIR, 'heartbeat.json');
const CHECK_MS = 60_000;
const SCRATCH_MAX = 64_000;
const OK_TOKEN = 'HEARTBEAT_OK';
// OpenClaw semantics: the token counts as "all quiet" even with a little padding around it.
const OK_SLACK = 300;

// Ligado por omissão: o ciclo é o motor da proactividade, e desligado por omissão significava que
// ninguém vigiava nada até alguém descobrir a definição. O custo continua travado pelo mesmo guarda
// de sempre — sem checklist e sem anomalias, o beat NÃO chama o modelo (custo zero).
export const DEFAULT_HEARTBEAT: HeartbeatConfig = {
  enabled: true,
  everyMinutes: 30,
  activeHours: { start: '09:00', end: '22:00' },
  model: 'haiku',
  scratch: '',
  maxAutoWakes: 12,
  crewWatch: true,
  rotateSessionUsd: 1.5,
  lastRunAt: null,
  lastDecision: null,
};

// Limites do orçamento de auto-wake. O chão é 1 e não 0 de propósito: zero desligaria por completo
// o encadeamento agente→gestor, que é o mecanismo de que a proactividade toda depende.
export const MIN_AUTO_WAKES = 1;
export const MAX_AUTO_WAKES_CAP = 40;

export function clampMaxAutoWakes(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_HEARTBEAT.maxAutoWakes;
  return Math.max(MIN_AUTO_WAKES, Math.min(MAX_AUTO_WAKES_CAP, n));
}

/** Orçamento em vigor. Lido a cada drenagem em `manager/wake.ts` — mudar a definição actua já. */
export function getMaxAutoWakes(): number {
  return clampMaxAutoWakes(loadHeartbeatConfig().maxAutoWakes);
}

// Limites do limiar de rotação. O chão não é 0: a 0 rodava-se a sessão a cada turno e o gestor
// nunca teria conversa nenhuma — a rotação passaria de higiene a amnésia permanente.
export const MIN_ROTATE_USD = 0.2;
export const MAX_ROTATE_USD = 20;

export function clampRotateUsd(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_HEARTBEAT.rotateSessionUsd;
  return Math.max(MIN_ROTATE_USD, Math.min(MAX_ROTATE_USD, Math.round(n * 100) / 100));
}

/** Limiar em vigor. Lido no fim de cada turno de gestor — mudar a definição actua no turno seguinte. */
export function getRotateSessionUsd(): number {
  return clampRotateUsd(loadHeartbeatConfig().rotateSessionUsd);
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function loadHeartbeatConfig(): HeartbeatConfig {
  return { ...DEFAULT_HEARTBEAT, ...readJsonFile<Partial<HeartbeatConfig>>(HEARTBEAT_FILE, {}) };
}

export function saveHeartbeatConfig(cfg: HeartbeatConfig): void {
  writeJsonFile(HEARTBEAT_FILE, {
    ...cfg,
    scratch: (cfg.scratch ?? '').slice(0, SCRATCH_MAX),
    // Clamp na escrita, não só na leitura: o ficheiro é editável à mão e um 9999 aqui seria um
    // gestor sem travão nenhum.
    maxAutoWakes: clampMaxAutoWakes(cfg.maxAutoWakes),
    rotateSessionUsd: clampRotateUsd(cfg.rotateSessionUsd),
  });
}

function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Local-time window check. Supports overnight windows (e.g. 22:00 → 07:00).
export function withinActiveHours(cfg: HeartbeatConfig, now = new Date()): boolean {
  const ah = cfg.activeHours;
  if (!ah) return true;
  const start = parseHHMM(ah.start), end = parseHHMM(ah.end);
  if (start === null || end === null) return true;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

// Deterministic snapshot — cheap facts the beat can reason over. Anomalies decide whether the LLM
// call happens at all when the scratch is empty.
export function buildStateSnapshot(): { text: string; anomalies: number } {
  const lines: string[] = [];
  let anomalies = 0;

  const tasks = loadTasks();
  const blocked = tasks.filter((t) => t.status === 'em-execucao' && (t.result ?? '').startsWith('⏸'));
  const failed = tasks.filter((t) => t.status === 'concluida' && t.lastStatus === 'error');
  const queued = tasks.filter((t) => t.status === 'a-executar');
  if (blocked.length) { anomalies += blocked.length; lines.push(`Tarefas BLOQUEADAS à espera de resposta (${blocked.length}): ${blocked.map((t) => t.title).join(' · ')}`); }
  if (failed.length) { anomalies += failed.length; lines.push(`Tarefas concluídas COM ERRO (${failed.length}): ${failed.map((t) => t.title).join(' · ')}`); }
  if (queued.length) lines.push(`Tarefas na fila a-executar: ${queued.length}`);

  const autos = loadAutomations();
  const autoErr = autos.filter((a) => a.lastStatus === 'error');
  if (autoErr.length) { anomalies += autoErr.length; lines.push(`Automações com último run em ERRO (${autoErr.length}): ${autoErr.map((a) => a.name).join(' · ')}`); }

  const unread = unreadCount();
  if (unread > 0) lines.push(`Notificações por ler na inbox: ${unread}`);

  const crew = buildCrewSnapshot();
  lines.push(...crew.lines);
  anomalies += crew.anomalies;

  if (!lines.length) lines.push('Sem tarefas bloqueadas, sem erros, fila vazia.');
  return { text: lines.join('\n'), anomalies };
}

// Um agente que acabou há 5 minutos está a descansar; um que não mexe há quase uma hora é trabalho
// parado. Os limiares são generosos de propósito — apertá-los transforma o heartbeat num alarme
// que ninguém lê.
const IDLE_WORKER_MS = 45 * 60_000;

function minutosDesde(ts: number | undefined | null): number | null {
  if (!ts) return null;
  return Math.max(0, Math.round((Date.now() - ts) / 60_000));
}

/**
 * Retrato de quem está a trabalhar: gestores e agentes, projecto a projecto. Determinístico,
 * sem LLM.
 *
 * Regra das anomalias: só conta o que É anormal. "3 agentes a trabalhar" é o sistema saudável —
 * contá-lo como anomalia faria o heartbeat chamar o modelo em TODOS os beats de um dia produtivo,
 * que é exactamente a fuga de custo que o guarda existe para evitar.
 */
export function buildCrewSnapshot(): { lines: string[]; anomalies: number } {
  const lines: string[] = [];
  let anomalies = 0;

  let activos = 0;
  let parados = 0;

  for (const project of loadProjects()) {
    if (project.archived) continue;

    const workers = listWorkers(project.id).map((w) => ({
      ...w,
      // `busy` é a intenção de quem despachou trabalho; o status da sessão é o que o terminal está
      // mesmo a fazer. Divergem quando o worker acabou e ninguém deu por isso.
      status: sessionManager.get(w.sessionId)?.status ?? 'closed',
    }));
    if (workers.length === 0) continue;

    const aTrabalhar = workers.filter((w) => w.busy || w.status === 'working');
    const idle = workers.filter((w) => !w.busy && w.status !== 'working');
    activos += aTrabalhar.length;
    parados += idle.length;

    const partes: string[] = [];

    if (aTrabalhar.length) {
      partes.push(`a trabalhar: ${aTrabalhar.map((w) => `${w.area}${w.currentJob ? ` (${w.currentJob.slice(0, 60)})` : ''}`).join(', ')}`);
    }

    // Agentes parados há muito → há trabalho entregue que ninguém foi buscar.
    const idleVelhos = idle.filter((w) => Date.now() - w.lastUsedAt > IDLE_WORKER_MS);
    if (idleVelhos.length) {
      anomalies += 1;
      partes.push(`PARADOS há muito: ${idleVelhos.map((w) => `${w.area} (${minutosDesde(w.lastUsedAt)} min)`).join(', ')}`);
    } else if (idle.length) {
      partes.push(`parados: ${idle.map((w) => w.area).join(', ')}`);
    }

    if (partes.length) lines.push(`Projecto "${project.name}": ${partes.join(' · ')}`);
  }

  if (activos || parados) {
    lines.unshift(`Agentes abertos: ${activos} a trabalhar, ${parados} parados.`);
  }
  return { lines, anomalies };
}

// ── Vigia activo ─────────────────────────────────────────────────────────────
//
// O heartbeat deixa de ser só um vigia que te dá um toque: age sobre o que vê. Duas acções, ambas
// DETERMINÍSTICAS (sem modelo, custo zero) e ambas do tipo mais barato possível — cutucar quem já
// sabe decidir, em vez de decidir por ele:
//
//   • agentes parados há muito e tarefas encalhadas → uma MENSAGEM no terminal do gestor do
//     projecto (o canal actual — o chat SDK está desligado), para ele ir ver porquê. O gestor é
//     que tem contexto; o heartbeat não julga trabalho. Sem terminal de gestor aberto, o aviso
//     cai na inbox do dono.
//   • agentes parados → `/save`, para o que eles souberem ficar em memória antes de o terminal
//     morrer ou ser reutilizado noutra coisa.
//
// Porque é que isto não vira um ciclo: o re-aviso é limitado por impressão digital + REAVISO_MS
// (só insiste se a situação MUDOU ou passou tempo suficiente). E o `/save` é silenciado no
// reporte (senão cada arrumação gerava um "o worker acabou" sobre trabalho que ninguém deu).

// Tarefa parada na fila há mais de isto, sem ninguém lhe tocar, é uma tarefa esquecida.
const TAREFA_PARADA_MS = 2 * 60 * 60_000;
// Não repetir o mesmo aviso ao gestor antes disto, mesmo que a situação se mantenha. Um vigia que
// repete de 30 em 30 minutos deixa de ser lido, e gasta orçamento de wakes a dizer o mesmo.
const REAVISO_MS = 4 * 60 * 60_000;

// Em memória de propósito, como o travão de progresso do `wake.ts`: é uma medida de "desde que
// arranquei", e um reinício do backend é interrupção que chega para recomeçar a contar.
const ultimoAviso = new Map<string, { fp: string; ts: number }>();   // projectId → o que já avisei
const jaGuardou = new Map<string, number>();                          // sessionId → quando fez /save

/**
 * A decisão de re-avisar, isolada para ser testável: avisa se a situação MUDOU, ou se já passou
 * tempo suficiente para valer a pena insistir na mesma.
 */
export function deveAvisar(
  anterior: { fp: string; ts: number } | undefined,
  fp: string,
  agora: number,
): boolean {
  if (!anterior) return true;
  if (anterior.fp !== fp) return true;
  return agora - anterior.ts >= REAVISO_MS;
}

/** Uma passagem do vigia. Devolve o que fez, para o log e para a rota de teste manual. */
/**
 * Tarefas em 'a-executar' nunca arrancam sozinhas por definição do quadro — alguém tem de mandar
 * `dispatchTask`. Este é esse alguém, para quem ninguém carregou em "correr": corre na janela
 * normal do heartbeat (intervalo + `withinActiveHours`), e reaproveita as guardas do próprio
 * `dispatchTask` (recusa se o worker do projecto já está ocupado ou se o limite de terminais foi
 * atingido) — não precisa de lock novo. 'a-definir' fica de fora sempre: é sempre manual.
 */
function dispararTarefasEmFila(): string[] {
  const feito: string[] = [];
  const emFila = loadTasks().filter((t) => t.status === 'a-executar');
  for (const t of emFila) {
    const r = dispatchTask(t.id);
    if (r.ok) feito.push(`tarefa "${t.title}" disparada`);
  }
  return feito;
}

export function vigiarEquipa(agora = Date.now()): string[] {
  const feito: string[] = [];
  const tarefas = loadTasks();

  for (const project of loadProjects()) {
    if (project.archived) continue;

    const workers = listWorkers(project.id).map((w) => ({
      ...w,
      status: sessionManager.get(w.sessionId)?.status ?? 'closed',
      cli: sessionManager.get(w.sessionId)?.cli,
    }));
    const parados = workers.filter((w) => !w.busy && w.status !== 'working' && w.status !== 'closed');
    const paradosVelhos = parados.filter((w) => agora - w.lastUsedAt > IDLE_WORKER_MS);

    // 1) Agentes sem trabalho → guardar o que sabem. Uma vez por período de ócio: se o carimbo do
    // save é posterior ao último trabalho que lhe deram, já guardou desde então.
    for (const w of parados) {
      // `/save` é um comando do JOCA_Brain, que só o Claude Code entende. Mandá-lo a um codex ou a
      // um agy é escrever-lhes uma linha de lixo no prompt.
      if ((w.cli ?? 'claude') !== 'claude') continue;
      if ((jaGuardou.get(w.sessionId) ?? 0) >= w.lastUsedAt) continue;
      ignorarProximoReporte(w.sessionId);
      if (!sessionManager.submitMessage(w.sessionId, '/save')) continue;
      jaGuardou.set(w.sessionId, agora);
      feito.push(`/save → ${project.name}/${w.area}`);
    }

    // 2) Parados há muito + tarefas encalhadas → o gestor que vá ver porquê.
    const doProjecto = tarefas.filter((t) => t.projectId === project.id);
    const naFila = doProjecto.filter((t) => t.status === 'a-executar' && agora - t.updatedAt > TAREFA_PARADA_MS);
    const bloqueadas = doProjecto.filter((t) => t.status === 'em-execucao' && (t.result ?? '').startsWith('⏸'));
    if (!paradosVelhos.length && !naFila.length && !bloqueadas.length) continue;

    // A impressão digital é O QUE está parado, não quantos: se um agente diferente parar, é uma
    // situação nova e vale um aviso novo mesmo dentro da janela de silêncio.
    const fp = [
      paradosVelhos.map((w) => w.area).sort().join(','),
      naFila.map((t) => t.id).sort().join(','),
      bloqueadas.map((t) => t.id).sort().join(','),
    ].join('#');
    if (!deveAvisar(ultimoAviso.get(project.id), fp, agora)) continue;

    const linhas = [
      `[Vigia do JOCA — projecto "${project.name}"]`,
      paradosVelhos.length
        ? `Agentes parados há muito: ${paradosVelhos.map((w) => `${w.area} (${minutosDesde(w.lastUsedAt)} min)`).join(', ')}.`
        : '',
      naFila.length
        ? `Tarefas paradas na coluna "a-executar" há mais de ${Math.round(TAREFA_PARADA_MS / 3600_000)}h: ${naFila.map((t) => t.title).join(' · ')}.`
        : '',
      bloqueadas.length
        ? `Tarefas em execução à espera de resposta: ${bloqueadas.map((t) => t.title).join(' · ')}.`
        : '',
      '',
      'Vai ver o que se passa antes de assumir seja o que for: lê o terminal dos agentes parados'
      + ' (`joca sessions` + `joca read <id>`) e o quadro (`joca tasks`).',
      'Depois decide e age: levantar o que ficou feito, responder a quem está à espera, despachar a'
      + ' tarefa parada, ou fechar o agente que já não faz falta. Se for irreversível, pergunta ao dono.',
    ].filter(Boolean).join('\n');

    // O canal actual do gestor é o TERMINAL dele (o chat SDK está desligado): o aviso entra lá
    // como mensagem. Sem terminal de gestor aberto, o aviso vai para a inbox do dono.
    const gestor = workers.find((w) => w.area === 'gestor' && w.status !== 'closed');
    if (gestor && sessionManager.submitMessage(gestor.sessionId, linhas)) {
      feito.push(`aviso ao terminal do gestor de ${project.name}`);
    } else {
      pushNotification({
        kind: 'heartbeat', title: `Vigia: ${project.name}`, text: linhas,
        groupKey: `vigia:${project.id}`,
      });
      feito.push(`aviso na inbox (${project.name} sem terminal de gestor aberto)`);
    }
    ultimoAviso.set(project.id, { fp, ts: agora });
  }

  return feito;
}

export function isOkResponse(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  if (!t.includes(OK_TOKEN)) return false;
  return t.length <= OK_TOKEN.length + OK_SLACK && (t.startsWith(OK_TOKEN) || t.endsWith(OK_TOKEN));
}

// One beat, end-to-end. Exported for the manual "testar agora" route.
export async function runHeartbeat(opts: { force?: boolean } = {}): Promise<{ decision: 'ok' | 'alert' | 'skipped' | 'error'; text: string }> {
  const cfg = loadHeartbeatConfig();
  const startedAt = Date.now();
  // O vigia corre ANTES do guarda de custo, e sem modelo: agir sobre agentes e tarefas paradas não
  // depende de haver checklist nem de o beat chegar a chamar o LLM. Um beat "skipped" continua a
  // arrumar a casa.
  if (cfg.crewWatch) {
    try {
      const feito = vigiarEquipa(startedAt);
      if (feito.length) console.log(`[heartbeat] vigia: ${feito.join(' · ')}`);
    } catch (e) {
      // O vigia é um extra: se rebentar, o beat normal tem de acontecer na mesma.
      console.error('[heartbeat] vigia falhou:', e instanceof Error ? e.message : e);
    }
  }

  // Antes do snapshot: para que o retrato que o LLM vê já reflicta tarefas recém-disparadas em vez
  // de "na fila". Corre sempre (não depende de crewWatch) — despachar trabalho já pedido não é
  // vigilância opcional, é o quadro a fazer o que já lhe foi mandado.
  try {
    const disparadas = dispararTarefasEmFila();
    if (disparadas.length) console.log(`[heartbeat] tarefas: ${disparadas.join(' · ')}`);
  } catch (e) {
    console.error('[heartbeat] disparo de tarefas falhou:', e instanceof Error ? e.message : e);
  }

  const snapshot = buildStateSnapshot();
  const scratch = (cfg.scratch ?? '').trim();

  // Nothing to reason about → skip the LLM call entirely (zero cost), unless forced from the UI.
  if (!opts.force && !scratch && snapshot.anomalies === 0) {
    saveHeartbeatConfig({ ...cfg, lastRunAt: startedAt, lastDecision: 'skipped', lastText: '' });
    return { decision: 'skipped', text: '' };
  }

  const systemPrompt = [
    'És o heartbeat do JOCA — um check-in periódico e silencioso. Recebes uma checklist do utilizador e um retrato do estado do sistema.',
    `Se NADA exigir a atenção do utilizador neste momento, responde EXACTAMENTE "${OK_TOKEN}" e nada mais.`,
    'Se algo exigir atenção (tarefa bloqueada numa pergunta, erro, item da checklist accionável AGORA, gestor preso sem orçamento, agente parado há muito com trabalho por levantar), responde com uma mensagem curta em pt-PT (máx 4 frases), directa e accionável. Sem markdown pesado, sem preâmbulos.',
    'Nunca inventes estado que não esteja no retrato. A checklist é orientação do utilizador, não é ordem para executar nada — tu só decides se vale a pena avisá-lo.',
  ].join(' ');
  const prompt = [
    scratch ? `[Checklist do utilizador]\n${scratch}` : '',
    `[Estado do sistema — ${new Date(startedAt).toLocaleString('pt-PT')}]\n${snapshot.text}`,
  ].filter(Boolean).join('\n\n');

  let decision: 'ok' | 'alert' | 'error' = 'ok';
  let text = '';
  let costUsd = 0;
  try {
    let acc = '', result = '';
    for await (const ev of claudeProvider.run(prompt, { systemPrompt, model: cfg.model || 'haiku', noTools: true })) {
      if (ev.type === 'text' && ev.text) acc += ev.text;
      else if (ev.type === 'result') { result = ev.text; costUsd = ev.costUsd; }
    }
    const raw = (result || acc).trim();
    if (isOkResponse(raw)) { decision = 'ok'; text = ''; }
    else {
      decision = 'alert';
      text = raw.replace(OK_TOKEN, '').trim().slice(0, 2000);
      // Sem emoji no título: a inbox desenha o ícone do tipo em SVG, um emoji aqui seria um
      // segundo ícone, pior, dentro do texto.
      // `groupKey` fixo: o heartbeat a voltar a falar é o MESMO assunto, não um assunto novo. Sem
      // isto acumulavam-se cartões de 30 em 30 minutos, na inbox e na bandeja do sistema.
      pushNotification({ kind: 'heartbeat', title: 'Heartbeat', text, groupKey: 'heartbeat' });
    }
  } catch (e) {
    decision = 'error';
    text = e instanceof Error ? e.message : String(e);
    console.error('[heartbeat] beat failed:', text);
  }

  const endedAt = Date.now();
  recordRun({
    kind: 'heartbeat', refId: 'heartbeat', name: 'Heartbeat',
    startedAt, endedAt, status: decision === 'error' ? 'error' : 'ok',
    summary: decision === 'ok' ? OK_TOKEN : text, costUsd, model: cfg.model || 'haiku',
  });
  saveHeartbeatConfig({ ...loadHeartbeatConfig(), lastRunAt: endedAt, lastDecision: decision, lastText: text });
  return { decision, text };
}

export function startHeartbeat(): void {
  if (timer) return;
  timer = setInterval(() => {
    const cfg = loadHeartbeatConfig();
    if (!cfg.enabled || running) return;
    if (!withinActiveHours(cfg)) return;
    const every = Math.max(5, Math.floor(cfg.everyMinutes || 30)) * 60_000;
    if (cfg.lastRunAt && Date.now() - cfg.lastRunAt < every) return;
    running = true;
    runHeartbeat().catch((e) => console.error('[heartbeat] error:', e)).finally(() => { running = false; });
  }, CHECK_MS);
  console.log('[heartbeat] loop on (check 60s)');
}
