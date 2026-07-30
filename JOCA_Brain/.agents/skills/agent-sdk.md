---
name: agent-sdk
description: Build apps on @anthropic-ai/claude-agent-sdk (the SDK that powers Claude Code CLI). Use when: building Claude Code orchestrators, programmatic Claude sessions, subscription-billed (zero-cost) Claude invocations, JOCA_OS-style multi-terminal apps, MCP server creation with agent-sdk tools.
triggers: claude-agent-sdk, agent sdk, programmatic claude, subscription claude, zero-cost claude, JOCA_OS backend, claude code orchestrator, query sdk, createSdkMcpServer
origin: local
---

# Agent SDK — @anthropic-ai/claude-agent-sdk

**Package distinction — critical:** `@anthropic-ai/claude-agent-sdk` (this skill) ≠ `@anthropic-ai/sdk` (Messages API). Wrong package = API key billing + wrong API surface.

## Install

```bash
npm install @anthropic-ai/claude-agent-sdk
```

**After install:** read `.d.ts` files as source of truth. Never trust online docs alone — the SDK ships types that reflect actual runtime behaviour. Online docs lag or are incomplete.

```bash
# Os tipos vivem na RAIZ do pacote, nao em dist/ (sdk.d.ts tem ~7000 linhas)
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
      { input: z.string() },          // zod raw shape (nao z.object(...))
      async ({ input }) => ({          // handler — devolve CallToolResult
        content: [{ type: 'text', text: `resultado: ${input}` }],
      }),
      // 5o parametro opcional: { annotations?, searchHint?, alwaysLoad? }
    ),
  ],
});
```

**Ligar ao modelo** — as tools chegam como `mcp__<server>__<tool>`:

```ts
query({ prompt, options: {
  tools: [],                              // desliga TODOS os built-ins (Bash/Read/Write)
  mcpServers: { joca: server },           // so as tuas tools existem
  allowedTools: ['mcp__joca__tool_name'], // auto-aprova (NAO restringe — quem restringe e `tools`)
  permissionMode: 'default',              // sem ferramentas de FS nao precisas de bypassPermissions
}});
```

⚠ **`permissionMode: 'bypassPermissions'` = `--dangerously-skip-permissions`**, que o CLI **recusa** quando corre como root. Um agente com `tools: []` nao precisa dele — usa `'default'` + `allowedTools`.

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

## Conversa multi-turno (chat persistente)

O SDK **nao aceita** um array de mensagens. O historico vem de uma sessao dele:

```ts
// turno 1 — guarda o session_id que vem no evento result
let sessionId: string | undefined;
for await (const msg of query({ prompt: 'ola', options })) {
  if (msg.type === 'result') sessionId = msg.session_id;   // sdk.d.ts: SDKResultSuccess.session_id
}

// turno 2 — o SDK recarrega o historico daquela conversa
query({ prompt: 'e antes disso?', options: { ...options, resume: sessionId } });
```

- `resume: string` — retoma uma sessao. `continue: true` retoma a mais recente do cwd (**exclusivo** com resume).
- `sessionId` — forca um UUID teu; `forkSession` ramifica; `resumeSessionAt` retoma ate um uuid de mensagem.
- **Nunca** reconstruas o historico colando o transcript no prompt: custa tokens em cada turno e degrada-se.

### Streaming input (injectar sem forcar turno)

`prompt` tambem aceita `AsyncIterable<SDKUserMessage>`. Cada mensagem pode trazer:
- `priority: 'now' | 'next' | 'later'` — prioridade da injeccao
- **`shouldQuery: false`** — anexa ao transcript **sem** disparar um turno do assistente (funde na proxima)

Util para "o worker produziu output novo, mete no contexto mas nao acordes o agente ainda".
Em streaming mode o objecto `Query` expoe ainda `interrupt()`, `setModel()`, `setPermissionMode()`,
`setMcpServers()`, `getContextUsage()` e `close()`.

## Session spawn pattern (UI broadcast) — JOCA

No JOCA_OS o `SessionManager` emite `'spawn'` com `{ session }`; e o `server.ts` que traduz isso para
o broadcast WS `{ type: 'session_created', session: SessionInfo }`. Sem esse broadcast a sessao existe
no backend mas nao aparece na UI.

---

## Anti-fabrication rule

This SDK has sparse public documentation. When a method or option is not confirmed in `.d.ts`:
- Leave `TODO: verify in .d.ts — not confirmed`
- Do NOT invent parameter names or return shapes
- Do NOT assume parity with `@anthropic-ai/sdk` — different package, different API surface

---

## Pure text completion — disable tools (no side effects)

**The Agent SDK is an AGENT, not a completer.** `query()` ships the built-in tools (Bash, Read, Edit, …) **ON by default** even when you pass no `mcpServers`. So using it as a plain "rewrite this text" / "summarise" call is dangerous: given an imperative prompt ("lê os meus emails com o gws e resume"), the model will **actually run the tools** (executes `gws`, returns real emails) instead of rewriting the instruction. A system prompt saying "don't execute" does **not** stop it — the model has the tools and uses them.

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
