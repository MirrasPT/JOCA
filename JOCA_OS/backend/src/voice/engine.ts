// O motor de voz, visto do backend: um processo filho com o modelo carregado.
//
// ⚠ Processo filho, e não dentro do backend. O `transcribe-cpp` é código nativo, e o README dele
// avisa que um runtime Visual C++ antigo rebenta com violação de acesso. Dentro do backend isso
// levava consigo todos os terminais. Assim cai só o ditado, e diz-se porquê. Sair o filho é também
// o que devolve a memória ao fim do tempo de repouso.
//
// O filho corre no mesmo executável e com os mesmos `execArgv` do backend: `tsx` em
// desenvolvimento (carrega o `.ts`), `node` sobre o `dist/` em produção (carrega o `.js`).
import { fork, type ChildProcess } from 'child_process';
import path from 'path';

/** Sem ditados durante isto, o motor sai e larga a memória. Carregar outra vez custa uns segundos. */
const REPOUSO_MS = 15 * 60 * 1000;
/** O que se guarda do `stderr` do filho para dizer porque caiu. */
const STDERR_GUARDADO = 2_000;
const VIOLACAO_DE_ACESSO = 3_221_225_477;

interface Pendente {
  readonly resolver: (valor: Record<string, unknown>) => void;
  readonly rejeitar: (erro: Error) => void;
}

export interface TranscricaoDoMotor {
  readonly texto: string;
  readonly truncado: boolean;
}

export function caminhoDoFilho(): string {
  return path.join(__dirname, `engine-worker${path.extname(__filename)}`);
}

export function motivoDaQueda(codigo: number | null, sinal: string | null, stderr: string): string {
  const base = `o motor de voz caiu (código ${codigo}${sinal === null ? '' : `, sinal ${sinal}`})`;
  if (codigo === VIOLACAO_DE_ACESSO) {
    return `${base}: violação de acesso. Em Windows isto costuma ser o Microsoft Visual C++ Redistributable (x64) anterior a 14.40; instala a versão atual`;
  }
  const fim = stderr.trim();
  return fim === '' ? base : `${base}: ${fim.slice(-300)}`;
}

export class VoiceEngine {
  #filho: ChildProcess | null = null;
  #caminho: string | null = null;
  #carga: Promise<void> | null = null;
  #ultimaFalha: string | null = null;
  #proximoId = 1;
  readonly #pendentes = new Map<number, Pendente>();
  #repouso: NodeJS.Timeout | null = null;

  /** O motivo da última falha do motor, ou `null`. Sai no `GET /voice/status`. */
  get ultimaFalha(): string | null {
    return this.#ultimaFalha;
  }

  get carregado(): boolean {
    return this.#filho !== null && this.#carga !== null;
  }

  /** Lança o filho e carrega este modelo, se ainda não estiver. Pedidos simultâneos partilham a carga. */
  async preparar(caminho: string): Promise<void> {
    if (this.#carga !== null && this.#caminho === caminho) {
      await this.#carga;
      this.#armarRepouso();
      return;
    }
    this.parar();
    this.#caminho = caminho;
    const carga = this.#carregar(caminho);
    this.#carga = carga;
    try {
      await carga;
      this.#ultimaFalha = null;
    } catch (error) {
      this.#ultimaFalha = (error as Error).message;
      if (this.#carga === carga) this.parar();
      throw error;
    }
    this.#armarRepouso();
  }

  async transcrever(caminho: string, pcm: Float32Array, idioma: string): Promise<TranscricaoDoMotor> {
    await this.preparar(caminho);
    try {
      const r = await this.#pedir({ op: 'transcribe', pcm, idioma });
      this.#armarRepouso();
      return { texto: String(r.texto ?? ''), truncado: r.truncado === true };
    } catch (error) {
      this.#ultimaFalha = (error as Error).message;
      throw error;
    }
  }

  /** Fecha o filho. Idempotente: é o que o repouso, a troca de modelo e o fim do backend chamam. */
  parar(): void {
    if (this.#repouso !== null) clearTimeout(this.#repouso);
    this.#repouso = null;
    const filho = this.#filho;
    this.#filho = null;
    this.#carga = null;
    this.#caminho = null;
    filho?.kill();
    for (const p of this.#pendentes.values()) p.rejeitar(new Error('o motor de voz parou antes de responder'));
    this.#pendentes.clear();
  }

  async #carregar(caminho: string): Promise<void> {
    this.#lancar();
    const r = await this.#pedir({ op: 'load', caminho });
    console.log(`[voz] modelo carregado (dispositivo: ${String(r.dispositivo ?? 'desconhecido')})`);
  }

  #lancar(): void {
    const filho = fork(caminhoDoFilho(), [], {
      execPath: process.execPath,
      execArgv: process.execArgv,
      serialization: 'advanced',
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    this.#filho = filho;
    let stderr = '';
    filho.stderr?.setEncoding('utf8');
    filho.stderr?.on('data', (parte: string) => { stderr = (stderr + parte).slice(-STDERR_GUARDADO); });
    filho.on('message', (m) => this.#resposta(m as Record<string, unknown>));
    filho.on('error', (erro) => this.#caiu(filho, erro.message));
    filho.on('exit', (codigo, sinal) => {
      if (this.#filho === filho) this.#caiu(filho, motivoDaQueda(codigo, sinal, stderr));
    });
  }

  #caiu(filho: ChildProcess, porque: string): void {
    if (this.#filho !== filho) return;
    console.warn(`[voz] ${porque}`);
    this.#ultimaFalha = porque;
    this.#filho = null;
    this.#carga = null;
    this.#caminho = null;
    for (const p of this.#pendentes.values()) p.rejeitar(new Error(porque));
    this.#pendentes.clear();
  }

  #resposta(m: Record<string, unknown>): void {
    const id = m.id;
    if (typeof id !== 'number') return;
    const p = this.#pendentes.get(id);
    if (p === undefined) return;
    this.#pendentes.delete(id);
    if (m.ok === true) p.resolver(m);
    else p.rejeitar(new Error(String(m.porque ?? 'o motor de voz recusou sem dizer porquê')));
  }

  #pedir(pedido: Record<string, unknown>): Promise<Record<string, unknown>> {
    const filho = this.#filho;
    if (filho === null) return Promise.reject(new Error('o motor de voz não está a correr'));
    const id = this.#proximoId++;
    return new Promise((resolver, rejeitar) => {
      this.#pendentes.set(id, { resolver, rejeitar });
      filho.send({ id, ...pedido }, (erro) => {
        if (erro === null) return;
        this.#pendentes.delete(id);
        rejeitar(new Error(`não consegui falar com o motor de voz: ${erro.message}`));
      });
    });
  }

  #armarRepouso(): void {
    if (this.#repouso !== null) clearTimeout(this.#repouso);
    this.#repouso = setTimeout(() => this.parar(), REPOUSO_MS);
    this.#repouso.unref();
  }
}
