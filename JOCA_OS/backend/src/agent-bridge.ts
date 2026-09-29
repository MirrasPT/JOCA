// Agent bridge — what makes every terminal a first-class citizen of JOCA.
//
// Each PTY spawned by JOCA_OS is born with the environment below, so the agent running inside it
// (Claude Code, Codex, agy, OpenCode — any of them) can call back into the running JOCA_OS over
// its local HTTP API, WITHOUT restarting anything: open new terminals, message another terminal,
// send notifications.
//
// Transport is the same HTTP API the browser uses, so there is exactly one implementation of every
// action. When auth is on, a token is minted per PTY and BOUND to that session (see
// auth.mintAgentToken): it opens every route like a login token, except that reporting agent state
// (POST /sessions/:id/agent-event) only works for its own session. The terminal already has full
// shell access to the machine, so this grants no new privilege; it just avoids putting the user's
// password anywhere.
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { mintAgentToken, authEnabled } from './auth';

export const JOCA_CLI_PATH = path.resolve(__dirname, '../../cli/joca.mjs');

// Port the HTTP server actually bound to; server.ts sets this once it is listening.
let apiPort = Number(process.env.PORT || 7491);
export function setApiPort(port: number): void { apiPort = port; }

export function jocaAgentEnv(sessionId: string): Record<string, string> {
  const env: Record<string, string> = {
    JOCA_API_URL: `http://127.0.0.1:${apiPort}`,
    JOCA_CLI: JOCA_CLI_PATH,
    JOCA_SESSION_ID: sessionId,
  };
  if (authEnabled()) env.JOCA_API_TOKEN = mintAgentToken(sessionId);
  return env;
}

// ── Hooks do Claude Code: o estado REAL da sessão (a trabalhar / à espera de ti / acabou) ──────
//
// Os hooks NÃO vão para o ~/.claude/settings.json nem para o settings do projecto: esse ficheiro é
// do dono (e do Brain), e um terminal aberto fora do JOCA não tem para onde os mandar. O backend
// escreve um settings PRÓPRIO, fora do repo, e o perfil `claude` arranca com `--settings <ficheiro>`
// — o Claude Code junta estes hooks aos que já existem, não os substitui.
//
// O conteúdo é igual para todas as sessões desta instância: quem é a sessão, a que porta falar e
// com que token vêm do AMBIENTE do PTY (jocaAgentEnv), que o `claude` herda e passa ao hook.
//
// Notification só nos tipos que querem MESMO uma resposta tua. O `idle_prompt` ("Claude is waiting
// for your input") chega ~60 s depois de cada Stop — deixá-lo passar punha todas as sessões
// acabadas em «à espera de ti» e enchia a inbox. Nomes medidos no binário do claude 2.1.284.
//
// PostToolUse tira a sessão de «à espera de ti» depois de aprovares (o PreToolUse corre ANTES do
// pedido de permissão, portanto não serve); StopFailure é o turno que morreu num limite ou num erro
// da API — sem ele a sessão ficava «a trabalhar» para sempre, porque aí o Stop não chega.
// Esta lista é a fonte única: o session-manager (AGENT_EVENTS) e a rota validam contra ela.
export const CLAUDE_HOOK_EVENTS = [
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Notification', 'Stop',
  'StopFailure',
] as const;
const NOTIFICATION_WAITING_MATCHER =
  'permission_prompt|elicitation_dialog|elicitation_url_dialog|agent_needs_input|worker_permission_prompt';

export function claudeHooksSettings(cliPath = JOCA_CLI_PATH, nodePath = process.execPath): { hooks: Record<string, unknown[]> } {
  // Forma EXEC (`command` + `args`): o claude lança o executável directamente, sem shell. Sem
  // `args`, o comando corre em bash no mac/linux e em PowerShell no Windows sem Git Bash (medido
  // aqui: é PowerShell) — e um caminho com espaços entre aspas não se escreve da mesma maneira nas
  // duas. `process.execPath` em vez do `node` do PATH: um JOCA arrancado sem o node no PATH (app
  // do mac, atalho do Windows) continua a ter hooks. Forma exec confirmada no binário 2.1.284.
  const hooks: Record<string, unknown[]> = {};
  for (const event of CLAUDE_HOOK_EVENTS) {
    const entry: Record<string, unknown> = {
      hooks: [{ type: 'command', command: nodePath, args: [cliPath, 'hook', event], timeout: 5 }],
    };
    if (event === 'Notification') entry.matcher = NOTIFICATION_WAITING_MATCHER;
    if (event === 'PreToolUse' || event === 'PostToolUse' || event === 'PostToolUseFailure') entry.matcher = '*';
    hooks[event] = [entry];
  }
  return { hooks };
}

// O ficheiro vive numa pasta PRIVADA com nome aleatório (mkdtemp, 0700; ficheiro 0600): um nome
// previsível num /tmp partilhado (Linux/VPS) deixava outro utilizador criá-lo primeiro e trocar o
// comando por outro, que correria como o dono do JOCA. Criado no arranque do servidor
// (prepareClaudeHooksSettings) e apagado à saída do processo. O pid vai no nome porque no Windows o
// `stop.bat` mata com `taskkill /F` e a saída limpa nunca corre: o arranque seguinte varre as
// pastas de processos que já não existem.
const HOOKS_DIR_PREFIX = 'joca-os-hooks-';
let hooksFile: string | undefined;

function varrerPastasOrfas(): void {
  let nomes: string[] = [];
  try { nomes = fs.readdirSync(os.tmpdir()); } catch { return; }
  for (const nome of nomes) {
    const m = new RegExp(`^${HOOKS_DIR_PREFIX}(\\d+)-`).exec(nome);
    if (!m || Number(m[1]) === process.pid) continue;
    try { process.kill(Number(m[1]), 0); continue; }       // vivo (ou de outro utilizador): não é nosso
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ESRCH') continue; }
    try { fs.rmSync(path.join(os.tmpdir(), nome), { recursive: true, force: true }); } catch { /* ok */ }
  }
}

function writeHooksFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${HOOKS_DIR_PREFIX}${process.pid}-`));
  fs.chmodSync(dir, 0o700);
  // No Windows o chmod não mexe nas ACL: a pasta herdava as do %TEMP% (medido: grupos de sandbox
  // com Modify). Corta a herança e deixa só o utilizador actual — antes de o ficheiro nascer, que
  // herda da pasta. Se o icacls falhar, fica como antes (herdado) e avisa.
  if (process.platform === 'win32') {
    try {
      execFileSync('icacls', [dir, '/inheritance:r', '/grant:r', `${os.userInfo().username}:(OI)(CI)F`], { stdio: 'ignore', timeout: 5000 });
    } catch (e) {
      console.warn(`[hooks] não consegui restringir as ACL de ${dir}: ${(e as Error).message}`);
    }
  }
  const file = path.join(dir, 'settings.json');
  // `wx`: a pasta acabou de nascer, portanto o ficheiro não pode existir — se existir, não é nosso.
  fs.writeFileSync(file, JSON.stringify(claudeHooksSettings(), null, 2), { mode: 0o600, flag: 'wx' });
  return file;
}

// Apaga a pasta dos hooks deste processo (saída do processo; os testes chamam-na no fim).
export function removeClaudeHooksSettings(): void {
  if (!hooksFile) return;
  try { fs.rmSync(path.dirname(hooksFile), { recursive: true, force: true }); } catch { /* ok */ }
  hooksFile = undefined;
}

// Devolve o caminho do settings de hooks, criando-o se ainda não existe (ou se o tmp foi limpo
// entretanto — aí nasce outra pasta aleatória). Falha de escrita não pode impedir o terminal de
// abrir: devolve undefined e o claude arranca sem hooks, com a heurística de silêncio como antes.
export function prepareClaudeHooksSettings(): string | undefined {
  try {
    if (hooksFile && fs.existsSync(hooksFile)) return hooksFile;
    if (!hooksFile) {
      varrerPastasOrfas();
      process.once('exit', removeClaudeHooksSettings);
    }
    hooksFile = writeHooksFile();
    return hooksFile;
  } catch (e) {
    console.warn(`[hooks] não consegui escrever o settings de hooks: ${(e as Error).message}`);
    return undefined;
  }
}
