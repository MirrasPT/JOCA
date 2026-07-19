// OllamaProvider — local, zero-cost text completion via Ollama. Used by the "Optimizar"
// feature when the optimize provider is Ollama. Plain single-turn completion, NO tools
// (so it can't execute anything).
//
// VERIFIED against a real Ollama at http://127.0.0.1:11434 (gemma4:12b, 2026-06-25):
//   - GET /api/tags lists installed models.
//   - POST /api/chat {model, messages, stream:false} returns
//       {message:{role:"assistant", content:"..."}, done:true, done_reason:"stop"}
const OLLAMA_BASE = 'http://127.0.0.1:11434';

interface OllamaTag { name: string }
interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
interface OllamaChatResponse {
  message?: OllamaChatMessage;
  error?: string;
}

export class OllamaProvider {
  readonly name = 'ollama';

  // available(): true if GET /api/tags responds (the endpoint is up).
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

  // Plain single-turn text completion — NO tools (so it can't execute anything). Any installed
  // model works; if `model` is empty, use the first installed.
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
