// ConfirmDialog — a paragem obrigatória antes de uma acção que não se desfaz.
//
// Existe porque a barra lateral passou a poder remover projectos: ali não há "Zona perigosa" a
// enquadrar o botão, e um caixote do lixo a um clique de distância, encostado ao arquivar, apaga
// trabalho por engano. O diálogo diz O QUE se perde e O QUE fica ANTES do clique — a diferença tem
// de ser visível antes, não depois.
//
// Acessibilidade tratada como no modal de projecto: `role="alertdialog"` (é um aviso, não um
// formulário), foco inicial no botão SEGURO (Cancelar) e não no destrutivo, focus-trap real no Tab
// — `aria-modal` promete que o resto fica inerte mas não o implementa — e Escape/clique fora a
// cancelar. Enter num diálogo destes nunca confirma sozinho: quem confirma carrega no botão.
import { useCallback, useEffect, useRef } from 'react';
import './confirm-dialog.css';

export default function ConfirmDialog({
  title, children, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onConfirm, onCancel,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Em refs para o efeito do teclado correr uma vez só: sem isto, um handler recriado a cada
  // render tira e repõe o listener e o foco salta.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelRef.current(); return; }
      if (e.key !== 'Tab') return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button');
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onOverlayDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  }, [onCancel]);

  return (
    <div className="confirm-overlay" onMouseDown={onOverlayDown}>
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
      >
        <div className="confirm-dialog-head">
          <span className="confirm-dialog-icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4" /><path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </span>
          <h2 id="confirm-dialog-title">{title}</h2>
        </div>
        <div id="confirm-dialog-body" className="confirm-dialog-body">{children}</div>
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="confirm-btn" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="confirm-btn confirm-btn--danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
