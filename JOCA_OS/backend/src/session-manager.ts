// SessionManager: owns the lifecycle of N Claude Code PTYs. Encapsulates the sessions Map,
// spawn/input/resize/kill, the rolling output buffer, and the idle→done heuristic. All timings
// and constants are IDENTICAL to the original god-file (BUFFER_MAX, IDLE_DEBOUNCE_MS,
// DONE_MIN_WORK_MS, MAX_SESSIONS). Shared state lives in the single exported `sessionManager`
// singleton — quem despacha trabalho programaticamente fala com essa instância.
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
//                                              work burst ends; quem despacha espera por isto.
//   'agent_event' { sessionId, event, detail } — cada hook do Claude Code que chegou (ver agentEvent).
//   'agent_state' { sessionId, agentState, agentStateAt, waitingReason } — mudança do estado do
//                                              agente (forwarded as 'session_agent_state').
//   'renamed' { sessionId, name }            — nome mudou, por ti ou pelo 1.º pedido (forwarded as
//                                              'session_renamed').
//   'current_job' { sessionId, currentJob }  — a linha de estado que o agente escreveu (`joca status`);
//                                              forwarded as 'session_current_job'.
// The existing WS flows are unchanged — the additive API (spawn/input/readBuffer/kill/resize +
// the 'done' subscription) does not alter any pre-existing behavior.
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import * as pty from 'node-pty';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { JOCA_LOGIC_ROOT } from './toolkit-registry';
import { loadProjectMemory, saveProjectMemory, loadUiSettings } from './project-store';
import { getCliProfile, buildLaunchLine, type CliId } from './cli-profiles';
import { jocaAgentEnv, prepareClaudeHooksSettings, CLAUDE_HOOK_EVENTS } from './agent-bridge';
import { pushNotification, resolveNotificationGroup } from './notifications/store';
import { criarNomeadorHaiku, binParaNomear, modeloDeNomeLigado, pedidoParaModelo, semComando, type Nomeador } from './session-namer';

// Estado do AGENTE dentro do terminal, distinto do `status` (bytes a sair / silêncio):
//   working → está a trabalhar num pedido · waiting → parou à espera de ti · done → acabou o turno.
// Com hooks (claude) vem do próprio CLI; sem hooks (codex, agy, opencode) é a heurística de silêncio.
export type AgentState = 'working' | 'waiting' | 'done';
// Os eventos vêm da lista que gera o settings dos hooks — uma só fonte: se divergissem, a rota
// respondia 400 a um hook ligado e o CLI engolia o erro em silêncio.
export const AGENT_EVENTS = CLAUDE_HOOK_EVENTS;
export type AgentEvent = typeof AGENT_EVENTS[number];
export interface AgentEventDetail { prompt?: string; tool?: string; message?: string }

// 'default' = «Session N» · 'auto' = saiu do 1.º pedido · 'user' = dado por ti (ao criar ou rename).
export type NameSource = 'default' | 'auto' | 'user';
export const NOME_AUTO_MAX = 40;

/**
 * Nome curto a partir do texto de um pedido, ou null se o pedido não diz nada (#12).
 * Tira o comando de barra da frente (`/goal faz X` → `faz X`), fica com a 1.ª linha com texto,
 * limpa markdown e controlo, e corta em NOME_AUTO_MAX numa fronteira de palavra, com «…».
 * Exportada para ser testável.
 */
export function nomeDoPedido(prompt: string): string | null {
  let texto = prompt.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ' ').trim();
  texto = semComando(texto);          // `/goal`, `/plugin:cmd`; `/resume "pasta"` sozinho → ''
  const linha = texto.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  const limpo = linha
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')                // [texto](url) → texto
    .replace(/^(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)+/, '')   // título, citação, lista
    .replace(/(\*\*|__|~~|`+)/g, '')                           // ênfase e código
    .replace(/\s+/g, ' ')
    .trim();
  if (!limpo) return null;
  if (limpo.length <= NOME_AUTO_MAX) return limpo;
  let corte = limpo.slice(0, NOME_AUTO_MAX - 1);
  const espaco = corte.lastIndexOf(' ');
  if (espaco >= NOME_AUTO_MAX / 2) corte = corte.slice(0, espaco);
  return `${corte.replace(/[\s.,;:!?-]+$/, '')}…`;
}

// Tecto da linha de estado do cartão: uma frase, não um relatório.
export const CURRENT_JOB_MAX = 120;

/**
 * Normaliza a linha de estado que um agente escreve: sem caracteres de controlo (quebras de linha,
 * ANSI, tabs) nem de direcção de texto, espaços colapsados, cortada a CURRENT_JOB_MAX caracteres.
 * Vazia depois disto = `undefined` (sem linha). Exportada para ser testável.
 */
export function limparLinhaDeEstado(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const limpa = raw
    .replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, ' ')   // sequências ANSI inteiras
    .replace(/[\p{Cc}\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!limpa) return undefined;
  return [...limpa].slice(0, CURRENT_JOB_MAX).join('').trim();
}

/**
 * Que estado é que um hook implica. `undefined` = o evento não muda o estado (SessionStart só diz
 * que a sessão tem hooks). Exportada para ser testável: é a regra de que a UI e a inbox dependem.
 */
export function estadoDoEvento(event: AgentEvent): AgentState | undefined {
  switch (event) {
    case 'UserPromptSubmit':
    case 'PreToolUse':
    case 'PostToolUse':
    case 'PostToolUseFailure': return 'working';
    case 'Notification':
    case 'StopFailure': return 'waiting';
    case 'Stop': return 'done';
    default: return undefined;
  }
}

export interface Session {
  id: string;
  name: string;
  nameSource: NameSource;    // de onde veio o nome — só 'default' se deixa nomear pelo 1.º pedido (#12)
  cwd: string;
  projectId?: string;
  origin: 'user' | 'auto';   // quem a criou: 'user' (UI) ou 'auto' (spawn programático, ex.: `joca open`)
  cli: CliId;                // which coding CLI runs inside the PTY (claude | codex | agy | opencode)
  // Etiqueta de área herdada da pool que o gestor de projecto usava. O gestor foi removido e nada
  // preenche isto hoje; fica no tipo por ser opcional e escrito no ficheiro de sessões antigo.
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
  agentState?: AgentState;
  agentStateAt?: number;     // epoch ms da entrada no estado actual
  waitingReason?: string;    // só em 'waiting': o texto que o CLI mostrou (ex.: pedido de permissão)
  // Recebeu pelo menos um hook → o `agentState` passa a vir dos hooks; a heurística de rajadas
  // continua a mexer no `status`, mas já não no `agentState` (só a rede de silêncio abaixo).
  agentHooked: boolean;
  // Rede de segurança do `working` com hooks: ver AGENT_SILENCE_DONE_MS.
  agentSilenceTimer: ReturnType<typeof setTimeout> | null;
  // Ferramenta do último PreToolUse, até ao PostToolUse (ou ao fim do turno). Diz que diálogo está
  // no ecrã quando a sessão entra em espera (ver DIALOGOS_DE_VARIOS_PASSOS).
  agentTool?: string;
  // Ferramentas com PreToolUse e sem PostToolUse nem Notification (contador: o claude pode correr
  // várias em paralelo, e o Post de uma não fecha a outra). Com alguma aberta, o claude pode estar
  // parado a desenhar um pedido de permissão cujo aviso ainda não chegou (medido: 6-10 s de atraso)
  // e a rede de 5 s não corre — só o tecto FERRAMENTA_ABERTA_MAX_MS.
  ferramentasAbertas: number;
  // Frase curta que o PRÓPRIO agente escreveu sobre o que está a fazer (`joca status "…"`). Limpa num
  // prompt novo teu: descrevia o pedido anterior.
  currentJob?: string;
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
  agentState?: AgentState;
  agentStateAt?: number;
  waitingReason?: string;
  currentJob?: string;
}

export interface SpawnOptions {
  cwd?: string;
  sessionName?: string;
  projectId?: string;
  initialInput?: string;
  origin?: 'user' | 'auto';   // default 'user'
  cli?: string;               // 'claude' (default) | 'codex' | 'agy' | 'opencode'
  model?: string;             // passed to the CLI's model flag when the profile has one
  area?: string;              // ver `Session.area` — hoje nunca preenchido
  /** Arranca o Claude Code com `--remote-control` (flag de arranque; só claude). */
  remoteControl?: boolean;
  // Etiqueta OPACA de quem pediu esta sessão (o browser que carregou no "+"). Volta no evento
  // 'spawn' e daí no broadcast: sem ela, o `session_created` chega igual a toda a gente e CADA
  // cliente aberto salta para o terminal novo — um segundo separador era atirado para fora do que
  // estava a fazer sempre que outro criava um terminal.
  requestedBy?: string;
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
// Um turno interrompido (Esc, Ctrl+C, o botão de interromper do JOCA) NÃO emite Stop, e sem isto a
// sessão ficava «a trabalhar» para sempre. Enquanto trabalha, o Claude Code redesenha o spinner e o
// contador de segundos — texto VISÍVEL várias vezes por segundo, também durante uma ferramenta longa
// (medido no 2.1.284: o maior intervalo entre rajadas visíveis a trabalhar foi 1,2 s, com 20 s de
// `sleep` numa ferramenta pelo meio). Silêncio visível acima deste limiar com a sessão em `working`
// = parou → `done`. Folga de 4x sobre o medido para um PC carregado não dar falsos «acabou».
export const AGENT_SILENCE_DONE_MS = 5000;

// Diálogos em que um Enter NÃO é a resposta final: o AskUserQuestion tem várias perguntas e um ecrã
// de «submeter» (medido: Enter na 1.ª pergunta e a 2.ª continua no ecrã), e o ExitPlanMode aprova
// um plano. Nestes, só o PostToolUse (respondeste a tudo), Esc ou Ctrl+C (cancelaste) tiram da espera.
const DIALOGOS_DE_VARIOS_PASSOS = new Set(['AskUserQuestion', 'ExitPlanMode']);

// Tecto da «ferramenta aberta» sem NENHUMA saída visível: um cancelamento que não passa pelo JOCA
// (remote control no claude.ai) antes do aviso não emite hook nenhum e deixava a sessão «a
// trabalhar» para sempre. Findo o tecto, a ferramenta dá-se por fechada e volta a rede de 5 s.
export const FERRAMENTA_ABERTA_MAX_MS = 5 * 60_000;
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
 * seja: um terminal morto derrubava o backend todo, com todas as outras sessões atrás.
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
  // Quem dá o nome pelo modelo (2.º passo do #12). Trocável nos testes — nunca chamam o CLI real.
  // Uma só chamada por sessão sem precisar de registo: só se chama com nameSource 'default', e o
  // rename da heurística, feito antes, passa-o a 'auto' — nada o volta a pôr em 'default'.
  nomeador: Nomeador;

  constructor() {
    super();
    ensureNodePtyHelpersExecutable();
    this.claudeBin = findBin('claude');
    this.nomeador = criarNomeadorHaiku(
      binParaNomear(this.claudeBin, () => execSync('where.exe claude', { encoding: 'utf8' })),
    );
  }

  get size() { return this.sessions.size; }

  list(): Session[] { return [...this.sessions.values()]; }

  get(id: string): Session | undefined { return this.sessions.get(id); }

  info(s: Session): SessionInfo {
    return {
      id: s.id, name: s.name, cwd: s.cwd, projectId: s.projectId, origin: s.origin, cli: s.cli, area: s.area, status: s.status,
      agentState: s.agentState, agentStateAt: s.agentStateAt, waitingReason: s.waitingReason,
      currentJob: s.currentJob,
    };
  }

  listInfo(): SessionInfo[] { return this.list().map((s) => this.info(s)); }

  spawn(opts: SpawnOptions = {}): Session {
    const { sessionName, projectId, initialInput } = opts;
    const origin = opts.origin ?? 'user';
    // Explicit cli wins; otherwise the user's configured default (Settings → CLI por defeito).
    const profile = getCliProfile(opts.cli ?? loadUiSettings().defaultCli);

    const cwd = opts.cwd ?? JOCA_LOGIC_ROOT;
    this.sessionCounter++;
    const id = randomUUID();
    const name = sessionName ?? `Session ${this.sessionCounter}`;
    // Nome dado ao criar (projecto, skill, reinício, `joca open --name`) é escolha de alguém.
    const nameSource: NameSource = sessionName ? 'user' : 'default';

    const shellArgs = IS_WINDOWS && SHELL.includes('powershell') ? ['-NoLogo'] : [];
    const ptyProcess = pty.spawn(SHELL, shellArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      // Every session is born knowing how to talk back to JOCA: the agent inside can open and
      // message other terminals, etc. via the `joca` CLI (JOCA_OS/cli/joca.mjs).
      // JOCA_SESSION_ID lets it identify itself.
      env: { ...process.env, ...jocaAgentEnv(id) } as Record<string, string>,
    });

    const session: Session = {
      id, name, cwd, projectId, origin,
      nameSource,
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
      agentHooked: false,
      agentSilenceTimer: null,
      ferramentasAbertas: 0,
    };
    this.sessions.set(id, session);

    if (projectId) {
      const memory = loadProjectMemory();
      const current = memory[projectId] ?? {
        projectId,
        recentSessions: [],
        favoriteSkills: [],
        favoriteAgents: [],
        quickCommands: ['start', 'save', 'compact', 'plan'],
        openFiles: [],
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
    // (claude → --dangerously-skip-permissions, codex → --dangerously-bypass-approvals-and-sandbox,
    // agy → --dangerously-skip-permissions, …).
    const launchLine = buildLaunchLine(profile, findBin(profile.bin), {
      model: opts.model,
      autonomous: loadUiSettings().skipPermissions,
      remoteControl: opts.remoteControl,
      hooksSettings: profile.id === 'claude' ? prepareClaudeHooksSettings() : undefined,
    });
    setTimeout(() => safePtyWrite(ptyProcess, `${launchLine}\r`), 100);

    // NENHUM comando de contexto é injectado no arranque. O `/resume` é MANUAL: o dono carrega no
    // botão de resume da barra do chat quando quer carregar o contexto do projecto (o frontend
    // compõe o comando a partir de `profile.resumeCmd`). Um terminal que arranca a gastar um turno
    // inteiro a carregar contexto que ninguém pediu é trabalho por cima do dono.
    //
    // `/init-project` também NUNCA é enviado daqui, pela mesma razão: abria um questionário por
    // cima de trabalho que o utilizador nem pediu.
    //
    // A coreografia de arranque corre com ou sem brief: é ela que reconhece e responde ao "trust
    // this folder?" e ao "Update available!" — deixar um terminal parado num desses diálogos é pior
    // do que qualquer contexto em falta (ver limparDialogosDeArranque). Quem a desliga é o perfil
    // do CLI (`startupSequence: false`), para um CLI que não tenha diálogos de arranque nenhuns.
    // O que é ENVIADO é só o brief (initialInput) de quem criou a sessão — e só quando a TUI está
    // pronta e os diálogos limpos. Timers fixos foram o bug por trás de "às vezes não manda a
    // mensagem". Sem coreografia o brief vai à mesma, apenas sem a espera.
    if (profile.startupSequence) void this.runStartupSequence(session, initialInput);
    else if (initialInput) this.enqueueWrite(session, initialInput, true);

    ptyProcess.onData((data: string) => {
      session.buffer += data;
      if (session.buffer.length > BUFFER_MAX) {
        let cutAt = session.buffer.length - BUFFER_MAX;
        // NUNCA cortar a meio de uma sequência de escape. `cutAt` é um índice arbitrário; se o
        // `\x1b` inicial ficar do lado deitado fora, os parâmetros que sobram (`38;2;255;0;0m`)
        // chegam ao xterm como TEXTO e o replay aparece com lixo e linhas repetidas. Alinhar ao
        // próximo `\x1b` é sempre seguro — toda a sequência começa aí. Um TUI repinta com CSI de
        // posicionamento, não com `\n`, por isso o alinhamento por linha (fallback) falha muito.
        const escPos = session.buffer.indexOf('\x1b', cutAt);
        if (escPos !== -1 && escPos < cutAt + 2000) {
          cutAt = escPos;
        } else {
          const nlPos = session.buffer.indexOf('\n', cutAt);
          if (nlPos !== -1 && nlPos < cutAt + 500) cutAt = nlPos + 1;
        }
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
      // detecção de fim.
      if (!temConteudoVisivel(data)) return;

      // Com hooks e a trabalhar, cada rajada visível adia a rede de silêncio (ver AGENT_SILENCE_DONE_MS).
      if (session.agentState === 'working') this.armarSilencio(session);

      // Status: transition to working
      const wasIdle = session.status === 'idle';
      session.status = 'working';
      session.lastOutputTime = Date.now();
      if (session.workingSince === null) session.workingSince = Date.now();

      if (wasIdle) {
        this.emit('status', { sessionId: id, status: 'working' as const });
        if (!session.agentHooked) this.setAgentState(session, 'working');
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
        // `notifyOnIdle` é um toast: perdê-lo custa um aviso. `awaitingDone` é um RUNNER à espera:
        // perdê-lo custa a fila inteira do projecto.
        //
        // Ambos eram limpos aqui SEMPRE, mesmo quando a rajada era curta demais para contar como
        // trabalho (`substantial`). Bastava um settle de menos de 2s — o eco do paste do brief, uma
        // pausa entre duas ferramentas — para consumir o "arm" sem emitir `done`. A partir daí
        // nenhuma rajada seguinte acordava o `waitForDone`, que só desistia ao fim de 1 HORA, com o
        // lock `busy` presa todo esse tempo e nada mais a correr nesse projecto. Media-se em ~1 de
        // cada 5 execuções.
        //
        // Só se desarma quem chegou a disparar.
        session.notifyOnIdle = isDone ? false : session.notifyOnIdle;
        session.awaitingDone = dispatchDone ? false : session.awaitingDone;
        session.idleTimer = null;

        this.emit('status', { sessionId: id, status: 'idle' as const, isDone });
        // Sem hooks, «acabou» é o que a heurística sabe dizer: uma rajada que alguém começou e
        // terminou. Rajada sem dono (arranque, repintura longa) volta a «sem estado», não a «acabou».
        if (!session.agentHooked) this.setAgentState(session, isDone ? 'done' : undefined);
        // 'done' acorda quem despachou trabalho programaticamente (POST /sessions, `joca open`).
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
      this.largarEstadoDoAgente(session);
      const finalOutput = session.buffer.replace(ANSI_RE, '');
      this.sessions.delete(id);
      this.emit('closed', { sessionId: id, finalOutput });
    });

    // Announce creation so the WS layer broadcasts 'session_created' to all clients. This is the
    // single source of the broadcast — workers criados programaticamente (origin:'auto')
    // become visible in the UI exactly like UI-created sessions.
    this.emit('spawn', { session, requestedBy: opts.requestedBy });
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

  /**
   * Espera que o TUI esteja MESMO pronto a receber texto.
   *
   * O `waitForQuiet` sozinho não chega: durante o arranque de um CLI há pausas de mais de 700ms
   * (a carregar, a resolver o modelo) em que o processo está vivo mas ainda não montou a caixa de
   * input. Escrever aí é escrever para o vazio — o texto não aparece em lado nenhum e o terminal
   * fica no prompt limpo. Como nada foi escrito, o `awaitingDone` nunca chega a armar e o runner
   * que espera pela tarefa fica pendurado até ao timeout de uma hora, com a fila do projecto presa
   * atrás dele. Foi assim que uma tarefa em cada cinco morria no arranque.
   *
   * O sinal de "pronto" é o próprio prompt do CLI. Se não aparecer dentro do tecto, avança à mesma
   * (um CLI que não conheçamos não pode bloquear o arranque para sempre) — daí o `capMs`.
   */
  private waitForTuiReady(session: Session, capMs: number): Promise<void> {
    // `❯` cobre Claude Code e Codex; as outras duas são a barra de estado do Claude Code, que só
    // aparece depois de a caixa de input existir.
    const PRONTO = /[❯›»]|bypass permissions|for agents|\? for shortcuts/;
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (!this.sessions.has(session.id)) return resolve();
        const tail = session.buffer.slice(-4000).replace(ANSI_RE, '');
        const quietFor = Date.now() - session.lastOutputTime;
        if ((PRONTO.test(tail) && quietFor >= 400) || Date.now() - start >= capMs) return resolve();
        setTimeout(tick, 150);
      };
      setTimeout(tick, 400);
    });
  }

  // Startup choreography for a freshly spawned Claude Code PTY: wait for the TUI to be ready, clear a
  // "trust this folder?" prompt if present, THEN submit the brief. Nenhum `/resume` é injectado —
  // o resume é manual, pelo botão da barra do chat.
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

  private async runStartupSequence(session: Session, initialInput?: string): Promise<void> {
    await this.waitForTuiReady(session, 25000);
    await this.limparDialogosDeArranque(session);
    if (initialInput && this.sessions.has(session.id)) {
      // Arm the done-on-idle signal: the brief is a real work burst, so the next idle is a 'done'
      // (é isto que deixa quem despachou esperar pela conclusão do worker).
      session.notifyOnIdle = true;
      session.awaitingDone = true;
      // Bracketed-paste submit: the brief is multi-line; raw newlines would submit only the first line
      // into the Claude TUI. Paced+chunked so a long brief isn't truncated by the pty buffer.
      this.enqueueWrite(session, initialInput, true);

      // Rede de segurança: confirmar que o brief CHEGOU. Um paste perdido não dá erro nenhum — o
      // terminal fica no prompt limpo e quem espera pela tarefa fica pendurado. Verifica-se por uma
      // marca do próprio texto e, se não estiver lá, tenta-se UMA vez.
      const marca = initialInput.trim().split('\n')[0].slice(0, 40);
      await new Promise((r) => setTimeout(r, 3500));
      if (!this.sessions.has(session.id)) return;
      const visto = session.buffer.slice(-8000).replace(ANSI_RE, '').includes(marca);
      if (!visto) {
        console.warn(`[session ${session.id.slice(0, 8)}] o brief não apareceu no terminal — a repetir`);
        await this.waitForTuiReady(session, 10000);
        if (this.sessions.has(session.id)) this.enqueueWrite(session, initialInput, true);
      }
    }
  }

  // Write to a session, replicating the WS 'input' semantics: a multi-char line ending in CR is
  // split so the CR lands ~80ms later (lets the CLI register the paste before submit). Marks the
  // session as work-initiating so the next idle counts as a 'done'.
  input(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || data === undefined) return false;
    if (data.trim().length > 0) session.notifyOnIdle = true;
    this.respostaDoDono(session, data);
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
  // multi-line bodies. Use for any programmatically-driven message.
  submitMessage(sessionId: string, text: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || text === undefined) return false;
    // Programmatic dispatch → arm BOTH: notifyOnIdle (toast) and awaitingDone (so the completion
    // fires 'done' and wakes the awaiting runner).
    if (text.trim().length > 0) { session.notifyOnIdle = true; session.awaitingDone = true; }
    // `joca send` a um terminal à espera é responder-lhe, como um Enter (o submit leva um).
    this.respostaDoDono(session, '\r');
    this.enqueueWrite(session, text.endsWith('\r') ? text.slice(0, -1) : text, true);
    return true;
  }

  /**
   * Um hook do Claude Code chegou (via `joca hook <Evento>` → POST /sessions/:id/agent-event).
   *
   * O 1.º hook de uma sessão deita fora o estado que a heurística lá tinha posto: o arranque da TUI
   * faz bytes, que a heurística lê como «a trabalhar», e a partir daqui ninguém o voltaria a limpar.
   * Devolve false se a sessão não existe.
   */
  agentEvent(sessionId: string, event: AgentEvent, detail: AgentEventDetail = {}): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (!session.agentHooked) {
      session.agentHooked = true;
      this.setAgentState(session, undefined);
    }
    this.emit('agent_event', { sessionId, event, detail });
    if (event === 'UserPromptSubmit') this.nomearPeloPedido(session, detail.prompt);
    const next = estadoDoEvento(event);
    // StopFailure: o turno morreu num limite ou num erro da API — quem tem de agir és tu (esperar,
    // mudar de modelo, repetir). A mensagem do evento, se vier, vai a seguir.
    const reason = event === 'StopFailure'
      ? `Bateu no limite ou erro da API${detail.message ? `: ${detail.message}` : ''}`
      : detail.message;
    switch (event) {
      case 'PreToolUse': session.agentTool = detail.tool; session.ferramentasAbertas++; break;
      case 'PostToolUse':
      case 'PostToolUseFailure':
        session.ferramentasAbertas = Math.max(0, session.ferramentasAbertas - 1);
        if (session.ferramentasAbertas === 0) session.agentTool = undefined;
        break;
      case 'Notification': session.ferramentasAbertas = 0; break;   // o aviso chegou: é espera, não silêncio
      case 'SessionStart': break;
      default: session.agentTool = undefined; session.ferramentasAbertas = 0;   // Stop*, novo prompt
    }
    if (next) this.setAgentState(session, next, next === 'waiting' ? reason : undefined);
    this.armarSilencio(session);   // mesmo sem mudar de estado: o PreToolUse pára-a, o PostToolUse volta a armá-la
    if (event === 'UserPromptSubmit') this.setCurrentJob(sessionId, undefined);   // pedido novo: a linha era do anterior
    return true;
  }

  /**
   * Uma tecla (ou mensagem) tua a uma sessão com hooks. Nenhuma resposta a um diálogo tem hook
   * próprio — recusar ou cancelar nem PostToolUse emite — por isso sai de `waiting` para `working`
   * e a rede de silêncio decide: se a ferramenta correr, o spinner mantém-no; se parou, `done`.
   *   • Esc ou Ctrl+C: cancelaste, em qualquer diálogo.
   *   • Enter ou um dígito 1-9 (que no pedido de permissão escolhe E confirma): respondeste — excepto
   *     nos DIALOGOS_DE_VARIOS_PASSOS, onde o Enter só avança para a pergunta seguinte.
   *   • Setas e letras: estás a navegar ou a escrever; nada muda.
   * Uma resposta fecha também as ferramentas abertas, com ou sem o aviso já chegado: recusar («3»,
   * Esc) ANTES do aviso acaba o turno em «Interrupted» sem hook nenhum — só a rede de 5 s o apanha.
   * Se a ferramenta correr, o spinner mantém o `working` e o PostToolUse confirma.
   */
  private respostaDoDono(session: Session, data: string): void {
    const cancelou = data === '\x1b' || data.includes('\x03');
    const respondeu = cancelou || (!DIALOGOS_DE_VARIOS_PASSOS.has(session.agentTool ?? '')
      && (data.includes('\r') || /^[1-9]$/.test(data)));
    if (!respondeu) return;
    session.ferramentasAbertas = 0;
    if (session.agentState === 'waiting') this.setAgentState(session, 'working');   // já rearma
    else this.armarSilencio(session);
  }

  // Rede de silêncio do `working` (ver AGENT_SILENCE_DONE_MS). Só com hooks: sem eles a heurística de
  // rajadas já trata do estado. Rearmada a cada rajada visível e a cada mudança de estado.
  private armarSilencio(session: Session): void {
    if (session.agentSilenceTimer) clearTimeout(session.agentSilenceTimer);
    session.agentSilenceTimer = null;
    if (!session.agentHooked || session.agentState !== 'working') return;
    if (session.ferramentasAbertas > 0) {
      // Ferramenta aberta: sem rede de 5 s, só o tecto — que a fecha e devolve a vez à rede.
      session.agentSilenceTimer = setTimeout(() => {
        session.agentSilenceTimer = null;
        if (!this.sessions.has(session.id)) return;
        session.ferramentasAbertas = 0;
        session.agentTool = undefined;
        this.armarSilencio(session);
      }, FERRAMENTA_ABERTA_MAX_MS);
      return;
    }
    session.agentSilenceTimer = setTimeout(() => {
      session.agentSilenceTimer = null;
      if (this.sessions.has(session.id) && session.agentState === 'working') this.setAgentState(session, 'done');
    }, AGENT_SILENCE_DONE_MS);
  }

  /**
   * A linha de estado que o agente escreve sobre si (`joca status "…"`). Passa sempre por
   * `limparLinhaDeEstado`; vazia = limpa. Emite 'current_job' só quando muda. Devolve false se a
   * sessão não existe.
   */
  setCurrentJob(sessionId: string, text: string | undefined): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const currentJob = limparLinhaDeEstado(text);
    if (session.currentJob === currentJob) return true;
    session.currentJob = currentJob;
    this.emit('current_job', { sessionId, currentJob });
    return true;
  }

  // A sessão vai fechar: pára a rede de silêncio e resolve um «precisa de ti» que ficou por
  // responder — uma sessão que já não existe não precisa de ninguém.
  private largarEstadoDoAgente(session: Session): void {
    if (session.agentSilenceTimer) clearTimeout(session.agentSilenceTimer);
    session.agentSilenceTimer = null;
    if (session.agentState === 'waiting') resolveNotificationGroup(`agent-waiting:${session.id}`);
  }

  // Muda o estado do agente e avisa — só quando muda mesmo: um PreToolUse por ferramenta não pode
  // virar um broadcast por ferramenta. `waiting` com outra razão conta como mudança.
  private setAgentState(session: Session, state: AgentState | undefined, reason?: string): void {
    const waitingReason = state === 'waiting' ? (reason?.slice(0, 500) || undefined) : undefined;
    if (session.agentState === state && session.waitingReason === waitingReason) return;
    const entrouEmEspera = state === 'waiting' && session.agentState !== 'waiting';
    const saiuDaEspera = session.agentState === 'waiting' && state !== 'waiting';
    session.agentState = state;
    session.agentStateAt = state ? Date.now() : undefined;
    session.waitingReason = waitingReason;
    this.emit('agent_state', {
      sessionId: session.id, agentState: state, agentStateAt: session.agentStateAt, waitingReason,
    });
    // «Precisa de ti» vai à inbox com prioridade de acção — só na ENTRADA em espera (mudar só a
    // razão não é um bloqueio novo). groupKey por sessão: a mesma sessão a pedir outra vez antes de
    // leres dobra-se na mesma entrada; duas sessões bloqueadas continuam a ser duas decisões.
    if (entrouEmEspera) {
      pushNotification({
        kind: 'system',
        priority: 'action',
        title: `«${session.name}» precisa de ti`,
        text: waitingReason ?? 'O agente parou à espera de uma resposta tua.',
        meta: { sessionId: session.id, projectId: session.projectId },
        groupKey: `agent-waiting:${session.id}`,
      });
    }
    // Saiu da espera → o «precisa de ti» deixou de ser verdade: resolve-o (fecha o toast de acção).
    // O bloqueio seguinte é uma decisão nova e gera uma entrada nova.
    if (saiuDaEspera) resolveNotificationGroup(`agent-waiting:${session.id}`);
    this.armarSilencio(session);
  }

  interrupt(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    // Ctrl+C a meio de um pedido de permissão também é responder-lhe (ver respostaDoDono).
    this.respostaDoDono(session, '\x03');
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
    this.largarEstadoDoAgente(session);
    try { session.pty.kill(); } catch {}
    const finalOutput = session.buffer.replace(ANSI_RE, '');
    this.sessions.delete(sessionId);
    this.emit('closed', { sessionId, finalOutput });
    return true;
  }

  // Returns the cleaned name on success, or null if the session is missing / the name is empty.
  // Único caminho de mudar o nome: emite 'renamed' (→ broadcast `session_renamed`). Sem `source`
  // é um rename teu (UI, API, CLI) e fica para sempre — o nome automático nunca lhe passa por cima.
  rename(sessionId: string, name: string, source: 'user' | 'auto' = 'user'): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const cleaned = name.replace(/[\x00-\x1f]/g, '').slice(0, 80).trim();
    if (cleaned.length === 0) return null;
    session.name = cleaned;
    session.nameSource = source;
    this.emit('renamed', { sessionId, name: cleaned });
    return cleaned;
  }

  // 1.º pedido de uma sessão ainda com o nome por omissão → o nome passa a ser o pedido (#12).
  // Um pedido que não dá nome (`/clear` sozinho) deixa-a à espera do seguinte.
  // Depois, sem bloquear, o Haiku propõe um nome de 1-2 palavras. Só entra se, quando chega, a
  // sessão ainda existe e o nome ainda é o da heurística — um rename teu entretanto ganha sempre.
  private nomearPeloPedido(session: Session, prompt: string | undefined): void {
    if (session.nameSource !== 'default' || !prompt) return;
    const nome = nomeDoPedido(prompt);
    if (!nome) return;
    const heuristico = this.rename(session.id, nome, 'auto');
    const pedido = pedidoParaModelo(prompt);
    if (!heuristico || !pedido || !modeloDeNomeLigado()) return;
    const id = session.id;
    // O catch cobre só o nomeador; um erro de quem ouve 'renamed' não é engolido aqui.
    this.nomeador(pedido)
      .catch(() => null)
      .then((proposto) => {
        const s = this.sessions.get(id);
        if (!proposto || !s || s.nameSource !== 'auto' || s.name !== heuristico || proposto === heuristico) return;
        this.rename(id, proposto, 'auto');
      });
  }

  // Raw rolling buffer (with ANSI), matching the WS 'get_buffer' response.
  getBuffer(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.buffer;
  }

  // Leitura programática. strip=true tira os escapes ANSI para consumo em texto simples.
  readBuffer(sessionId: string, opts: { strip?: boolean } = {}): string | undefined {
    const buf = this.sessions.get(sessionId)?.buffer;
    if (buf === undefined) return undefined;
    return opts.strip ? buf.replace(ANSI_RE, '') : buf;
  }

  // Await the completion of a programmatic dispatch on a session: resolves 'done' when the armed
  // work burst finishes, 'closed' if the PTY exits first, 'timeout' after timeoutMs. Used by the
  // quem despachou o trabalho (o worker fica aberto — isto só observa).
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
