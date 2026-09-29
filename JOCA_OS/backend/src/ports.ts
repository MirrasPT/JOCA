// Portas TCP em escuta abertas pelos terminais de um projecto (issue #13).
//
// A atribuição é pela ÁRVORE DE PROCESSOS: cada PTY tem um PID (a shell); tudo o que descende dele
// — o `npm run dev`, o node que ele lança, o vite — pertence àquele terminal, e portanto ao
// projecto do terminal. O Orca (stablyai/orca, MIT, `src/main/ports/`) atribui pelo `cwd`/linha de
// comando; aqui não é preciso adivinhar, porque fomos nós que abrimos a shell.
//
// SÓ LEITURA: isto lista processos e sockets, nunca mata nem sinaliza nada.
//
// Custo: no Windows a tabela de processos vem do PowerShell (~0,7 s a frio, medido 2026-09-28 —
// o `wmic` já não existe no Windows 11). Por isso o varrimento fica em cache e pedidos
// simultâneos partilham o mesmo varrimento em curso, em vez de lançar um PowerShell cada um.
// A cache conta a partir do FIM do varrimento e dura tanto como o polling da UI (10 s): com uma
// cache mais curta que o intervalo (era 4 s contra 5 s) cada poll falhava a cache e lançava um
// PowerShell novo — 24 processos/min com a vista aberta, medido.
import { execFile } from 'child_process';

export interface Listener { port: number; pid: number; processName?: string }
export interface ProcRow { pid: number; ppid: number; name?: string }
export interface PortSession { id: string; name: string; pid: number }
export interface OpenPort {
  port: number;
  pid: number;
  processName?: string;
  sessionId: string;
  sessionName: string;
  url: string;
}

const IS_WINDOWS = process.platform === 'win32';
const CACHE_MS = 10_000;
const CMD_TIMEOUT_MS = 8000;

function portFromAddress(addr: string): number | null {
  // `0.0.0.0:5173`, `[::]:5173`, `*:5173`, `127.0.0.1:5173` — a porta é sempre o que vem depois
  // do ÚLTIMO `:` (o IPv6 tem `:` lá dentro, por isso não serve partir no primeiro).
  const m = addr.trim().match(/:(\d+)$/);
  if (!m) return null;
  const port = Number(m[1]);
  return port > 0 && port <= 65535 ? port : null;
}

/**
 * `netstat -ano` (Windows). A coluna do estado vem TRADUZIDA na língua do Windows
 * («LISTENING», «ABHÖREN», …), portanto não se compara a palavra: um socket em escuta é o único
 * com endereço remoto `0.0.0.0:0` / `[::]:0`. O protocolo (`TCP`) e o PID não se traduzem.
 */
export function parseNetstat(output: string): Listener[] {
  const out: Listener[] = [];
  for (const line of output.split(/\r?\n/)) {
    const f = line.trim().split(/\s+/);
    if (f.length < 5 || f[0].toUpperCase() !== 'TCP') continue;
    if (!/^(0\.0\.0\.0|\[::\]|\*):0$/.test(f[2])) continue;
    const port = portFromAddress(f[1]);
    const pid = Number(f[f.length - 1]);
    if (port === null || !Number.isInteger(pid) || pid <= 0) continue;
    out.push({ port, pid });
  }
  return dedupe(out);
}

/**
 * `lsof -nP -iTCP -sTCP:LISTEN -F pcn` (macOS/Linux). Formato por campos, uma linha cada, com a
 * letra do campo à frente: `p<pid>` abre um processo, `c<nome>` é o comando, `f<fd>` abre um
 * ficheiro e `n<endereço>` é o socket. O `-sTCP:LISTEN` já filtra o estado.
 */
export function parseLsof(output: string): Listener[] {
  const out: Listener[] = [];
  let pid: number | undefined;
  let name: string | undefined;
  for (const line of output.split(/\r?\n/)) {
    const tag = line[0];
    const value = line.slice(1);
    if (tag === 'p') { pid = Number(value); name = undefined; }
    else if (tag === 'c') name = value || undefined;
    else if (tag === 'n' && pid) {
      // `-> remoto` só aparece em ligações; em escuta não, mas corta-se por segurança.
      const port = portFromAddress(value.split('->')[0].replace(/\s*\(LISTEN\)$/i, ''));
      if (port !== null) out.push({ port, pid, processName: name });
    }
  }
  return dedupe(out);
}

/** Saída de `ps -A -o pid=,ppid=` (macOS/Linux) OU das linhas `pid ppid nome` do PowerShell. */
export function parseProcTable(output: string): ProcRow[] {
  const rows: ProcRow[] = [];
  for (const line of output.split(/\r?\n/)) {
    const m = line.trim().match(/^(\d+)\s+(\d+)(?:\s+(.+))?$/);
    if (!m) continue;
    rows.push({ pid: Number(m[1]), ppid: Number(m[2]), name: m[3]?.trim() || undefined });
  }
  return rows;
}

// A mesma porta aparece duas vezes quando o servidor escuta em IPv4 e IPv6 — é uma porta só.
function dedupe(list: Listener[]): Listener[] {
  const seen = new Set<string>();
  return list.filter((l) => {
    const k = `${l.port}:${l.pid}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** O PID raiz e todos os seus descendentes. `seen` corta ciclos (o Windows recicla PIDs). */
export function descendants(root: number, procs: ProcRow[]): Set<number> {
  const children = new Map<number, number[]>();
  for (const p of procs) {
    if (p.pid === p.ppid) continue;
    const list = children.get(p.ppid);
    if (list) list.push(p.pid); else children.set(p.ppid, [p.pid]);
  }
  const seen = new Set<number>([root]);
  const stack = [root];
  while (stack.length) {
    for (const c of children.get(stack.pop()!) ?? []) {
      if (!seen.has(c)) { seen.add(c); stack.push(c); }
    }
  }
  return seen;
}

/** Cruza portas em escuta com a árvore de cada terminal. Pura — é o que os testes exercitam. */
export function attributePorts(
  listeners: Listener[], procs: ProcRow[], sessions: PortSession[], exclude: Set<number>,
): OpenPort[] {
  const names = new Map(procs.map((p) => [p.pid, p.name] as const));
  const out: OpenPort[] = [];
  const taken = new Set<string>();
  for (const s of sessions) {
    const tree = descendants(s.pid, procs);
    for (const l of listeners) {
      if (exclude.has(l.port) || !tree.has(l.pid)) continue;
      const k = `${l.port}:${l.pid}`;
      if (taken.has(k)) continue;
      taken.add(k);
      out.push({
        port: l.port,
        pid: l.pid,
        processName: l.processName ?? names.get(l.pid),
        sessionId: s.id,
        sessionName: s.name,
        url: `http://localhost:${l.port}`,
      });
    }
  }
  return out.sort((a, b) => a.port - b.port);
}

/** O varrimento do sistema falhou — a rota responde 503, e a UI diz «não foi possível ler». */
export class PortsUnavailableError extends Error {}

// `okCodes`: saídas não-zero que NÃO são falha. O lsof sai com 1 quando não há nenhum socket em
// escuta — isso é «nenhuma porta», não um erro.
function run(cmd: string, args: string[], okCodes: number[] = []): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: CMD_TIMEOUT_MS, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        const out = typeof stdout === 'string' ? stdout : '';
        if (!err) return resolve(out);
        const code = (err as NodeJS.ErrnoException & { code?: unknown }).code;
        if (!err.killed && typeof code === 'number' && okCodes.includes(code)) return resolve(out);
        // Falha (lsof ausente numa distro Linux, PowerShell bloqueado, timeout) NÃO é «nenhuma
        // porta»: o stdout de um processo morto a meio vem cortado, e uma árvore cortada perde
        // portas em silêncio. Regista-se a causa (só o comando e o motivo, nunca o output) e o
        // varrimento inteiro falha.
        const cause = err.killed ? `timeout ${CMD_TIMEOUT_MS} ms` : String(code ?? err.message);
        console.warn(`[ports] ${cmd} falhou: ${cause}`);
        reject(new PortsUnavailableError(`${cmd}: ${cause}`));
      });
  });
}

const WIN_PROC_SCRIPT =
  '[Console]::OutputEncoding=[Text.Encoding]::UTF8; ' +
  'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $($_.Name)" }';

async function scanSystem(): Promise<{ listeners: Listener[]; procs: ProcRow[] }> {
  if (IS_WINDOWS) {
    const [net, ps] = await Promise.all([
      // Sem `-p tcp`: esse filtro só mostra IPv4, e um vite em `localhost` escuta muitas vezes
      // só em `[::1]` — ficava de fora. As linhas UDP caem no parser (o protocolo não é `TCP`).
      run('netstat', ['-ano']),
      run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WIN_PROC_SCRIPT]),
    ]);
    return { listeners: parseNetstat(net), procs: parseProcTable(ps) };
  }
  const [lsof, ps] = await Promise.all([
    run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-F', 'pcn'], [1]),
    run('ps', ['-A', '-o', 'pid=,ppid=']),
  ]);
  return { listeners: parseLsof(lsof), procs: parseProcTable(ps) };
}

type Scan = { listeners: Listener[]; procs: ProcRow[] };
// `at` = fim do varrimento; `null` enquanto está em curso (os pedidos simultâneos esperam por ele).
let cache: { at: number | null; data: Promise<Scan> } | null = null;

function cachedScan(): Promise<Scan> {
  if (cache && (cache.at === null || Date.now() - cache.at < CACHE_MS)) return cache.data;
  const entry: { at: number | null; data: Promise<Scan> } = { at: null, data: scanSystem() };
  cache = entry;
  entry.data.then(
    () => { entry.at = Date.now(); },
    // Uma falha não fica em cache: o próximo pedido tenta de novo.
    () => { if (cache === entry) cache = null; },
  );
  return entry.data;
}

/** Portas do próprio JOCA OS (backend + frontend) — nunca se listam como «do projecto». */
export function ownPorts(): Set<number> {
  return new Set([
    Number(process.env.PORT || 7491),
    Number(process.env.JOCA_FRONTEND_PORT || 7492),
  ]);
}

export async function listOpenPorts(sessions: PortSession[]): Promise<OpenPort[]> {
  if (sessions.length === 0) return [];
  const { listeners, procs } = await cachedScan();
  return attributePorts(listeners, procs, sessions, ownPorts());
}
