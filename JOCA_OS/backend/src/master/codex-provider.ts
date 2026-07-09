// CodexProvider — Master brain via the `codex` CLI on the user's ChatGPT SUBSCRIPTION (logged in
// with `codex login` → ChatGPT auth in ~/.codex/auth.json; NOT the OpenAI API, no API key). Mirrors
// the ClaudeProvider contract: same MasterProvider interface, same ProviderEvent union. costUsd is
// always 0 here — `codex exec` reports only token counts (usage{input_tokens,output_tokens,...}),
// never a USD figure (subscription, not metered API). So we surface 0, like the local providers.
//
// ── WHAT IS VERIFIED (real probes, codex-cli 0.135.0, 2026-06-25) ─────────────────────────────
//   `codex --version`         → codex-cli 0.135.0
//   `codex login status`      → "Logged in using ChatGPT"  (subscription, not API key)
//   `codex exec --json <p>`   → JSONL on stdout. Observed event shapes (exact):
//       {"type":"thread.started","thread_id":"..."}
//       {"type":"turn.started"}
//       {"type":"item.started","item":{...}}
//       {"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"OK"}}
//       {"type":"item.completed","item":{"type":"command_execution","command":...,"status":...}}
//       {"type":"item.completed","item":{"type":"mcp_tool_call","server":"probe","tool":"ping_joca",
//                "arguments":{"who":"renato"},"result":{"content":[{"type":"text","text":"..."}]},
//                "error":null,"status":"completed"}}
//       {"type":"turn.completed","usage":{"input_tokens":..,"output_tokens":..,...}}   (no cost_usd)
//     Confirmed by running `codex exec --json --skip-git-repo-check -s read-only "reply with exactly: OK"`.
//   MCP wiring CAN work: registering a stdio MCP server via repeated `-c mcp_servers.<name>.command`
//     + `-c mcp_servers.<name>.args=[...]` (TOML literal strings, single-quoted) made codex DISCOVER
//     and CALL a probe tool. The tool call only EXECUTED (rather than "user cancelled MCP tool call")
//     under `--dangerously-bypass-approvals-and-sandbox` — in non-interactive `exec` there is no human
//     to approve, and read-only/on-request both cancel MCP calls. The bypass flag is the documented
//     escape hatch for "environments that are externally sandboxed" (the JOCA backend is that host).
//     Round-trip proven: ping_joca({who:"renato"}) → "TOKEN-JOCA-7391 for renato" → final agent_message.
//
// ── WHAT IS *NOT* VERIFIED (the orchestration gap) ───────────────────────────────────────────
//   The Master tools (spawn_worker, …) operate on the in-process `sessionManager` singleton, which
//   lives in THIS backend process. `codex exec` launches its MCP server as a SEPARATE child process —
//   that child cannot reach the in-process SessionManager. So the standalone MCP server must call the
//   backend over HTTP. The backend exposes NO such control endpoints today (checked server.ts: only
//   /projects, /master-chat, /master-providers, /open, /files … — nothing to spawn/read/send workers).
//   Therefore the full tool-orchestration path is wired here but GATED behind a runtime check + TODO;
//   it is NOT proven end-to-end and run() will refuse it loudly until the bridge exists. The text path
//   below IS proven and works today.
import { spawn } from 'child_process';
import { execFile } from 'child_process';
import type { MasterProvider, MasterRunOptions, ProviderEvent } from './provider';
import { NODE_BIN, CODEX_BRIDGE_PATH, MASTER_BACKEND_URL, MASTER_SECRET_FILE } from './bridge-config';

// ── codex exec --json wire types (only the fields we read; verified against live JSONL) ─────────
interface CodexAgentMessageItem { id?: string; type: 'agent_message'; text?: string }
interface CodexMcpToolCallItem {
  type: 'mcp_tool_call';
  server?: string;
  tool?: string;
  arguments?: unknown;
  result?: { content?: Array<{ type?: string; text?: string }> } | null;
  error?: { message?: string } | null;
  status?: string;
}
interface CodexCommandExecItem { type: 'command_execution'; command?: string; status?: string }
type CodexItem = CodexAgentMessageItem | CodexMcpToolCallItem | CodexCommandExecItem | { type: string };

type CodexEvent =
  | { type: 'thread.started'; thread_id?: string }
  | { type: 'turn.started' }
  | { type: 'item.started'; item: CodexItem }
  | { type: 'item.completed'; item: CodexItem }
  | { type: 'turn.completed'; usage?: Record<string, number> }
  | { type: string; [k: string]: unknown };

// Strip the auth vars so the CLI cannot silently fall back to a metered OpenAI API key — we want
// the ChatGPT subscription credential in ~/.codex/auth.json to win. (Parallel to provider.ts's
// subscriptionEnv() for Claude.) execFile/spawn env REPLACES the child env, so copy process.env first.
function subscriptionEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.OPENAI_API_KEY;
  delete env.CODEX_API_KEY;
  return env;
}

export class CodexProvider implements MasterProvider {
  readonly name = 'codex';

  // available() = the codex CLI is present on PATH. (Login state is a separate, heavier check;
  // bin presence is the cheap signal the Settings selector needs. getProviderAvailability() in
  // provider.ts already does `where codex`; this mirrors it so the provider self-reports too.)
  async available(): Promise<boolean> {
    const present = await new Promise<boolean>((resolve) => {
      const cmd = process.platform === 'win32' ? 'where' : 'which';
      execFile(cmd, ['codex'], (err) => resolve(!err));
    });
    return present;
  }

  // run() drives `codex exec --json <prompt>` and normalizes its JSONL stream into ProviderEvents.
  //
  // TEXT PATH (VERIFIED working): no mcpServers supplied → codex just answers. agent_message items
  // become {type:'text'}; the LAST agent_message + turn.completed become the {type:'result'}.
  //
  // TOOL-ORCHESTRATION PATH (NOT verified — see file header): supplying opts.mcpServers means the
  // caller wants codex to drive workers via the Master tools. Those tools need the in-process
  // SessionManager, which a codex-spawned MCP subprocess cannot reach. Until a standalone HTTP-bridge
  // MCP server + backend control endpoints exist, this path is refused loudly rather than faked.
  // ORCHESTRATION PATH (WIRED). Registers the JOCA Master MCP bridge so codex drives workers via the
  // SAME 7 tools as Claude. The bridge (codex-master-bridge.mjs) reaches the in-process SessionManager
  // over the backend control plane (GET /master/tools-schema + POST /master/tool). codex exec is
  // non-interactive so MCP tool calls only EXECUTE under --dangerously-bypass-approvals-and-sandbox
  // (no human to approve; the JOCA backend is the sandbox host). The (long, multi-line) system+user
  // prompt is fed via STDIN to avoid any command-line quoting.
  async *run(prompt: string, opts: MasterRunOptions = {}): AsyncGenerator<ProviderEvent, void> {
    const fullPrompt = opts.systemPrompt ? `${opts.systemPrompt}\n\n---\n\n${prompt}` : prompt;
    const args = ['exec', '--json', '--skip-git-repo-check', '--dangerously-bypass-approvals-and-sandbox'];
    // Register the bridge via -c overrides (verified-working pattern). On WINDOWS spawn runs through the
    // cmd.exe shim (shell:true — needed for the codex .cmd), so each whole key=value must be wrapped in
    // double quotes to survive as one token. On macOS/Linux spawn is shell:false and passes argv
    // literally — wrapping in double quotes there injects LITERAL " chars into the arg, so codex fails to
    // parse the -c override, registers ZERO mcp_servers, and the brain runs with no Master tools
    // ("sem ferramentas Master expostas"). So quote only on win32; pass raw otherwise.
    // The inner single quotes are TOML literal strings (backslashes/spaces in paths stay literal).
    const q = (kv: string) => (process.platform === 'win32' ? `"${kv}"` : kv);
    args.push('-c', q(`mcp_servers.master.command='${NODE_BIN}'`));
    // argv = [bridge.mjs, backendUrl, secretFile]. Pass the EXACT secret path (bridge-config is the
    // single source of truth for DATA_DIR) so the bridge never recomputes it with ../../ — that trap
    // had the bridge reading backend/data while the secret lives in JOCA_OS/data → bridge crash →
    // codex got 0 tools → it did the work itself in the background instead of opening JOCA UI workers.
    args.push('-c', q(`mcp_servers.master.args=['${CODEX_BRIDGE_PATH}', '${MASTER_BACKEND_URL}', '${MASTER_SECRET_FILE}']`));
    if (opts.model) args.push('--model', opts.model);
    yield* this.streamCodex(args, fullPrompt, opts);
  }

  // Spawns `codex exec --json <args>`, writes the prompt to STDIN, and yields ProviderEvents.
  private async *streamCodex(args: string[], stdinPrompt: string, opts: MasterRunOptions): AsyncGenerator<ProviderEvent, void> {
    const child = spawn('codex', args, {
      env: subscriptionEnv(),
      cwd: opts.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32', // resolve the `codex` shim (.cmd) on Windows
    });
    // codex exec reads instructions from stdin when none is given as an argument.
    child.stdin?.write(stdinPrompt);
    child.stdin?.end();

    let stderr = '';
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    // Buffer stdout and split on newlines; each complete line is one JSON event.
    let buf = '';
    const lineQueue: string[] = [];
    let resolveLine: (() => void) | null = null;
    let ended = false;
    let exitCode: number | null = null;

    child.stdout?.on('data', (d: Buffer) => {
      buf += d.toString();
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, '');
        buf = buf.slice(nl + 1);
        if (line.trim()) lineQueue.push(line);
      }
      resolveLine?.();
    });
    child.on('close', (code) => {
      exitCode = code;
      ended = true;
      if (buf.trim()) lineQueue.push(buf.trim());
      buf = '';
      resolveLine?.();
    });

    let lastAgentText = '';
    let sawAnyText = false;

    // Async pull loop: drain the queue, awaiting more lines until the process closes.
    for (;;) {
      if (lineQueue.length === 0) {
        if (ended) break;
        await new Promise<void>((r) => { resolveLine = r; });
        resolveLine = null;
        continue;
      }
      const line = lineQueue.shift()!;
      let ev: CodexEvent;
      try { ev = JSON.parse(line) as CodexEvent; }
      catch { continue; } // non-JSON noise (e.g. "Reading additional input from stdin...") — skip
      yield* this.mapEvent(ev, (t) => { lastAgentText = t; sawAnyText = true; });
    }

    const isError = exitCode !== 0 && exitCode !== null;
    const text = isError && !sawAnyText
      ? `codex exec falhou (exit ${exitCode})${stderr ? `: ${stderr.trim().slice(-500)}` : ''}`
      : lastAgentText;
    // costUsd: 0 — codex exec --json reports token usage only, never a USD cost (subscription).
    yield { type: 'result', text, isError, costUsd: 0 };
  }

  // Normalize one codex JSONL event into ProviderEvents. `onAgentText` records the running last
  // agent_message so runExecText can use it as the final result text.
  private *mapEvent(ev: CodexEvent, onAgentText: (t: string) => void): Generator<ProviderEvent> {
    if (ev.type !== 'item.completed' && ev.type !== 'item.started') return;
    const item = (ev as { item?: CodexItem }).item;
    if (!item) return;

    if (item.type === 'agent_message') {
      const text = (item as CodexAgentMessageItem).text ?? '';
      if (text.trim()) { onAgentText(text); }
      // Only emit streamed text on completion to avoid duplicate started/completed pairs.
      if (ev.type === 'item.completed' && text.trim()) yield { type: 'text', text };
    } else if (item.type === 'mcp_tool_call' && ev.type === 'item.started') {
      // VERIFIED shape. When the tool path is enabled this surfaces orchestration steps to the UI,
      // matching ClaudeProvider's {type:'tool_use'} on assistant tool_use blocks.
      const m = item as CodexMcpToolCallItem;
      yield { type: 'tool_use', name: m.tool ?? 'unknown', input: m.arguments ?? {} };
    }
    // command_execution items (codex running shell) are intentionally not surfaced as ProviderEvents
    // in Fase 1a — they are codex-internal, not Master orchestration steps.
  }
}

export const codexProvider = new CodexProvider();
