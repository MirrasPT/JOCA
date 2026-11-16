// O ditado vive AQUI, fora dos componentes: gravar, transcrever, limpar e entregar o texto.
//
// ⚠ Porquê fora do React: o JOCA OS tem mais do que uma instância de `TerminalView` (vista do
// projecto e vista solta). Mudar de vista a meio desmontava a instância que gravava e o áudio ia
// com ela — sem pedido, sem aviso (defeito D1, verificação de 2026-11-16). Aqui a gravação não
// pertence a nenhuma instância: quem está montado LIGA-SE como destino; ao desmontar a meio, a
// gravação TERMINA e é transcrita na mesma, e o texto vai para a sessão de ORIGEM pela id dela.
// Se nenhum destino a consegue receber, o texto fica guardado em memória e entra na caixa, com
// aviso, quando essa sessão voltar a estar visível. Nunca se deita fora o que foi dito.
//
// O texto final nunca é enviado: o destino põe-no na linha de entrada, e o Enter é de quem ditou.
import type { Gravador } from './microphone';
import { MAX_SEGUNDOS, TAXA_DE_AMOSTRAGEM, type Correcao, type EstadoDeVoz, type ModeloDeVoz } from './voice-client';

const MIN_AMOSTRAS = TAXA_DE_AMOSTRAGEM / 10;

export type FaseDoDitado =
  | { readonly nome: 'parado' }
  | { readonly nome: 'a-abrir' }
  | { readonly nome: 'a-ouvir'; readonly desde: number }
  | { readonly nome: 'a-transcrever' }
  | { readonly nome: 'a-corrigir' }
  | { readonly nome: 'sem-modelo'; readonly modelo: ModeloDeVoz }
  | { readonly nome: 'a-descarregar'; readonly percentagem: number }
  | { readonly nome: 'a-repetir'; readonly porque: string };

export type Tom = 'info' | 'erro';

/** Quem está montado e pode receber o texto. `entregar` devolve `false` se não conseguir. */
export interface Destino {
  entregar(origem: string, texto: string): boolean;
  avisar(aviso: string | null, tom?: Tom): void;
}

export interface DependenciasDoDitado {
  lerEstado(): Promise<EstadoDeVoz>;
  transcrever(pcm: Float32Array): Promise<{ readonly texto: string; readonly truncado: boolean }>;
  corrigir(texto: string, contexto: string | null): Promise<Correcao>;
  prepararMotor(): Promise<unknown>;
  descarregar(modelo: string): Promise<unknown>;
  abrirMicrofone(): Promise<Gravador>;
  /** As últimas linhas visíveis do terminal de origem (ou `null`), com prazo. */
  capturarContexto(origem: string): Promise<string | null>;
}

const AVISO_GUARDADO = 'O texto ditado ficou guardado: entra na caixa, por enviar, quando voltares ao terminal onde ditaste.';
const AVISO_RECUPERADO = 'Recuperei o texto que ditaste antes de mudares de vista. Está na caixa, por enviar.';

export class ControladorDoDitado {
  #fase: FaseDoDitado = { nome: 'parado' };
  readonly #ouvintes = new Set<() => void>();
  #destino: Destino | null = null;
  #avisoGuardado: { aviso: string; tom: Tom } | null = null;
  #gravador: Gravador | null = null;
  #limite: ReturnType<typeof setTimeout> | null = null;
  #sondagem: ReturnType<typeof setInterval> | null = null;
  #origem: string | null = null;
  // Cada ditado tem o seu número: cancelar muda-o, e a resposta atrasada de antes não entra.
  #id = 0;
  #pcm: Float32Array | null = null;
  #contexto: string | null = null;
  #corrigirLigado = true;
  readonly #pendentes = new Map<string, string[]>();

  private readonly deps: DependenciasDoDitado;

  constructor(deps: DependenciasDoDitado) {
    this.deps = deps;
  }

  get fase(): FaseDoDitado { return this.#fase; }

  /** Para o `useSyncExternalStore`. */
  readonly subscrever = (ouvinte: () => void): (() => void) => {
    this.#ouvintes.add(ouvinte);
    return () => { this.#ouvintes.delete(ouvinte); };
  };

  #mudar(fase: FaseDoDitado): void {
    this.#fase = fase;
    if (fase.nome === 'a-descarregar') this.#sondarDescarga(); else this.#pararSondagem();
    for (const o of this.#ouvintes) o();
  }

  #avisar(aviso: string | null, tom: Tom = 'erro'): void {
    if (this.#destino) this.#destino.avisar(aviso, tom);
    else this.#avisoGuardado = aviso === null ? null : { aviso, tom };
  }

  /** Entrega pela id da sessão; se ninguém a recebe, guarda-a — nunca a deita fora. */
  #entregar(origem: string, texto: string): void {
    if (this.#destino?.entregar(origem, texto)) return;
    this.#pendentes.set(origem, [...(this.#pendentes.get(origem) ?? []), texto]);
    this.#avisar(AVISO_GUARDADO, 'info');
  }

  /** Um `TerminalView` montou: passa a ser ele a receber. Recebe logo o aviso que ficou por dar. */
  ligar(destino: Destino): void {
    this.#destino = destino;
    if (this.#avisoGuardado) {
      const { aviso, tom } = this.#avisoGuardado;
      this.#avisoGuardado = null;
      destino.avisar(aviso, tom);
    }
  }

  /**
   * O `TerminalView` desmontou. A meio de uma gravação, TERMINA-a e transcreve na mesma: o texto
   * segue para a sessão de origem pelo próximo destino, ou fica guardado. A abrir o microfone
   * ainda não se disse nada: cancela-se.
   */
  desmontar(destino: Destino): void {
    if (this.#destino === destino) this.#destino = null;
    if (this.#fase.nome === 'a-ouvir') void this.parar();
    else if (this.#fase.nome === 'a-abrir') this.cancelar();
  }

  /** Há texto guardado para esta sessão (ficou visível agora)? Entrega-o ao destino actual. */
  entregarPendentes(sessao: string | null): void {
    if (!sessao || !this.#destino) return;
    const textos = this.#pendentes.get(sessao);
    if (!textos?.length) return;
    this.#pendentes.delete(sessao);
    if (this.#destino.entregar(sessao, textos.join(' '))) this.#avisar(AVISO_RECUPERADO, 'info');
    else this.#pendentes.set(sessao, textos);
  }

  pendentesDe(sessao: string): readonly string[] {
    return this.#pendentes.get(sessao) ?? [];
  }

  #fecharGravacao(): Gravador | null {
    const g = this.#gravador;
    this.#gravador = null;
    if (this.#limite !== null) clearTimeout(this.#limite);
    this.#limite = null;
    return g;
  }

  cancelar(): void {
    this.#id += 1;
    this.#fecharGravacao()?.descartar();
    this.#pcm = null;
    this.#contexto = null;
    this.#mudar({ nome: 'parado' });
  }

  async iniciar(origem: string): Promise<void> {
    if (this.#fase.nome !== 'parado') return;
    this.#avisar(null);
    const id = (this.#id += 1);
    this.#origem = origem;
    this.#mudar({ nome: 'a-abrir' });
    try {
      const estado = await this.deps.lerEstado();
      if (this.#id !== id) return;
      if (estado.descarga?.fase === 'a-descarregar') {
        this.#mudar({ nome: 'a-descarregar', percentagem: Math.floor((estado.descarga.recebidos / estado.descarga.total) * 100) });
        return;
      }
      const escolhido = estado.modelos.find((m) => m.id === estado.definicoes.modeloVoz);
      if (escolhido && escolhido.origem === null) {
        this.#mudar({ nome: 'sem-modelo', modelo: escolhido });
        return;
      }
      this.#corrigirLigado = estado.definicoes.correcaoLigada;
      const gravador = await this.deps.abrirMicrofone();
      if (this.#id !== id) { gravador.descartar(); return; }
      // O motor carrega enquanto se fala, para o texto chegar logo a seguir a parar.
      if (!estado.motorCarregado) void this.deps.prepararMotor().catch(() => undefined);
      this.#gravador = gravador;
      this.#limite = setTimeout(() => void this.parar(), MAX_SEGUNDOS * 1000);
      this.#mudar({ nome: 'a-ouvir', desde: Date.now() });
    } catch (erro) {
      if (this.#id !== id) return;
      this.#mudar({ nome: 'parado' });
      this.#avisar((erro as Error).message);
    }
  }

  async parar(): Promise<void> {
    const gravador = this.#fecharGravacao();
    const origem = this.#origem;
    if (gravador === null || origem === null) return;
    const id = this.#id;
    const pcm = gravador.terminar();
    // Antes de a fase mudar: o contexto é o do terminal como estava quando se parou de falar.
    const contexto = await this.deps.capturarContexto(origem).catch(() => null);
    if (this.#id !== id) return;
    if (pcm.length < MIN_AMOSTRAS) {
      this.#mudar({ nome: 'parado' });
      this.#avisar('Não ouvi nada. Vê se o microfone certo está ligado.');
      return;
    }
    this.#pcm = pcm;
    this.#contexto = contexto;
    await this.#processar(pcm, contexto, id, origem);
  }

  /** Do áudio ao texto. Volta a correr em «Tentar de novo», com o áudio guardado. */
  async #processar(pcm: Float32Array, contexto: string | null, id: number, origem: string): Promise<void> {
    const aindaEste = (): boolean => this.#id === id;
    this.#mudar({ nome: 'a-transcrever' });
    let texto: string;
    try {
      const r = await this.deps.transcrever(pcm);
      if (!aindaEste()) return;
      texto = r.texto;
      if (r.truncado) this.#avisar('A transcrição veio cortada: o motor não chegou ao fim do áudio.');
    } catch (erro) {
      if (!aindaEste()) return;
      this.#mudar({ nome: 'a-repetir', porque: (erro as Error).message });
      return;
    }
    const acabar = (): void => { this.#pcm = null; this.#contexto = null; this.#mudar({ nome: 'parado' }); };
    if (texto.trim() === '') {
      acabar();
      this.#avisar('Não ouvi nada. Vê se o microfone certo está ligado.');
      return;
    }
    if (!this.#corrigirLigado) {
      acabar();
      this.#entregar(origem, texto);
      return;
    }
    this.#mudar({ nome: 'a-corrigir' });
    try {
      const c = await this.deps.corrigir(texto, contexto);
      if (!aindaEste()) return;
      acabar();
      this.#entregar(origem, c.texto);
      if (!c.corrigido) this.#avisar(`Ficou a transcrição em bruto: ${c.aviso}.`);
    } catch (erro) {
      if (!aindaEste()) return;
      // A rota não respondeu: o que foi dito não se perde por causa disso.
      acabar();
      this.#entregar(origem, texto);
      this.#avisar(`Ficou a transcrição em bruto: ${(erro as Error).message}.`);
    }
  }

  tentarDeNovo(): void {
    const pcm = this.#pcm;
    if (pcm !== null && this.#origem !== null) void this.#processar(pcm, this.#contexto, this.#id, this.#origem);
  }

  descarregar(modelo: ModeloDeVoz): void {
    this.#mudar({ nome: 'a-descarregar', percentagem: 0 });
    this.deps.descarregar(modelo.id).catch((erro: unknown) => {
      this.#mudar({ nome: 'parado' });
      this.#avisar(`Não consegui descarregar o modelo de voz: ${(erro as Error).message}.`);
    });
  }

  // Sem canal de eventos para a voz: durante a descarga, pergunta-se o progresso a cada segundo.
  #sondarDescarga(): void {
    if (this.#sondagem !== null) return;
    this.#sondagem = setInterval(() => {
      this.deps.lerEstado().then((estado) => {
        if (this.#fase.nome !== 'a-descarregar') return;
        const d = estado.descarga;
        if (d?.fase === 'a-descarregar') {
          this.#mudar({ nome: 'a-descarregar', percentagem: Math.floor((d.recebidos / d.total) * 100) });
          return;
        }
        this.#mudar({ nome: 'parado' });
        if (d?.fase === 'pronto') this.#avisar('O modelo de voz está pronto. Já podes ditar.', 'info');
        else if (d?.fase === 'falhou') this.#avisar(`A descarga falhou: ${d.porque}.`);
      }).catch(() => undefined);
    }, 1000);
  }

  #pararSondagem(): void {
    if (this.#sondagem !== null) clearInterval(this.#sondagem);
    this.#sondagem = null;
  }
}
