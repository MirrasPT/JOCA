import { useState, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties, ReactNode, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { MainView, SessionInfo, Project, ProjectIcon, ProjectGroup as ProjectGroupData } from '../types';
import { iconInitials, projectIconUrl } from '../types';
import { projectColor } from '../lib/projectColor';
import { shortPath } from '../lib/paths';
import ConfirmDialog from './ConfirmDialog';
import { useBrand } from '../hooks/useBrand';
import { probeOfficeGif, loadOfficePool, poolIndex, stillFor } from '../lib/office-gifs';
// Version read from `package.json`, not written by hand: the number hardcoded here had fallen a
// whole version behind the real one (0.8.1 on screen, 0.9.1 in the three package.json). The named
// import only brings the string into the bundle, not the whole file.
import { version as VERSAO_COMPLETA } from '../../package.json';

/** Only `major.minor` in the bar (`0.9`). The patch keeps living in `package.json`, which is where
 *  it matters; here it is identity, not a build number — and it still derives from the file, so it
 *  does not diverge again like the hand-written `0.8.1` did.
 *
 *  When the backend announces a `JOCA_ENV` (`PRD`, `DEV`, …), THAT is the label that shows: with two
 *  installations running at the same time, knowing WHICH one you are looking at is worth more than
 *  the version, which is the same in both. Without `JOCA_ENV`, nothing changes. */
const VERSAO = VERSAO_COMPLETA.split('.').slice(0, 2).join('.');



interface Props {
  /** Instance label (`JOCA_ENV` in the backend). `null` → shows the version. */
  envLabel?: string | null;
  sessions: SessionInfo[];
  projects: Project[];
  projectGroups: ProjectGroupData[];
  /** The type comes from `types.ts` — repeating the union here made it diverge (that is how
   *  `'agents'` came to exist everywhere except in the bar that has to mark it as active). */
  mainView: MainView;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onShowDashboard: () => void;
  /** Global agents view (every project in one single place). */
  onShowAgents: () => void;
  onShowProject: (projectId: string) => void;
  /** Open a loose agent (without a project) straight from the sidebar. */
  onOpenSession: (id: string) => void;
  /** Rename a quick agent (double-click on the name). */
  onRenameSession?: (id: string, name: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onCreateProject: () => void;
  /** Opens Settings (modal). The right rail where they lived was removed. */
  onOpenSettings: () => void;
  onInput: (sessionId: string, data: string) => void;
  onRenameProject?: (id: string, name: string) => void;
  onArchiveProject?: (id: string, archived: boolean) => void;
  onReorderProjects?: (orderedIds: string[]) => void;
  onGroupProjects?: (draggedId: string, targetId: string) => void;
  onUngroupProject?: (id: string) => void;
  /** Removes the project from JOCA. The confirmation is raised by the row itself, not here. */
  onRemoveProject?: (id: string) => void;
  onRenameGroup?: (id: string, name: string) => void;
  /** `null` clears the group icon (the backend collects the file if nobody else points at it). */
  onSetGroupIcon?: (id: string, icon: ProjectIcon | null) => void;
  onToggleGroupCollapsed?: (id: string, collapsed: boolean) => void;
}

type LucideName =
  | 'layout-dashboard' | 'plus' | 'folder-plus' | 'message-square'
  | 'terminal' | 'terminal-quick' | 'folder' | 'folder-open' | 'chevron-right' | 'chevron-down'
  | 'sparkles' | 'chevrons-left' | 'search' | 'x'
  | 'check' | 'refresh' | 'command' | 'chevrons-right' | 'chevron-left' | 'info'
  | 'grip' | 'archive' | 'archive-restore' | 'cpu' | 'arrow-up-down' | 'link' | 'trash'
  | 'settings';

/**
 * Icons of the "The Office" theme — they only come in with `data-brand="office"`, and only for the
 * names listed here; the rest falls back to the normal set.
 *
 * They are OUR OWN drawings, in the same stroke as the others (24×24, `currentColor`), quoting the
 * show's running jokes — the boss's mug, the Dundie, the stapler, the Schrute Farms beet, the
 * glasses, the ream of paper. They are not frames: images from the show in a public repo would be
 * third-party copyrighted material, and these inherit the theme's color, which a PNG does not.
 */
const OFFICE_ICONS: Partial<Record<LucideName, React.ReactNode>> = {
  // "World's Best Boss" mug — the main panel.
  'layout-dashboard': <><path d="M4 8h11v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" /><path d="M15 10h2.2a2.4 2.4 0 0 1 0 4.8H15" /><path d="M7.5 3v2M11.5 3v2" /></>,
  // Schrute Farms beet — the agents.
  terminal: <><path d="M12 20.5c-3.2 0-5.5-2.3-5.5-5.2S9 9.5 12 9.5s5.5 2.9 5.5 5.8-2.3 5.2-5.5 5.2Z" /><path d="M12 9.5V5.5" /><path d="M12 6.5C10.8 4.3 9 3.8 7.4 4.4c.2 1.9 2 3 4.6 2.1ZM12 6.5c1.2-2.2 3-2.7 4.6-2.1-.2 1.9-2 3-4.6 2.1Z" /></>,
  // Pencil — the quick session is the scratch pad on the side, not the agents' field work. Its OWN
  // glyph so the two can be told apart even with no GIF configured at all.
  'terminal-quick': <><path d="m14.5 4.5 5 5L9 20H4v-5Z" /><path d="m12.5 6.5 5 5" /></>,
  // Dwight's glasses — the settings.
  settings: <><circle cx="6.6" cy="13.5" r="3.6" /><circle cx="17.4" cy="13.5" r="3.6" /><path d="M10.2 13.2c.8-.9 2.8-.9 3.6 0" /><path d="m3.2 11.4 1.8-3M20.8 11.4 19 8.4" /></>,
  // Ream of paper — each project is a stack of sheets.
  folder: <><path d="M8 3.5h9.5v17H8Z" /><path d="M5 6.5v14h11" /><path d="M10.6 8h4.4M10.6 11.5h4.4" /></>,
};

/**
 * URL of this icon's GIF, if the file exists in `public/brand/office/`. Returns `null` while it
 * probes and whenever the theme is not The Office — in those cases the glyph is drawn, as before.
 */
function useOfficeGif(name: LucideName, activo: boolean): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!activo) { setSrc(null); return; }
    let vivo = true;
    void probeOfficeGif(name).then((url) => { if (vivo) setSrc(url); });
    return () => { vivo = false; };
  }, [name, activo]);
  return src;
}

/**
 * Animated image that only animates with the mouse over it. At rest it shows the still frame; on
 * enter it switches to the animated file, on leave it goes back (and the animated one restarts from
 * the beginning next time, which is what we want). If the still does not exist, we stay on the
 * animated one — there is never a hole.
 */
function OfficeGif({ src, className }: { src: string; className?: string }) {
  const [hover, setHover] = useState(false);
  const [seleccionado, setSeleccionado] = useState(false);
  const [temParado, setTemParado] = useState(true);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // The trigger is the BUTTON/row that contains the icon, not the icon: a 20px target forced you
    // to hit the square, when what you are pointing at is the whole entry.
    const alvo = ref.current?.closest<HTMLElement>(
      'button, a, [role="button"], .sidebar-loose-item, .project-group-header',
    );
    if (!alvo) return;

    const entra = () => setHover(true);
    const sai = () => setHover(false);
    alvo.addEventListener('mouseenter', entra);
    alvo.addEventListener('mouseleave', sai);

    // The item you ARE ON animates with no hover at all. The active state is written into the
    // button's classes/attributes, and changes without this component re-rendering — hence the
    // observer, instead of reading it once and going stale on a view change.
    const leEstado = () => setSeleccionado(
      alvo.classList.contains('active')
      || alvo.classList.contains('is-active')
      || alvo.getAttribute('aria-current') === 'page',
    );
    leEstado();
    const obs = new MutationObserver(leEstado);
    obs.observe(alvo, { attributes: true, attributeFilter: ['class', 'aria-current'] });

    return () => {
      alvo.removeEventListener('mouseenter', entra);
      alvo.removeEventListener('mouseleave', sai);
      obs.disconnect();
    };
  }, []);

  const aAnimar = hover || seleccionado;
  return (
    <img
      ref={ref}
      className={className ?? 'office-gif-icon'}
      src={aAnimar || !temParado ? src : stillFor(src)}
      alt=""
      aria-hidden
      onError={() => { if (!aAnimar) setTemParado(false); }}
    />
  );
}

/**
 * GIF from the pool for this id (project or session). `null` outside The Office theme, while the
 * pool is being probed, or if the folder is empty — in those cases the normal icon is drawn.
 */
function usePoolGif(id: string, activo: boolean): string | null {
  const [pool, setPool] = useState<string[]>([]);
  useEffect(() => {
    if (!activo) { setPool([]); return; }
    let vivo = true;
    void loadOfficePool().then((p) => { if (vivo) setPool(p); });
    return () => { vivo = false; };
  }, [activo]);
  return pool.length ? pool[poolIndex(id, pool.length)] : null;
}

function LucideIcon({ name }: { name: LucideName }) {
  const brand = useBrand();
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  // Order: GIF (if the file exists in the folder) → theme glyph → normal glyph. The glyph is what
  // gets drawn while the probe has not answered, so there is never a hole nor a broken icon.
  const gif = useOfficeGif(name, brand.id === 'office');
  if (gif) return <OfficeGif src={gif} />;
  if (brand.id === 'office' && OFFICE_ICONS[name]) return <svg {...common}>{OFFICE_ICONS[name]}</svg>;
  if (name === 'layout-dashboard') return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.9 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.7 1Z" /></svg>;
  if (name === 'plus') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === 'folder-plus') return <svg {...common}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M12 10v6M9 13h6" /></svg>;
  if (name === 'message-square') return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></svg>;
  // `terminal-quick` (quick session / loose agents) is drawn the same as `terminal` in the normal
  // set — it is the SAME thing. It exists as its own name only so it can get a different icon in the
  // themes: sharing the key made the Agents GIF show up in the quick session too.
  if (name === 'terminal' || name === 'terminal-quick') return <svg {...common}><path d="m5 7 5 5-5 5" /><path d="M12 19h7" /></svg>;
  if (name === 'folder') return <svg {...common}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /></svg>;
  if (name === 'folder-open') return <svg {...common}><path d="M6 17.5A2.5 2.5 0 0 1 3.5 15V6.5A2.5 2.5 0 0 1 6 4h3.5l2 2H18a2 2 0 0 1 2 2v1" /><path d="M4 17.5 6.2 10h15.3l-2.2 7.5A2 2 0 0 1 17.4 19H5.9A2 2 0 0 1 4 17.5Z" /></svg>;
  if (name === 'chevron-down') return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
  if (name === 'sparkles') return <svg {...common}><path d="m12 3-1.8 5.2L5 10l5.2 1.8L12 17l1.8-5.2L19 10l-5.2-1.8Z" /><path d="M5 3v4M3 5h4M19 17v4M17 19h4" /></svg>;
  if (name === 'chevrons-left') return <svg {...common}><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></svg>;
  if (name === 'chevrons-right') return <svg {...common}><path d="m13 17 5-5-5-5M6 17l5-5-5-5" /></svg>;
  if (name === 'chevron-left') return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
  if (name === 'chevron-right') return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
  if (name === 'x') return <svg {...common}><path d="M18 6 6 18M6 6l12 12" /></svg>;
  if (name === 'check') return <svg {...common}><polyline points="20 6 9 17 4 12" /></svg>;
  if (name === 'refresh') return <svg {...common}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" /></svg>;
  if (name === 'command') return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /></svg>;
  if (name === 'info') return <svg {...common}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
  if (name === 'grip') return <svg {...common}><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></svg>;
  if (name === 'archive') return <svg {...common}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></svg>;
  if (name === 'archive-restore') return <svg {...common}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h4" /><path d="M19 8v3" /><path d="m15 18 4-4 4 4" /><path d="M19 22v-8" /></svg>;
  if (name === 'cpu') return <svg {...common}><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /></svg>;
  if (name === 'arrow-up-down') return <svg {...common}><path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /></svg>;
  if (name === 'trash') return <svg {...common}><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" /><path d="M10 11v6M14 11v6" /></svg>;
  if (name === 'link') return <svg {...common}><path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 1 1 0 10h-2" /><line x1="8" y1="12" x2="16" y2="12" /></svg>;
  return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
}

// ── Visual identity (logo · emoji · monogram) ──────────────────────
// A single cascade for projects AND groups: uploaded logo → chosen emoji → the first 2 letters of
// the name. With the sidebar collapsed the name is hidden, so none of the branches may fall into an
// empty square — that is what happened to groups, which did not even have an icon element.
// The monogram comes in `data-mono` and only the CSS swaps it for the svg when the sidebar is
// collapsed (the folder icon stays in the DOM for the expanded sidebar).

function ProjectAvatar({ icon, name, id }: { icon?: ProjectIcon; name: string; id?: string }) {
  const brand = useBrand();
  // The pool only comes in when the project has NO icon of its own: a logo the owner chose always
  // beats the draw. The hook is called unconditionally (rules of hooks) and switched off by `activo`.
  const poolGif = usePoolGif(id ?? name, brand.id === 'office' && !icon);
  if (icon?.type === 'image') {
    return (
      <span className="project-group-icon project-icon--image">
        {/* Decorative: the accessible name already comes from the button that wraps it. */}
        <img src={projectIconUrl(icon)} alt="" />
      </span>
    );
  }
  if (icon?.type === 'emoji') {
    return <span className="project-group-icon project-icon--emoji" aria-hidden>{icon.value}</span>;
  }
  if (poolGif) {
    return (
      <span className="project-group-icon project-icon--image">
        <OfficeGif src={poolGif} className="office-gif-icon office-gif-icon--avatar" />
      </span>
    );
  }
  return (
    <span className="project-group-icon" data-mono={iconInitials(name)}>
      <LucideIcon name="folder" />
    </span>
  );
}

/**
 * Icon picker field (upload logo · emoji · remove), shared by the group row in the sidebar and by
 * the project modal. It lives here, and not in a file of its own, because the only two consumers
 * are these two modules — the alternative was creating a third file just for a ~60-line function.
 *
 * The upload follows the `POST /icons` contract: raw bytes in the body, the extension only as a
 * hint. The server is the authority on format/size — here the error is only translated into PT-PT.
 */
export function ProjectIconField({ icon, name, label, onChange }: {
  icon?: ProjectIcon;
  /** Project/group name — feeds the preview's monogram. */
  name: string;
  /** What the target is called in accessible labels (e.g. "group Marketing"). */
  label: string;
  onChange: (icon: ProjectIcon | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emojiDraft, setEmojiDraft] = useState(icon?.type === 'emoji' ? icon.value : '');
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() ?? '' : '';
      const res = await fetch('/icons', {
        method: 'POST',
        headers: ext ? { 'x-file-ext': ext } : undefined,
        body: file,
      });
      const data = await res.json().catch(() => ({} as { error?: string; icon?: ProjectIcon }));
      if (!res.ok || !data.icon) {
        setError(data.error || (res.status === 413 ? 'Image too large (maximum 2 MB).' : 'Could not upload the image.'));
        return;
      }
      onChange(data.icon);
      setEmojiDraft('');
    } catch {
      setError('Could not upload the image.');
    } finally {
      setBusy(false);
    }
  };

  const applyEmoji = () => {
    const value = emojiDraft.trim();
    if (!value) return;
    // Light validation — the one that really decides is the server (1 pictographic grapheme).
    if (!/\p{Extended_Pictographic}/u.test(value)) { setError('Type a single emoji.'); return; }
    setError('');
    onChange({ type: 'emoji', value });
  };

  return (
    <div className="icon-field">
      <span className="icon-field-preview" aria-hidden>
        {icon?.type === 'image' ? <img src={projectIconUrl(icon)} alt="" />
          : icon?.type === 'emoji' ? <span className="icon-field-emoji">{icon.value}</span>
            : <span className="icon-field-mono">{iconInitials(name)}</span>}
      </span>
      <div className="icon-field-controls">
        <input
          ref={fileRef}
          type="file"
          className="icon-field-file"
          accept="image/png,image/jpeg,image/webp"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          className="icon-field-btn"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'Uploading…' : 'Upload logo'}
        </button>
        <label className="icon-field-emoji-input">
          <span>Emoji</span>
          <input
            value={emojiDraft}
            maxLength={8}
            aria-label={`Emoji for ${label}`}
            onChange={(e) => setEmojiDraft(e.target.value)}
            onBlur={applyEmoji}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); applyEmoji(); }
              // Escape goes on its way: it is whoever closes the modal/flyout wrapping the field.
              if (e.key !== 'Escape') e.stopPropagation();
            }}
          />
        </label>
        {icon && (
          <button
            type="button"
            className="icon-field-btn icon-field-btn--ghost"
            onClick={() => { setEmojiDraft(''); setError(''); onChange(null); }}
          >
            Remove icon
          </button>
        )}
      </div>
      <p className={`icon-field-hint${error ? ' icon-field-hint--error' : ''}`} role="status">
        {error || 'PNG, JPEG or WEBP up to 2 MB. With no icon, the first two letters of the name are used.'}
      </p>
    </div>
  );
}

// ── Project sorting ────────────────────────────────────────────────
// Projects have no creation date — we use the position in the array (the `order` returned by
// GET /projects) as a proxy: the last one in the list is the most recent.
// The non-manual sorts are only a VIEW (they save nothing on the server); there is a
// "Pin order" button that persists explicitly via onReorderProjects → PUT /projects/order.

type ProjectSort = 'manual' | 'name-asc' | 'name-desc' | 'recent' | 'oldest';

const PROJECT_SORT_KEY = 'joca:project-sort';

const PROJECT_SORT_OPTIONS: { value: ProjectSort; label: string }[] = [
  { value: 'manual', label: 'Manual (drag)' },
  { value: 'name-asc', label: 'Name A→Z' },
  { value: 'name-desc', label: 'Name Z→A' },
  { value: 'recent', label: 'Most recent' },
  { value: 'oldest', label: 'Oldest' },
];

const PROJECT_SORT_HINT =
  'Sidebar sorting: projects AND quick agents. "Most recent"/"Oldest" use the position in the list as '
  + 'an approximation of the date (projects do not store a creation date — the last one added ends up at the end). '
  + 'Only "Manual (drag)" allows reordering by drag; the others are just a view, until you press "Pin order".';

function readProjectSort(): ProjectSort {
  try {
    const raw = localStorage.getItem(PROJECT_SORT_KEY);
    return PROJECT_SORT_OPTIONS.some((o) => o.value === raw) ? (raw as ProjectSort) : 'manual';
  } catch { return 'manual'; }
}

/**
 * Generic over `{ name }` because the same selector sorts TWO lists: the projects and the quick
 * agents. They were two different criteria in the same bar — changing the sort did not touch the agents.
 */
function sortProjects<T extends { name: string }>(list: T[], sort: ProjectSort): T[] {
  // 'manual' and 'oldest' are the order exactly as it comes from the server (oldest first).
  if (sort === 'manual' || sort === 'oldest') return list;
  const out = [...list];
  if (sort === 'recent') return out.reverse();
  const dir = sort === 'name-desc' ? -1 : 1;
  return out.sort((a, b) => dir * a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }));
}

// ── Project search ─────────────────────────────────────────────────
// A single box filters the THREE lists in the bar: active projects, sections and archived. The
// archive grows without limit (it is where closed projects go) and without search the only way to
// get there was opening the drawer and scanning the list by eye.

/** No accents and lowercase: "sao" has to find "São", "bracaris" has to find "Bracaris".
 *  `\p{Diacritic}` instead of a range of combining marks written raw — those are invisible in the
 *  file and the first editor that re-normalizes it breaks the filter silently. */
function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function matchesQuery(name: string, query: string): boolean {
  return normalizeSearch(name).includes(query);
}

// ── Project row ────────────────────────────────────────────────────
// A project is a rail item (server-list style) — color dot, name, "working" badge, actions revealed
// on hover. The project's sessions no longer show up here: they live in the ProjectWorkspace's
// Workers channel, which is where `onDashboard` leads. Besides grouping and archiving, the row
// removes the project — it was taken out of here once for being redundant with the Overview's
// "Danger zone", and came back on request: getting there meant opening the edit modal.
// The difference is that it now does NOT delete on one click — it raises an alertdialog that says
// what is lost.
//
// Dropping ANOTHER project's color dot onto this one groups the two (onGroupDrop) — distinct from
// dropping on the rest of the row, which reorders (onDrop). The dot intercepts the event itself
// (stopPropagation) so the two actions never fire at the same time.

function ProjectRow({
  project, sessions, onDashboard, onRenameProject,
  onArchive, onRemove, onUngroup, indented, isDragOver, dragEnabled, onDragStart, onDragEnter, onDragEnd, onDrop, onMoveUp, onMoveDown,
  dotDragOver, onDotDragEnter, onDotDragLeave, onGroupDrop, groupCandidates, onGroupWith,
}: {
  project: Project;
  sessions: SessionInfo[];
  onDashboard: () => void;
  onRenameProject?: (id: string, name: string) => void;
  onArchive?: () => void;
  onRemove?: () => void;
  onUngroup?: () => void;
  indented?: boolean;
  isDragOver?: boolean;
  dragEnabled?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  dotDragOver?: boolean;
  onDotDragEnter?: () => void;
  onDotDragLeave?: () => void;
  onGroupDrop?: () => void;
  /** Keyboard alternative to dragging-the-dot (WCAG 2.1.1 — native drag is not operable by
   *  keyboard/touch). Other active projects, to choose which one to group this with. */
  groupCandidates?: { id: string; name: string; groupName?: string }[];
  onGroupWith?: (targetId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const [grouping, setGrouping] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const groupSelectRef = useRef<HTMLSelectElement>(null);
  const workingCount = sessions.filter(s => s.status === 'working').length;

  useEffect(() => {
    if (grouping) groupSelectRef.current?.focus();
  }, [grouping]);

  useEffect(() => {
    if (editing) {
      setDraft(project.name);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, project.name]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== project.name && onRenameProject) onRenameProject(project.id, t);
    setEditing(false);
  };

  return (
    <div
      className={[
        'project-group',
        indented ? 'project-group--indented' : '',
        isDragOver ? 'project-group--dragover' : '',
        dragging ? 'project-group--dragging' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--project-color': projectColor(project) } as CSSProperties}
      onDragOver={dragEnabled ? (e) => { e.preventDefault(); onDragEnter?.(); } : undefined}
      onDrop={dragEnabled ? (e) => { e.preventDefault(); onDrop?.(); } : undefined}
    >
      <div className="project-group-header">
        {dragEnabled && (
          <span
            className="project-group-grip"
            draggable
            role="button"
            tabIndex={0}
            onDragStart={(e) => { e.stopPropagation(); setDragging(true); e.dataTransfer.effectAllowed = 'move'; onDragStart?.(); }}
            onDragEnd={(e) => { e.stopPropagation(); setDragging(false); onDragEnd?.(); }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); onMoveUp?.(); }
              else if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); onMoveDown?.(); }
            }}
            title="Drag or use ↑/↓ to reorder"
            aria-label={`Reorder ${project.name} — up/down arrows`}
          >
            <LucideIcon name="grip" />
          </span>
        )}
        {editing ? (
          <>
            <ProjectAvatar icon={project.icon} name={project.name} id={project.id} />
            <span
              className="project-group-color"
              style={{ '--project-color': projectColor(project) } as CSSProperties}
              aria-hidden
            />
            <input
              ref={inputRef}
              className="session-item-name-input"
              style={{ fontSize: '11px', height: '20px', padding: '0 4px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-bright)', borderRadius: '4px', width: '120px' }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') { setDraft(project.name); setEditing(false); }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </>
        ) : (
          <button
            type="button"
            className="project-group-label"
            onClick={onDashboard}
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title={`${project.name} — open workspace (double-click to rename)`}
            aria-label={`Open ${project.name}'s workspace`}
          >
            <ProjectAvatar icon={project.icon} name={project.name} id={project.id} />
            <span
              className={`project-group-color${dotDragOver ? ' project-group-color--dragover' : ''}`}
              style={{ '--project-color': projectColor(project) } as CSSProperties}
              aria-hidden
              onDragOver={onGroupDrop ? (e) => { e.preventDefault(); e.stopPropagation(); onDotDragEnter?.(); } : undefined}
              onDragLeave={onGroupDrop ? (e) => { e.stopPropagation(); onDotDragLeave?.(); } : undefined}
              onDrop={onGroupDrop ? (e) => { e.preventDefault(); e.stopPropagation(); onGroupDrop(); } : undefined}
            />
            <span className="project-group-name">{project.name}</span>
          </button>
        )}
        {workingCount > 0 && <span className="project-group-badge">{workingCount}</span>}
        <div className="project-group-actions">
          {groupCandidates && groupCandidates.length > 0 && onGroupWith && (
            <button className="project-group-action" type="button" aria-label={`Group ${project.name} with another project`} onClick={(e) => { e.stopPropagation(); setGrouping(true); }} data-tooltip="Group with…" data-tooltip-position="bottom"><LucideIcon name="link" /></button>
          )}
          {onUngroup && <button className="project-group-action" type="button" aria-label={`Remove ${project.name} from the group`} onClick={(e) => { e.stopPropagation(); onUngroup(); }} data-tooltip="Remove from the group" data-tooltip-position="bottom"><LucideIcon name="x" /></button>}
          {onArchive && <button className="project-group-action" type="button" aria-label={`Archive project ${project.name}`} onClick={(e) => { e.stopPropagation(); onArchive(); }} data-tooltip="Archive project" data-tooltip-position="bottom"><LucideIcon name="archive" /></button>}
          {onRemove && <button className="project-group-action project-group-action--remove" type="button" aria-label={`Remove project ${project.name}`} onClick={(e) => { e.stopPropagation(); setConfirmRemove(true); }} data-tooltip="Remove project" data-tooltip-position="bottom"><LucideIcon name="trash" /></button>}
        </div>
      </div>
      {grouping && groupCandidates && onGroupWith && (
        <div className="project-group-picker" onClick={(e) => e.stopPropagation()}>
          <select
            ref={groupSelectRef}
            aria-label={`Group ${project.name} with…`}
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              setGrouping(false);
              if (id) onGroupWith(id);
            }}
            onBlur={() => setGrouping(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setGrouping(false); } }}
          >
            <option value="" disabled>Group with…</option>
            {groupCandidates.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.groupName ? ` (group: ${c.groupName})` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {confirmRemove && onRemove && (
        <ConfirmDialog
          title={`Remove "${project.name}"?`}
          confirmLabel="Remove project"
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => { setConfirmRemove(false); onRemove(); }}
        >
          You are going to delete <strong>{project.name}</strong> from JOCA: the sidebar entry, the
          conversation and this project's open terminals, which are closed first.
          <span className="confirm-note">
            The files in <strong>{shortPath(project.path)}</strong> are not touched. To take it out
            of sight without deleting anything, archive it.
          </span>
        </ConfirmDialog>
      )}
    </div>
  );
}

// ── Project folder (group) ──────────────────────────────────────────
// Collapsible row representing a group of projects (purely visual grouping — dropping one project's
// dot onto another's creates/joins this one). Expanded, it shows the member projects indented
// below, each one as a normal ProjectRow.

/**
 * Row of a quick agent (a session without a project). Double-clicking the name enters editing — the
 * same gesture that renames a project in the row above, so there are not two vocabularies in the
 * same bar. With the sidebar collapsed there is no name in sight, so there is no rename either:
 * only the square is left.
 */
function LooseAgentRow({
  session, collapsed, onOpen, onRename, onClose,
}: {
  session: SessionInfo;
  collapsed: boolean;
  onOpen: () => void;
  onRename?: (name: string) => void;
  onClose?: () => void;
}) {
  const brand = useBrand();
  // Each session picks up its own GIF from the pool, by id — stable for as long as the session lives.
  const poolGif = usePoolGif(session.id, brand.id === 'office');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) { setDraft(session.name); inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing, session.name]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== session.name && onRename) onRename(t);
    setEditing(false);
  };

  if (editing && !collapsed) {
    return (
      <div className="sidebar-loose-item is-editing">
        <span className="sidebar-loose-icon">{poolGif ? <OfficeGif src={poolGif} className="office-gif-icon office-gif-icon--avatar" /> : <LucideIcon name="terminal-quick" />}</span>
        <input
          ref={inputRef}
          className="sidebar-loose-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { setDraft(session.name); setEditing(false); }
            e.stopPropagation();
          }}
          aria-label={`Name of agent ${session.name}`}
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`sidebar-loose-item${session.status === 'working' ? ' is-working' : ''}`}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      onDoubleClick={onRename && !collapsed ? (e) => { e.stopPropagation(); setEditing(true); } : undefined}
      title={onRename && !collapsed
        ? `${session.name} — agent without a project (double-click to rename)`
        : `${session.name} — agent without a project`}
      aria-label={`Open agent ${session.name}`}
    >
      <span className="sidebar-loose-icon">{poolGif ? <OfficeGif src={poolGif} className="office-gif-icon office-gif-icon--avatar" /> : <LucideIcon name="terminal-quick" />}</span>
      <span className="sidebar-loose-name">{session.name}</span>
      {onClose && !collapsed && (
        <button
          type="button"
          className="sidebar-loose-close"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label={`Close agent ${session.name}`}
          data-tooltip="Close agent"
          data-tooltip-position="bottom"
        >
          <LucideIcon name="x" />
        </button>
      )}
      <span className="sidebar-loose-dot" data-on={session.status === 'working'} aria-hidden />
    </div>
  );
}

function ProjectFolder({
  group, members, sessions, expanded, collapsed, onToggle, onRenameGroup, onSetIcon, onOpenMember, renderMember,
  dotDragOver, onDotDragEnter, onDotDragLeave, onGroupDrop,
}: {
  group: ProjectGroupData;
  members: Project[];
  sessions: SessionInfo[];
  expanded: boolean;
  /** Sidebar collapsed — the row becomes a square and the click opens the flyout instead of collapsing. */
  collapsed: boolean;
  onToggle: () => void;
  onRenameGroup?: (name: string) => void;
  onSetIcon?: (icon: ProjectIcon | null) => void;
  /** Open a project of the group from the flyout. */
  onOpenMember: (project: Project) => void;
  /** The same wiring (drag/group/archive/…) as a loose ProjectRow — built by the caller
   *  (SessionSidebar) so it never diverges between a loose row and a nested row. */
  renderMember: (project: Project) => ReactNode;
  dotDragOver?: boolean;
  onDotDragEnter?: () => void;
  onDotDragLeave?: () => void;
  onGroupDrop?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.name);
  const [iconPanel, setIconPanel] = useState(false);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLButtonElement>(null);
  // Its own ref, not `document.querySelector('.group-flyout')`: with two groups in the bar the
  // class selector would always catch the first panel and Tab would get trapped in the wrong flyout.
  const flyoutRef = useRef<HTMLDivElement>(null);
  const workingCount = members.reduce(
    (n, p) => n + sessions.filter((s) => s.projectId === p.id && s.status === 'working').length,
    0,
  );

  useEffect(() => {
    if (editing) { setDraft(group.name); inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing, group.name]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== group.name && onRenameGroup) onRenameGroup(t);
    setEditing(false);
  };

  const closeFlyout = useCallback(() => {
    setFlyoutOpen(false);
    labelRef.current?.focus();
  }, []);

  // Expanding the sidebar leaves the flyout with nowhere to go (the group list becomes inline).
  useEffect(() => { if (!collapsed) setFlyoutOpen(false); }, [collapsed]);

  useEffect(() => {
    if (!flyoutOpen) return;
    flyoutRef.current?.querySelector<HTMLElement>('.group-flyout-item')?.focus();
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (flyoutRef.current?.contains(target) || labelRef.current?.contains(target)) return;
      // A click outside only closes — returning focus here would steal it from whatever the user just clicked.
      setFlyoutOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [flyoutOpen]);

  const onFlyoutKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFlyout(); return; }
    if (e.key !== 'Tab' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const items = Array.from(flyoutRef.current?.querySelectorAll<HTMLElement>('.group-flyout-item') ?? []);
    if (items.length === 0) return;
    e.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const back = e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey);
    let next: number;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else if (back) next = current <= 0 ? items.length - 1 : current - 1;
    else next = current < 0 || current === items.length - 1 ? 0 : current + 1;
    items[next].focus();
  };

  return (
    <div className={`project-folder${flyoutOpen ? ' project-folder--flyout-open' : ''}`}>
      <div className="project-group-header project-folder-header">
        <button
          type="button"
          className="project-group-grip project-folder-chevron"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} group ${group.name}`}
        >
          <LucideIcon name={expanded ? 'chevron-down' : 'chevron-right'} />
        </button>
        {editing ? (
          <>
            <ProjectAvatar icon={group.icon} name={group.name} id={group.id} />
            <span
              className="project-group-color"
              style={{ '--project-color': projectColor(group) } as CSSProperties}
              aria-hidden
            />
            <input
              ref={inputRef}
              className="session-item-name-input"
              style={{ fontSize: '11px', height: '20px', padding: '0 4px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-bright)', borderRadius: '4px', width: '120px' }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') { setDraft(group.name); setEditing(false); }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </>
        ) : (
          <button
            ref={labelRef}
            type="button"
            className="project-group-label"
            // Collapsed, the member list does not fit inline — the click (and Enter/Space, which in
            // a <button> fire the same onClick) opens the flyout instead of collapsing/expanding.
            onClick={collapsed ? () => setFlyoutOpen((v) => !v) : onToggle}
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title={collapsed
              ? `${group.name} — ${members.length} projects (open list)`
              : `${group.name} — ${members.length} projects (double-click to rename)`}
            aria-label={collapsed
              ? `Group ${group.name}, ${members.length} projects — open list`
              : `Group ${group.name}, ${members.length} projects`}
            aria-haspopup={collapsed ? 'menu' : undefined}
            aria-expanded={collapsed ? flyoutOpen : expanded}
          >
            <ProjectAvatar icon={group.icon} name={group.name} id={group.id} />
            <span
              className={`project-group-color${dotDragOver ? ' project-group-color--dragover' : ''}`}
              style={{ '--project-color': projectColor(group) } as CSSProperties}
              aria-hidden
              onDragOver={onGroupDrop ? (e) => { e.preventDefault(); e.stopPropagation(); onDotDragEnter?.(); } : undefined}
              onDragLeave={onGroupDrop ? (e) => { e.stopPropagation(); onDotDragLeave?.(); } : undefined}
              onDrop={onGroupDrop ? (e) => { e.preventDefault(); e.stopPropagation(); onGroupDrop(); } : undefined}
            />
            <span className="project-group-name">{group.name}</span>
            <span className="project-folder-count">{members.length}</span>
          </button>
        )}
        {workingCount > 0 && <span className="project-group-badge">{workingCount}</span>}
        {onSetIcon && (
          <div className="project-group-actions">
            <button
              className="project-group-action"
              type="button"
              aria-label={`Icon of group ${group.name}`}
              aria-expanded={iconPanel}
              onClick={(e) => { e.stopPropagation(); setIconPanel((v) => !v); }}
              data-tooltip="Group icon"
              data-tooltip-position="bottom"
            >
              <LucideIcon name="sparkles" />
            </button>
          </div>
        )}
      </div>
      {/* Its own panel instead of stuffing it into rename mode: the name input saves on `onBlur`,
          and touching the icon buttons closed the edit from under the user's feet. */}
      {iconPanel && onSetIcon && (
        <div className="project-folder-icon-panel">
          <ProjectIconField
            icon={group.icon}
            name={group.name}
            label={`group ${group.name}`}
            onChange={onSetIcon}
          />
        </div>
      )}
      {expanded && !collapsed && (
        <div className="project-folder-members">
          {members.map((project) => renderMember(project))}
        </div>
      )}
      {/* Collapsed, the members come out IN FLOW below the group's square — a column of the
          projects' dots, in the same language as the rest of the collapsed bar.
          ⚠ Do not use `position:absolute` here: `.session-sidebar-list` has `overflow-y:auto` +
          `overflow-x:hidden` (it needs them for the scroll), and any panel that went out to the
          side was CUT by the ancestor's overflow — that is what broke the previous version. */}
      {collapsed && flyoutOpen && (
        <div
          ref={flyoutRef}
          className="group-collapsed-list"
          role="menu"
          aria-label={`Projects of group ${group.name}`}
          onKeyDown={onFlyoutKeyDown}
        >
          {members.map((project) => (
            <button
              key={project.id}
              type="button"
              role="menuitem"
              className="group-flyout-item"
              style={{ '--project-color': projectColor(project) } as CSSProperties}
              onClick={() => { setFlyoutOpen(false); onOpenMember(project); }}
              title={project.name}
              aria-label={`Open ${project.name}`}
            >
              <ProjectAvatar icon={project.icon} name={project.name} id={project.id} />
            </button>
          ))}
          {members.length === 0 && <span className="group-collapsed-empty" title="Group with no projects" aria-hidden>—</span>}
        </div>
      )}
    </div>
  );
}



// ── Main sidebar ───────────────────────────────────────────────────

export default function SessionSidebar({
  envLabel, sessions, projects, projectGroups, mainView, collapsed, onToggleCollapsed, onShowDashboard, onShowAgents, onShowProject,
  onOpenSession, onRenameSession, onClose, onNew, onCreateProject, onOpenSettings, onInput: _onInput, onRenameProject,
  onArchiveProject, onReorderProjects, onGroupProjects, onUngroupProject, onRemoveProject, onRenameGroup, onSetGroupIcon, onToggleGroupCollapsed,
}: Props) {
  const brand = useBrand();
  const [confirmCloseIdle, setConfirmCloseIdle] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dotOverId, setDotOverId] = useState<string | null>(null);
  const [projectSort, setProjectSort] = useState<ProjectSort>(readProjectSort);
  const [search, setSearch] = useState('');
  // Only the mobile strip reads this: there the search box lives behind the magnifier, because the
  // 26px+gap it always took up were 26px+gap the project list did not have. On desktop the box is
  // always visible (no rule hides it) and this state is never consulted.
  const [searchOpen, setSearchOpen] = useState(false);
  const sortRowRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const query = normalizeSearch(search);
  const searching = query.length > 0;

  // On the mobile strip (38dvh, already near the limit before this) opening the bar pushes the
  // whole project list out of the fold, with no hint at all that there is more below — it brings the
  // bar into view as soon as it opens.
  useEffect(() => {
    if (sortMenuOpen) sortRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [sortMenuOpen]);

  // Opening the magnifier puts the cursor where you are going to type; closing it CLEARS the
  // filter. Closing without clearing left an active search with nothing on screen saying so — the
  // list showed up truncated and there was no box in sight to work out why.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const idleSessions = sessions.filter(s => s.status === 'idle');
  // "Quick" agents: sessions without a project. They follow the SAME sorting chosen in the
  // projects' selector — it is one selector for the whole bar, and having two lists with different
  // criteria was what made it look like the sorting did not take here.
  // Exception in "Manual": a session has no dragged order to respect, so the criterion that already
  // existed is kept — working first, which is what you go there to see.
  const soltas = sessions.filter(s => !s.projectId && (!searching || matchesQuery(s.name, query)));
  const looseSessions = projectSort === 'manual'
    ? [...soltas].sort((a, b) => Number(b.status === 'working') - Number(a.status === 'working'))
    : sortProjects(soltas, projectSort);

  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);

  // The search is a VIEW over the three lists — it does not touch server state. A project comes in
  // if its name matches, or if the name of the SECTION it is in matches: typing "clients" has to
  // bring the whole section, otherwise the section showed up empty and looked like a bug.
  const groupMatches = (groupId?: string) =>
    !!groupId && matchesQuery(projectGroups.find(g => g.id === groupId)?.name ?? '', query);
  const projectMatches = (p: Project) =>
    !searching || matchesQuery(p.name, query) || groupMatches(p.groupId);

  const visibleActive = activeProjects.filter(projectMatches);
  const visibleArchived = archivedProjects.filter(projectMatches);

  const sortedProjects = sortProjects(visibleActive, projectSort);
  const sortedArchivedProjects = sortProjects(visibleArchived, projectSort);

  // Top-level items of the list: loose projects as they are, and a single item per group (at the
  // position of its first member in the current sorting) — the grouping is only visual, it does not
  // change `order`.
  type SidebarItem =
    | { kind: 'project'; project: Project }
    | { kind: 'group'; group: ProjectGroupData; members: Project[] };
  const emittedGroups = new Set<string>();
  const sidebarItems: SidebarItem[] = [];
  for (const project of sortedProjects) {
    if (project.groupId) {
      if (emittedGroups.has(project.groupId)) continue;
      const group = projectGroups.find(g => g.id === project.groupId);
      if (!group) { sidebarItems.push({ kind: 'project', project }); continue; }
      emittedGroups.add(project.groupId);
      sidebarItems.push({
        kind: 'group',
        group,
        members: sortedProjects.filter(p => p.groupId === project.groupId),
      });
    } else {
      sidebarItems.push({ kind: 'project', project });
    }
  }

  // Sorting by name has to hold for the SECTIONS too. The loop above emits each group at the
  // position of its first member, so a section "Zulu" whose first project was "Acura" landed at the
  // top of the A→Z — the list looked unsorted with no way to see why. It only applies to the
  // name sorts: in "Most recent"/"Oldest" the position in the list IS the criterion.
  if (projectSort === 'name-asc' || projectSort === 'name-desc') {
    const dir = projectSort === 'name-desc' ? -1 : 1;
    const itemName = (i: SidebarItem) => i.kind === 'group' ? i.group.name : i.project.name;
    sidebarItems.sort((a, b) => dir * itemName(a).localeCompare(itemName(b), 'pt', { sensitivity: 'base' }));
  }

  const handleGroupDrop = (targetId: string) => {
    if (dragId && onGroupProjects) onGroupProjects(dragId, targetId);
    setDragId(null);
    setOverId(null);
    setDotOverId(null);
  };

  // Dragging only makes sense in the manual view — in another sorting the dropped position would be
  // discarded. And never with the search active: the visible list is a subset, but `commitReorder`
  // indexes the FULL list — dropping between two filtered results would save an order nobody asked for.
  const dragEnabled = !!onReorderProjects && activeProjects.length > 1 && projectSort === 'manual' && !searching;
  const canPinOrder = !!onReorderProjects && activeProjects.length > 1 && projectSort !== 'manual' && !searching;
  const canSort = activeProjects.length > 1 || archivedProjects.length > 1;

  const changeProjectSort = (value: ProjectSort) => {
    setProjectSort(value);
    try { localStorage.setItem(PROJECT_SORT_KEY, value); } catch { /* ignore */ }
  };

  // "Pin order": saves the currently visible order and goes back to manual mode.
  // It derives from the FULL list of active ones, not from `sortedProjects` (which the search
  // filters) — otherwise pinning with a filter typed would save the order of the results only and
  // lose the rest.
  const pinCurrentOrder = () => {
    if (!onReorderProjects) return;
    onReorderProjects(sortProjects(activeProjects, projectSort).map(p => p.id));
    changeProjectSort('manual');
  };

  const commitReorder = (targetId: string) => {
    if (!dragId || dragId === targetId || !onReorderProjects) { setDragId(null); setOverId(null); return; }
    const ids = activeProjects.map(p => p.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return; }
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorderProjects(ids);
    setDragId(null);
    setOverId(null);
  };

  // Keyboard reorder (↑/↓ on the grip): swap with the adjacent project.
  const moveProject = (id: string, dir: 'up' | 'down') => {
    if (!onReorderProjects) return;
    const ids = activeProjects.map(p => p.id);
    const i = ids.indexOf(id);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onReorderProjects(ids);
  };

  const closeIdleSessions = () => {
    idleSessions.forEach(s => onClose(s.id));
    setConfirmCloseIdle(false);
  };

  // Props shared by a ProjectRow, whether it is loose in the list or nested inside a ProjectFolder
  // — extracted so there are not 2 places wiring drag/grouping in divergent ways (bug caught while
  // testing: the nested rows had no "drop on the dot" handler at all).
  const projectRowProps = (project: Project) => ({
    project,
    sessions: sessions.filter(s => s.projectId === project.id),
    onDashboard: () => onShowProject(project.id),
    onRenameProject,
    onArchive: onArchiveProject ? () => onArchiveProject(project.id, true) : undefined,
    onRemove: onRemoveProject ? () => onRemoveProject(project.id) : undefined,
    onUngroup: project.groupId && onUngroupProject ? () => onUngroupProject(project.id) : undefined,
    dragEnabled,
    isDragOver: overId === project.id && dragId !== project.id,
    onDragStart: () => setDragId(project.id),
    onDragEnter: () => setOverId(project.id),
    onDragEnd: () => { setDragId(null); setOverId(null); },
    onDrop: () => commitReorder(project.id),
    onMoveUp: () => moveProject(project.id, 'up'),
    onMoveDown: () => moveProject(project.id, 'down'),
    dotDragOver: dotOverId === project.id,
    onDotDragEnter: () => setDotOverId(project.id),
    onDotDragLeave: () => setDotOverId((v: string | null) => v === project.id ? null : v),
    onGroupDrop: onGroupProjects ? () => handleGroupDrop(project.id) : undefined,
    // Keyboard alternative to dragging-the-dot (native drag is not operable by keyboard/touch).
    groupCandidates: onGroupProjects
      ? activeProjects.filter((p) => p.id !== project.id).map((p) => ({
        id: p.id,
        name: p.name,
        groupName: p.groupId ? projectGroups.find((g) => g.id === p.groupId)?.name : undefined,
      }))
      : undefined,
    onGroupWith: onGroupProjects ? (targetId: string) => onGroupProjects(project.id, targetId) : undefined,
  });

  // `--filtering` only serves the mobile strip: with the search typed OR the sort menu open, the
  // strip's 38dvh are entirely consumed by the header and not a single list row is left
  // (measured at 390×844: 28px of list visible with the menu closed, 0px with it open). The strip
  // grows for as long as the gesture lasts and goes back to 38dvh as soon as it is cleared.
  return (
    <aside
      className={`session-sidebar ${collapsed ? 'session-sidebar--collapsed' : ''}${(searching || sortMenuOpen || searchOpen) ? ' session-sidebar--filtering' : ''}${(searchOpen || searching) ? ' session-sidebar--search-open' : ''}`}
      aria-label="Projects"
    >
      <div className="sidebar-main-bento">
        <div className="sb-header">
          <div className="sb-brand">
            {brand.logo
              ? <img className="sb-logo-img" src={brand.logo} alt="" aria-hidden />
              : <div className="sb-logo-rings" aria-hidden />}
            <span className="sb-logo-text">{brand.wordmark} <span style={{opacity:0.45,fontWeight:500,fontSize:'0.75em',letterSpacing:'0.05em'}}>{envLabel || VERSAO}</span></span>
          </div>
          <button
            className="sidebar-collapse-btn"
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            onClick={onToggleCollapsed}
            data-tooltip={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            data-tooltip-position="bottom"
          >
            <span className="sidebar-collapse-glyph">
              <LucideIcon name={collapsed ? 'chevrons-right' : 'chevrons-left'} />
            </span>
          </button>
        </div>

        <div className="nav-menu">
          <button
            className={`nav-btn ${mainView === 'dashboard' ? 'active' : ''}`}
            type="button"
            onClick={onShowDashboard}
            aria-label="Dashboard"
            aria-current={mainView === 'dashboard' ? 'page' : undefined}
          >
            <span className="nav-icon"><LucideIcon name="layout-dashboard" /></span>
            <span>Dashboard</span>
          </button>
          <button
            className={`nav-btn ${mainView === 'agents' ? 'active' : ''}`}
            type="button"
            onClick={onShowAgents}
            aria-label="Agents"
            aria-current={mainView === 'agents' ? 'page' : undefined}
          >
            <span className="nav-icon"><LucideIcon name="terminal" /></span>
            <span>Agents</span>
          </button>
        </div>

        <div className="session-sidebar-header">
          <span className="sidebar-title">Projects</span>
          <div className="sidebar-header-actions">
            {/* Search trigger — it only exists on the mobile strip (`display:none` outside the
                breakpoint): there the box is collapsed by default, up here it stays always open. */}
            {projects.length > 0 && (
              <button
                className={`sidebar-search-toggle${(searchOpen || searching) ? ' is-active' : ''}`}
                type="button"
                onClick={() => setSearchOpen((v) => { if (v) setSearch(''); return !v; })}
                aria-label={(searchOpen || searching) ? 'Close project search' : 'Search projects'}
                aria-expanded={searchOpen || searching}
                aria-controls="sidebar-search-row"
              ><LucideIcon name={(searchOpen || searching) ? 'x' : 'search'} /></button>
            )}
            {canSort && (
              <button
                className={`sidebar-btn-sort${sortMenuOpen ? ' is-active' : ''}`}
                type="button"
                onClick={() => setSortMenuOpen((v) => !v)}
                data-tooltip="Sort projects and quick agents"
                data-tooltip-position="bottom"
                aria-label="Sort projects and quick agents"
                aria-expanded={sortMenuOpen}
                aria-controls="sidebar-sort-row"
              ><LucideIcon name="arrow-up-down" /></button>
            )}
          </div>
        </div>

        {projects.length > 0 && (
          <div className="sidebar-search-row" id="sidebar-search-row">
            <span className="sidebar-search-icon" aria-hidden><LucideIcon name="search" /></span>
            <input
              ref={searchInputRef}
              className="sidebar-search-input"
              type="search"
              value={search}
              placeholder="Search projects…"
              aria-label="Search projects, sections and archived"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setSearch(''); setSearchOpen(false); } }}
            />
            {searching && (
              <button
                className="sidebar-search-clear"
                type="button"
                onClick={() => { setSearch(''); searchInputRef.current?.focus(); }}
                aria-label="Clear search"
                data-tooltip="Clear (Esc)"
                data-tooltip-position="bottom"
              ><LucideIcon name="x" /></button>
            )}
          </div>
        )}

        {sortMenuOpen && canSort && (
          <div className="sidebar-sort-row" id="sidebar-sort-row" ref={sortRowRef}>
            <select
              className="sidebar-sort-select"
              value={projectSort}
              onChange={(e) => changeProjectSort(e.target.value as ProjectSort)}
              title={PROJECT_SORT_HINT}
              aria-label="Sort projects"
            >
              {PROJECT_SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {canPinOrder && (
              <button
                className="sidebar-sort-pin"
                type="button"
                onClick={pinCurrentOrder}
                data-tooltip="Save this order as the manual order"
                data-tooltip-position="bottom"
              >
                Pin
              </button>
            )}
          </div>
        )}

        <div className="session-sidebar-list">
          {/* Agents without a project, at the head of the list. Before, you only got there through
              the global Agents view and by searching — a quick agent loses its point if it costs two steps. */}
          {looseSessions.length > 0 && (
            <div className="sidebar-loose" aria-label="Quick agents">
              <div className="sidebar-loose-title">Quick</div>
              {looseSessions.map((s) => (
                <LooseAgentRow
                  key={s.id}
                  session={s}
                  collapsed={collapsed}
                  onOpen={() => onOpenSession(s.id)}
                  onRename={onRenameSession ? (name) => onRenameSession(s.id, name) : undefined}
                  onClose={() => onClose(s.id)}
                />
              ))}
            </div>
          )}

          {sidebarItems.map((item) => item.kind === 'project' ? (
            <ProjectRow key={item.project.id} {...projectRowProps(item.project)} />
          ) : (
            <ProjectFolder
              key={item.group.id}
              group={item.group}
              members={item.members}
              sessions={sessions}
              expanded={searching || !item.group.collapsed}
              collapsed={collapsed}
              onToggle={() => onToggleGroupCollapsed?.(item.group.id, !item.group.collapsed)}
              onRenameGroup={onRenameGroup ? (name) => onRenameGroup(item.group.id, name) : undefined}
              onSetIcon={onSetGroupIcon ? (icon) => onSetGroupIcon(item.group.id, icon) : undefined}
              onOpenMember={(p) => onShowProject(p.id)}
              renderMember={(p) => <ProjectRow key={p.id} indented {...projectRowProps(p)} />}
              dotDragOver={dotOverId === item.group.id}
              onDotDragEnter={() => setDotOverId(item.group.id)}
              onDotDragLeave={() => setDotOverId((v) => v === item.group.id ? null : v)}
              onGroupDrop={onGroupProjects ? () => handleGroupDrop(item.members[0]?.id ?? '') : undefined}
            />
          ))}

          {projects.length > 0 && !searching && (
            <button type="button" className="sidebar-add-project-row" onClick={onCreateProject}>
              <LucideIcon name="folder-plus" /> New project
            </button>
          )}

          {/* The search opens the archive drawer by itself: the reason the box exists is to find
              archived projects, and forcing a second click to see the results cancelled that out. */}
          {sortedArchivedProjects.length > 0 && (
            <div className="sidebar-archived">
              <button
                className="sidebar-archived-toggle"
                type="button"
                onClick={() => setShowArchived(v => !v)}
                aria-expanded={searching || showArchived}
              >
                <span className="sidebar-archived-icon"><LucideIcon name="archive" /></span>
                <span className="sidebar-archived-label">Archived</span>
                <span className="sidebar-archived-count">
                  {searching ? `${sortedArchivedProjects.length}/${archivedProjects.length}` : archivedProjects.length}
                </span>
                <span className="sidebar-archived-chevron"><LucideIcon name={(searching || showArchived) ? 'chevron-down' : 'chevron-right'} /></span>
              </button>
              {(searching || showArchived) && (
                <div className="sidebar-archived-list">
                  {sortedArchivedProjects.map(project => (
                    <div key={project.id} className="archived-item" style={{ '--project-color': projectColor(project) } as CSSProperties}>
                      <span className="archived-item-color" aria-hidden />
                      <button
                        className="archived-item-name"
                        type="button"
                        onClick={() => onShowProject(project.id)}
                        title={`Open ${project.name}'s dashboard`}
                      >
                        {project.name}
                      </button>
                      {onArchiveProject && (
                        <button
                          className="archived-item-restore"
                          type="button"
                          onClick={() => onArchiveProject(project.id, false)}
                          data-tooltip="Restore to the sidebar"
                          data-tooltip-position="bottom"
                          aria-label={`Restore project ${project.name}`}
                        >
                          <LucideIcon name="archive-restore" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {searching && sortedProjects.length === 0 && sortedArchivedProjects.length === 0 && looseSessions.length === 0 && (
            <div className="sidebar-search-empty">
              <span>Nothing found for “{search.trim()}”</span>
              <button type="button" onClick={() => { setSearch(''); searchInputRef.current?.focus(); }}>Clear search</button>
            </div>
          )}

          {projects.length === 0 && (
            <div className="sidebar-empty">
              <div className="sidebar-empty-icon"><LucideIcon name="info" /></div>
              <p>No projects</p>
              <button className="sidebar-btn-new-large" onClick={onCreateProject}>+ Create project</button>
            </div>
          )}
        </div>

        {/* The bar's footer. The wrapper is `display:contents` on desktop — the three buttons stay
            flex children of the bento, exactly as before — and becomes a ROW on the mobile strip,
            where three stacked blocks cost 103px+gaps of height on a 320px strip. */}
        <div className="sidebar-footer-row">
        {/* The two buttons share a row — two stacked full-width blocks cost the project list height
            without gaining it in legibility. "Close idle" stays out of the pair: it has the longest
            label and is the rarest action. */}
        <div className="sidebar-footer-pair">
        <button
          type="button"
          className="sidebar-quick-session-btn"
          onClick={onNew}
          data-tooltip="Quick session — agent without a project"
          data-tooltip-position="top"
        >
          <LucideIcon name="terminal-quick" /> Quick session
        </button>

        {/* Settings: the icon at the bottom of the left column. It moved here when the right rail
            (notifications + settings) was removed — the app stopped having a right column. */}
        <button
          type="button"
          className="sidebar-settings-btn"
          onClick={onOpenSettings}
          data-tooltip="Settings"
          data-tooltip-position="top"
          aria-label="Settings"
        >
          <LucideIcon name="settings" /> <span className="sidebar-settings-label">Settings</span>
        </button>

        <div className="session-bulk-actions">
          {confirmCloseIdle ? (
            <div className="bulk-confirm-row">
              <span>Close {idleSessions.length} idle?</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="button" className="confirm-yes" onClick={closeIdleSessions}>Yes</button>
                <button type="button" className="confirm-no" onClick={() => setConfirmCloseIdle(false)}>No</button>
              </div>
            </div>
          ) : (
            <button
              className="bulk-select-btn"
              type="button"
              disabled={idleSessions.length === 0}
              onClick={() => setConfirmCloseIdle(true)}
              data-tooltip="Close all idle sessions"
              data-tooltip-position="bottom"
              aria-label={`Close ${idleSessions.length} idle sessions`}
            >
              {/* The full label hides in the footer's compact row (it becomes "✕ (2)"); the complete
                  name stays in the tooltip and the aria-label. Written out it did not fit: measured
                  at 77px wide, it came out cut in the middle of "IDLE", without even the ellipsis. */}
              <LucideIcon name="x" /> <span className="bulk-select-label">Close idle </span>({idleSessions.length})
            </button>
          )}
        </div>
        </div>
        </div>
      </div>

    </aside>
  );
}
