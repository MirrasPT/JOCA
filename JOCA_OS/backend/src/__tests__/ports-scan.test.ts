// Varrimento do sistema (issue #13): uma falha dos comandos NÃO é «nenhuma porta», o output de um
// processo morto por timeout não se usa, e só o varrimento bom fica em cache. O `execFile` é falso
// e responde por comando — serve ao Windows (netstat + powershell) e ao Mac/Linux (lsof + ps).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type ExecErr = Error & { code?: unknown; killed?: boolean };
type Reply = { err?: ExecErr; out: string };
type Cb = (err: ExecErr | null, stdout: string) => void;

const { execFile, replies } = vi.hoisted(() => {
  const replies: { fn: (cmd: string) => Reply } = { fn: () => ({ out: '' }) };
  const execFile = vi.fn((cmd: string, _args: string[], _opts: unknown, cb: Cb) => {
    const r = replies.fn(cmd);
    setImmediate(() => cb(r.err ?? null, r.out));
  });
  return { execFile, replies };
});

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  execFile,
}));

// Uma sessão (shell 8000) com um node (9100) a escutar na 5173, nos formatos de cada sistema.
const OK: Record<string, string> = {
  netstat: '  TCP    127.0.0.1:5173         0.0.0.0:0              LISTENING       9100\r\n',
  'powershell.exe': '8000 1 powershell.exe\r\n9100 8000 node.exe\r\n',
  lsof: 'p9100\ncnode\nf23\nn127.0.0.1:5173\n',
  ps: ' 8000 1\n 9100 8000\n',
};
const ok = (cmd: string): Reply => ({ out: OK[cmd] ?? '' });
const fail = (extra: Partial<ExecErr>): ExecErr => Object.assign(new Error('x'), extra);
const SESS = [{ id: 's1', name: 'dev', pid: 8000 }];

let ports: typeof import('../ports');
let now = 1_000_000;

beforeEach(async () => {
  vi.resetModules();                 // cache do módulo limpa em cada teste
  execFile.mockClear();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  ports = await import('../ports');
});
afterEach(() => { vi.restoreAllMocks(); });

describe('listOpenPorts — varrimento do sistema', () => {
  it('comando que falha → PortsUnavailableError com aviso, nunca lista vazia', async () => {
    replies.fn = () => ({ err: fail({ code: 'ENOENT' }), out: '' });
    await expect(ports.listOpenPorts(SESS)).rejects.toBeInstanceOf(ports.PortsUnavailableError);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/^\[ports\] .+ falhou: ENOENT$/));
  });

  it('timeout: o stdout cortado não se usa, mesmo parecendo válido', async () => {
    replies.fn = (cmd) => (cmd === 'powershell.exe' || cmd === 'ps'
      ? { err: fail({ killed: true, code: null }), out: '8000 1 powershell.exe\r\n9100 8000 node.exe\r\n' }
      : ok(cmd));
    await expect(ports.listOpenPorts(SESS)).rejects.toBeInstanceOf(ports.PortsUnavailableError);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/falhou: timeout/));
  });

  it('a falha não fica em cache; o varrimento bom fica 10 s e depois renova', async () => {
    replies.fn = () => ({ err: fail({ code: 2 }), out: '' });
    await expect(ports.listOpenPorts(SESS)).rejects.toBeInstanceOf(ports.PortsUnavailableError);
    expect(execFile).toHaveBeenCalledTimes(2);

    replies.fn = ok;
    const first = await ports.listOpenPorts(SESS);
    expect(first.map((p) => p.port)).toEqual([5173]);
    expect(execFile).toHaveBeenCalledTimes(4);        // tentou de novo: a falha não ficou guardada

    now += 9_000;                                      // dentro do intervalo do polling → cache
    await ports.listOpenPorts(SESS);
    expect(execFile).toHaveBeenCalledTimes(4);

    now += 1_500;                                      // passou dos 10 s → varrimento novo
    await ports.listOpenPorts(SESS);
    expect(execFile).toHaveBeenCalledTimes(6);
  });

  it('pedidos simultâneos partilham o mesmo varrimento em curso', async () => {
    replies.fn = ok;
    await Promise.all([ports.listOpenPorts(SESS), ports.listOpenPorts(SESS), ports.listOpenPorts(SESS)]);
    expect(execFile).toHaveBeenCalledTimes(2);        // 2 comandos, 1 varrimento
  });
});
