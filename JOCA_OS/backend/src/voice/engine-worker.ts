// O processo filho onde corre o `transcribe-cpp`. Quem o lança é o `engine.ts`.
//
// Mensagens por IPC (`serialization: 'advanced'`, o PCM viaja como `Float32Array`):
// `{ id, op: 'load', caminho }` e `{ id, op: 'transcribe', pcm, idioma }`; a resposta leva o mesmo
// `id`, com `ok` e o resultado ou o motivo.
//
// ⚠ Nunca escreve o texto nem o áudio em lado nenhum: só os devolve a quem pediu.
import type { TranscribeModel } from 'transcribe-cpp';

type Pedido =
  | { readonly id: number; readonly op: 'load'; readonly caminho: string }
  | { readonly id: number; readonly op: 'transcribe'; readonly pcm: Float32Array; readonly idioma: string };

let modelo: TranscribeModel | null = null;

// ⚠ O `transcribe-cpp` é só ESM (`exports` só com `import`), e o backend compila para CommonJS: o
// `tsc` troca um `import()` escrito aqui por `require()`, que dá ERR_PACKAGE_PATH_NOT_EXPORTED
// (medido a 2026-11-16 no `dist/`). Um `import()` dentro de `new Function` o `tsc` não toca.
const importar = new Function('especificador', 'return import(especificador)') as
  (especificador: string) => Promise<typeof import('transcribe-cpp')>;

function responder(mensagem: unknown): void {
  process.send?.(mensagem);
}

async function carregar(caminho: string): Promise<{ readonly dispositivo: string | null }> {
  modelo?.dispose();
  modelo = null;
  const { TranscribeModel: Motor } = await importar('transcribe-cpp');
  const carregado = await Motor.load(caminho);
  // Medido no Studio (2026-11-10): sem este aquecimento a PRIMEIRA transcrição real custava ~14 s;
  // com 1 s de silêncio logo a seguir a carregar, a real passa a ~200 ms.
  await carregado.transcribe(new Float32Array(16_000), { language: 'pt' });
  modelo = carregado;
  return { dispositivo: (carregado as unknown as { device?: { name?: string } }).device?.name ?? null };
}

async function atender(pedido: Pedido): Promise<void> {
  try {
    if (pedido.op === 'load') {
      responder({ id: pedido.id, ok: true, ...(await carregar(pedido.caminho)) });
      return;
    }
    if (modelo === null) throw new Error('o motor de voz ainda não carregou o modelo');
    const r = await modelo.transcribe(pedido.pcm, pedido.idioma === 'auto' ? {} : { language: pedido.idioma });
    responder({ id: pedido.id, ok: true, texto: r.text.trim(), truncado: r.truncated });
  } catch (error) {
    responder({ id: pedido.id, ok: false, porque: error instanceof Error ? error.message : String(error) });
  }
}

process.on('message', (mensagem) => void atender(mensagem as Pedido));
// O pai morreu ou fechou o canal: um motor com centenas de MB em memória não fica órfão.
process.on('disconnect', () => process.exit(0));
