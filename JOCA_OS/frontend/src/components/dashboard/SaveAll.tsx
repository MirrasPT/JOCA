// "Save all" — send `/save` to every open conversation at once.
//
// WHY IT GOES COMPLETE (with Enter) and not written into the field: the `save` button on ONE
// terminal's bar writes `/save ` into the field and does not send, deliberately — there you can add
// a note (`/save tidied up the buttons`) before Enter. In bulk that reason disappears: there is no
// way to write a different note in N fields at once, and N unsent drafts save nothing. Whoever
// wants the note still has the button inside the terminal — that is what the dialog says.
//
// The piece is split in three — the plan (pure), the button and the dialog — because the plan is the
// part that decides WHO receives the command, and that decision has to be verifiable without a browser.
import type { SessionInfo } from '../../types';
import ConfirmDialog from '../ConfirmDialog';
import { SaveIcon } from './icons';

/** What Save all is going to do, counted before doing it. */
export interface PlanoSaveAll {
  /** The conversations that receive the command, in list order. */
  ids: string[];
  total: number;
  /** How many of those are working right now. It does not change who receives — it changes the warning. */
  aTrabalhar: number;
}

/** What goes into each conversation's PTY. `\r` is what submits — without it, it sits there written and idle. */
export const COMANDO_SAVE = '/save\r';

/**
 * EVERY open conversation goes in, including the ones that are working.
 *
 * 1. The button says "Save all (N)". A button that promises N and saves two is a false count — and
 *    the ones that are working are precisely the ones with the most left to save.
 * 2. Writing into a working conversation does not interrupt it: the CLI queues the line and runs
 *    it when the current turn ends. It is the same thing the owner does by hand when typing while
 *    that thing works (interrupting is the Stop button's Ctrl-C, another matter).
 * 3. Filtering by `working` would buy no safety: the state only tells "output came out recently"
 *    from "quiet for a few seconds" (`session-manager.ts`), so a conversation idle waiting for an
 *    answer to a permission request counts as `idle` and would get the text anyway. A filter that
 *    does not protect from the bad case, and hides half the owner's work, is worse than nothing.
 *
 * The real brake is the confirmation dialog, which says how many are working before the click.
 */
export function planoSaveAll(sessions: SessionInfo[]): PlanoSaveAll {
  return {
    ids: sessions.map((s) => s.id),
    total: sessions.length,
    aTrabalhar: sessions.filter((s) => s.status === 'working').length,
  };
}

/** What stays written on the dashboard after sending — the result has to be visible, not presumed. */
export function mensagemSaveAll(plano: PlanoSaveAll): string {
  const conversas = plano.total === 1 ? '1 conversation' : `${plano.total} conversations`;
  if (plano.aTrabalhar === 0) return `/save sent to ${conversas}.`;
  const estavam = plano.aTrabalhar === 1 ? '1 was working' : `${plano.aTrabalhar} were working`;
  return `/save sent to ${conversas} — ${estavam}, there it sits in the CLI's queue.`;
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
        ? 'There are no open conversations to save'
        : `Send /save to the ${plano.total} open conversations`}
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
      title={`Send /save to ${plano.total === 1 ? '1 conversation' : `${plano.total} conversations`}?`}
      confirmLabel={`Send /save (${plano.total})`}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <strong>/save</strong> will be written and sent with Enter in each of the{' '}
      <strong>{plano.total}</strong> open conversations, with no note. To add a note to one of them,
      use the <strong>save</strong> button inside the terminal.
      {plano.aTrabalhar > 0 && (
        <span className="confirm-note">
          <strong>{plano.aTrabalhar}</strong> {plano.aTrabalhar === 1 ? 'is' : 'are'} working
          now: there the command interrupts nothing — it enters the CLI's queue and runs when the
          current work ends.
        </span>
      )}
    </ConfirmDialog>
  );
}
