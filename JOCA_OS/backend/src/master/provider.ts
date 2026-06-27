// ProviderManager — Fase 1a. Provider-agnostic brain layer; only the `claude` provider is
// implemented in this phase (Claude Agent SDK driving the logged-in Claude Code CLI on the
// Anthropic SUBSCRIPTION — zero marginal cost). Gemini/Codex/Ollama are future providers behind
// the same MasterProvider interface.
//
// Verified against @anthropic-ai/claude-agent-sdk@0.3.185 (sdk.d.ts + official TS reference):
//   query({prompt, options}): Query extends AsyncGenerator<SDKMessage, void>
//   Options.env REPLACES the subprocess environment (does NOT merge) — so the auth strip below
//   builds {...process.env} minus the API-key vars; the CLI then falls back to the subscription.
//   ⚠️ ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN in env would WIN and bill credits — strip them.
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { execFile } from 'child_process';
import type { MasterProvider as MasterProviderId } from '../project-store';

export type ProviderEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; input: unknown }
  | { type: 'result'; text: string; isError: boolean; costUsd: number };

export interface MasterRunOptions {
  systemPrompt?: string;
  model?: string;                                  // 'opus' | 'sonnet' | 'haiku' | full id
  cwd?: string;
  mcpServers?: NonNullable<Options['mcpServers']>; // e.g. { master: createMasterToolsServer(...) }
  onProjectsChanged?: () => void;                  // forwarded to the tool layer (non-Claude providers)
  noTools?: boolean;                               // disable ALL built-in tools → pure text completion
}

export interface MasterProvider {
  readonly name: string;
  available(): Promise<boolean>;
  run(prompt: string, opts?: MasterRunOptions): AsyncGenerator<ProviderEvent, void>;
}

// Build an env that forces SUBSCRIPTION auth: copy process.env, drop the API-key vars.
// Options.env replaces (not merges), so we must include the rest of process.env (PATH, etc.).
function subscriptionEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

export class ClaudeProvider implements MasterProvider {
  readonly name = 'claude';

  async available(): Promise<boolean> {
    // The SDK bundles a Claude Code binary; a successful auth probe is the real signal.
    try {
      return await this.authProbe();
    } catch {
      return false;
    }
  }

  // Lightweight probe: run a 1-token request with the stripped env and confirm it completes
  // without an auth error. NOTE: the SDK does not expose *which* credential won, so we cannot
  // assert "subscription" with certainty here — the load-bearing guarantee is the env strip
  // (applied on every run). We log the outcome so it can be eyeballed against billing.
  async authProbe(): Promise<boolean> {
    const q = query({
      prompt: 'Reply with exactly: OK',
      options: {
        env: subscriptionEnv(),
        permissionMode: 'bypassPermissions',
        systemPrompt: 'You are a connectivity probe. Reply with exactly: OK',
      },
    });
    for await (const msg of q) {
      if (msg.type === 'result') {
        const ok = !msg.is_error;
        // total_cost_usd is computed regardless of credential; treat as informational only.
        const cost = (msg as { total_cost_usd?: number }).total_cost_usd ?? 0;
        console.log(`[master:auth-probe] provider=claude ok=${ok} reported_cost_usd=${cost} (env-strip applied; ANTHROPIC_API_KEY/AUTH_TOKEN removed)`);
        return ok;
      }
    }
    return false;
  }

  async *run(prompt: string, opts: MasterRunOptions = {}): AsyncGenerator<ProviderEvent, void> {
    const q = query({
      prompt,
      options: {
        env: subscriptionEnv(),
        permissionMode: 'bypassPermissions',
        model: opts.model,
        systemPrompt: opts.systemPrompt,
        cwd: opts.cwd,
        mcpServers: opts.mcpServers,
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
// `wired`     = JOCA already drives it to orchestrate workers. Claude is wired now;
//               Ollama (in-process tool loop) and Codex/Antigravity (standalone MCP
//               bridge) are the next increments — selectable but not yet orchestrating.
export interface ProviderInfo {
  id: MasterProviderId;
  label: string;
  available: boolean;
  wired: boolean;
  defaultModel: string;
  detail: string;
}

function binExists(bin: string): Promise<boolean> {
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
  const [codex, agy, ollama] = await Promise.all([binExists('codex'), binExists('agy'), ollamaUp()]);
  return [
    { id: 'claude', label: 'Claude · Agent SDK', available: true, wired: true, defaultModel: 'sonnet', detail: 'Subscrição Anthropic (custo-zero)' },
    { id: 'ollama', label: 'Ollama · local', available: ollama, wired: ollama, defaultModel: '', detail: ollama ? 'Orquestra workers (tool-calling local)' : 'Não detectado em :11434' },
    { id: 'codex', label: 'Codex · OpenAI', available: codex, wired: codex, defaultModel: '', detail: codex ? 'Orquestra workers (bridge MCP, subscrição)' : 'codex CLI não encontrado' },
    { id: 'antigravity', label: 'Antigravity · Gemini', available: agy, wired: false, defaultModel: '', detail: agy ? 'Subscrição · agy -p não emite p/ pipe (bloqueado)' : 'agy CLI não encontrado' },
  ];
}
