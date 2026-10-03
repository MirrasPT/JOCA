// O claude do «Optimizar» (Agent SDK) nasce com o mesmo ambiente dos terminais (#18).
//
// O que se protege: o filho não herda a sessão do Claude que arrancou o backend nem variáveis que
// injetam código, guarda a config do dono e continua sem as vars da API key (força a subscrição).
// O `query` do SDK é falso — nunca o CLI real.
import { vi, describe, it, expect, afterEach } from 'vitest';

const visto = vi.hoisted(() => ({} as { env?: Record<string, string | undefined> }));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: ({ options }: { options: { env: Record<string, string | undefined> } }) => {
    visto.env = options.env;
    return (async function* () { /* sem mensagens */ })();
  },
}));

import { ClaudeProvider } from '../providers/provider';

const NOMES = ['CLAUDECODE', 'CLAUDE_CODE_MESSAGING_TOKEN', 'CLAUDE_CODE_BRIDGE_SESSION_ID', 'NODE_OPTIONS',
  'CLAUDE_CODE_USE_BEDROCK', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];
const antes = Object.fromEntries(NOMES.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const [k, v] of Object.entries(antes)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
});

describe('ambiente do «Optimizar»', () => {
  it('limpa a sessão do Claude pai e a injeção, guarda a config do dono e tira a API key', async () => {
    for (const k of NOMES) process.env[k] = 'x';
    for await (const _ of new ClaudeProvider().run('reescreve isto', { noTools: true })) { /* nada */ }
    const env = visto.env!;
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.CLAUDE_CODE_MESSAGING_TOKEN).toBeUndefined();
    expect(env.CLAUDE_CODE_BRIDGE_SESSION_ID).toBeUndefined();
    expect(env.NODE_OPTIONS).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
    expect(env.CLAUDE_CODE_USE_BEDROCK).toBe('x');
    expect(env.PATH ?? env.Path).toBeDefined();
  });
});
