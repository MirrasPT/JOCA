// Descarregar um modelo de voz, com progresso.
//
// O endereço e o resumo vêm do catálogo, nunca do pedido: quem chama diz só QUAL modelo. Escreve-se
// para `<ficheiro>.part` e só se muda o nome depois de o tamanho e o sha-256 baterem — um ficheiro
// a meio ou adulterado nunca passa por modelo.
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { VoiceModel } from './catalog';
import { voiceModelsDir } from './catalog';

export type EstadoDescarga =
  | { readonly fase: 'a-descarregar'; readonly modelo: string; readonly recebidos: number; readonly total: number }
  | { readonly fase: 'falhou'; readonly modelo: string; readonly porque: string }
  | { readonly fase: 'pronto'; readonly modelo: string };

const INTERVALO_DE_AVISO_MS = 500;

export function urlDoModelo(modelo: VoiceModel): string {
  return `https://huggingface.co/${modelo.repo}/resolve/main/${modelo.ficheiro}`;
}

/** Rejeita com o motivo; quem chama traduz para o estado. `fetchImpl` existe para os testes. */
export async function descarregarModelo(
  modelo: VoiceModel,
  sinal: AbortSignal,
  aoAvancar: (recebidos: number) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const pasta = voiceModelsDir();
  await fs.promises.mkdir(pasta, { recursive: true, mode: 0o700 });
  const destino = path.join(pasta, modelo.ficheiro);
  const parcial = `${destino}.part`;
  try {
    const resposta = await fetchImpl(urlDoModelo(modelo), { signal: sinal, redirect: 'follow' });
    if (!resposta.ok || resposta.body === null) {
      throw new Error(`o Hugging Face respondeu ${resposta.status} a ${modelo.ficheiro}`);
    }
    const resumo = createHash('sha256');
    let recebidos = 0;
    let ultimoAviso = 0;
    const corrente = Readable.fromWeb(resposta.body as never);
    corrente.on('data', (parte: Buffer) => {
      resumo.update(parte);
      recebidos += parte.length;
      const agora = Date.now();
      if (agora - ultimoAviso >= INTERVALO_DE_AVISO_MS) {
        ultimoAviso = agora;
        aoAvancar(recebidos);
      }
    });
    await pipeline(corrente, fs.createWriteStream(parcial, { mode: 0o600 }), { signal: sinal });
    aoAvancar(recebidos);
    if (recebidos !== modelo.bytes) {
      throw new Error(`vieram ${recebidos} bytes de ${modelo.ficheiro} e eram ${modelo.bytes}`);
    }
    if (resumo.digest('hex') !== modelo.sha256) {
      throw new Error(`o sha-256 de ${modelo.ficheiro} não bate com o publicado`);
    }
    // Windows: o rename não escreve por cima de um ficheiro que exista (um modelo com o tamanho errado).
    await fs.promises.rm(destino, { force: true });
    await fs.promises.rename(parcial, destino);
    return destino;
  } catch (error) {
    await fs.promises.rm(parcial, { force: true }).catch(() => undefined);
    throw error;
  }
}
