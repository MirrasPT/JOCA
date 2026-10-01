// «Sair» — encerra o JOCA OS inteiro (backend + frontend), o mesmo que correr o stop.bat / stop.sh
// à mão. Fecha TODAS as conversas abertas; por isso passa por confirmação e lembra o Save all antes.
// Depois do 202 o backend morre: o ecrã final substitui a app, que ficaria a tentar religar-se.
import ConfirmDialog from '../ConfirmDialog';
import { ExitIcon } from './icons';

/** Pede ao backend para correr o stop. `true` = aceite (202). */
export async function pedirSaida(): Promise<boolean> {
  try {
    const res = await fetch('/shutdown', { method: 'POST' });
    return res.status === 202;
  } catch {
    return false;
  }
}

export function ExitButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="f-btn f-btn--secondary"
      onClick={onClick}
      title="Encerrar o JOCA OS (backend e frontend)"
    >
      <ExitIcon /> Sair
    </button>
  );
}

export function ExitConfirm({
  conversasAbertas, erro, onConfirm, onCancel,
}: { conversasAbertas: number; erro: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <ConfirmDialog title="Encerrar o JOCA OS?" confirmLabel="Sair" onConfirm={onConfirm} onCancel={onCancel}>
      O JOCA OS desliga-se por completo e todas as conversas abertas terminam. Para voltar, arranca-o
      de novo.
      {conversasAbertas > 0 && (
        <span className="confirm-note">
          Tens <strong>{conversasAbertas}</strong>{' '}
          {conversasAbertas === 1 ? 'conversa aberta' : 'conversas abertas'}. Se há trabalho por
          guardar, cancela e usa o <strong>Save all</strong> primeiro.
        </span>
      )}
      {erro && <span className="confirm-note" role="alert">{erro}</span>}
    </ConfirmDialog>
  );
}

export function ExitScreen() {
  return (
    <div className="joca-exit-screen" role="status">
      <h1>JOCA OS encerrado</h1>
      <p>Podes fechar este separador.</p>
    </div>
  );
}
