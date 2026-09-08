// Retrato em disco das sessões vivas — a rede que apanha o backend a morrer.
//
// O problema: os PTYs vivem SÓ em memória (`SessionManager`). Quando o processo do backend morre
// — crash, SIGKILL do `start.sh`, máquina a suspender — todos os terminais morrem com ele e as
// conversas desaparecem da UI sem uma linha de explicação. Nada disto é recuperável a sério: um
// PTY morto não se reata. O que SE consegue é não deixar o dono sem saber o que lá estava.
//
// O que isto faz: escreve `data/sessions-snapshot.json` com os metadados de cada sessão viva mais
// a CAUDA do output (RAW, com ANSI, para o xterm poder repintá-la). A instância seguinte lê esse
// ficheiro ANTES de o reescrever e oferece o conteúdo pelas rotas `/sessions/recovered*` — o
// cliente decide se mostra o aviso ou se o dispensa (DELETE).
//
// O que isto NÃO faz: reatar processos. Não há reattach de PTY nem processos destacados — está
// fora de âmbito e não funciona nesta arquitectura.
//
// Ritmo de escrita: debounce de 5s (o `output` do PTY dispara centenas de vezes por segundo — uma
// escrita por chunk era impensável) + flush IMEDIATO em SIGTERM, SIGINT e ao criar/fechar uma
// sessão. O SIGTERM apanha o encerramento normal do `start.sh`; a escrita periódica é a única
// coisa que cobre o SIGKILL 2s depois e o crash.
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { DATA_DIR, readJsonFile, writeFileAtomic } from './project-store';
import { sessionManager } from './session-manager';
import type { CliId } from './cli-profiles';

export interface SnapshotSession {
  id: string;
  name: string;
  cwd: string;
  projectId?: string;
  cli: CliId;
  origin: 'user' | 'auto';
  status: 'working' | 'idle';
  /**
   * Geometria do PTY no momento em que o retrato foi tirado.
   *
   * Não é decoração: o output guardado é o de um TUI (o `claude` é o CLI por omissão), e um TUI
   * redesenha o ecrã por POSIÇÃO — apaga linhas, sobe o cursor, escreve por cima. Reproduzir isso
   * noutra largura parte o desenho ao meio, e noutra altura manda para fora do ecrã tudo o que a
   * app posicionou em absoluto (medido: o mesmo retrato reproduzido a 180x32 dá o ecrã inteiro;
   * a 180x24 sobram 6 linhas). Quem lê o retrato precisa das duas medidas ou não o sabe repintar.
   */
  cols: number;
  rows: number;
  /** Últimos <= TAIL_MAX_BYTES do buffer, RAW (com ANSI) — é o que o xterm sabe repintar. */
  tail: string;
}

/**
 * Geometria de recurso, para retratos escritos por uma versão anterior a estes campos.
 *
 * 120x30 e não 80x24: é o tamanho com que o `session-manager` cria cada PTY (`pty.spawn`), logo é
 * o que uma sessão que nunca foi redimensionada tem mesmo. Os limites são os mesmos do
 * `sessionManager.resize` — um ficheiro corrompido não pode pedir um terminal de um milhão de linhas.
 */
const COLS_FALLBACK = 120;
const ROWS_FALLBACK = 30;

function geometriaValida(valor: unknown, fallback: number, min: number, max: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return fallback;
  return Math.max(min, Math.min(Math.floor(valor), max));
}

export interface SessionsSnapshot {
  bootId: string;
  savedAt: number;
  sessions: SnapshotSession[];
}

export const SNAPSHOT_FILE = path.join(DATA_DIR, 'sessions-snapshot.json');

/**
 * Retrato POR RECUPERAR, em ficheiro separado do retrato das sessões vivas.
 *
 * Ter só um ficheiro perdia o caso mais provável de todos: `start.sh` corre num terminal, muitas
 * vezes sem browser aberto. Reiniciar duas vezes seguidas fazia o segundo arranque ler um ficheiro
 * que o primeiro já tinha reescrito com `sessions: []` — e o registo das conversas mortas, que é a
 * única razão de isto existir, desaparecia sem ninguém o ter visto.
 *
 * Com dois ficheiros: o que morre com conversas vivas é PROMOVIDO a `.prev` no arranque seguinte, e
 * o `.prev` só sai daqui quando o utilizador dispensa o aviso. Arrancar não apaga nada.
 */
export const SNAPSHOT_PREV_FILE = path.join(DATA_DIR, 'sessions-snapshot.prev.json');

/** Identidade desta instância do backend. Muda a cada arranque — é assim que o cliente distingue
 *  "as sessões que estão a correr" de "as sessões que morreram com o backend anterior". */
export const BOOT_ID = randomUUID();

const FLUSH_DEBOUNCE_MS = 5000;
const TAIL_MAX_BYTES = 256 * 1024;

/**
 * Cauda do buffer, cortada em BYTES e em sítio seguro.
 *
 * Duas armadilhas, as mesmas que o corte do `BUFFER_MAX` no `session-manager` já paga:
 *
 * 1. **Nunca cortar a meio de um code point.** O corte é por bytes UTF-8; recuar até um byte
 *    inicial evita que a cauda comece com um caracter de substituição.
 * 2. **Nunca cortar a meio de uma sequência de escape.** Se o `\x1b` inicial ficar do lado deitado
 *    fora, os parâmetros que sobram (`38;2;255;0;0m`) chegam ao xterm como TEXTO e o replay
 *    aparece com lixo. Alinhar ao próximo `\x1b` é sempre seguro; o `\x1b[0m` à cabeça repõe o
 *    estado de cor que o corte deitou fora.
 *
 * Exportada para ser testável — uma regressão aqui é silenciosa (o ficheiro escreve-se na mesma).
 */
export function snapshotTail(buffer: string, maxBytes = TAIL_MAX_BYTES): string {
  if (Buffer.byteLength(buffer, 'utf8') <= maxBytes) return buffer;

  const bytes = Buffer.from(buffer, 'utf8');
  let start = bytes.length - maxBytes;
  // 0b10xxxxxx = byte de continuação; avançar até ao início do code point seguinte.
  while (start < bytes.length && (bytes[start] & 0xc0) === 0x80) start++;
  let tail = bytes.subarray(start).toString('utf8');

  const escPos = tail.indexOf('\x1b');
  if (escPos !== -1 && escPos < 2000) {
    tail = tail.slice(escPos);
  } else {
    const nlPos = tail.indexOf('\n');
    if (nlPos !== -1 && nlPos < 500) tail = tail.slice(nlPos + 1);
  }
  return `\x1b[0m${tail}`;
}

// ── Snapshot da instância ANTERIOR ────────────────────────────────────────────────────────────
// Lido UMA vez, no carregamento do módulo — antes de qualquer escrita poder acontecer. A partir
// daqui o ficheiro passa a ser desta instância, e o que lá estava só existe nesta variável.
let previous: SessionsSnapshot | null = promotePreviousSnapshot();

/**
 * Corre UMA vez, no carregamento do módulo, antes de qualquer escrita.
 *
 * Se o retrato das sessões vivas que ficou em disco tem conversas, foi uma morte com trabalho lá
 * dentro: promove-se a `.prev`. Se está vazio (encerramento limpo, ou um arranque a seguir a
 * outro), o que estiver por recuperar fica onde está — arrancar o backend nunca deita fora o que
 * ninguém chegou a ver.
 */
function promotePreviousSnapshot(): SessionsSnapshot | null {
  const vivas = readSnapshotFile(SNAPSHOT_FILE);
  if (vivas && vivas.sessions.length > 0) {
    try {
      writeFileAtomic(SNAPSHOT_PREV_FILE, JSON.stringify(vivas));
      // CONSUMIR o ficheiro das vivas faz parte da promoção, e tem de acontecer aqui — não à espera
      // do `installSessionsSnapshot()`. Senão a promoção deixa de ser idempotente: quem carregue o
      // módulo sem o instalar deixa o retrato antigo em disco, e o arranque seguinte promove-o
      // OUTRA VEZ — inclusive um que o utilizador já tinha dispensado.
      writeFileAtomic(SNAPSHOT_FILE, JSON.stringify({ bootId: BOOT_ID, savedAt: Date.now(), sessions: [] }));
    } catch (e) {
      console.warn('[sessions-snapshot] não consegui promover o retrato anterior:', e);
    }
    return vivas;
  }
  return readSnapshotFile(SNAPSHOT_PREV_FILE);
}

function readSnapshotFile(file: string): SessionsSnapshot | null {
  const raw = readJsonFile<unknown>(file, null);
  if (!raw || typeof raw !== 'object') return null;
  const snap = raw as Partial<SessionsSnapshot>;
  if (typeof snap.bootId !== 'string' || !Array.isArray(snap.sessions)) return null;
  return {
    bootId: snap.bootId,
    savedAt: typeof snap.savedAt === 'number' ? snap.savedAt : 0,
    // A geometria normaliza-se AQUI, uma vez: daqui para a frente (rotas, cliente) ela é sempre
    // dois números utilizáveis, e não "às vezes indefinida porque o ficheiro é antigo".
    sessions: snap.sessions
      .filter((s): s is SnapshotSession => !!s && typeof s.id === 'string')
      .map((s) => ({
        ...s,
        cols: geometriaValida(s.cols, COLS_FALLBACK, 10, 500),
        rows: geometriaValida(s.rows, ROWS_FALLBACK, 5, 200),
      })),
  };
}

/** Metadados das sessões da instância anterior — SEM o `tail` (é grande; vai à parte). */
export function recoveredSessions(): {
  bootId: string;
  previousBootId?: string;
  savedAt?: number;
  sessions: Array<Omit<SnapshotSession, 'tail'> & { tailBytes: number }>;
} {
  if (!previous) return { bootId: BOOT_ID, sessions: [] };
  return {
    bootId: BOOT_ID,
    previousBootId: previous.bootId,
    savedAt: previous.savedAt,
    sessions: previous.sessions.map(({ tail, ...meta }) => ({
      ...meta,
      tailBytes: Buffer.byteLength(tail ?? '', 'utf8'),
    })),
  };
}

/** Cauda raw de uma sessão da instância anterior, ou `undefined` se não existir. */
export function recoveredTail(id: string): string | undefined {
  const found = previous?.sessions.find((s) => s.id === id);
  return found ? (found.tail ?? '') : undefined;
}

/**
 * Dispensar o aviso. Limpa a memória E o `.prev` — é o único sítio que o apaga, e é isso que faz
 * com que reiniciar o backend não perca o que ainda ninguém dispensou. O `SNAPSHOT_FILE` não se
 * toca: desde o arranque que ele é o retrato das sessões VIVAS, e apagá-lo só conseguiria perder
 * as conversas que estão a correr agora.
 */
export function clearRecovered(): void {
  previous = null;
  try {
    fs.rmSync(SNAPSHOT_PREV_FILE, { force: true });
  } catch (e) {
    console.warn('[sessions-snapshot] não consegui apagar o retrato por recuperar:', e);
  }
}

// ── Escrita ───────────────────────────────────────────────────────────────────────────────────
let dirty = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

function currentSnapshot(): SessionsSnapshot {
  return {
    bootId: BOOT_ID,
    savedAt: Date.now(),
    sessions: sessionManager.list().map((s) => ({
      id: s.id,
      name: s.name,
      cwd: s.cwd,
      ...(s.projectId ? { projectId: s.projectId } : {}),
      cli: s.cli,
      origin: s.origin,
      status: s.status,
      // A geometria VIVA do PTY, não a de arranque: o browser redimensiona a sessão ao abrir o
      // painel, e é a última medida que corresponde ao desenho que ficou no buffer.
      cols: geometriaValida(s.pty.cols, COLS_FALLBACK, 10, 500),
      rows: geometriaValida(s.pty.rows, ROWS_FALLBACK, 5, 200),
      tail: snapshotTail(s.buffer),
    })),
  };
}

/**
 * Escreve já, atomicamente (tmp + rename, via `project-store`). Sem sessões vivas o ficheiro fica
 * com `sessions: []` — um encerramento limpo sem conversas não gera aviso nenhum da próxima vez.
 *
 * Síncrona de propósito: é o que a corre no handler de SIGTERM, e o `start.sh` dá SIGKILL 2s
 * depois.
 */
export function flushSessionsSnapshot(): void {
  dirty = false;
  if (timer) { clearTimeout(timer); timer = null; }
  try {
    writeFileAtomic(SNAPSHOT_FILE, JSON.stringify(currentSnapshot()));
  } catch (e) {
    console.warn('[sessions-snapshot] não consegui escrever o retrato das sessões:', e);
  }
}

/** Marca alterações; escreve no máximo 1x cada FLUSH_DEBOUNCE_MS. */
export function scheduleSessionsSnapshot(): void {
  if (!installed) return;
  dirty = true;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    if (dirty) flushSessionsSnapshot();
  }, FLUSH_DEBOUNCE_MS);
  timer.unref?.();
}

/**
 * Liga o snapshot ao ciclo de vida das sessões e aos sinais de encerramento.
 *
 * O handler de sinal remove-se a si próprio (`once`) e volta a enviar o mesmo sinal, para o
 * processo morrer com o estado que morreria sem este código — um `process.exit(0)` mudava o código
 * de saída de quem estiver a ver.
 */
export function installSessionsSnapshot(): void {
  if (installed) return;
  installed = true;

  sessionManager.on('output', scheduleSessionsSnapshot);
  sessionManager.on('status', scheduleSessionsSnapshot);
  // Criar e fechar são momentos raros e caros de perder → flush imediato.
  sessionManager.on('spawn', flushSessionsSnapshot);
  sessionManager.on('closed', flushSessionsSnapshot);

  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.once(sig, () => {
      flushSessionsSnapshot();
      process.kill(process.pid, sig);
    });
  }

  // Estado inicial em disco: sem isto, um backend que arranca e morre antes da primeira sessão
  // deixava lá o retrato da instância anterior e a seguinte avisava outra vez pelo mesmo.
  flushSessionsSnapshot();
}
