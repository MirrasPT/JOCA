// SessionManager: owns the lifecycle of N Claude Code PTYs. Encapsulates the sessions Map,
// spawn/input/resize/kill, the rolling output buffer, and the idle→done heuristic. All timings
// and constants are IDENTICAL to the original god-file (BUFFER_MAX, IDLE_DEBOUNCE_MS,
// DONE_MIN_WORK_MS, MAX_SESSIONS). Shared state lives in the single exported `sessionManager`
// singleton — server.ts, the automations runner and the tasks engine all talk to that instance.
//
// Eventing: extends EventEmitter and emits:
//   'spawn'  { session }                     — session created (forwarded as 'session_created'); the
//                                              SINGLE broadcast source for both UI- and auto-spawned PTYs
//   'output' { sessionId, data }            — every PTY chunk (server forwards to WS as 'output')
//   'status' { sessionId, status, isDone }   — working↔idle transitions (forwarded as 'session_status')
//   'closed' { sessionId, finalOutput }      — PTY exit (forwarded as 'session_closed'). `finalOutput`
//                                              é o buffer final já sem ANSI: quem ouvir isto não o
//                                              consegue ir buscar depois, porque a sessão já saiu do mapa.
//   'done'   { sessionId }                   — ADDITIVE: fired once when a programmatically dispatched
//                                              work burst ends; automations/tasks await this.
// The existing WS flows are unchanged — the additive API (spawn/input/readBuffer/kill/resize +
// the 'done' subscription) does not alter any pre-existing behavior.
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import * as pty from 'node-pty';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { PATH_SAFE, safePath } from './security-fs';
import { JOCA_LOGIC_ROOT } from './toolkit-registry';
import { loadProjectMemory, saveProjectMemory, loadUiSettings } from './project-store';
import { getCliProfile, buildLaunchLine, type CliId } from './cli-profiles';
import { jocaAgentEnv } from './agent-bridge';

export interface Session {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  origin: 'user' | 'auto';   // who spawned it: 'user' (UI) or 'auto' (automations/tasks worker)
  cli: CliId;                // which coding CLI runs inside the PTY (claude | codex | agy | opencode)
  // Área do gestor a que este terminal pertence, quando foi ele que o abriu. É a IDENTIDADE do
  // worker (é por aqui que o gestor lhe fala), e vive à parte do `name` de propósito: o `name` é o
  // rótulo que o dono edita na interface, e renomear não pode mudar com quem o gestor está a falar.
  area?: string;
  pty: pty.IPty;
  buffer: string;
  status: 'working' | 'idle';
  lastOutputTime: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
  workingSince: number | null;
  notifyOnIdle: boolean;    // any work burst was initiated (user OR programmatic) → drives isDone (toast/unread)
  awaitingDone: boolean;    // a PROGRAMMATIC dispatch (submitMessage / initial brief) → drives 'done' (wakes
                            // the awaiting runner). User keystrokes set notifyOnIdle but NOT this.
  writeQueue: WriteJob[];   // paced-write queue (see chunkText) — serialises concurrent submits
  writeTimer: ReturnType<typeof setTimeout> | null;
  writing: boolean;
}

interface WriteJob { payload: string; submit: boolean }

export interface SessionInfo {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  origin: 'user' | 'auto';
  cli: CliId;
  area?: string;
  status: 'working' | 'idle';
}

export interface SpawnOptions {
  cwd?: string;
  resumePath?: string;
  sessionName?: string;
  projectId?: string;
  initialInput?: string;
  origin?: 'user' | 'auto';   // default 'user'
  cli?: string;               // 'claude' (default) | 'codex' | 'agy' | 'opencode'
  model?: string;             // passed to the CLI's model flag when the profile has one
  area?: string;              // preenchido pelo pool do gestor — ver `Session.area`
}

const IS_WINDOWS = process.platform === 'win32';
const SHELL = IS_WINDOWS
  ? 'powershell.exe'
  : (process.env.SHELL || '/bin/zsh');
// Rolling per-session output buffer. 5 MB × 30 sessions was 150 MB of live strings and a real
// cause of the "JOCA gets slow after a while" reports; 1.5 MB still covers a long scrollback for
// the judge/tail readers (which only ever look at the last few KB).
const BUFFER_MAX = 1_500_000;
const IDLE_DEBOUNCE_MS = 1500;
const DONE_MIN_WORK_MS = 2000;
export const MAX_SESSIONS = 30;

function ensureNodePtyHelpersExecutable() {
  const prebuildsDir = path.resolve(__dirname, '../node_modules/node-pty/prebuilds');
  try {
    if (!fs.existsSync(prebuildsDir)) return;
    for (const platformDir of fs.readdirSync(prebuildsDir)) {
      const helperPath = path.join(prebuildsDir, platformDir, 'spawn-helper');
      if (fs.existsSync(helperPath) && !IS_WINDOWS) fs.chmodSync(helperPath, 0o755);
    }
  } catch (e) {
    console.warn('Could not chmod node-pty spawn-helper:', e);
  }
}

// PATH lookup with cache — one execSync per distinct binary, reused across spawns.
const binCache = new Map<string, string>();
function findBin(bin: string): string {
  const cached = binCache.get(bin);
  if (cached) return cached;
  const cmd = IS_WINDOWS ? `where.exe ${bin}` : `which ${bin}`;
  let resolved = bin;
  try { resolved = execSync(cmd, { encoding: 'utf8' }).trim().split(/\r?\n/)[0] || bin; } catch { /* keep name */ }
  binCache.set(bin, resolved);
  return resolved;
}

// CSI/OSC/SGR escape stripper for readBuffer({ strip: true }) — leaves plain text for programmatic readers.
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;

/**
 * Esta rajada trouxe alguma coisa VISÍVEL, ou é só o terminal a pintar-se?
 *
 * Tirando as sequências de escape e os caracteres de controlo, o que sobra é o que um humano leria.
 * Se não sobra nada, ninguém escreveu nada: foi cursor, cor, limpar linha, mudar de posição.
 *
 * Exportada para ser testável — é uma decisão que afecta TODO o sistema de estados (o `done`, o
 * juiz, o que a UI mostra), e uma regressão aqui é silenciosa.
 */
/**
 * O CLI está a pedir para confiar nesta pasta?
 *
 * Duas armadilhas, ambas pagas em campo:
 *
 * 1. **Cada CLI escreve o pedido à sua maneira.** O Claude diz "Do you trust the files in this
 *    folder?", o codex diz "Do you trust the contents of this directory?". A versão anterior só
 *    conhecia a do Claude — e um worker codex ficava parado no diálogo para sempre, com o JOCA a
 *    reportá-lo como `idle`, isto é, livre.
 * 2. **O texto do TUI não tem espaços.** Estas interfaces posicionam cada palavra com movimentos
 *    de cursor em vez de escreverem espaços, portanto o buffer sem ANSI lê-se
 *    `Doyoutrustthecontentsofthisdirectory`. Qualquer padrão com espaços falha. Daí normalizar
 *    para só letras antes de comparar.
 *
 * Em ambos os CLIs o Enter aceita a opção segura por omissão (Claude: confiar; codex: "1. Yes,
 * continue" já seleccionada, "Press enter to continue"). São pastas que o dono abriu de propósito.
 */
export function pedeConfiancaNaPasta(buffer: string): boolean {
  const t = buffer.replace(ANSI_RE, '').toLowerCase().replace(/[^a-z]/g, '');
  return t.includes('doyoutrustthefiles')
    || t.includes('doyoutrustthecontents')
    || t.includes('trustthefilesinthisfolder')
    || t.includes('trustthecontentsofthisdirectory');
}

/**
 * O CLI está a oferecer-se para se ACTUALIZAR? Nunca se aceita a meio de um arranque.
 *
 * Não é pedantismo: no codex a opção por omissão é "Update now", e aceitá-la corre um
 * `npm install -g` e mata a sessão a seguir ("Please restart Codex"). Uma actualização é uma
 * decisão do dono, num momento escolhido por ele — não um efeito secundário de despachar trabalho.
 * Mesma normalização sem espaços de `pedeConfiancaNaPasta`, e pela mesma razão.
 */
export function ofereceActualizacao(buffer: string): boolean {
  const t = buffer.replace(ANSI_RE, '').toLowerCase().replace(/[^a-z]/g, '');
  return t.includes('updateavailable') || t.includes('updatenowruns') || t.includes('anewversionisavailable');
}

export function temConteudoVisivel(chunk: string): boolean {
  // \r e \b são movimento (voltar ao início da linha, apagar atrás), não conteúdo.
  return chunk.replace(ANSI_RE, '').replace(/[\x00-\x08\x0b-\x1f\x7f\r]/g, '').trim().length > 0;
}

// Paced writes into a CLI TUI over a PTY. Three separate problems, one mechanism:
//   1. A multi-line message written raw makes the TUI submit early on the first embedded '\n'
//      (only the first line lands) → wrap multi-line bodies in bracketed-paste (ESC[200~ … ESC[201~)
//      so newlines are literal.
//   2. A single big write OVERFLOWS the pty line-discipline buffer (a few KB) and the excess is
//      dropped SILENTLY — this is the "long message arrives truncated" bug → write in small chunks
//      with a gap so the TUI's reader drains between them.
//   3. A CR sent too soon after a paste is swallowed → delay the submit CR, scaled with payload size.
// Writes are queued per session so two rapid messages can never interleave their chunks.
const CHUNK_SIZE = 800;        // chars per write — comfortably under the line-discipline buffer
const CHUNK_DELAY_MS = 12;     // gap between chunks
const CR_BASE_DELAY_MS = 200;  // floor for the submit CR (unchanged for short messages)
const CR_PER_KB_MS = 70;       // extra settle time per KB pasted
const CR_MAX_DELAY_MS = 4000;

// Split without ever cutting a surrogate pair in half — an emoji written as two separate writes
// reaches the TUI as two invalid code units.
export function chunkText(text: string, size = CHUNK_SIZE): string[] {
  if (text.length <= size) return [text];
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + size, text.length);
    if (end < text.length) {
      const code = text.charCodeAt(end - 1);
      if (code >= 0xd800 && code <= 0xdbff) end--; // high surrogate would be orphaned
    }
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
}

export function submitCrDelay(payloadLength: number): number {
  return Math.min(CR_MAX_DELAY_MS, CR_BASE_DELAY_MS + Math.floor(payloadLength / 1024) * CR_PER_KB_MS);
}


/**
 * Escrita num PTY que pode já ter morrido.
 *
 * Um worker que arranca mal (CLI em falta, pasta sem permissões, `claude` a sair logo) deixa o PTY
 * fechado, e escrever nele lança `EPIPE`. Quando essa escrita está dentro de um `setTimeout` ou de
 * um `async` sem `catch`, o erro sobe como excepção não-apanhada e o Node mata o PROCESSO — ou
 * seja: um terminal morto derrubava o backend todo, com todas as outras sessões e o gestor atrás.
 * Devolve `false` em vez de rebentar; quem escreve decide o que fazer.
 */
function safePtyWrite(pty: { write(d: string): void }, data: string): boolean {
  try { pty.write(data); return true; } catch { return false; }
}

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, Session>();
  private sessionCounter = 0;
  readonly shell = SHELL;
  readonly claudeBin: string;

  constructor() {
    super();
    ensureNodePtyHelpersExecutable();
    this.claudeBin = findBin('claude');
  }

  get size() { return this.sessions.size; }

  list(): Session[] { return [...this.sessions.values()]; }

  get(id: string): Session | undefined { return this.sessions.get(id); }

  info(s: Session): SessionInfo {
    return { id: s.id, name: s.name, cwd: s.cwd, projectId: s.projectId, origin: s.origin, cli: s.cli, area: s.area, status: s.status };
  }

  listInfo(): SessionInfo[] { return this.list().map((s) => this.info(s)); }

  spawn(opts: SpawnOptions = {}): Session {
    const { resumePath, sessionName, projectId, initialInput } = opts;
    const origin = opts.origin ?? 'user';
    // Explicit cli wins; otherwise the user's configured default (Settings → CLI por defeito).
    const profile = getCliProfile(opts.cli ?? loadUiSettings().defaultCli);

    // Resolve the resume folder once. TODOS os CLIs arrancam DENTRO do JOCA_Brain (cwd) — é lá que
    // vivem as skills/regras que os tornam úteis — e recebem a pasta do projecto pelo comando de
    // resume do perfil: `/resume "<pasta>"` no Claude Code, `resume "<pasta>"` em texto simples nos
    // outros (codex/agy não reconhecem comandos custom com `/`).
    let resumeResolved: string | null = null;
    if (resumePath) {
      try {
        const r = safePath(resumePath);
        if (PATH_SAFE.test(r) && fs.existsSync(r)) resumeResolved = r;
      } catch { /* invalid resume path → ignored */ }
    }
    const cwd = opts.cwd ?? JOCA_LOGIC_ROOT;
    this.sessionCounter++;
    const id = randomUUID();
    const name = sessionName ?? `Session ${this.sessionCounter}`;

    const shellArgs = IS_WINDOWS && SHELL.includes('powershell') ? ['-NoLogo'] : [];
    const ptyProcess = pty.spawn(SHELL, shellArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      // Every session is born knowing how to talk back to JOCA: the agent inside can list/comment/
      // move tasks, open and message other terminals, etc. via the `joca` CLI (JOCA_OS/cli/joca.mjs).
      // JOCA_SESSION_ID lets it identify itself; the tasks engine adds JOCA_TASK_ID per dispatch.
      env: { ...process.env, ...jocaAgentEnv(id) } as Record<string, string>,
    });

    const session: Session = {
      id, name, cwd, projectId, origin,
      cli: profile.id,
      area: opts.area,
      pty: ptyProcess,
      buffer: '',
      status: 'idle',
      lastOutputTime: Date.now(),
      idleTimer: null,
      workingSince: null,
      notifyOnIdle: false,
      awaitingDone: false,
      writeQueue: [],
      writeTimer: null,
      writing: false,
    };
    this.sessions.set(id, session);

    if (projectId) {
      const memory = loadProjectMemory();
      const current = memory[projectId] ?? {
        projectId,
        recentSessions: [],
        favoriteSkills: [],
        favoriteAgents: [],
        quickCommands: ['save', 'compact', 'clear'],
        openFiles: [],
        rightPanel: null,
        updatedAt: new Date().toISOString(),
      };
      memory[projectId] = {
        ...current,
        recentSessions: [id, ...current.recentSessions.filter((item) => item !== id)].slice(0, 12),
        updatedAt: new Date().toISOString(),
      };
      saveProjectMemory(memory);
    }

    // Launch the selected CLI. The autonomous toggle maps to each profile's own flags
    // (claude → --dangerously-skip-permissions, codex → --dangerously-bypass-approvals-and-sandbox, …).
    const launchLine = buildLaunchLine(profile, findBin(profile.bin), {
      model: opts.model,
      autonomous: loadUiSettings().skipPermissions,
    });
    setTimeout(() => safePtyWrite(ptyProcess, `${launchLine}\r`), 100);

    // Contexto de projecto no arranque. Duas regras, e a diferença é QUEM abriu o terminal:
    //
    //   • aberto à MÃO (origin 'user') → `/resume "<pasta>"` sozinho, como submissão própria. É a
    //     única coisa que o terminal recebe, e sem ela o utilizador ficava com um Claude Code cru
    //     sem saber em que projecto está.
    //   • aberto pelo GESTOR ou por um runner (origin 'auto') → o `/resume` NÃO vai à frente
    //     sozinho: viaja colado ao brief, na mesma submissão. Quem despacha já sabe o projecto e
    //     manda-o junto com o trabalho; um `/resume` automático antes disso é um turno inteiro
    //     gasto a carregar contexto que a mensagem seguinte ia dar de qualquer forma.
    //     (O `/resume` lê só o 1.º argumento — a pasta entre aspas —, portanto o brief a seguir
    //     passa como texto normal e não é confundido com argumento.)
    //
    // `/init-project` NUNCA é enviado daqui. Ligar um projecto ao JOCA é conversa com o gestor,
    // não uma coreografia de arranque de terminal: o gestor faz o levantamento da pasta e conduz
    // as perguntas (ver manager.ts → onboardingSection). Um terminal a disparar `/init-project`
    // sozinho abria um questionário por cima de trabalho que o utilizador nem pediu.
    //
    // Enviado só quando a TUI está mesmo pronta (ver runStartupSequence). Timers fixos foram o bug
    // por trás de "às vezes não manda o /resume": num arranque lento, ou com o prompt "trust this
    // folder?", o comando chegava antes de o CLI o poder receber e perdia-se. Todos os CLIs passam
    // por aqui — a diferença é só a forma do comando (profile.resumeCmd).
    let startupCmd: string | null = null;
    let firstMessage = initialInput;
    if (profile.startupSequence && resumeResolved) {
      const resumeCmd = `${profile.resumeCmd} "${resumeResolved}"`;
      if (origin === 'user') startupCmd = resumeCmd;
      else if (firstMessage) firstMessage = `${resumeCmd}\n\n${firstMessage}`;
    }

    if (startupCmd || firstMessage) {
      void this.runStartupSequence(session, startupCmd, firstMessage);
    }

    ptyProcess.onData((data: string) => {
      session.buffer += data;
      if (session.buffer.length > BUFFER_MAX) {
        let cutAt = session.buffer.length - BUFFER_MAX;
        const nlPos = session.buffer.indexOf('\n', cutAt);
        if (nlPos !== -1 && nlPos < cutAt + 500) cutAt = nlPos + 1;
        session.buffer = '\x1b[0m' + session.buffer.slice(cutAt);
      }
      this.emit('output', { sessionId: id, data });

      // Repintura não é trabalho. Um TUI mexe o cursor, repõe cores e apaga linhas sem nada de novo
      // acontecer — e como o estado era "chegaram bytes = está a trabalhar", uma sessão parada num
      // ecrã com cursor a piscar nunca voltava a `idle`: o silêncio de IDLE_DEBOUNCE_MS nunca
      // chegava. Era esta a origem dos terminais eternamente "a trabalhar".
      //
      // O que fica de fora: um spinner ou um relógio ESCREVEM caracteres visíveis, e continuam a
      // contar como trabalho. Resolver isso obriga a comparar o ECRÃ ao longo do tempo, não o
      // fluxo de bytes — outra empreitada. Isto apanha o caso barato e frequente sem tocar na
      // detecção de fim, de que o gestor todo depende.
      if (!temConteudoVisivel(data)) return;

      // Status: transition to working
      const wasIdle = session.status === 'idle';
      session.status = 'working';
      session.lastOutputTime = Date.now();
      if (session.workingSince === null) session.workingSince = Date.now();

      if (wasIdle) {
        this.emit('status', { sessionId: id, status: 'working' as const });
      }

      // Debounce idle detection
      if (session.idleTimer) clearTimeout(session.idleTimer);
      session.idleTimer = setTimeout(() => {
        const wasWorking = session.status === 'working';
        const workedFor = session.workingSince ? Date.now() - session.workingSince : 0;
        const substantial = wasWorking && workedFor > DONE_MIN_WORK_MS;
        const isDone = session.notifyOnIdle && substantial;         // toast/unread: any initiated burst finished
        const dispatchDone = session.awaitingDone && substantial;   // wakes an awaiting runner: ONLY programmatic dispatches

        session.status = 'idle';
        session.workingSince = null;
        session.notifyOnIdle = false;
        session.awaitingDone = false;
        session.idleTimer = null;

        this.emit('status', { sessionId: id, status: 'idle' as const, isDone });
        // 'done' wakes whoever dispatched work programmatically (automations runner / tasks engine).
        // Gated on awaitingDone so that YOU typing in a worker never fires a spurious 'done'.
        if (dispatchDone) this.emit('done', { sessionId: id });
      }, IDLE_DEBOUNCE_MS);
    });

    // node-pty emite 'error' no socket interno quando o processo morre a meio de uma escrita. Um
    // 'error' sem ouvinte é excepção não-apanhada em Node — mata o backend inteiro. Este ouvinte
    // existe SÓ para o absorver; o fecho a sério continua a ser tratado no onExit abaixo.
    const ptySocket = (ptyProcess as unknown as { _socket?: { on(e: string, f: (err: Error) => void): void } })._socket;
    ptySocket?.on('error', (err: Error) => {
      console.warn(`[pty] socket da sessão ${session.id} falhou: ${err.message}`);
    });

    ptyProcess.onExit(() => {
      // Atenção: isto cancela um `idleTimer` pendente, logo o 'done' desta rajada NUNCA sai. Um
      // processo que acaba depressa (ou que morre) fecha sem nunca ter dito "terminei" — quem
      // estivesse à espera do 'done' ficava à espera para sempre. Por isso o 'closed' leva o
      // output final: é o único sítio onde ainda existe (o `sessions.delete` abaixo torna-o
      // inalcançável), e é o que permite a quem ouve reportar o fecho em vez de o engolir.
      if (session.idleTimer) clearTimeout(session.idleTimer);
      if (session.writeTimer) clearTimeout(session.writeTimer);
      session.writeQueue.length = 0;
      const finalOutput = session.buffer.replace(ANSI_RE, '');
      this.sessions.delete(id);
      this.emit('closed', { sessionId: id, finalOutput });
    });

    // Announce creation so the WS layer broadcasts 'session_created' to all clients. This is the
    // single source of the broadcast — workers spawned programmatically (automations/tasks)
    // become visible in the UI exactly like UI-created sessions.
    this.emit('spawn', { session });
    return session;
  }

  // Queue a paced write. `submit` appends the CR that makes the TUI send the message. Queued per
  // session so two rapid messages never interleave their chunks (see CHUNK_SIZE notes above).
  private enqueueWrite(session: Session, body: string, submit: boolean): void {
    const payload = body.includes('\n') ? `\x1b[200~${body}\x1b[201~` : body;
    session.writeQueue.push({ payload, submit });
    if (!session.writing) this.drainWrites(session);
  }

  // Drain one job at a time: chunk → gap → chunk … → (optional) CR → next job. Every step re-checks
  // that the session is alive, so a PTY killed mid-paste never gets written to (which would throw
  // inside a timer and take the process down).
  private drainWrites(session: Session): void {
    const job = session.writeQueue.shift();
    if (!job) { session.writing = false; return; }
    session.writing = true;

    const chunks = chunkText(job.payload);
    const crDelay = submitCrDelay(job.payload.length);
    let i = 0;

    const abort = () => { session.writing = false; session.writeQueue.length = 0; session.writeTimer = null; };
    const write = (data: string): boolean => {
      if (!this.sessions.has(session.id)) { abort(); return false; }
      try { session.pty.write(data); return true; }
      catch { abort(); return false; }
    };

    const step = (): void => {
      session.writeTimer = null;
      if (i < chunks.length) {
        if (!write(chunks[i++])) return;
        // More chunks pending → gap. Last chunk written → wait crDelay before the submit CR.
        const done = i >= chunks.length;
        if (!done) { session.writeTimer = setTimeout(step, CHUNK_DELAY_MS); return; }
        if (job.submit) { session.writeTimer = setTimeout(step, crDelay); return; }
        this.drainWrites(session);
        return;
      }
      // Chunks exhausted and a CR is still owed.
      if (job.submit && !write('\r')) return;
      this.drainWrites(session);
    };

    step(); // first chunk goes out immediately
  }

  // Resolve once the PTY has produced output and then gone quiet for `quietMs` (the Claude TUI
  // finished rendering its current screen), or after `capMs` as a hard fallback. Poll-based; reads the
  // live session fields the onData handler keeps fresh. Resolves early if the session is gone.
  private waitForQuiet(session: Session, quietMs: number, capMs: number): Promise<void> {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (!this.sessions.has(session.id)) return resolve();
        const quietFor = Date.now() - session.lastOutputTime;
        const booted = session.buffer.length > 0;
        if ((booted && quietFor >= quietMs) || Date.now() - start >= capMs) return resolve();
        setTimeout(tick, 150);
      };
      setTimeout(tick, quietMs);
    });
  }

  // Startup choreography for a freshly spawned Claude Code PTY: wait for the TUI to be ready, clear a
  // "trust this folder?" prompt if present, THEN send /resume (só em terminais abertos à mão),
  // THEN submit any brief (que, nos automáticos, já traz o /resume colado à frente).
  // Every step waits for the TUI to settle before the next — robust vs the old fixed-offset timers.
  /**
   * Limpa os diálogos modais com que um CLI arranca, ANTES de lhe entregar trabalho.
   *
   * Porque é que isto não é "carregar Enter": o Enter aceita a opção por OMISSÃO, e a opção por
   * omissão nem sempre é inofensiva. Medido em campo com o codex 0.143.0: um Enter cego no
   * diálogo "Update available!" escolhe **"1. Update now"** — o CLI correu `npm install -g`,
   * alterou o sistema do dono e saiu com "Please restart Codex". O terminal ficava num prompt de
   * shell, o JOCA reportava-o como `idle` (livre) e o trabalho nunca chegava a começar.
   *
   * Por isso cada diálogo é RECONHECIDO e respondido à medida: confiar na pasta, sim (foi o dono
   * que a abriu); actualizar-se sozinho a meio de um arranque, nunca. Em ciclo, porque vêm em
   * série — a actualização aparece antes da confiança.
   */
  private async limparDialogosDeArranque(session: Session): Promise<void> {
    const p = session.pty;
    for (let i = 0; i < 4; i++) {
      if (!this.sessions.has(session.id)) return;
      const tail = session.buffer.slice(-4000);
      if (ofereceActualizacao(tail)) {
        // "2. Skip" nos dois formatos conhecidos; o dígito selecciona, o CR confirma.
        safePtyWrite(p, '2');
        await new Promise((r) => setTimeout(r, 120));
        safePtyWrite(p, '\r');
      } else if (pedeConfiancaNaPasta(tail)) {
        safePtyWrite(p, '\r');
      } else {
        return;
      }
      await this.waitForQuiet(session, 700, 8000);
    }
  }

  private async runStartupSequence(session: Session, startupCmd: string | null, initialInput?: string): Promise<void> {
    const p = session.pty;
    await this.waitForQuiet(session, 700, 12000);
    await this.limparDialogosDeArranque(session);
    if (!this.sessions.has(session.id)) return;
    if (startupCmd) {
      if (!safePtyWrite(p, startupCmd)) return;   // terminal morreu a arrancar — nada a enviar
      await new Promise((r) => setTimeout(r, 120)); // let the line register before the submit CR
      safePtyWrite(p, '\r');
      if (initialInput) await this.waitForQuiet(session, 900, 20000); // /resume loads context — let it settle
    }
    if (initialInput && this.sessions.has(session.id)) {
      // Arm the done-on-idle signal: the brief is a real work burst, so the next idle is a 'done'
      // (this is what lets the automations runner / tasks engine await the worker's completion).
      session.notifyOnIdle = true;
      session.awaitingDone = true;
      // Bracketed-paste submit: the brief is multi-line; raw newlines would submit only the first line
      // into the Claude TUI. Paced+chunked so a long brief isn't truncated by the pty buffer.
      this.enqueueWrite(session, initialInput, true);
    }
  }

  // Write to a session, replicating the WS 'input' semantics: a multi-char line ending in CR is
  // split so the CR lands ~80ms later (lets the CLI register the paste before submit). Marks the
  // session as work-initiating so the next idle counts as a 'done'.
  input(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || data === undefined) return false;
    if (data.trim().length > 0) session.notifyOnIdle = true;
    if (data.length > 1 && data.endsWith('\r')) {
      // A submitted line (typed message or a paste from the UI composer): queue it paced+chunked,
      // otherwise a long body overflows the pty buffer and arrives truncated.
      this.enqueueWrite(session, data.slice(0, -1), true);
    } else if (data.length > CHUNK_SIZE) {
      this.enqueueWrite(session, data, false); // large paste straight into the terminal, no submit
    } else {
      // Single keystrokes / control chars: write through, no queueing (latency matters here).
      try { session.pty.write(data); } catch { return false; }
    }
    return true;
  }

  // Programmatic message submit (runner → worker). Unlike input() (which mirrors raw UI keystrokes),
  // this guarantees the whole message is entered and submitted once, via bracketed-paste for
  // multi-line bodies. Use for any programmatically-driven message (tasks tester pass, etc.).
  submitMessage(sessionId: string, text: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || text === undefined) return false;
    // Programmatic dispatch → arm BOTH: notifyOnIdle (toast) and awaitingDone (so the completion
    // fires 'done' and wakes the awaiting runner).
    if (text.trim().length > 0) { session.notifyOnIdle = true; session.awaitingDone = true; }
    this.enqueueWrite(session, text.endsWith('\r') ? text.slice(0, -1) : text, true);
    return true;
  }

  interrupt(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    return safePtyWrite(session.pty, '\x03');
  }

  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const c = Math.max(10, Math.min(Math.floor(cols), 500));
    const r = Math.max(5, Math.min(Math.floor(rows), 200));
    try { session.pty.resize(c, r); } catch {}
    return true;
  }

  // Cooperative close used by the WS 'close_session' path: clears the idle timer, kills the PTY,
  // removes it from the map, and emits 'closed'. (PTY-driven exit also emits 'closed' via onExit;
  // calling this after a natural exit is a no-op because the session is already gone.)
  kill(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.idleTimer) clearTimeout(session.idleTimer);
    if (session.writeTimer) clearTimeout(session.writeTimer);
    session.writeQueue.length = 0;
    try { session.pty.kill(); } catch {}
    const finalOutput = session.buffer.replace(ANSI_RE, '');
    this.sessions.delete(sessionId);
    this.emit('closed', { sessionId, finalOutput });
    return true;
  }

  // Returns the cleaned name on success, or null if the session is missing / the name is empty.
  rename(sessionId: string, name: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const cleaned = name.replace(/[\x00-\x1f]/g, '').slice(0, 80).trim();
    if (cleaned.length === 0) return null;
    session.name = cleaned;
    return cleaned;
  }

  // Raw rolling buffer (with ANSI), matching the WS 'get_buffer' response.
  getBuffer(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.buffer;
  }

  // Programmatic read (automations/tasks). strip=true removes ANSI escapes for plain-text consumption.
  readBuffer(sessionId: string, opts: { strip?: boolean } = {}): string | undefined {
    const buf = this.sessions.get(sessionId)?.buffer;
    if (buf === undefined) return undefined;
    return opts.strip ? buf.replace(ANSI_RE, '') : buf;
  }

  // Await the completion of a programmatic dispatch on a session: resolves 'done' when the armed
  // work burst finishes, 'closed' if the PTY exits first, 'timeout' after timeoutMs. Used by the
  // automations runner and the tasks engine (the worker stays open — this only observes).
  waitForDone(sessionId: string, timeoutMs: number): Promise<'done' | 'closed' | 'timeout'> {
    return new Promise((resolve) => {
      if (!this.sessions.has(sessionId)) return resolve('closed');
      const cleanup = () => {
        clearTimeout(timer);
        this.off('done', onDone);
        this.off('closed', onClosed);
      };
      const onDone = ({ sessionId: sid }: { sessionId: string }) => { if (sid === sessionId) { cleanup(); resolve('done'); } };
      const onClosed = ({ sessionId: sid }: { sessionId: string }) => { if (sid === sessionId) { cleanup(); resolve('closed'); } };
      const timer = setTimeout(() => { cleanup(); resolve('timeout'); }, timeoutMs);
      this.on('done', onDone);
      this.on('closed', onClosed);
    });
  }
}

export const sessionManager = new SessionManager();
