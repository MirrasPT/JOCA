// Tabs dos terminais de um projecto — a navegação entre agentes, no sítio onde toda a gente já
// espera encontrá-la (em cima do que ela controla), em vez de uma coluna fixa ao lado.
//
// Substitui a antiga lista lateral `WorkersChannel`: com um agente, a coluna gastava 285px para
// mostrar uma linha; com cinco, era uma lista onde se procurava. Uma tab por terminal resolve os
// dois casos e devolve a largura ao terminal.
import { useEffect, useRef, useState } from 'react';
import type { CliProfileInfo, SessionInfo } from '../../types';
import InlineName from '../InlineName';

export interface TerminalTab {
  id: string;
  label: string;
  working: boolean;
}

interface Props {
  tabs: TerminalTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  /** Renomear a sessão (duplo clique no nome da tab). Ausente = nome não editável. */
  onRename?: (id: string, name: string) => void;
  onNew: (cli?: string) => void;
}

/**
 * Uma tab por terminal do projecto. Fonte única: as sessões do WebSocket. Havia aqui uma segunda
 * fonte — a pool de áreas do gestor de projecto —, removida com ele.
 */
export function buildTabs(projectSessions: SessionInfo[]): TerminalTab[] {
  return projectSessions.map((s) => ({
    id: s.id,
    label: s.name || 'Terminal',
    working: s.status === 'working',
  }));
}

function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  );
}

export default function TerminalTabs({
  tabs, activeId, onSelect, onClose, onRename, onNew,
}: Props) {
  // Fechar mata trabalho a meio — confirma-se na própria tab, como no resto da app, em vez de um
  // modal por cima do terminal.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cliMenuOpen, setCliMenuOpen] = useState(false);
  const [cliProfiles, setCliProfiles] = useState<CliProfileInfo[] | null>(null);
  const newWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cliMenuOpen) return;
    const onDoc = (ev: MouseEvent) => {
      if (newWrapRef.current && !newWrapRef.current.contains(ev.target as Node)) setCliMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [cliMenuOpen]);

  const openCliMenu = () => {
    setCliMenuOpen((o) => !o);
    if (cliProfiles === null) {
      fetch('/cli-profiles').then((r) => r.json())
        .then((d: CliProfileInfo[]) => setCliProfiles(Array.isArray(d) ? d : []))
        .catch(() => setCliProfiles([]));
    }
  };

  return (
    <div className="pw-tabbar">
      <div className="pw-tabs" role="tablist" aria-label="Terminais do projecto">
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <div key={t.id} className={`pw-tab ${active ? 'pw-tab--active' : ''}`}>
              {/* `div[role=tab]` e não `<button>`: o nome é editável e um <input> não pode viver
                  dentro de um botão. O comportamento de teclado é reposto à mão. */}
              <div
                role="tab"
                tabIndex={active ? 0 : -1}
                aria-selected={active}
                className="pw-tab-main"
                onClick={() => onSelect(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(t.id); }
                }}
                // O estado vai no nome acessível (o ponto verde é decorativo) — esta app não tem
                // classe utilitária de texto só-para-leitor, e um <span> escondido "à mão" aqui
                // apareceu mesmo no ecrã.
                aria-label={`${t.label}${t.working ? ' — a trabalhar' : ''}`}
              >
                <span className={`pw-tab-dot ${t.working ? 'pw-tab-dot--working' : ''}`} aria-hidden />
                <InlineName
                  value={t.label}
                  onRename={onRename ? (name) => onRename(t.id, name) : undefined}
                  onActivate={() => onSelect(t.id)}
                  className="pw-tab-label"
                  inputClassName="pw-tab-name-input"
                  title={`${t.label} — duplo-clique renomeia`}
                />
              </div>
              {confirmId === t.id ? (
                <span className="pw-tab-confirm">
                  <button type="button" className="pw-tab-confirm-yes" onClick={() => { setConfirmId(null); onClose(t.id); }}>fechar</button>
                  <button type="button" className="pw-tab-confirm-no" onClick={() => setConfirmId(null)}>não</button>
                </span>
              ) : (
                <button
                  type="button"
                  className="pw-tab-close"
                  onClick={() => setConfirmId(t.id)}
                  aria-label={`Fechar terminal ${t.label}`}
                  title="Fechar este terminal"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          );
        })}

        {/* O "+" acompanha a última tab: com poucos terminais, o botão fixo à direita ficava longe
            de onde se está a olhar. Este é só "abrir mais um" — a escolha do CLI vive no botão da
            direita, que não é podado pelo scroll horizontal desta fila. */}
        <button
          type="button"
          className="pw-tab-add"
          onClick={() => onNew()}
          title="Abrir um terminal novo"
          aria-label="Abrir um terminal novo"
        >+</button>
      </div>

      {/* Fora da fila de tabs de propósito — ver a nota no `.pw-tabs` do CSS. */}
      <div className="pw-tab-new-wrap" ref={newWrapRef}>
        <button type="button" className="pw-tab-new" onClick={() => onNew()} title="Abrir um terminal novo (escolhe o CLI na seta ao lado)" aria-label="Abrir um terminal novo">+</button>
        <button type="button" className="pw-tab-new-caret" onClick={openCliMenu} aria-haspopup="menu" aria-expanded={cliMenuOpen} aria-label="Escolher o CLI do terminal novo">▾</button>
        {cliMenuOpen && (
          <div className="pw-cli-menu" role="menu" aria-label="CLIs disponíveis">
            {(cliProfiles ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                className="pw-cli-item"
                disabled={!p.available}
                onClick={() => { setCliMenuOpen(false); onNew(p.id); }}
              >
                {p.label}{p.available ? '' : ' (não instalado)'}
              </button>
            ))}
            {cliProfiles === null && <div className="pw-cli-item pw-cli-item--loading">A carregar…</div>}
            {cliProfiles?.length === 0 && <div className="pw-cli-item pw-cli-item--loading">Sem perfis CLI.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
