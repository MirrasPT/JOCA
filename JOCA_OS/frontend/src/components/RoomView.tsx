import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Project } from '../types';
import { iconInitials, projectIconUrl } from '../types';
import { projectColor } from '../lib/projectColor';
import { useBrand } from '../hooks/useBrand';
import './room-view.css';

interface RoomAuthor { kind: 'user' | 'joca' | 'manager'; projectId?: string; name: string }
interface RoomMessage { id: string; ts: number; author: RoomAuthor; text: string }

const LS_PROFILE = 'joca-room-profile';
// Genérico de propósito: este repo é público, e o nome de quem o corre não se hardcoda.
// Quem usa a sala põe o seu no mini-perfil do cabeçalho.
const DEFAULT_NAME = 'Eu';
const POLL_MS = 3000;
// Enquanto a discussão corre vale a pena olhar mais vezes — as intervenções chegam em rajada.
const POLL_MS_BUSY = 1500;

interface Profile { name: string; emoji: string }

function readProfile(): Profile {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_PROFILE) ?? '{}') as Partial<Profile>;
    return { name: raw.name?.trim() || DEFAULT_NAME, emoji: raw.emoji?.trim() || '' };
  } catch { return { name: DEFAULT_NAME, emoji: '' }; }
}

/** Bola do autor: gestor = ícone/cor do projecto · Joca = logo do tema · dono = emoji do perfil. */
function Avatar({ author, projects, brandLogo, profile }: {
  author: RoomAuthor; projects: Project[]; brandLogo?: string; profile: Profile;
}): ReactNode {
  if (author.kind === 'user') {
    return <span className="room-av room-av--user">{profile.emoji || profile.name.slice(0, 2).toUpperCase()}</span>;
  }
  if (author.kind === 'joca') {
    return brandLogo
      ? <span className="room-av room-av--img"><img src={brandLogo} alt="" /></span>
      : <span className="room-av room-av--joca">✦</span>;
  }
  const project = projects.find((p) => p.id === author.projectId);
  const style = { '--dot-color': project ? projectColor(project) : 'var(--accent)' } as CSSProperties;
  if (project?.icon?.type === 'image') {
    return <span className="room-av room-av--img" style={style}><img src={projectIconUrl(project.icon)} alt="" /></span>;
  }
  if (project?.icon?.type === 'emoji') {
    return <span className="room-av room-av--emoji" style={style}>{project.icon.value}</span>;
  }
  return <span className="room-av" style={style}>{iconInitials(author.name)}</span>;
}

/** Destaca `@etiqueta` no corpo — é assim que os gestores se chamam uns aos outros. */
function withMentions(text: string): ReactNode[] {
  return text.split(/(@[\p{L}\p{N}_-]+)/u).map((part, i) => (
    part.startsWith('@') && part.length > 1
      ? <span key={i} className="room-mention">{part}</span>
      : <span key={i}>{part}</span>
  ));
}

function sameAuthor(a: RoomAuthor, b: RoomAuthor): boolean {
  return a.kind === b.kind && a.projectId === b.projectId && a.name === b.name;
}

/** Filete na cor do projecto, só nas bolhas de gestor — é o que os distingue entre si de relance. */
function bubbleStyle(m: RoomMessage, projects: Project[]): CSSProperties | undefined {
  if (m.author.kind !== 'manager') return undefined;
  const project = projects.find((p) => p.id === m.author.projectId);
  if (!project) return undefined;
  return { '--dot-color': projectColor(project) } as CSSProperties;
}

// A Sala: o dono, o Joca e os gestores na mesma conversa. Bolhas — as minhas à direita, as deles
// à esquerda. As respostas chegam por poll: o POST devolve 202 e os turnos demoram.
export default function RoomView({ projects }: { projects: Project[] }) {
  const brand = useBrand();
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [targets, setTargets] = useState<string[]>(['joca']);
  const [profile, setProfile] = useState<Profile>(readProfile);
  const [editingProfile, setEditingProfile] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);
  const lastCount = useRef(0);

  const visibleProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);

  const refresh = useCallback(() => {
    fetch('/room/messages').then((r) => r.json()).then((data: { messages?: RoomMessage[]; busy?: boolean }) => {
      if (Array.isArray(data?.messages)) setMessages(data.messages);
      // A verdade sobre "ainda estão a discutir" vem do servidor. Adivinhá-la pela última mensagem
      // apagava o indicador na primeira resposta, a meio de um debate de várias voltas.
      setWaiting(Boolean(data?.busy));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const t = window.setInterval(() => { if (!document.hidden) refresh(); }, waiting ? POLL_MS_BUSY : POLL_MS);
    const onWake = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onWake);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', onWake); };
  }, [refresh, waiting]);

  // Auto-scroll só se já estava no fundo — a meio da leitura ninguém quer ser puxado.
  useEffect(() => {
    if (stickBottom.current) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    lastCount.current = messages.length;
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    stickBottom.current = true;
    if (targets.length > 0) setWaiting(true);
    fetch('/room/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, name: profile.name, targets }),
    }).then(() => refresh()).catch(() => setWaiting(false));
  };

  const toggleTarget = (id: string) =>
    setTargets((t) => t.includes(id) ? t.filter((x) => x !== id) : [...t, id]);

  const saveProfile = (name: string, emoji: string) => {
    const p: Profile = { name: name.trim() || 'Dono', emoji: emoji.trim().slice(0, 4) };
    setProfile(p);
    try { localStorage.setItem(LS_PROFILE, JSON.stringify(p)); } catch { /* ignore */ }
    setEditingProfile(false);
  };

  return (
    <div className="room-view">
      <header className="room-header">
        <div className="room-header-id">
          <h1 className="room-title">Sala</h1>
          <p className="room-sub">
            Tu, o {brand.managerName} e {visibleProjects.length} gestor{visibleProjects.length === 1 ? '' : 'es'} — todos na mesma conversa.
          </p>
        </div>
        <button
          className="room-me"
          type="button"
          onClick={() => setEditingProfile((v) => !v)}
          aria-expanded={editingProfile}
          data-tooltip="Editar o teu perfil"
          data-tooltip-position="bottom"
        >
          <span className="room-av room-av--user">{profile.emoji || profile.name.slice(0, 2).toUpperCase()}</span>
          <span>{profile.name}</span>
        </button>
      </header>

      {editingProfile && (
        <div className="room-profile">
          <label>
            <span>Como te chamas na sala</span>
            <input
              defaultValue={profile.name}
              maxLength={40}
              onKeyDown={(e) => { if (e.key === 'Escape') setEditingProfile(false); }}
              ref={(el) => el?.focus()}
              id="room-profile-name"
            />
          </label>
          <label>
            <span>Avatar (emoji)</span>
            <input defaultValue={profile.emoji} maxLength={4} placeholder="🙂" id="room-profile-emoji" />
          </label>
          <button className="f-btn" type="button" onClick={() => saveProfile(
            (document.getElementById('room-profile-name') as HTMLInputElement)?.value ?? '',
            (document.getElementById('room-profile-emoji') as HTMLInputElement)?.value ?? '',
          )}>Guardar</button>
        </div>
      )}

      <div
        className="room-stream"
        ref={listRef}
        onScroll={() => {
          const el = listRef.current;
          if (el) stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {messages.length === 0 && (
          <div className="room-empty">
            <p><strong>A sala está vazia.</strong></p>
            <p>
              Escolhe em baixo quem deve responder e faz a primeira pergunta. Os gestores podem
              chamar-se uns aos outros com <span className="room-mention">@nome</span> — se um
              precisar de outro para verificar alguma coisa, chama-o sozinho.
            </p>
          </div>
        )}

        {messages.map((m, i) => {
          const own = m.author.kind === 'user';
          const prev = messages[i - 1];
          // Mensagens seguidas do mesmo autor colam-se: só a primeira leva avatar e nome.
          const grouped = Boolean(prev && sameAuthor(prev.author, m.author) && m.ts - prev.ts < 5 * 60_000);
          return (
            <div
              key={m.id}
              className={`room-row${own ? ' room-row--own' : ''}${grouped ? ' room-row--grouped' : ''}`}
            >
              <div className="room-row-av">
                {!grouped && <Avatar author={m.author} projects={projects} brandLogo={brand.logo} profile={profile} />}
              </div>
              <div className="room-bubble-wrap">
                {!grouped && (
                  <div className="room-meta">
                    <span className="room-meta-name">
                      {m.author.kind === 'joca' ? brand.managerName
                        : m.author.kind === 'manager' ? m.author.name : m.author.name}
                    </span>
                    {m.author.kind === 'manager' && <span className="room-meta-role">gestor</span>}
                    <time className="room-meta-time">
                      {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                )}
                <div
                  className={`room-bubble${own ? ' room-bubble--own' : ''}${/^\s*RESOLVIDO\s*:/im.test(m.text) ? ' room-bubble--resolved' : ''}`}
                  style={bubbleStyle(m, projects)}
                >
                  {withMentions(m.text)}
                </div>
              </div>
            </div>
          );
        })}

        {waiting && (
          <div className="room-row">
            <div className="room-row-av"><span className="room-av room-av--ghost">…</span></div>
            <div className="room-bubble-wrap">
              <div className="room-bubble room-bubble--typing" aria-live="polite">
                <span className="room-typing-dot" /><span className="room-typing-dot" /><span className="room-typing-dot" />
                <span className="room-typing-label">a discutir…</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="room-composer">
        <div className="room-targets" role="group" aria-label="Quem responde a esta mensagem">
          <span className="room-targets-label">Responde:</span>
          <button
            type="button"
            className={`room-chip${targets.includes('joca') ? ' is-on' : ''}`}
            aria-pressed={targets.includes('joca')}
            onClick={() => toggleTarget('joca')}
          >
            {brand.managerName}
          </button>
          {visibleProjects.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`room-chip${targets.includes(p.id) ? ' is-on' : ''}`}
              aria-pressed={targets.includes(p.id)}
              style={{ '--dot-color': projectColor(p) } as CSSProperties}
              onClick={() => toggleTarget(p.id)}
            >
              <span className="room-chip-dot" aria-hidden />
              {p.name}
            </button>
          ))}
        </div>
        <div className="room-input-row">
          <textarea
            className="room-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={targets.length === 0
              ? 'Sem ninguém seleccionado — fica como nota na sala.'
              : 'Escreve à sala…  (Enter envia · Shift+Enter nova linha)'}
            rows={1}
          />
          <button className="room-send" type="button" onClick={send} disabled={!draft.trim()} aria-label="Enviar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 2 11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
