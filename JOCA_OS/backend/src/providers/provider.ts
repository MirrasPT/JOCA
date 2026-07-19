// Brain layer — direct LLM calls (no terminal, no orchestration). Used by the automations
// `llm` node (cheap summarise/transform) and the "Optimizar" text-rewrite feature.
//
// Verified against @anthropic-ai/claude-agent-sdk@0.3.185 (sdk.d.ts + official TS reference):
//   query({prompt, options}): Query extends AsyncGenerator<SDKMessage, void>
//   Options.env REPLACES the subprocess environment (does NOT merge) — so the auth strip below
//   builds {...process.env} minus the API-key vars; the CLI then falls back to the subscription.
//   ⚠️ ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN in env would WIN and bill credits — strip them.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { execFile } from 'child_process';
import type { LlmProvider as LlmProviderId } from '../project-store';

export type ProviderEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; input: unknown }
  | { type: 'result'; text: string; isError: boolean; costUsd: number };

export interface BrainRunOptions {
  systemPrompt?: string;
  model?: string;                                  // 'opus' | 'sonnet' | 'haiku' | full id
  cwd?: string;
  noTools?: boolean;                               // disable ALL built-in tools → pure text completion
}

// Build an env that forces SUBSCRIPTION auth: copy process.env, drop the API-key vars.
// Options.env replaces (not merges), so we must include the rest of process.env (PATH, etc.).
function subscriptionEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

export class ClaudeProvider {
  readonly name = 'claude';

  async *run(prompt: string, opts: BrainRunOptions = {}): AsyncGenerator<ProviderEvent, void> {
    const q = query({
      prompt,
      options: {
        env: subscriptionEnv(),
        permissionMode: 'bypassPermissions',
        model: opts.model,
        systemPrompt: opts.systemPrompt,
        cwd: opts.cwd,
        // noTools → pure text completion (no Bash/Read/etc). Used by /optimize-objective so the brain
        // REWRITES the instruction instead of EXECUTING it. tools:[] disables all built-ins; maxTurns:1
        // is belt-and-suspenders against any tool/continue loop.
        ...(opts.noTools ? { tools: [] as string[], maxTurns: 1 } : {}),
      },
    });

    for await (const msg of q) {
      if (msg.type === 'assistant') {
        // msg.message is a Beta Messages API message; content is a block array.
        const content = (msg.message as { content?: unknown[] }).content ?? [];
        for (const raw of content) {
          const block = raw as { type?: string; text?: string; name?: string; input?: unknown };
          if (block.type === 'text' && typeof block.text === 'string') {
            yield { type: 'text', text: block.text };
          } else if (block.type === 'tool_use') {
            yield { type: 'tool_use', name: block.name ?? 'unknown', input: block.input };
          }
        }
      } else if (msg.type === 'result') {
        const isError = msg.is_error;
        const text = msg.subtype === 'success' ? msg.result : '';
        const costUsd = (msg as { total_cost_usd?: number }).total_cost_usd ?? 0;
        yield { type: 'result', text, isError, costUsd };
      }
    }
  }
}

export const claudeProvider = new ClaudeProvider();

// ── Provider availability (for the Settings selector) ───────────────────────
// `available` = the brain CAN run on this machine (CLI logged in / endpoint up).
export interface ProviderInfo {
  id: LlmProviderId;
  label: string;
  available: boolean;
  defaultModel: string;
  detail: string;
}

export function binExists(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execFile(cmd, [bin], (err) => resolve(!err));
  });
}

async function ollamaUp(): Promise<boolean> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 1200);
    const r = await fetch('http://127.0.0.1:11434/api/tags', { signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

export async function getProviderAvailability(): Promise<ProviderInfo[]> {
  const ollama = await ollamaUp();
  return [
    { id: 'claude', label: 'Claude · Agent SDK', available: true, defaultModel: 'sonnet', detail: 'Subscrição Anthropic (custo-zero)' },
    { id: 'ollama', label: 'Ollama · local', available: ollama, defaultModel: '', detail: ollama ? 'Inferência local (custo-zero)' : 'Não detectado em :11434' },
  ];
}
