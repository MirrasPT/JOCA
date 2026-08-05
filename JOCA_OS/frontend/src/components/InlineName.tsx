import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * Nome editável por duplo-clique.
 *
 * UM componente com estado PRÓPRIO, montado por linha — de propósito. A primeira versão disto
 * partilhava um único `editingId` + um ref entre todos os nomes de uma grelha, e bastava haver
 * dois campos com o mesmo id (título e linha do mesmo item) para o ref ficar agarrado ao último e
 * o blur de um fechar o outro. Estado local por instância elimina a classe inteira de bugs.
 *
 * Usado nos três sítios onde se renomeia inline: dashboard global, agentes do projecto e vista
 * global de Agentes. Sem `onRename` fica texto simples — é assim que se desliga a edição.
 *
 * ⚠ O nome vive quase sempre DENTRO de uma linha clicável (`role="button"` que abre o agente). Aí,
 * o 1.º clique do duplo-clique sobe até à linha, que navega e desmonta esta árvore — o modo de
 * edição nem chega a aparecer. `stopPropagation` no `onDoubleClick` não salva: o `dblclick` só é
 * emitido DEPOIS dos dois `click`. Por isso existe o `onActivate`: quem tem linha clicável passa lá
 * a acção da linha, e nós seguramos o clique 250 ms para ver se vem um segundo. Sem `onActivate` o
 * comportamento fica o de sempre (o clique sobe), para não mudar quem não precisa.
 */
const DBL_CLICK_MS = 250;

export default function InlineName({ value, onRename, onActivate, className, inputClassName = 'card-name-input', inputStyle, title }: {
  value: string;
  /** Ausente = não editável. */
  onRename?: (name: string) => void;
  /** Acção da linha clicável em que este nome vive (ex.: abrir o agente). Ver o aviso acima. */
  onActivate?: () => void;
  className?: string;
  inputClassName?: string;
  inputStyle?: CSSProperties;
  /** Tooltip em modo leitura. Sem isto usa-se o próprio nome + a dica de renome. */
  title?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingClick = () => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
  };
  useEffect(() => cancelPendingClick, []);   // desmontar a meio não deixa o timer a disparar

  useEffect(() => {
    if (editing) { setDraft(value); inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing, value]);

  if (!editing || !onRename) {
    return (
      <span
        className={className}
        onClick={onRename && onActivate ? (e) => {
          // Segura a acção da linha: se vier um 2.º clique, era um renome e este nunca corre.
          e.stopPropagation();
          cancelPendingClick();
          clickTimer.current = setTimeout(() => { clickTimer.current = null; onActivate(); }, DBL_CLICK_MS);
        } : undefined}
        onDoubleClick={onRename ? (e) => { e.stopPropagation(); cancelPendingClick(); setEditing(true); } : undefined}
        title={title ?? (onRename ? `${value} — duplo-clique renomeia` : value)}
        style={onRename ? { cursor: 'pointer' } : undefined}
      >
        {value}
      </span>
    );
  }

  const commit = () => {
    const t = draft.trim();
    if (t && t !== value) onRename(t);
    setEditing(false);
  };
  return (
    <input
      ref={inputRef}
      className={inputClassName}
      style={inputStyle}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') setEditing(false);
        // O pai é um role="button" que abre o agente ao Enter — sem isto, renomear abria o terminal.
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}
