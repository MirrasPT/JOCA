// O microfone do browser: abrir, juntar o áudio e devolvê-lo a 16 kHz mono float32.
import { TAXA_DE_AMOSTRAGEM } from './voice-client';

// O coletor corre na thread de áudio e manda cada bloco (128 amostras) para aqui.
const COLETOR = `
class ColetorDoDitado extends AudioWorkletProcessor {
  process(entradas) {
    const canal = entradas[0] && entradas[0][0]
    if (canal) this.port.postMessage(canal.slice(0))
    return true
  }
}
registerProcessor('coletor-do-ditado', ColetorDoDitado)
`;

/**
 * Uma gravação aberta. `terminar` fecha o microfone e devolve o PCM a 16 kHz; `descartar` só fecha.
 * `nivel` é o volume agora (0..1, suavizado); lê-se por frame (rAF), e dá 0 depois de fechar.
 */
export interface Gravador {
  terminar(): Float32Array;
  descartar(): void;
  nivel(): number;
}

// Voz ao microfone anda entre ~-50 dB (baixinho) e ~-10 dB (perto e alto): é esse o intervalo
// que enche as barras. Sobe depressa e desce devagar, como um VU — senão as barras tremem.
const DB_SILENCIO = -55;
const DB_CHEIO = -12;
const SUBIDA = 0.5;
const DESCIDA = 0.12;

function medidorDeNivel(analisador: AnalyserNode, fechado: () => boolean): () => number {
  const amostras = new Float32Array(analisador.fftSize);
  let suave = 0;
  return () => {
    if (fechado()) return 0;
    analisador.getFloatTimeDomainData(amostras);
    let soma = 0;
    for (const a of amostras) soma += a * a;
    const db = 20 * Math.log10(Math.sqrt(soma / amostras.length) || 1e-8);
    const alvo = Math.min(1, Math.max(0, (db - DB_SILENCIO) / (DB_CHEIO - DB_SILENCIO)));
    suave += (alvo - suave) * (alvo > suave ? SUBIDA : DESCIDA);
    return suave;
  };
}

function juntarPedacos(pedacos: readonly Float32Array[]): Float32Array {
  const total = pedacos.reduce((soma, p) => soma + p.length, 0);
  const junto = new Float32Array(total);
  let onde = 0;
  for (const p of pedacos) { junto.set(p, onde); onde += p.length; }
  return junto;
}

/**
 * Da taxa do microfone (44,1/48 kHz) para os 16 kHz que o motor pede, pela média de cada janela —
 * o filtro passa-baixo mais simples, chega para voz. Grava-se à taxa nativa porque o Firefox não
 * liga um microfone a um AudioContext com outra taxa.
 */
export function reamostrar(entrada: Float32Array, deTaxa: number, paraTaxa = TAXA_DE_AMOSTRAGEM): Float32Array {
  if (deTaxa === paraTaxa) return entrada;
  const razao = deTaxa / paraTaxa;
  const saida = new Float32Array(Math.floor(entrada.length / razao));
  for (let i = 0; i < saida.length; i++) {
    const inicio = Math.floor(i * razao);
    const fim = Math.min(entrada.length, Math.max(inicio + 1, Math.floor((i + 1) * razao)));
    let soma = 0;
    for (let j = inicio; j < fim; j++) soma += entrada[j];
    saida[i] = soma / (fim - inicio);
  }
  return saida;
}

function motivoDoMicrofone(erro: unknown): string {
  const nome = (erro as DOMException).name;
  if (nome === 'NotAllowedError') {
    return 'O microfone foi recusado. Autoriza-o no cadeado da barra de endereço do browser (e, no sistema, nas definições de privacidade do microfone) e tenta de novo.';
  }
  if (nome === 'NotFoundError') return 'Não encontrei nenhum microfone ligado a esta máquina.';
  if (nome === 'NotReadableError') return 'O microfone está ocupado por outra aplicação.';
  return `Não consegui abrir o microfone: ${(erro as Error).message}`;
}

export async function abrirMicrofone(): Promise<Gravador> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('O microfone só funciona com o JOCA OS aberto em localhost ou por HTTPS.');
  }
  let stream: MediaStream | null = null;
  let contexto: AudioContext | null = null;
  let fechado = false;
  const fechar = (): void => {
    fechado = true;
    for (const faixa of stream?.getTracks() ?? []) faixa.stop();
    void contexto?.close().catch(() => undefined);
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false } });
    contexto = new AudioContext();
    const endereco = URL.createObjectURL(new Blob([COLETOR], { type: 'text/javascript' }));
    try { await contexto.audioWorklet.addModule(endereco); } finally { URL.revokeObjectURL(endereco); }
    const coletor = new AudioWorkletNode(contexto, 'coletor-do-ditado');
    const pedacos: Float32Array[] = [];
    coletor.port.onmessage = (evento: MessageEvent<Float32Array>) => { pedacos.push(evento.data); };
    // O analisador fica NO caminho (passa o áudio tal e qual): assim é processado de certeza, e o
    // coletor recebe exactamente o mesmo que recebia ligado à fonte.
    const analisador = contexto.createAnalyser();
    analisador.fftSize = 1024;
    contexto.createMediaStreamSource(stream).connect(analisador);
    analisador.connect(coletor);
    coletor.connect(contexto.destination);
    const taxa = contexto.sampleRate;
    return {
      terminar: () => { fechar(); return reamostrar(juntarPedacos(pedacos), taxa); },
      descartar: fechar,
      nivel: medidorDeNivel(analisador, () => fechado),
    };
  } catch (erro) {
    fechar();
    throw erro instanceof DOMException ? new Error(motivoDoMicrofone(erro)) : erro;
  }
}
