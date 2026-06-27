// OllamaProvider — local, zero-cost Master brain via Ollama function-calling.
//
// Orchestrates workers IN-PROCESS: it runs a ReAct loop against POST /api/chat with `tools`
// (function-calling) and executes the matching MasterTool handler in the SAME process (same
// SessionManager singleton) when the model emits a tool_call. This is the easy, fully-working
// path — no MCP bridge, no second runtime. Workers are PTYs visible in the UI, exactly like the
// Claude path.
//
// VERIFIED against a real Ollama at http://127.0.0.1:11434 (gemma4:12b, 2026-06-25):
//   - GET /api/tags lists installed models; each carries details.* and a capabilities[] array
//     ("tools" present => function-calling supported). gemma4:12b/26b both advertise "tools".
//   - POST /api/chat {model, messages, tools, stream:false} returns:
//       {message:{role:"assistant", content:"", thinking?:"...",
//                 tool_calls:[{id?, function:{name, arguments:{...}}}]}, done:true, done_reason:"stop"}
//     `arguments` is a PARSED OBJECT (not a JSON string) — fed straight to def.handler(args).
//   - Round-trip confirmed: appending {role:"tool", content:"<handler result>"} and re-posting
//     yields a final {message:{content:"...", (no tool_calls)}} — the loop-exit signal.
//   These are observed shapes, not assumptions. (Probe transcript: get_weather tool, Lisbon.)
//
// Equivalence: this provider implements the SAME MasterProvider interface and emits the SAME
// ProviderEvent union as ClaudeProvider. costUsd is always 0 (local inference).
import type { MasterProvider, MasterRunOptions, ProviderEvent } from './provider';
import { sessionManager } from '../session-manager';
import { buildMasterToolDefs, createMasterToolsServer, type MasterToolDef, type MasterToolsOptions } from './master-tools';

const OLLAMA_BASE = 'http://127.0.0.1:11434';
const MAX_ITERATIONS = 12; // ReAct loop cap (matches the orchestrator's anti-loop doctrine)

// ── Ollama wire types (only the fields we actually read; verified against live responses) ──────
interface OllamaTag {
  name: string;
  capabilities?: string[]; // present on /api/tags; "tools" => function-calling capable
}
interface OllamaToolCall {
  id?: string;
  function: { name: string; arguments: Record<string, unknown> };
}
interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  thinking?: string;
  tool_calls?: OllamaToolCall[];
  tool_name?: string; // disambigua tool-results por NOME (fallback p/ versões de Ollama sem id)
  tool_call_id?: string; // casa o resultado ao id EXACTO do tool_call (alinha chamadas paralelas)
}
interface OllamaChatResponse {
  message?: OllamaChatMessage;
  done?: boolean;
  done_reason?: string;
  error?: string;
}

// Ollama's function-calling tool schema: {type:"function", function:{name, description, parameters}}.
// `parameters` is the JSON-Schema we already hand-write per MasterToolDef (def.jsonSchema).
interface OllamaTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

function toOllamaTools(defs: MasterToolDef[]): OllamaTool[] {
  return defs.map((d) => ({
    type: 'function',
    function: { name: d.name, description: d.description, parameters: d.jsonSchema },
  }));
}

export class OllamaProvider implements MasterProvider {
  readonly name = 'ollama';

  // available(): true if GET /api/tags responds (the endpoint is up). Mirrors provider.ts ollamaUp().
  async available(): Promise<boolean> {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 1200);
      const r = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: c.signal });
      clearTimeout(t);
      return r.ok;
    } catch {
      return false;
    }
  }

  // Pick the model to drive the loop: opts.model wins; else the first locally-installed model that
  // advertises the "tools" capability. We never hard-code a model name (anti-fabrication) — we read
  // /api/tags and select a real, tool-capable one. Throws a clear, actionable error if none exists.
  private async resolveModel(explicit?: string): Promise<string> {
    if (explicit && explicit.trim()) return explicit.trim();
    const r = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!r.ok) throw new Error(`Ollama /api/tags respondeu ${r.status}`);
    const data = (await r.json()) as { models?: OllamaTag[] };
    const models = data.models ?? [];
    const toolCapable = models.find((m) => (m.capabilities ?? []).includes('tools'));
    if (toolCapable) return toolCapable.name;
    // No tool-capable model installed: fail loud with the exact remediation. Do NOT silently pick a
    // model that cannot call tools (it would never orchestrate — worst possible outcome).
    const names = models.map((m) => m.name).join(', ') || '(nenhum)';
    throw new Error(
      `Nenhum modelo Ollama com capacidade "tools" instalado (instalados: ${names}). ` +
        `Corre \`ollama pull qwen2.5\` (ou llama3.1) — o provider está pronto para um modelo tool-capable.`,
    );
  }

  // One non-streaming /api/chat turn. We use stream:false (confirmed working) — the whole point is to
  // read message.tool_calls atomically per turn. Streaming interim text is a future nicety, not needed
  // for correctness; the ReAct loop is gated on complete tool_calls arrays.
  private async chatOnce(model: string, messages: OllamaChatMessage[], tools: OllamaTool[]): Promise<OllamaChatMessage> {
    const r = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, tools, stream: false }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`Ollama /api/chat respondeu ${r.status}: ${body.slice(0, 400)}`);
    }
    const data = (await r.json()) as OllamaChatResponse;
    if (data.error) throw new Error(`Ollama erro: ${data.error}`);
    if (!data.message) throw new Error('Ollama /api/chat sem campo message');
    return data.message;
  }

  // Run the orchestration ReAct loop. Yields ProviderEvent exactly like ClaudeProvider:
  //   - {type:'text'}     for interim assistant content (the model thinking out loud)
  //   - {type:'tool_use'} for each tool the model decides to call (forwarded to the UI as a step)
  //   - {type:'result'}   once, at the end (no more tool_calls), with the final text. costUsd=0.
  async *run(prompt: string, opts: MasterRunOptions = {}): AsyncGenerator<ProviderEvent, void> {
    let model: string;
    try {
      model = await this.resolveModel(opts.model);
    } catch (e) {
      yield { type: 'result', text: e instanceof Error ? e.message : String(e), isError: true, costUsd: 0 };
      return;
    }

    // Build the SAME 7 neutral tools the Claude path uses. ctx.workers MUST be the module-singleton
    // workerRegistry for cross-message worker reuse (spawn writes, list/read read). The singleton is
    // not exported, so we obtain it via createMasterToolsServer's returned `.workers` Map (option (b)
    // in master-tools GOTCHA #2). This also attaches the idempotent PTY-close cleanup hook.
    const onProjectsChanged = (opts as { onProjectsChanged?: () => void }).onProjectsChanged;
    const toolsOpts: MasterToolsOptions = onProjectsChanged ? { onProjectsChanged } : {};
    const { workers } = createMasterToolsServer(sessionManager, toolsOpts);
    const defs = buildMasterToolDefs({ sm: sessionManager, opts: toolsOpts, workers });
    const byName = new Map(defs.map((d) => [d.name, d]));
    const ollamaTools = toOllamaTools(defs);

    const messages: OllamaChatMessage[] = [];
    if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt });
    messages.push({ role: 'user', content: prompt });

    let finalText = '';

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      let msg: OllamaChatMessage;
      try {
        msg = await this.chatOnce(model, messages, ollamaTools);
      } catch (e) {
        yield { type: 'result', text: e instanceof Error ? e.message : String(e), isError: true, costUsd: 0 };
        return;
      }

      const interim = (msg.content ?? '').trim();
      if (interim) yield { type: 'text', text: interim };

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        // No more tools => this is the final answer. Loop-exit signal (verified: done_reason "stop").
        finalText = msg.content ?? '';
        yield { type: 'result', text: finalText, isError: false, costUsd: 0 };
        return;
      }

      // Append the assistant turn (with its tool_calls) so the model has the call context next turn.
      messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: toolCalls });

      // Execute each tool IN-PROCESS against the shared SessionManager, append results as tool msgs.
      for (const call of toolCalls) {
        const name = call.function?.name ?? '';
        const args = call.function?.arguments ?? {};
        const callId = call.id; // id REAL do tool_call (confirmado no /api/chat: "call_xxxx")
        yield { type: 'tool_use', name, input: args };

        const def = byName.get(name);
        let result: string;
        if (!def) {
          result = `erro: ferramenta desconhecida "${name}". Ferramentas válidas: ${defs.map((d) => d.name).join(', ')}.`;
        } else {
          try {
            result = await def.handler(args);
          } catch (e) {
            result = `erro a executar ${name}: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
        // Feed the RAW handler string back as the tool result (function-calling brains want the plain
        // string, per master-tools GOTCHA #1). Casar o resultado ao id EXACTO do tool_call (verificado:
        // o /api/chat devolve `id` por call) — evita colisão entre 2 chamadas à mesma tool no mesmo turno.
        // tool_name fica como fallback p/ versões antigas de Ollama que não emitem id; só propagamos um
        // id quando ele existe de facto no payload (nunca fabricado).
        const toolMsg: OllamaChatMessage = { role: 'tool', content: result, tool_name: name };
        if (callId) toolMsg.tool_call_id = callId;
        messages.push(toolMsg);
      }
    }

    // Hit the iteration cap without a final answer: report what we have, flagged as error so the
    // caller surfaces it (anti-infinite-loop brake, mirrors orchestrator doctrine).
    yield {
      type: 'result',
      text: finalText || `Atingido o limite de ${MAX_ITERATIONS} iterações sem resposta final do modelo ${model}.`,
      isError: true,
      costUsd: 0,
    };
  }

  // Plain single-turn text completion — NO tools (so it can't execute anything). Used by the
  // "Optimizar" feature when the optimize provider is Ollama. Any installed model works (a tool-
  // capable one is NOT required for plain text); if `model` is empty, use the first installed.
  async completeText(prompt: string, systemPrompt?: string, model?: string): Promise<string> {
    let m = model?.trim() ?? '';
    if (!m) {
      const r = await fetch(`${OLLAMA_BASE}/api/tags`);
      if (!r.ok) throw new Error(`Ollama /api/tags respondeu ${r.status}`);
      const data = (await r.json()) as { models?: OllamaTag[] };
      m = data.models?.[0]?.name ?? '';
      if (!m) throw new Error('Nenhum modelo Ollama instalado (corre `ollama pull qwen2.5`).');
    }
    const messages: OllamaChatMessage[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    const r = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: m, messages, stream: false }), // no `tools` → pure text
    });
    if (!r.ok) throw new Error(`Ollama /api/chat respondeu ${r.status}: ${(await r.text().catch(() => '')).slice(0, 300)}`);
    const data = (await r.json()) as OllamaChatResponse;
    if (data.error) throw new Error(`Ollama erro: ${data.error}`);
    return (data.message?.content ?? '').trim();
  }
}

export const ollamaProvider = new OllamaProvider();
