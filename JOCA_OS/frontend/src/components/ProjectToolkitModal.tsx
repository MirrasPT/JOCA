import { useEffect, useRef, useState } from 'react';
import type { Project } from '../types';

interface ToolkitItem { name: string; category: string; insert: string; path: string; description?: string }
interface Toolkit { skills: ToolkitItem[]; agents: ToolkitItem[]; commands: ToolkitItem[] }

interface Props {
  open: boolean;
  project: Project;
  onClose: () => void;
  onCreateProjectSkill?: (project: Project, skillName: string) => void;
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// Gestão do kit exclusivo do projecto (skills/agentes só dele) — nível 2 dentro de Settings, por
// decisão explícita: ninguém precisa de acesso rápido a isto, fica a 2 cliques (Settings → Skills).
// Conteúdo levantado tal-qual do antigo canal Overview.
export default function ProjectToolkitModal({ open, project, onClose, onCreateProjectSkill }: Props) {
  const [toolkit, setToolkit] = useState<Toolkit | null>(null);
  const [newToolName, setNewToolName] = useState('');
  const [newToolType, setNewToolType] = useState<'skills' | 'agents'>('skills');
  const [creationError, setCreationError] = useState('');

  useEffect(() => {
    if (!open) return;
    fetch(`/projects/${project.id}/toolkit`).then((r) => r.json()).then(setToolkit).catch(() => setToolkit(null));
    setNewToolName('');
    setCreationError('');
  }, [open, project.id]);

  // Trap + Escape + restauro de foco próprios — não pode depender do modal por baixo (Settings),
  // que fica em silêncio enquanto este está aberto (ver CreateProjectModal.tsx). Dois efeitos
  // separados (capturar+focar vs. keydown) para a mesma razão que lá: nenhum re-executa por causa
  // de uma prop `onClose` de identidade instável (fica numa ref).
  const modalRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement;
    requestAnimationFrame(() => {
      const modal = modalRef.current;
      if (!modal) return;
      const first = modal.querySelector<HTMLElement>('button, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      first?.focus();
    });
    return () => {
      if (openerRef.current) { openerRef.current.focus(); openerRef.current = null; }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusables = Array.from(modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((el) => el.getClientRects().length > 0);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div className="project-modal-overlay" style={{ zIndex: 60 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={modalRef} className="project-modal" role="dialog" aria-modal="true" aria-labelledby="toolkit-modal-title" style={{ maxWidth: '640px' }}>
        <div className="project-modal-header">
          <div>
            <span className="project-modal-kicker">{project.name}</span>
            <h2 id="toolkit-modal-title">Skills &amp; Agentes exclusivos</h2>
          </div>
          <button className="project-modal-close" type="button" onClick={onClose} aria-label="Fechar"><XIcon /></button>
        </div>

        <div className="project-toolkit-section">
          <div className="project-toolkit-cols">
            <div className="project-toolkit-col">
              <div className="project-toolkit-col-header">
                <span>Skills Exclusivas</span>
                <span className="count-badge">{toolkit?.skills.length || 0}</span>
              </div>
              <div className="project-toolkit-list">
                {toolkit?.skills.map((skill) => (
                  <div key={skill.path} className="project-toolkit-item">
                    <span className="toolkit-item-icon" style={{ color: 'var(--project-color, var(--accent))' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14 4-4 4 4M4 14l4-4 4 4" /></svg>
                    </span>
                    <div className="toolkit-item-details">
                      <div className="toolkit-item-name">{skill.name}</div>
                      {skill.description && <div className="toolkit-item-desc">{skill.description}</div>}
                    </div>
                  </div>
                ))}
                {(toolkit?.skills.length || 0) === 0 && (
                  <div className="memory-empty-text">Nenhuma skill exclusiva.</div>
                )}
              </div>
            </div>

            <div className="project-toolkit-col">
              <div className="project-toolkit-col-header">
                <span>Agentes Exclusivos</span>
                <span className="count-badge">{toolkit?.agents.length || 0}</span>
              </div>
              <div className="project-toolkit-list">
                {toolkit?.agents.map((agent) => (
                  <div key={agent.path} className="project-toolkit-item">
                    <span className="toolkit-item-icon" style={{ color: 'var(--project-color, var(--accent))' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 14a8 8 0 0 0-8 8h16a8 8 0 0 0-8-8z" /></svg>
                    </span>
                    <div className="toolkit-item-details">
                      <div className="toolkit-item-name">{agent.name}</div>
                      {agent.description && <div className="toolkit-item-desc">{agent.description}</div>}
                    </div>
                  </div>
                ))}
                {(toolkit?.agents.length || 0) === 0 && (
                  <div className="memory-empty-text">Nenhum agente exclusivo.</div>
                )}
              </div>
            </div>
          </div>

          <div className="add-toolkit-form">
            <div className="add-toolkit-title">Criar Nova Ferramenta Exclusiva</div>
            <div className="memory-input-row">
              <select
                value={newToolType}
                onChange={(e) => setNewToolType(e.target.value as 'skills' | 'agents')}
                className="project-toolkit-select"
              >
                <option value="skills">Skill</option>
                <option value="agents">Agente</option>
              </select>
              <input
                type="text"
                value={newToolName}
                onChange={(e) => setNewToolName(e.target.value)}
                placeholder={newToolType === 'skills' ? 'ex: php-refactor' : 'ex: reviewer-git'}
                className="project-toolkit-input"
              />
              <button
                className="f-btn f-btn--sm"
                type="button"
                onClick={async () => {
                  const name = newToolName.trim();
                  if (!name) return;
                  setCreationError('');
                  if (newToolType === 'skills') {
                    if (onCreateProjectSkill) {
                      onCreateProjectSkill(project, name);
                      setNewToolName('');
                      onClose();
                    } else {
                      setCreationError('Erro: callback para criar skill não fornecido.');
                    }
                    return;
                  }
                  try {
                    const res = await fetch(`/projects/${project.id}/toolkit`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: newToolType, name }),
                    });
                    if (!res.ok) {
                      const err = await res.json();
                      throw new Error(err.error || 'Erro desconhecido');
                    }
                    const data = await res.json();
                    setToolkit(data.items);
                    setNewToolName('');
                  } catch (e) {
                    setCreationError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Criar
              </button>
            </div>
            {creationError && <div className="toolkit-creation-error">{creationError}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
