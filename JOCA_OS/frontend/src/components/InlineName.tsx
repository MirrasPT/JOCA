import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * Name editable by double-click.
 *
 * ONE component with its OWN state, mounted per row — deliberately. The first version of this
 * shared a single `editingId` + one ref across every name in a grid, and it took only two fields
 * with the same id (the title and the row of the same item) for the ref to end up stuck on the
 * last one and the blur of one to close the other. Local state per instance eliminates the whole
 * class of bugs.
 *
 * Used in the three places where renaming happens inline: global dashboard, project agents and the
 * global Agents view. Without `onRename` it is plain text — that is how editing is turned off.
 *
 * ⚠ The name almost always lives INSIDE a clickable row (a `role="button"` that opens the agent).
 * There, the 1st click of the double-click bubbles up to the row, which navigates and unmounts this
 * tree — edit mode never even appears. `stopPropagation` on `onDoubleClick` does not save it: the
 * `dblclick` is only emitted AFTER the two `click`s. That is why `onActivate` exists: whoever has a
 * clickable row passes the row's action in there, and we hold the click for 250 ms to see if a
 * second one comes. Without `onActivate` the behavior is the usual one (the click bubbles), so as
 * not to change those who do not need it.
 */
const DBL_CLICK_MS = 250;

export default function InlineName({ value, onRename, onActivate, className, inputClassName = 'card-name-input', inputStyle, title }: {
  value: string;
  /** Absent = not editable. */
  onRename?: (name: string) => void;
  /** Action of the clickable row this name lives in (e.g. open the agent). See the warning above. */
  onActivate?: () => void;
  className?: string;
  inputClassName?: string;
  inputStyle?: CSSProperties;
  /** Tooltip in read mode. Without this the name itself + the rename hint is used. */
  title?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingClick = () => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
  };
  useEffect(() => cancelPendingClick, []);   // unmounting mid-flight does not leave the timer firing

  useEffect(() => {
    if (editing) { setDraft(value); inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing, value]);

  if (!editing || !onRename) {
    return (
      <span
        className={className}
        onClick={onRename && onActivate ? (e) => {
          // Holds the row's action: if a 2nd click comes, it was a rename and this one never runs.
          e.stopPropagation();
          cancelPendingClick();
          clickTimer.current = setTimeout(() => { clickTimer.current = null; onActivate(); }, DBL_CLICK_MS);
        } : undefined}
        onDoubleClick={onRename ? (e) => { e.stopPropagation(); cancelPendingClick(); setEditing(true); } : undefined}
        title={title ?? (onRename ? `${value} — double-click to rename` : value)}
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
        // The parent is a role="button" that opens the agent on Enter — without this, renaming opened the terminal.
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}
