// O que o ditado lê do backend (`/voice/*`), e o contexto do terminal que vai para a limpeza.
//
// ⚠ Espelho das respostas de `backend/src/http/voice-routes.ts`: ao mexer no contrato lá, mexe-se aqui.

export const TAXA_DE_AMOSTRAGEM = 16_000;
/** O tecto de um ditado, em segundos. O mesmo `MAX_DICTATION_SECONDS` do backend. */
export const MAX_SEGUNDOS = 300;

export interface ModeloDeVoz {
  readonly id: string;
  readonly nome: string;
  readonly bytes: number;
  /** `null` = este modelo não está nesta máquina. */
  readonly origem: 'huggingface' | 'joca' | null;
}

export interface DefinicoesDeVoz {
  readonly correcaoLigada: boolean;
  readonly modeloCorrecao: string;
  readonly termos: readonly string[];
  readonly modeloVoz: string;
  readonly idioma: string;
}

export type DescargaDeVoz =
  | { readonly fase: 'a-descarregar'; readonly modelo: string; readonly recebidos: number; readonly total: number }
  | { readonly fase: 'falhou'; readonly modelo: string; readonly porque: string }
  | { readonly fase: 'pronto'; readonly modelo: string };

export interface EstadoDeVoz {
  readonly modelos: readonly ModeloDeVoz[];
  readonly idiomas: readonly string[];
  readonly descarga: DescargaDeVoz | null;
  readonly definicoes: DefinicoesDeVoz;
  readonly falhaDoMotor: string | null;
  readonly motorCarregado: boolean;
}

export type Correcao =
  | { readonly corrigido: true; readonly texto: string }
  | { readonly corrigido: false; readonly texto: string; readonly aviso: string };

/** `fetch` com prazo, que lança com a mensagem do backend (`error` + `detail`) quando não é 2xx. */
async function pedir<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 20_000, ...resto } = init;
  const controlo = new AbortController();
  const relogio = window.setTimeout(() => controlo.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...resto, signal: controlo.signal });
    const corpo = await r.json().catch(() => null) as { error?: string; detail?: string } | null;
    if (!r.ok) {
      const msg = [corpo?.error, corpo?.detail].filter(Boolean).join(': ') || `o backend respondeu ${r.status}`;
      throw Object.assign(new Error(msg), { status: r.status, corpo });
    }
    return corpo as T;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error(`o backend não respondeu em ${Math.round(timeoutMs / 1000)} s`);
    throw e;
  } finally {
    window.clearTimeout(relogio);
  }
}

const JSON_HEADERS = { 'content-type': 'application/json' };

export function lerEstadoDeVoz(): Promise<EstadoDeVoz> {
  return pedir<EstadoDeVoz>('/voice/status');
}

export function gravarDefinicoes(parcial: Partial<DefinicoesDeVoz>): Promise<DefinicoesDeVoz> {
  return pedir<DefinicoesDeVoz>('/voice/settings', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(parcial) });
}

export function descarregarModeloDeVoz(modelo: string): Promise<unknown> {
  return pedir('/voice/download', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ modelo }) });
}

export function desistirDaDescarga(): Promise<unknown> {
  return pedir('/voice/download', { method: 'DELETE' });
}

export function prepararMotor(): Promise<unknown> {
  return pedir('/voice/prepare', { method: 'POST', timeoutMs: 120_000 });
}

export function emMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export function transcrever(pcm: Float32Array): Promise<{ readonly texto: string; readonly truncado: boolean }> {
  // Little-endian: é o que todos os browsers em x86/ARM guardam num Float32Array, e o que o backend lê.
  const corpo = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength) as ArrayBuffer;
  return pedir('/voice/transcribe', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'x-sample-rate': String(TAXA_DE_AMOSTRAGEM) },
    body: corpo,
    // O 1.º ditado pode ter de carregar o motor antes: não se corta aos 20 s.
    timeoutMs: 120_000,
  });
}

export function corrigir(texto: string, contexto: string | null): Promise<Correcao> {
  // O backend corta a limpeza aos 30 s; aqui dá-se-lhe folga para responder que cortou.
  return pedir<Correcao>('/voice/correct', {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ texto, contexto }), timeoutMs: 45_000,
  });
}

const LINHAS_DE_CONTEXTO = 60;
const PRAZO_DA_CAPTURA_MS = 2_000;

/**
 * As últimas linhas VISÍVEIS do terminal, em texto.
 *
 * Porquê texto e não imagem: este xterm (5.5, sem o addon de canvas/WebGL) desenha com o renderer
 * de DOM — não há `<canvas>` de onde tirar um PNG, e fotografar DOM pede uma dependência pesada
 * (html2canvas e afins). As linhas do ecrã são o mesmo contexto, mais leve e sem OCR.
 * Lê-se do DOM do próprio xterm (`.xterm-rows`), dentro do contentor do terminal que ditou.
 */
export function linhasVisiveis(contentor: Element | null): string | null {
  const linhas = contentor?.querySelector('.xterm-rows')?.children;
  if (!linhas || linhas.length === 0) return null;
  const texto = Array.from(linhas)
    .map((l) => (l.textContent ?? '').replace(/ /g, ' ').trimEnd())
    .slice(-LINHAS_DE_CONTEXTO)
    .join('\n')
    .trim();
  return texto === '' ? null : texto;
}

/** O contexto, ou `null` se não vier a tempo. O ditado nunca fica preso à espera dele. */
export function capturarContexto(obter: () => string | null): Promise<string | null> {
  const prazo = new Promise<null>((resolver) => window.setTimeout(() => resolver(null), PRAZO_DA_CAPTURA_MS));
  const captura = new Promise<string | null>((resolver) => {
    try { resolver(obter()); } catch { resolver(null); }
  });
  return Promise.race([captura, prazo]);
}

/** Os dois textos juntos, sem apagar o que lá estava. */
export function juntarTextoDitado(antes: string, ditado: string): string {
  if (antes === '') return ditado;
  return /\s$/.test(antes) ? `${antes}${ditado}` : `${antes} ${ditado}`;
}
