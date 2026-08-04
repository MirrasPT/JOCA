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
 */
export default function InlineName({ value, onRename, className, inputClassName = 'card-name-input', inputStyle, title }: {
  value: string;
  /** Ausente = não editável. */
  onRename?: (name: string) => void;
  className?: string;
  inputClassName?: string;
  inputStyle?: CSSProperties;
  /** Tooltip em modo leitura. Sem isto usa-se o próprio nome + a dica de renome. */
  title?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) { setDraft(value); inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing, value]);

  if (!editing || !onRename) {
    return (
      <span
        className={className}
        onDoubleClick={onRename ? (e) => { e.stopPropagation(); setEditing(true); } : undefined}
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
