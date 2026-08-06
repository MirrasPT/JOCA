// Tasks engine — v2 WORKER-SEQUENTIAL. The always-on backend pulls tasks from the 'a-executar'
// column and executes them in REAL Claude Code workers (PTYs, visible in the UI like any session).
//
// Invariants:
//   • ONE task worker per project (keyed by projectId; tasks without project share one generic
//     worker). Tasks of the same project NEVER run in parallel — they are injected SEQUENTIALLY
//     into that single worker, so two runs can't step on each other's files.
//   • The first task of a project spawns the worker with resumePath = the project folder: the
//     worker boots, runs `/resume "<pasta>"` to load the project context, and THEN receives the
//     task brief. Subsequent tasks reuse the same worker (submitMessage when it is idle).
//   • The worker STAYS OPEN after each task (and after the queue drains) so the user can inspect
//     or continue the work in the terminal.
//   • A silent SDK judge (direct LLM call, no tools — it cannot execute anything) reads the
//     terminal output when the worker settles and classifies the run: ok / error / question.
//     'question' = the worker is blocked waiting for the user (questionnaire, confirmation menu):
//     the engine notifies the user (task_question broadcast → toast + OS notification), leaves the
//     task 'em-execucao' and waits for the user to answer in the terminal before continuing.
//
// Column flow per task: 'a-executar' → 'em-execucao' (dispatch) → 'concluida' QUANDO O AGENTE a
// fechar (`joca done`). O motor nunca a move para 'concluida': ele não sabe se o trabalho ficou
// feito, só que o terminal se calou. 'arquivada' é sempre manual.
import { sessionManager, MAX_SESSIONS } from '../session-manager';
import { claudeProvider } from '../providers/provider';
import { loadProjects } from '../project-store';
import { broadcast } from '../ws/broadcast';
import { pushNotification } from '../notifications/store';
import { recordRun } from '../runs/store';
import {
  getTask, loadTasks, upsertTask, moveTask, notifyTasksChanged, setTasksRunner, addTaskComment, type Task,
} from './store';

// Sem constante de polling: a execução é sempre pedida (botão do dono, ou a fila a avançar).
const TASK_TIMEOUT_MS = 60 * 60_000;        // hard cap per dispatch (1h); the judge sees whatever is there
const ANSWER_TIMEOUT_MS = 24 * 60 * 60_000; // how long we wait for the user to answer a question (24h)
const NO_PROJECT_KEY = '';                  // queue key for tasks without a project

// One task worker per project. `busy` = a task is currently dispatched into it (the sequential lock).
interface ProjectWorker { sessionId: string; busy: boolean }
const workers = new Map<string, ProjectWorker>();
let started = false;

// Re-read the latest task, merge a patch, persist (atomic full-file rewrite via upsertTask). Re-reading
// first means a concurrent edit (title/skills) during a long run isn't clobbered. No-op if task gone.
function patchTask(id: string, patch: Partial<Task>): void {
  const latest = getTask(id);
  if (!latest) return;
  upsertTask({ ...latest, ...patch });
}

/**
 * O que o terminal recebe: o essencial da tarefa, e como fechá-la.
 *
 * As instruções da ponte `joca` estão aqui porque QUEM FECHA A TAREFA É O AGENTE — o motor deixou
 * de a mover para 'concluida' sozinho. Sem elas, o agente fazia o trabalho e a tarefa ficava presa
 * em "Em execução" para sempre. São três linhas, não o parágrafo que aqui esteve: o resto do
 * catálogo vive no `joca help`.
 */
function buildBrief(task: Task, projectName?: string): string {
  const linhas = [`[Tarefa] ${task.title}`];
  const objectivo = (task.description ?? '').trim();
  if (objectivo) linhas.push('', objectivo);
  if (projectName) linhas.push('', `Projecto: ${projectName}`);
  if (task.attachments?.length) linhas.push('', `Anexos: ${task.attachments.join(', ')}`);
  if (task.comments?.length) {
    const thread = task.comments.slice(-8)
      .map((c) => `- [${c.author}${c.authorName ? `/${c.authorName}` : ''}] ${c.text}`)
      .join('\n');
    linhas.push('', `Notas já nesta tarefa (lê antes de agir):\n${thread}`);
  }
  if (task.skills?.length) linhas.push('', `Usa estas skills do JOCA (lê-as antes de agir): ${task.skills.join(', ')}.`);
  if (task.requireConfirm) {
    linhas.push('', 'Antes de qualquer acção IRREVERSÍVEL (enviar, apagar, deploy, push, gastar dinheiro): prepara e pede confirmação. Não executes sem OK.');
  }
  linhas.push(
    '',
    '[Como fechar esta tarefa]',
    `Esta tarefa é a ${task.id}. Vê o quadro com \`node "$JOCA_CLI" tasks\` e o detalhe desta com \`node "$JOCA_CLI" task\`.`,
    `QUANDO ACABARES: \`node "$JOCA_CLI" done ${task.id} --note "o que fiz e como ficou"\` — deixa a tua nota e move a tarefa para "concluída". Ninguém a move por ti.`,
    `Se ficares bloqueado ou a tarefa não der para fazer, NÃO a feches: explica porquê com \`node "$JOCA_CLI" comment ${task.id} "..."\` e deixa-a onde está.`,
  );
  return linhas.join('\n');
}

/**
 * O que o terminal MOSTRA, a partir do que ele escreveu.
 *
 * Um TUI repinta o ecrã inteiro a cada frame e separa as linhas com `\r` — sem um único `\n` no
 * meio. Tirar o ANSI não chega: o buffer fica com o mesmo ecrã três, quatro vezes seguidas, mais
 * a barra de estado e o spinner. O juiz lia isso e concluía "encalhou" ou "só há métricas de
 * sistema", sobre trabalho que estava feito — foi assim que um "arroz" respondido em 2s foi dado
 * como erro.
 *
 * Aqui: `\r` conta como fim de linha (é o que o TUI quer dizer com ele), repintura consecutiva do
 * mesmo texto colapsa numa linha, e o mobiliário do CLI — separadores, prompt vazio, barra de
 * consumo, barra de permissões — sai. O que fica é o que um humano leria.
 */
const MOBILIARIO_DO_TUI = [
  /^[─━—\-_=]{3,}$/,                 // separadores horizontais
  /^❯\s*$/,                          // prompt à espera, sem nada escrito
  /^⏵⏵/,                             // "bypass permissions on (shift+tab to cycle)"
  /ctx\s+[█░▁▂▃▄▅▆▇]/,               // barra de contexto/consumo do rodapé
  /^\s*[✳✢✶✻✽·⋅]+\s*$/,             // frames soltos do spinner
];

export function ecraVisivel(bruto: string): string {
  const out: string[] = [];
  for (const crua of bruto.split(/\r\n|\n|\r/)) {
    const linha = crua.trim();
    if (!linha) continue;
    if (MOBILIARIO_DO_TUI.some((re) => re.test(linha))) continue;
    if (out[out.length - 1] === linha) continue;    // o mesmo ecrã repintado
    out.push(linha);
  }
  return out.join('\n');
}

// ── SDK judge — silent supervision layer (no chat, no tools) ────────────────
interface Verdict { state: 'ok' | 'error' | 'question'; summary: string; costUsd: number; fallback?: boolean }

// One judge attempt: returns null when the SDK call or the JSON parse fails.
async function judgeOnce(task: Task, tail: string): Promise<Verdict | null> {
  const systemPrompt = [
    'És um supervisor SILENCIOSO de tarefas num terminal Claude Code. Recebes o output final do terminal após o agente parar.',
    'Classifica o estado e responde APENAS com JSON válido, sem markdown, no formato:',
    '{"state":"ok"|"error"|"question","summary":"resumo curto em pt-pt (máx 2 frases)"}',
    'Critérios: "question" = o agente está PARADO à espera de resposta do utilizador (pergunta, menu de opções, pedido de confirmação por responder). "error" = a tarefa falhou ou ficou incompleta com erros. "ok" = a tarefa foi concluída.',
    'Em caso de dúvida entre ok e error, escolhe pelo que o resumo final do agente disser.',
    'O output vem de um terminal: pode trazer restos de indicadores de progresso ("a pensar…", contadores de tempo, pontinhos). Isso NÃO é sinal de que encalhou — o agente já parou quando isto te chega.',
    'Uma resposta CURTA pode estar perfeitamente certa: se a tarefa pedia uma palavra e o agente respondeu essa palavra, é "ok".',
  ].join(' ');
  const prompt = `Tarefa em execução: "${task.title}"\n\nOutput do terminal (final):\n"""\n${tail}\n"""`;
  let acc = '', result = '', costUsd = 0;
  for await (const ev of claudeProvider.run(prompt, { systemPrompt, model: 'haiku', noTools: true })) {
    if (ev.type === 'text' && ev.text) acc += ev.text;
    else if (ev.type === 'result') { result = ev.text; costUsd = ev.costUsd; }
  }
  const raw = (result || acc).trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]) as { state?: string; summary?: string };
  if (parsed.state === 'ok' || parsed.state === 'error' || parsed.state === 'question') {
    return { state: parsed.state, summary: (parsed.summary ?? '').slice(0, 500), costUsd };
  }
  return null;
}

// Classify the worker's terminal output once it settles. Direct LLM call with tools disabled — it
// can only READ the transcript and answer JSON; it cannot execute anything. Retries once on
// failure; the final fallback is 'ok' with the raw tail (never blocks the queue on judge failure)
// but is FLAGGED (fallback:true + ⚠ prefix) so a judge outage is visible instead of a silent pass.
async function judge(task: Task, tail: string): Promise<Verdict> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const v = await judgeOnce(task, tail);
      if (v) return v;
    } catch (e) {
      console.error(`[tasks] judge error (tentativa ${attempt + 1}/2):`, e instanceof Error ? e.message : e);
    }
  }
  return { state: 'ok', summary: `⚠ juiz indisponível — assumido ok. ${tail.slice(-300).trim()}`.slice(0, 500), costUsd: 0, fallback: true };
}

// O mesmo juiz, exposto para qualquer worker (não só uma tarefa do quadro).
export function judgeWorkerOutput(label: string, tail: string): Promise<Verdict> {
  return judge({ title: label } as Task, tail);
}

// Wait for the user to answer a blocked worker: resolves when the worker completes its NEXT real
// work burst (the user's answer makes it work, then settle → status idle + isDone). 'closed' if the
// PTY exits, 'timeout' after ANSWER_TIMEOUT_MS.
function waitForUserAnswer(sessionId: string): Promise<'done' | 'closed' | 'timeout'> {
  return new Promise((resolve) => {
    if (!sessionManager.get(sessionId)) return resolve('closed');
    const cleanup = () => {
      clearTimeout(t);
      sessionManager.off('status', onStatus);
      sessionManager.off('closed', onClosed);
    };
    const onStatus = ({ sessionId: sid, status, isDone }: { sessionId: string; status: string; isDone?: boolean }) => {
      if (sid === sessionId && status === 'idle' && isDone) { cleanup(); resolve('done'); }
    };
    const onClosed = ({ sessionId: sid }: { sessionId: string }) => {
      if (sid === sessionId) { cleanup(); resolve('closed'); }
    };
    const t = setTimeout(() => { cleanup(); resolve('timeout'); }, ANSWER_TIMEOUT_MS);
    sessionManager.on('status', onStatus);
    sessionManager.on('closed', onClosed);
  });
}

// Execute ONE task in the project's worker, end-to-end. Assumes the caller holds the `busy` lock
// for this project key; always releases it. Long-running — callers must NOT block on it.
async function fire(key: string, id: string): Promise<void> {
  const task = getTask(id);
  const w = workers.get(key);
  if (!task || !w) { if (w) w.busy = false; return; }

  // → em-execucao (running)
  moveTask(id, 'em-execucao');
  patchTask(id, { lastStatus: 'running', sessionId: w.sessionId || undefined });
  notifyTasksChanged();

  const startedAt = Date.now();
  let judgeCostUsd = 0;
  let verdict: Verdict;
  try {
    let sessionId = w.sessionId;
    if (!sessionId) {
      // First task of this project → spawn ITS single task worker. resumePath makes the worker run
      // `/resume "<pasta do projecto>"` on boot (loads project context) and only then receive the
      // task brief — the "/resume + pasta + tarefa" startup. The FIRST task's cli/model decide the
      // project worker's CLI; later tasks reuse whatever worker is already open.
      const proj = task.projectId ? loadProjects().find((p) => p.id === task.projectId) : undefined;
      const session = sessionManager.spawn({
        resumePath: proj?.path,
        projectId: task.projectId,
        sessionName: (proj ? `Tarefas: ${proj.name}` : 'Tarefas').slice(0, 80),
        origin: 'auto',
        cli: task.cli,
        model: task.model,
        initialInput: buildBrief(task, proj?.name),
      });
      sessionId = session.id;
      w.sessionId = sessionId;
      patchTask(id, { sessionId });
    } else {
      // Reuse the project's worker: inject the next task as a new message.
      const proj = task.projectId ? loadProjects().find((p) => p.id === task.projectId) : undefined;
      if (!sessionManager.submitMessage(sessionId, buildBrief(task, proj?.name))) {
        throw new Error('o worker de tarefas deste projecto já não existe');
      }
    }

    // Await completion; re-judge after every user answer while the worker is blocked on questions.
    let outcome = await sessionManager.waitForDone(sessionId, TASK_TIMEOUT_MS);
    for (;;) {
      if (outcome === 'closed') { verdict = { state: 'error', summary: 'O worker foi fechado antes de a tarefa terminar.', costUsd: 0 }; break; }
      if (outcome === 'timeout') { verdict = { state: 'error', summary: `Sem resposta do worker dentro do limite — vê o terminal.`, costUsd: 0 }; break; }
      const tail = ecraVisivel(sessionManager.readBuffer(sessionId, { strip: true }) ?? '').slice(-6000);
      verdict = await judge(task, tail);
      judgeCostUsd += verdict.costUsd;
      if (verdict.state !== 'question') break;
      // Blocked on the user: notify (persistent inbox + WS), keep the task 'em-execucao', wait for
      // the answer in the terminal. The inbox entry survives a closed browser tab.
      pushNotification({
        kind: 'task_question', title: `⏸ ${task.title}`,
        text: verdict.summary || 'O worker está à espera de uma resposta tua no terminal.',
        // Nada avança até responderes — nunca agrupar nem enterrar entre os avisos informativos.
        priority: 'action',
        meta: { taskId: task.id, sessionId, projectId: task.projectId },
      });
      broadcast({ type: 'task_question', taskId: task.id, sessionId, title: task.title, summary: verdict.summary });
      patchTask(id, { result: `⏸ À espera de resposta no terminal: ${verdict.summary}` });
      notifyTasksChanged();
      outcome = await waitForUserAnswer(sessionId);
    }
  } catch (e) {
    verdict = { state: 'error', summary: e instanceof Error ? e.message : String(e), costUsd: 0 };
  }

  // O worker fica aberto (nunca se mata aqui) — o utilizador pode inspeccionar/continuar no
  // terminal.
  //
  // A TAREFA NÃO É MOVIDA AQUI. Quem a fecha é o AGENTE, com `joca done` (ver `buildBrief`): é ele
  // que sabe se o trabalho ficou mesmo feito. O juiz continua a correr, mas o veredicto dele é
  // informação — entra no `lastStatus` e na thread —, não uma decisão sobre a coluna. Uma tarefa
  // que o agente não feche fica em "Em execução", à vista, que é melhor do que ser dada por
  // concluída sem ninguém ter confirmado.
  patchTask(id, {
    lastStatus: verdict.state === 'ok' ? 'ok' : 'error',
    result: verdict.summary,
  });
  // O veredicto entra na thread — o quadro fica com o histórico legível de cada execução. Se o
  // agente já fechou a tarefa pelo caminho, esta nota junta-se à dele.
  addTaskComment(id, {
    author: 'judge',
    text: `${verdict.state === 'ok' ? '✓' : '✗'} ${verdict.summary}`,
  });
  recordRun({
    kind: 'task', refId: task.id, name: task.title, projectId: task.projectId,
    startedAt, endedAt: Date.now(),
    status: verdict.state === 'ok' ? 'ok' : 'error',
    summary: verdict.summary, costUsd: judgeCostUsd,
    cli: task.cli, model: task.model,
  });
  if (verdict.state !== 'ok') {
    // Falhas ficam na inbox persistente — sucesso já se vê no board.
    pushNotification({
      kind: 'system',
      title: `✗ Tarefa falhou: ${task.title}`,
      text: verdict.summary,
      priority: 'action',        // uma falha fica parada até decidires o que fazer com ela
      meta: { taskId: task.id, sessionId: w.sessionId || undefined, projectId: task.projectId },
      // Uma fila de tarefas que falha toda pelo MESMO motivo (CLI em baixo, projecto partido) é um
      // problema, não N. O motivo entra na chave: falhas diferentes continuam a ser notificações
      // diferentes, senão o agrupamento escondia a que era distinta.
      groupKey: `task-fail:${task.projectId ?? 'sem-projecto'}:${verdict.summary.slice(0, 40)}`,
    });
  }
  const cur = workers.get(key);
  if (cur) {
    if (!sessionManager.get(cur.sessionId)) workers.delete(key); // user closed the worker meanwhile
    else cur.busy = false;
  }
  notifyTasksChanged();

  // Acabou uma: pega na seguinte da MESMA fila. É o que torna a coluna 'a-executar' uma fila a
  // sério em vez de uma lista de espera — sempre em série, porque o `busy` acabou de ser
  // libertado e o `dispatchTask` volta a tomá-lo.
  dispararFila(task.projectId);
}

/**
 * Qual é a próxima a correr nesta fila.
 *
 * Pela `order` da coluna, não pela ordem do ficheiro: o quadro deixa reordenar dentro da coluna
 * (`reorderTasks`), e arrastar uma tarefa para o topo de "a-executar" tem de a fazer correr
 * primeiro. Com um `find()` simples ganhava a ordem do array persistido e o arrasto não valia nada.
 *
 * Pura e exportada para ser testável — é a regra que decide o que corre a seguir.
 */
export function proximaNaFila(tasks: Task[], key: string): Task | undefined {
  return tasks
    .filter((t) => t.status === 'a-executar' && (t.projectId ?? NO_PROJECT_KEY) === key)
    .sort((a, b) => a.order - b.order)[0];
}

/**
 * Arranca a PRIMEIRA tarefa em 'a-executar' de um projecto, se houver e se o terminal de tarefas
 * dele estiver livre.
 *
 * É o único disparo automático que existe: nada nasce por abrires a app ou um projecto — nasce por
 * pores trabalho na fila. Fechar o terminal de tarefas pára tudo até haver movimento novo no
 * quadro (o `dispatchTask` abre outro nessa altura, que é o que "registado até ser fechado"
 * significa na prática).
 *
 * Sem `projectId` (tarefas soltas) usa a fila genérica, que tem o mesmo lock.
 */
export function dispararFila(projectId?: string): void {
  const key = projectId ?? NO_PROJECT_KEY;
  const w = workers.get(key);
  if (w?.busy) return;                                    // já está a correr uma — a série manda
  const proxima = proximaNaFila(loadTasks(), key);
  if (proxima) dispatchTask(proxima.id);
}

// Start ONE task in its project's worker, applying the invariant guards. Chamado pelo botão
// "correr" e pelo `dispararFila` (a fila a andar sozinha). Não há retry automático: uma tarefa que
// falha fica falhada.
//
// UMA tarefa de cada vez por projecto: `workers` é um worker por projectId e o `busy` é o lock
// sequencial — um segundo dispatch no mesmo projecto é recusado enquanto o primeiro corre. O mesmo
// terminal serve todas as tarefas do projecto enquanto viver; fechado, o próximo dispatch abre
// outro.
//
// Devolve um motivo em vez de atirar, para quem chama poder dizer PORQUÊ nada aconteceu.
export function dispatchTask(id: string): { ok: boolean; reason?: string } {
  const task = getTask(id);
  if (!task) return { ok: false, reason: 'tarefa não encontrada' };
  if (task.status === 'em-execucao') return { ok: false, reason: 'já está a executar' };
  if (task.status === 'arquivada') return { ok: false, reason: 'está arquivada' };

  const key = task.projectId ?? NO_PROJECT_KEY;
  let w = workers.get(key);
  if (w && !sessionManager.get(w.sessionId)) { workers.delete(key); w = undefined; } // worker was closed
  if (w?.busy) return { ok: false, reason: 'o worker de tarefas deste projecto ainda está ocupado' };
  if (!w && sessionManager.size >= MAX_SESSIONS) {
    return { ok: false, reason: `limite de ${MAX_SESSIONS} terminais atingido` };
  }
  if (!w) { w = { sessionId: '', busy: true }; workers.set(key, w); }
  else w.busy = true;

  if (task.status !== 'a-executar') { moveTask(id, 'a-executar', 0); notifyTasksChanged(); }
  void fire(key, id);
  return { ok: true };
}

// Sem polling: a fila anda por eventos — uma tarefa que chega a 'a-executar' (camada HTTP) e uma
// tarefa que acaba (fim do `fire`). No arranque NÃO se drena nada: abrir o JOCA não é pôr trabalho
// na fila, e um relançamento não pode ressuscitar sozinho o que ficou de ontem.
export function startTasksEngine(): void {
  if (started) return;
  started = true;
  recuperarOrfas();
  console.log('[tasks] engine on (só correm por ordem tua, uma de cada vez por projecto)');
}

/**
 * Tarefas que ficaram em 'em-execucao' de um processo anterior.
 *
 * O lock (`workers`) vive em memória: se o backend cai — ou é reiniciado — a meio de uma tarefa, o
 * PTY morre com ele mas o disco continua a dizer 'em-execucao'. Ninguém lhe volta a tocar: o
 * `dispararFila` só olha para 'a-executar', e o agente que a fecharia já não existe. Ficava presa
 * para sempre, à espera de alguém dar por ela.
 *
 * Voltam para 'a-executar', com a razão escrita na thread. NÃO são disparadas aqui — arrancar
 * trabalho no arranque do JOCA é exactamente o que não queremos; ficam prontas, e correm quando o
 * quadro mexer ou carregares em "correr".
 */
function recuperarOrfas(): void {
  const orfas = loadTasks().filter((t) => t.status === 'em-execucao');
  if (!orfas.length) return;
  for (const t of orfas) {
    moveTask(t.id, 'a-executar', 0);
    patchTask(t.id, { lastStatus: null, result: undefined });
    addTaskComment(t.id, {
      author: 'system',
      text: 'O JOCA reiniciou enquanto esta tarefa corria — o terminal dela não sobreviveu. Devolvida a "A executar"; volta a correr quando quiseres.',
    });
  }
  console.log(`[tasks] ${orfas.length} tarefa(s) presas em execução devolvidas a "a-executar" (o processo anterior não as fechou)`);
  notifyTasksChanged();
}

// Manual "run now" — the button on a card. Same path as the manager's.
export async function runTaskNow(id: string): Promise<{ ok: boolean; reason?: string }> {
  // Devolve o veredicto em vez de o deitar fora: o `dispatchTask` recusa por motivos concretos
  // (worker ocupado, tarefa arquivada, limite de terminais) e a UI dizia "started" a todos eles.
  return dispatchTask(id);
}

// Wire the store's injectable runner so the HTTP route can trigger execution without importing this
// module's internals (matches automations/store setAutomationRunner pattern).
setTasksRunner(runTaskNow);
