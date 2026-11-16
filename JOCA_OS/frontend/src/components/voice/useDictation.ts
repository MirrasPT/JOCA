// A ponte entre o `TerminalView` e o controlador do ditado (que vive fora do React — ver
// `dictation-controller.ts`). O componente só se liga como destino enquanto está montado.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ControladorDoDitado, type Destino } from './dictation-controller';
import { abrirMicrofone } from './microphone';
import {
  capturarContexto,
  corrigir,
  descarregarModeloDeVoz,
  emMegabytes,
  lerEstadoDeVoz,
  linhasVisiveis,
  prepararMotor,
  transcrever,
} from './voice-client';

export type { FaseDoDitado } from './dictation-controller';

/** Um só para a app inteira: sobrevive a qualquer `TerminalView` que monte ou desmonte. */
const controlador = new ControladorDoDitado({
  lerEstado: lerEstadoDeVoz,
  transcrever,
  corrigir,
  prepararMotor,
  descarregar: descarregarModeloDeVoz,
  abrirMicrofone,
  capturarContexto: (origem) => capturarContexto(
    () => linhasVisiveis(document.querySelector(`[data-sessao="${CSS.escape(origem)}"]`)),
  ),
});

// Estáveis (fora do componente): podem entrar em dependências de efeitos sem os relançar.
const cancelar = () => controlador.cancelar();
const tentarDeNovo = () => controlador.tentarDeNovo();
const descarregar = controlador.descarregar.bind(controlador);
const entregarPendentes = (sessao: string | null) => controlador.entregarPendentes(sessao);

interface Opcoes {
  readonly desligado: boolean;
  /** Põe o texto (por enviar) na sessão `origem`; `false` se esta vista não a consegue receber. */
  readonly entregar: (origem: string, texto: string) => boolean;
  /** `null` apaga o aviso; `info` é boa notícia, o resto é problema. */
  readonly aoAviso: (aviso: string | null, tom?: 'info' | 'erro') => void;
}

export function useDictation({ desligado, entregar, aoAviso }: Opcoes) {
  const fase = useSyncExternalStore(controlador.subscrever, () => controlador.fase);
  const [segundos, setSegundos] = useState(0);

  // O destino lê as props mais recentes por ref: o controlador guarda UM objeto por montagem.
  const ultimas = useRef({ entregar, aoAviso });
  useEffect(() => { ultimas.current = { entregar, aoAviso }; }, [entregar, aoAviso]);
  useEffect(() => {
    const destino: Destino = {
      entregar: (origem, texto) => ultimas.current.entregar(origem, texto),
      avisar: (aviso, tom) => ultimas.current.aoAviso(aviso, tom),
    };
    controlador.ligar(destino);
    // Desmontar a meio NÃO deita fora o áudio: o controlador termina e transcreve na mesma.
    return () => controlador.desmontar(destino);
  }, []);

  /** Carregar no microfone: começa a ouvir para a sessão `origem`, ou pára se já está a ouvir. */
  const alternar = useCallback((origem: string | null): void => {
    if (controlador.fase.nome === 'a-ouvir') void controlador.parar();
    else if (controlador.fase.nome === 'parado' && !desligado && origem) void controlador.iniciar(origem);
  }, [desligado]);

  useEffect(() => {
    if (fase.nome !== 'a-ouvir') return;
    const relogio = window.setInterval(() => setSegundos(Math.round((Date.now() - fase.desde) / 1000)), 1000);
    return () => { window.clearInterval(relogio); setSegundos(0); };
  }, [fase]);

  return {
    fase,
    segundos,
    alternar,
    cancelar,
    tentarDeNovo,
    descarregar,
    entregarPendentes,
    tamanhoDoModelo: emMegabytes,
  };
}
