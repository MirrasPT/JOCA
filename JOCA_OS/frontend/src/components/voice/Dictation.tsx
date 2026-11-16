// O botão de ditar (barra do terminal) e a linha de estado do ditado.
import type { FaseDoDitado, useDictation } from './useDictation';
import './dictation.css';

function relogio(segundos: number): string {
  const resto = segundos % 60;
  return `${Math.floor(segundos / 60)}:${resto < 10 ? '0' : ''}${resto}`;
}

export function DictationButton({ fase, desligado, aoCarregar }: { readonly fase: FaseDoDitado; readonly desligado: boolean; readonly aoCarregar: () => void }) {
  const aOuvir = fase.nome === 'a-ouvir';
  const ocupado = !aOuvir && fase.nome !== 'parado';
  return (
    <button
      type="button"
      className={`quick-command-btn quick-command-btn--plus ditado-botao${aOuvir ? ' ditado-botao--a-ouvir' : ''}`}
      aria-label={aOuvir ? 'Parar de ditar' : 'Ditar por voz'}
      aria-pressed={aOuvir}
      data-tooltip={aOuvir ? 'Parar de ditar (o texto fica na caixa, por enviar)' : 'Ditar por voz (transcrição local)'}
      disabled={ocupado || (desligado && !aOuvir)}
      onClick={aoCarregar}
    >
      {aOuvir ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <path d="M12 17v5" />
        </svg>
      )}
    </button>
  );
}

export interface AvisoDoDitado {
  readonly texto: string;
  readonly tom: 'info' | 'erro';
}

/** A linha por cima da caixa: o estado do ditado e, por baixo dele, o último aviso. */
export function DictationStatus({ ditado, aviso, aoFecharAviso }: {
  readonly ditado: ReturnType<typeof useDictation>;
  readonly aviso: AvisoDoDitado | null;
  readonly aoFecharAviso: () => void;
}) {
  const { fase, segundos, cancelar, tentarDeNovo, descarregar, tamanhoDoModelo } = ditado;
  if (fase.nome === 'parado' && aviso === null) return null;

  const texto = fase.nome === 'parado' ? '' : {
    'a-abrir': 'A ligar o microfone…',
    'a-ouvir': `A ouvir ${relogio(segundos)}`,
    'a-transcrever': 'A transcrever…',
    'a-corrigir': 'A limpar o texto…',
    'a-descarregar': fase.nome === 'a-descarregar' ? `A descarregar o modelo de voz: ${fase.percentagem}%` : '',
    'sem-modelo': fase.nome === 'sem-modelo' ? `Falta o modelo de voz (${tamanhoDoModelo(fase.modelo.bytes)}).` : '',
    'a-repetir': fase.nome === 'a-repetir' ? `O ditado não foi transcrito: ${fase.porque}` : '',
  }[fase.nome];

  return (
    <div className="ditado-linhas">
      {fase.nome !== 'parado' && (
        <div className="ditado-estado" role="status">
          {fase.nome === 'a-ouvir' && <span className="ditado-ponto" aria-hidden />}
          <span>{texto}</span>
          {fase.nome === 'sem-modelo' && (
            <button type="button" className="ditado-accao" onClick={() => descarregar(fase.modelo)}>Descarregar</button>
          )}
          {fase.nome === 'a-repetir' && (
            <button type="button" className="ditado-accao" onClick={tentarDeNovo}>Tentar de novo</button>
          )}
          {fase.nome !== 'a-descarregar' && (
            <button type="button" className="ditado-accao" onClick={cancelar}>
              {fase.nome === 'sem-modelo' ? 'Agora não' : fase.nome === 'a-repetir' ? 'Descartar' : 'Cancelar'}
            </button>
          )}
        </div>
      )}
      {aviso && (
        <div className={`ditado-estado ditado-aviso ditado-aviso--${aviso.tom}`} role={aviso.tom === 'erro' ? 'alert' : 'status'}>
          <span>{aviso.texto}</span>
          <button type="button" className="ditado-accao" onClick={aoFecharAviso}>Fechar</button>
        </div>
      )}
    </div>
  );
}
