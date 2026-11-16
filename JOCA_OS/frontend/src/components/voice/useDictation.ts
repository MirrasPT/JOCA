// O ditado: gravar, transcrever (local, Parakeet), limpar (opcional, Claude) e devolver o texto.
//
// O áudio vive num `ref` até o texto sair daqui. Uma transcrição que falha guarda o áudio e dá para
// tentar outra vez; nada se escreve em disco. O texto final NUNCA é enviado: quem chama põe-no na
// linha de entrada, e o Enter é sempre de quem ditou.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  capturarContexto,
  corrigir,
  descarregarModeloDeVoz,
  emMegabytes,
  lerEstadoDeVoz,
  MAX_SEGUNDOS,
  prepararMotor,
  TAXA_DE_AMOSTRAGEM,
  transcrever,
  type ModeloDeVoz,
} from './voice-client';

export type FaseDoDitado =
  | { readonly nome: 'parado' }
  | { readonly nome: 'a-abrir' }
  | { readonly nome: 'a-ouvir'; readonly desde: number }
  | { readonly nome: 'a-transcrever' }
  | { readonly nome: 'a-corrigir' }
  | { readonly nome: 'sem-modelo'; readonly modelo: ModeloDeVoz }
  | { readonly nome: 'a-descarregar'; readonly percentagem: number }
  | { readonly nome: 'a-repetir'; readonly porque: string };

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

interface Gravacao {
  readonly stream: MediaStream;
  readonly contexto: AudioContext;
  readonly limite: number;
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

interface Opcoes {
  readonly desligado: boolean;
  /** O texto final, por enviar. Quem chama põe-no na linha de entrada, sem apagar o que lá está. */
  readonly aoTexto: (texto: string) => void;
  /** `null` apaga o aviso; `info` é boa notícia, o resto é problema. */
  readonly aoAviso: (aviso: string | null, tom?: 'info' | 'erro') => void;
  /** As últimas linhas visíveis do terminal, lidas no momento em que se pára de falar. */
  readonly obterContexto: () => string | null;
}

export function useDictation({ desligado, aoTexto, aoAviso, obterContexto }: Opcoes) {
  const [fase, setFase] = useState<FaseDoDitado>({ nome: 'parado' });
  const [segundos, setSegundos] = useState(0);

  const gravacao = useRef<Gravacao | null>(null);
  const pedacos = useRef<Float32Array[]>([]);
  const pcmGuardado = useRef<Float32Array | null>(null);
  const contextoGuardado = useRef<string | null>(null);
  const corrigirLigado = useRef(true);
  // Cada ditado tem o seu número: cancelar muda-o, e a resposta atrasada de antes não entra.
  const ditadoEmCurso = useRef(0);
  const faseAtual = useRef(fase);
  useEffect(() => { faseAtual.current = fase; }, [fase]);

  const fecharGravacao = useCallback((): void => {
    const atual = gravacao.current;
    if (atual === null) return;
    gravacao.current = null;
    window.clearTimeout(atual.limite);
    for (const faixa of atual.stream.getTracks()) faixa.stop();
    void atual.contexto.close().catch(() => undefined);
  }, []);

  const esquecer = useCallback((): void => {
    pcmGuardado.current = null;
    contextoGuardado.current = null;
  }, []);

  const cancelar = useCallback((): void => {
    ditadoEmCurso.current += 1;
    fecharGravacao();
    pedacos.current = [];
    esquecer();
    setFase({ nome: 'parado' });
  }, [esquecer, fecharGravacao]);

  /** Do áudio ao texto. Volta a correr em «Tentar de novo», com o áudio guardado. */
  const processar = useCallback(async (pcm: Float32Array, contexto: string | null, id: number): Promise<void> => {
    const aindaEste = (): boolean => ditadoEmCurso.current === id;
    setFase({ nome: 'a-transcrever' });
    let texto: string;
    try {
      const r = await transcrever(pcm);
      if (!aindaEste()) return;
      texto = r.texto;
      if (r.truncado) aoAviso('A transcrição veio cortada: o motor não chegou ao fim do áudio.');
    } catch (erro) {
      if (!aindaEste()) return;
      setFase({ nome: 'a-repetir', porque: (erro as Error).message });
      return;
    }
    if (texto.trim() === '') {
      esquecer();
      setFase({ nome: 'parado' });
      aoAviso('Não ouvi nada. Vê se o microfone certo está ligado.');
      return;
    }
    if (!corrigirLigado.current) {
      esquecer();
      setFase({ nome: 'parado' });
      aoTexto(texto);
      return;
    }
    setFase({ nome: 'a-corrigir' });
    try {
      const c = await corrigir(texto, contexto);
      if (!aindaEste()) return;
      aoTexto(c.texto);
      if (!c.corrigido) aoAviso(`Ficou a transcrição em bruto: ${c.aviso}.`);
    } catch (erro) {
      if (!aindaEste()) return;
      // A rota não respondeu: o que foi dito não se perde por causa disso.
      aoTexto(texto);
      aoAviso(`Ficou a transcrição em bruto: ${(erro as Error).message}.`);
    }
    esquecer();
    setFase({ nome: 'parado' });
  }, [aoAviso, aoTexto, esquecer]);

  const parar = useCallback(async (): Promise<void> => {
    const atual = gravacao.current;
    if (atual === null) return;
    const id = ditadoEmCurso.current;
    const taxa = atual.contexto.sampleRate;
    fecharGravacao();
    // Antes de a fase mudar: o contexto é o do terminal como estava quando se parou de falar.
    const contexto = await capturarContexto(obterContexto);
    if (ditadoEmCurso.current !== id) return;
    const pcm = reamostrar(juntarPedacos(pedacos.current), taxa);
    pedacos.current = [];
    if (pcm.length < TAXA_DE_AMOSTRAGEM / 10) {
      setFase({ nome: 'parado' });
      aoAviso('Não ouvi nada. Vê se o microfone certo está ligado.');
      return;
    }
    pcmGuardado.current = pcm;
    contextoGuardado.current = contexto;
    await processar(pcm, contexto, id);
  }, [aoAviso, fecharGravacao, obterContexto, processar]);

  const iniciar = useCallback(async (): Promise<void> => {
    aoAviso(null);
    const id = (ditadoEmCurso.current += 1);
    setFase({ nome: 'a-abrir' });
    // Até a gravação estar registada, o microfone só se larga por aqui.
    let stream: MediaStream | null = null;
    let contexto: AudioContext | null = null;
    const largarMicrofone = (): void => {
      for (const faixa of stream?.getTracks() ?? []) faixa.stop();
      void contexto?.close().catch(() => undefined);
    };
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('O microfone só funciona com o JOCA OS aberto em localhost ou por HTTPS.');
      }
      const estado = await lerEstadoDeVoz();
      if (ditadoEmCurso.current !== id) return;
      if (estado.descarga?.fase === 'a-descarregar') {
        setFase({ nome: 'a-descarregar', percentagem: Math.floor((estado.descarga.recebidos / estado.descarga.total) * 100) });
        return;
      }
      const escolhido = estado.modelos.find((m) => m.id === estado.definicoes.modeloVoz);
      if (escolhido && escolhido.origem === null) {
        setFase({ nome: 'sem-modelo', modelo: escolhido });
        return;
      }
      corrigirLigado.current = estado.definicoes.correcaoLigada;

      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false } });
      if (ditadoEmCurso.current !== id) { largarMicrofone(); return; }
      contexto = new AudioContext();
      const endereco = URL.createObjectURL(new Blob([COLETOR], { type: 'text/javascript' }));
      try { await contexto.audioWorklet.addModule(endereco); } finally { URL.revokeObjectURL(endereco); }
      if (ditadoEmCurso.current !== id) { largarMicrofone(); return; }
      const coletor = new AudioWorkletNode(contexto, 'coletor-do-ditado');
      pedacos.current = [];
      coletor.port.onmessage = (evento: MessageEvent<Float32Array>) => { pedacos.current.push(evento.data); };
      contexto.createMediaStreamSource(stream).connect(coletor);
      coletor.connect(contexto.destination);
      // O motor carrega enquanto se fala, para o texto chegar logo a seguir a parar.
      if (!estado.motorCarregado) void prepararMotor().catch(() => undefined);

      const limite = window.setTimeout(() => void parar(), MAX_SEGUNDOS * 1000);
      gravacao.current = { stream, contexto, limite };
      setSegundos(0);
      setFase({ nome: 'a-ouvir', desde: Date.now() });
    } catch (erro) {
      largarMicrofone();
      if (ditadoEmCurso.current !== id) return;
      setFase({ nome: 'parado' });
      aoAviso(erro instanceof DOMException ? motivoDoMicrofone(erro) : (erro as Error).message);
    }
  }, [aoAviso, parar]);

  const alternar = useCallback((): void => {
    const nome = faseAtual.current.nome;
    if (nome === 'a-ouvir') void parar();
    else if (nome === 'parado' && !desligado) void iniciar();
  }, [desligado, iniciar, parar]);

  const tentarDeNovo = useCallback((): void => {
    const pcm = pcmGuardado.current;
    if (pcm !== null) void processar(pcm, contextoGuardado.current, ditadoEmCurso.current);
  }, [processar]);

  const descarregar = useCallback((modelo: ModeloDeVoz): void => {
    setFase({ nome: 'a-descarregar', percentagem: 0 });
    descarregarModeloDeVoz(modelo.id).catch((erro: unknown) => {
      setFase({ nome: 'parado' });
      aoAviso(`Não consegui descarregar o modelo de voz: ${(erro as Error).message}.`);
    });
  }, [aoAviso]);

  // Sem canal de eventos para a voz: durante a descarga, pergunta-se o progresso a cada segundo.
  const aDescarregar = fase.nome === 'a-descarregar';
  useEffect(() => {
    if (!aDescarregar) return;
    const relogio = window.setInterval(() => {
      lerEstadoDeVoz().then((estado) => {
        if (faseAtual.current.nome !== 'a-descarregar') return;
        const d = estado.descarga;
        if (d?.fase === 'a-descarregar') {
          setFase({ nome: 'a-descarregar', percentagem: Math.floor((d.recebidos / d.total) * 100) });
          return;
        }
        setFase({ nome: 'parado' });
        if (d?.fase === 'pronto') aoAviso('O modelo de voz está pronto. Já podes ditar.', 'info');
        else if (d?.fase === 'falhou') aoAviso(`A descarga falhou: ${d.porque}.`);
      }).catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(relogio);
  }, [aDescarregar, aoAviso]);

  useEffect(() => {
    if (fase.nome !== 'a-ouvir') return;
    const relogio = window.setInterval(() => setSegundos(Math.round((Date.now() - fase.desde) / 1000)), 1000);
    return () => window.clearInterval(relogio);
  }, [fase]);

  useEffect(() => () => {
    // A abrir ainda não há gravação para fechar: o número novo faz o `iniciar` largar o microfone.
    if (faseAtual.current.nome === 'a-abrir') ditadoEmCurso.current += 1;
    fecharGravacao();
  }, [fecharGravacao]);

  return { fase, segundos, alternar, cancelar, tentarDeNovo, descarregar, tamanhoDoModelo: emMegabytes };
}
