// O filho do Haiku nasce com o mesmo ambiente dos terminais (#106).
//
// O que se protege: o `claude -p` do nomeador já não perde a config do dono com o prefixo
// CLAUDE_CODE_* (ex.: CLAUDE_CODE_USE_BEDROCK) e perde o que a lista negra dos terminais tira.
// O `execFile` é falso — nunca o CLI real — e corre em qualquer sistema, Windows incluído.
import { vi, describe, it, expect, afterEach } from 'vitest';

const { execFile, visto } = vi.hoisted(() => {
  const visto: { env?: NodeJS.ProcessEnv } = {};
  type Cb = (err: Error | null, stdout: string) => void;
  const execFile = vi.fn((_bin: string, _args: string[], opts: { env: NodeJS.ProcessEnv }, cb: Cb) => {
    visto.env = opts.env;
    setImmediate(() => cb(null, 'Deploy VPS\n'));
    return { stdin: { on() {}, end() {} } };
  });
  return { execFile, visto };
});

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  execFile,
}));

import { criarNomeadorHaiku, ambienteDoTerminal } from '../session-namer';

const NOMES = ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_USE_BEDROCK', 'NODE_OPTIONS', 'JOCA_API_TOKEN'];
const antes = Object.fromEntries(NOMES.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const [k, v] of Object.entries(antes)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
});

describe('nomeador Haiku: ambiente do filho (#106)', () => {
  it('usa a limpeza dos terminais: fica a config CLAUDE_CODE_* do dono, sai a sessão e a injecção', async () => {
    Object.assign(process.env, {
      CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDE_CODE_USE_BEDROCK: '1',
      NODE_OPTIONS: '--max-old-space-size=64', JOCA_API_TOKEN: 'x',
    });
    expect(await criarNomeadorHaiku('claude-falso')('corrige o login')).toBe('Deploy VPS');
    expect(execFile).toHaveBeenCalledTimes(1);
    const env = visto.env!;
    expect(env.CLAUDE_CODE_USE_BEDROCK).toBe('1');
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
    expect(env.NODE_OPTIONS).toBeUndefined();
    expect(env.JOCA_API_TOKEN).toBeUndefined();
    expect(Object.keys(env).sort()).toEqual(Object.keys(ambienteDoTerminal()).sort());
  });
});
