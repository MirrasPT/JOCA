// "Save all" — mandar `/save` a todas as conversas abertas de uma vez.
//
// PORQUE VAI COMPLETO (com Enter) e não escrito no campo: o botão `save` da barra de UM terminal
// escreve `/save ` no campo e não envia, de propósito — ali dá para juntar uma nota
// (`/save arrumei os botões`) antes do Enter. Em lote essa razão desaparece: não há forma de
// escrever uma nota diferente em N campos ao mesmo tempo, e N rascunhos por enviar não guardam
// nada. Quem quer a nota continua a ter o botão de dentro do terminal — é o que o diálogo diz.
//
// A peça está partida em três — o plano (puro), o botão e o diálogo — porque o plano é a parte que
// decide QUEM recebe o comando, e essa decisão tem de ser verificável sem browser.
import type { SessionInfo } from '../../types';
import ConfirmDialog from '../ConfirmDialog';
import { SaveIcon } from './icons';

/** O que o Save all vai fazer, contado antes de o fazer. */
export interface PlanoSaveAll {
  /** As conversas que recebem o comando, por ordem da lista. */
  ids: string[];
  total: number;
  /** Quantas dessas estão a trabalhar neste momento. Não muda quem recebe — muda o que se avisa. */
  aTrabalhar: number;
}

/** O que entra no PTY de cada conversa. `\r` é o que submete — sem ele fica escrito e parado. */
export const COMANDO_SAVE = '/save\r';

/**
 * TODAS as conversas abertas entram, incluindo as que estão a trabalhar.
 *
 * 1. O botão diz "Save all (N)". Um botão que promete N e guarda dois é uma contagem falsa — e as
 *    que estão a trabalhar são precisamente as que têm mais coisas por guardar.
 * 2. Escrever numa conversa a trabalhar não a interrompe: o CLI enfileira a linha e corre-a quando
 *    o turno actual acaba. É o mesmo que o dono faz à mão quando escreve enquanto aquilo trabalha
 *    (interromper é o Ctrl-C do botão Stop, outra coisa).
 * 3. Filtrar por `working` não compraria segurança nenhuma: o estado só distingue "saiu output há
 *    pouco" de "está calado há uns segundos" (`session-manager.ts`), portanto uma conversa parada à
 *    espera de resposta a um pedido de permissão conta como `idle` e receberia o texto na mesma.
 *    Um filtro que não protege do caso mau, e esconde metade do trabalho do dono, é pior que nada.
 *
 * O travão real é o diálogo de confirmação, que diz quantas estão a trabalhar antes do clique.
 */
export function planoSaveAll(sessions: SessionInfo[]): PlanoSaveAll {
  return {
    ids: sessions.map((s) => s.id),
    total: sessions.length,
    aTrabalhar: sessions.filter((s) => s.status === 'working').length,
  };
}

/** O que fica escrito na dashboard depois de enviar — o resultado tem de ser visível, não presumido. */
export function mensagemSaveAll(plano: PlanoSaveAll): string {
  const conversas = plano.total === 1 ? '1 conversa' : `${plano.total} conversas`;
  if (plano.aTrabalhar === 0) return `/save enviado a ${conversas}.`;
  const estavam = plano.aTrabalhar === 1 ? '1 estava a trabalhar' : `${plano.aTrabalhar} estavam a trabalhar`;
  return `/save enviado a ${conversas} — ${estavam}, aí fica na fila do CLI.`;
}

export function SaveAllButton({ plano, onClick }: { plano: PlanoSaveAll; onClick: () => void }) {
  const semConversas = plano.total === 0;
  return (
    <button
      type="button"
      className="f-btn f-btn--secondary"
      onClick={onClick}
      disabled={semConversas}
      title={semConversas
        ? 'Não há conversas abertas para guardar'
        : `Mandar /save às ${plano.total} conversas abertas`}
    >
      <SaveIcon /> Save all ({plano.total})
    </button>
  );
}

export function SaveAllConfirm({
  plano, onConfirm, onCancel,
}: { plano: PlanoSaveAll; onConfirm: () => void; onCancel: () => void }) {
  return (
    <ConfirmDialog
      title={`Mandar /save a ${plano.total === 1 ? '1 conversa' : `${plano.total} conversas`}?`}
      confirmLabel={`Mandar /save (${plano.total})`}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      Vai ser escrito <strong>/save</strong> e enviado com Enter em cada uma das{' '}
      <strong>{plano.total}</strong> conversas abertas, sem nota. Para juntar uma nota a uma delas,
      usa o botão <strong>save</strong> dentro do terminal.
      {plano.aTrabalhar > 0 && (
        <span className="confirm-note">
          <strong>{plano.aTrabalhar}</strong> {plano.aTrabalhar === 1 ? 'está' : 'estão'} a trabalhar
          agora: aí o comando não interrompe nada — entra na fila do CLI e corre quando o trabalho
          actual acabar.
        </span>
      )}
    </ConfirmDialog>
  );
}
