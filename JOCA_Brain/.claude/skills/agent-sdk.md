---
name: agent-sdk
description: "Build apps on @anthropic-ai/claude-agent-sdk (the SDK that powers Claude Code CLI). Use when: building Claude Code orchestrators, programmatic Claude sessions, subscription-billed (zero-cost) Claude invocations, JOCA_OS-style multi-terminal apps, MCP server creation with agent-sdk tools."
triggers: claude-agent-sdk, agent sdk, programmatic claude, subscription claude, zero-cost claude, JOCA_OS backend, claude code orchestrator, query sdk, createSdkMcpServer
origin: local
---

# Agent SDK — @anthropic-ai/claude-agent-sdk

**Package distinction — critical:** `@anthropic-ai/claude-agent-sdk` (this skill) ≠ `@anthropic-ai/sdk` (Messages API). Wrong package = API key billing + wrong API surface.

## Install

```bash
npm install @anthropic-ai/claude-agent-sdk
```

**After install:** read `.d.ts` files as source of truth. Never trust online docs alone — the SDK ships types that reflect actual runtime behavior. Online docs lag or are incomplete.

```bash
# The types live at the package ROOT, not in dist/ (sdk.d.ts has ~7000 lines)
ls node_modules/@anthropic-ai/claude-agent-sdk/*.d.ts   # sdk.d.ts, sdk-tools.d.ts, bridge.d.ts
grep -n "resume\|mcpServers\|createSdkMcpServer" node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts
```

---

## Core API

### `query()` — async iterable of SDK messages

```ts
import { query } from '@anthropic-ai/claude-agent-sdk';

const stream = query({
  prompt: string,
  options?: Options,   // see env section below
});

for await (const message of stream) {
  // message is SDKMessage — discriminate by type
}
```

`query()` returns a `Query` object (async iterable). Iterate with `for await`.

### Message types

```ts
// SDKAssistantMessage
message.type === 'assistant'
message.message   // BetaMessage from @anthropic-ai/sdk
message.message.content  // ContentBlock[]

// SDKResultMessage
message.type === 'result'
message.result         // string — CONTAINS DUPLICATE (see de-dup below)
message.is_error       // boolean
message.total_cost_usd // number — 0 when using subscription
```

---

## Env-strip pattern — subscription usage (zero-cost)

`Options.env` **replaces** `process.env` entirely (does NOT merge). Passing `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` in env makes Claude bill that key. To use the subscription (zero-cost), strip those keys:

```ts
const {
  ANTHROPIC_API_KEY,
  ANTHROPIC_AUTH_TOKEN,
  ...rest
} = process.env;

const stream = query({
  prompt,
  options: { env: rest },   // subscription — no key, no billing
});
```

Passing `{}` as env also works but drops all env vars (PATH, HOME, etc.) — prefer the destructure pattern.

---

## De-duplication pattern

The SDK **repeats the last assistant text block** in `SDKResultMessage.result`. If you display both, content appears twice.

```ts
let lastAssistantText = '';

for await (const message of stream) {
  if (message.type === 'assistant') {
    const textBlocks = message.message.content
      .filter(b => b.type === 'text')
      .map(b => b.text);
    if (textBlocks.length > 0) {
      lastAssistantText = textBlocks.at(-1) ?? '';
    }
    // display assistant message normally
  }

  if (message.type === 'result') {
    // exact match first; fall back to trimmed match if SDK adds whitespace
    const isDup = message.result === lastAssistantText
      || message.result.trim() === lastAssistantText.trim();
    const deduped = isDup ? '' : message.result;
    if (deduped && !message.is_error) {
      // display deduped result
    }
  }
}
```

---

## MCP server creation

```ts
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const server = createSdkMcpServer({
  name: 'my-server',
  version: '1.0.0',
  tools: [
    tool(
      'tool_name',
      'Tool description for Claude',
      { input: z.string() },          // zod raw shape (not z.object(...))
      async ({ input }) => ({          // handler — returns CallToolResult
        content: [{ type: 'text', text: `result: ${input}` }],
      }),
      // optional 5th parameter: { annotations?, searchHint?, alwaysLoad? }
    ),
  ],
});
```

**Connect to the model** — the tools arrive as `mcp__<server>__<tool>`:

```ts
query({ prompt, options: {
  tools: [],                              // turns ALL built-ins off (Bash/Read/Write)
  mcpServers: { joca: server },           // only your tools exist
  allowedTools: ['mcp__joca__tool_name'], // auto-approves (does NOT restrict — `tools` is what restricts)
  permissionMode: 'default',              // with no FS tools you don't need bypassPermissions
}});
```

⚠ **`permissionMode: 'bypassPermissions'` = `--dangerously-skip-permissions`**, which the CLI **refuses** when running as root. An agent with `tools: []` does not need it — use `'default'` + `allowedTools`.

---

## PTY / TUI submission (Claude Code terminal)

Raw newlines (`\n`) submit early in bracketed-paste mode — the TUI interprets them as submit. Use bracketed-paste + delayed CR:

```ts
const BP_START = '\x1b[200~';
const BP_END   = '\x1b[201~';
const CR       = '\r';

function submitToPty(pty: IPty, text: string, delayMs = 80): void {
  pty.write(`${BP_START}${text}${BP_END}`);
  setTimeout(() => pty.write(CR), delayMs);
}
```

**Never** write `text + '\n'` directly — splits multi-line prompts into multiple submissions.

---

## Multi-turn conversation (persistent chat)

The SDK does **not accept** an array of messages. The history comes from one of its own sessions:

```ts
// turn 1 — save the session_id that comes in the result event
let sessionId: string | undefined;
for await (const msg of query({ prompt: 'hello', options })) {
  if (msg.type === 'result') sessionId = msg.session_id;   // sdk.d.ts: SDKResultSuccess.session_id
}

// turn 2 — the SDK reloads the history of that conversation
query({ prompt: 'and before that?', options: { ...options, resume: sessionId } });
```

- `resume: string` — resumes a session. `continue: true` resumes the most recent one for the cwd (**exclusive** with resume).
- `sessionId` — forces a UUID of your own; `forkSession` branches; `resumeSessionAt` resumes up to a message uuid.
- **Never** rebuild the history by pasting the transcript into the prompt: it costs tokens on every turn and degrades.

### Streaming input (inject without forcing a turn)

`prompt` also accepts `AsyncIterable<SDKUserMessage>`. Each message can carry:
- `priority: 'now' | 'next' | 'later'` — injection priority
- **`shouldQuery: false`** — appends to the transcript **without** firing an assistant turn (merges into the next one)

Useful for "the worker produced new output, put it in the context but don't wake the agent yet".
In streaming mode the `Query` object also exposes `interrupt()`, `setModel()`, `setPermissionMode()`,
`setMcpServers()`, `getContextUsage()` and `close()`.

## Session spawn pattern (UI broadcast) — JOCA

In JOCA_OS the `SessionManager` emits `'spawn'` with `{ session }`; it is `server.ts` that translates it
into the WS broadcast `{ type: 'session_created', session: SessionInfo }`. Without that broadcast the
session exists in the backend but does not appear in the UI.

---

## Anti-fabrication rule

This SDK has sparse public documentation. When a method or option is not confirmed in `.d.ts`:
- Leave `TODO: verify in .d.ts — not confirmed`
- Do NOT invent parameter names or return shapes
- Do NOT assume parity with `@anthropic-ai/sdk` — different package, different API surface

---

## Pure text completion — disable tools (no side effects)

**The Agent SDK is an AGENT, not a completer.** `query()` ships the built-in tools (Bash, Read, Edit, …) **ON by default** even when you pass no `mcpServers`. So using it as a plain "rewrite this text" / "summarize" call is dangerous: given an imperative prompt ("read my emails with gws and summarize"), the model will **actually run the tools** (executes `gws`, returns real emails) instead of rewriting the instruction. A system prompt saying "don't execute" does **not** stop it — the model has the tools and uses them.

For a pure, side-effect-free text completion, **disable all tools**:

```ts
const stream = query({
  prompt,
  options: {
    tools: [],     // empty array = ALL built-ins OFF (confirmed in sdk.d.ts)
    maxTurns: 1,   // defensive: no multi-step agentic loop
  },
});
```

Rule of thumb: **Agent SDK ≠ Messages API.** When you only want text out, constrain `tools: []`; otherwise the agent can reach shell/files and act. Confirm the option in the installed `.d.ts` (online docs don't highlight this). (Source: JOCA_OS "Optimizar" feature 2026-06-25.)

---

## Anti-patterns

| Wrong | Correct |
|---|---|
| `import { query } from '@anthropic-ai/sdk'` | `from '@anthropic-ai/claude-agent-sdk'` |
| `options: { env: process.env }` | Env-strip destructure (strips auth keys) |
| Display `result` + assistant text | De-dup `result` against last assistant block |
| `pty.write(prompt + '\n')` | Bracketed-paste + delayed CR |
| Trust online docs | Read installed `.d.ts` first |
| Invent undocumented options | `TODO: verify in .d.ts` |
| Agent SDK as plain text completer (tools ON → it executes) | `tools: []` + `maxTurns: 1` for pure completion |
