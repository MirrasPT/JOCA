// AutomationsView — v1 panel. Lists automations (enable toggle, next/last run, run-now, delete) and
// a "new automation" form. The common shape is a scheduled Master task delivered to the Master chat:
// nodes = [{master, objective}, {message, {{input}}}]. The runtime supports more node types; the
// visual node editor (n8n-style canvas) comes next — this form generates the 80% case.
import { useCallback, useEffect, useMemo, useState } from 'react';
import './AutomationsView.css';

// Minimal inline-SVG icons (the project has no shared icon module / lucide-react dep).
type IconName = 'plus' | 'x' | 'clock' | 'play' | 'loader' | 'trash-2';
function LucideIcon({ name }: { name: IconName }) {
  const c = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'plus') return <svg {...c}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === 'x') return <svg {...c}><path d="M18 6 6 18M6 6l12 12" /></svg>;
  if (name === 'clock') return <svg {...c}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === 'play') return <svg {...c}><path d="M7 5v14l11-7z" /></svg>;
  if (name === 'loader') return <svg {...c}><path d="M12 3v4M12 17v4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M3 12h4M17 12h4M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></svg>;
  return <svg {...c}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>; // trash-2
}

type ScheduleKind = 'daily' | 'weekly' | 'interval';
interface Schedule { kind: ScheduleKind; time?: string; weekday?: number; everyMinutes?: number }
interface AutomationNode { id: string; type: string; objective?: string; text?: string; title?: string }
interface Automation {
  id: string; name: string; enabled: boolean;
  provider?: string; model?: string; skills?: string[]; requireConfirm?: boolean;
  trigger: { type: 'schedule' | 'manual'; schedule?: Schedule };
  nodes: AutomationNode[];
  nextRunAt?: number | null; lastRunAt?: number | null;
  lastStatus?: 'ok' | 'error' | 'running' | null; lastResult?: string;
}
interface ProviderInfo { id: string; label: string; available: boolean; wired: boolean }
interface JocaItem { name: string; description?: string; kind: 'skill' | 'agent' }

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const fmtTs = (ts?: number | null) => (ts ? new Date(ts).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

function describeTrigger(a: Automation): string {
  if (a.trigger.type === 'manual') return 'Manual';
  const s = a.trigger.schedule;
  if (!s) return 'Agendado';
  if (s.kind === 'daily') return `Todos os dias às ${s.time ?? '09:00'}`;
  if (s.kind === 'weekly') return `${WEEKDAYS[s.weekday ?? 1]} às ${s.time ?? '09:00'}`;
  return `A cada ${s.everyMinutes ?? 60} min`;
}

export function AutomationsView({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<Automation[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // form state
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [provider, setProvider] = useState('claude');
  const [model, setModel] = useState('');
  const [jocaItems, setJocaItems] = useState<JocaItem[]>([]);
  const [skillQuery, setSkillQuery] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [requireConfirm, setRequireConfirm] = useState(false);
  const [runInputs, setRunInputs] = useState<Record<string, string>>({}); // per-action runtime input
  const [triggerType, setTriggerType] = useState<'manual' | 'schedule'>('schedule');
  const [kind, setKind] = useState<ScheduleKind>('daily');
  const [time, setTime] = useState('08:00');
  const [weekday, setWeekday] = useState(6);
  const [everyMinutes, setEveryMinutes] = useState(60);

  const reload = useCallback(() => {
    fetch('/automations').then((r) => r.json()).then(setItems).catch(() => setItems([]));
  }, []);
  // "Optimizar": send the written objective to the brain (background) and replace it with a cleaner,
  // more actionable version (preserves {{input}}).
  const optimize = useCallback(async () => {
    if (!objective.trim() || optimizing) return;
    setOptimizing(true);
    try {
      const r = await fetch('/optimize-objective', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: objective }) });
      const d = await r.json();
      if (d.text) setObjective(d.text);
    } catch { /* ignore */ } finally { setOptimizing(false); }
  }, [objective, optimizing]);
  useEffect(() => { reload(); }, [reload, refreshKey]);
  // Which agents can run an automation (Claude/Codex/Ollama wired; Antigravity blocked → disabled).
  useEffect(() => {
    fetch('/master-providers').then((r) => r.json()).then(setProviders).catch(() => setProviders([]));
  }, []);
  // JOCA_Brain skills + agents, for the "skills a usar" picker (don't make the user memorise names).
  useEffect(() => {
    fetch('/joca-items').then((r) => r.json()).then((o) => {
      const skills = (o.skills ?? []).map((s: { name: string; description?: string }) => ({ ...s, kind: 'skill' as const }));
      const agents = (o.agents ?? []).map((a: { name: string; description?: string }) => ({ ...a, kind: 'agent' as const }));
      setJocaItems([...skills, ...agents]);
    }).catch(() => setJocaItems([]));
  }, []);
  const knownNames = useMemo(() => new Set(jocaItems.map((i) => i.name)), [jocaItems]);
  const addSkill = useCallback((raw: string) => {
    const v = raw.trim();
    if (!v) return;
    setSelectedSkills((s) => (s.includes(v) ? s : [...s, v]));
    setSkillQuery('');
  }, []);

  const create = useCallback(async () => {
    if (!name.trim() || !objective.trim()) return;
    const schedule: Schedule | undefined = triggerType === 'schedule'
      ? (kind === 'interval' ? { kind, everyMinutes } : kind === 'weekly' ? { kind, time, weekday } : { kind, time })
      : undefined;
    const body = {
      name: name.trim(),
      enabled: true,
      provider,
      model: provider === 'claude' && model.trim() ? model.trim() : undefined,
      skills: selectedSkills.length ? selectedSkills : undefined,
      requireConfirm: requireConfirm || undefined,
      trigger: { type: triggerType, schedule },
      nodes: [
        { type: 'master', objective: objective.trim() },
        { type: 'message', text: '{{input}}', title: name.trim() },
      ],
    };
    await fetch('/automations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setName(''); setObjective(''); setModel(''); setSelectedSkills([]); setSkillQuery(''); setRequireConfirm(false); setCreating(false);
    reload();
  }, [name, objective, provider, model, selectedSkills, requireConfirm, triggerType, kind, time, weekday, everyMinutes, reload]);

  const toggle = useCallback(async (a: Automation) => {
    await fetch(`/automations/${a.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: !a.enabled }) });
    reload();
  }, [reload]);

  const runNow = useCallback(async (a: Automation) => {
    setBusy(a.id);
    const input = runInputs[a.id] ?? '';
    try {
      await fetch(`/automations/${a.id}/run`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input }),
      });
    } finally { setBusy(null); reload(); }
  }, [reload, runInputs]);

  const remove = useCallback(async (a: Automation) => {
    await fetch(`/automations/${a.id}`, { method: 'DELETE' });
    reload();
  }, [reload]);

  return (
    <div className="automations-view">
      <header className="av-header">
        <div>
          <h1>Automações</h1>
          <p>Tarefas agendadas que o Master corre sozinho. O resultado cai no chat do Master.</p>
        </div>
        <button className="av-btn-primary" type="button" onClick={() => setCreating((v) => !v)}>
          <LucideIcon name={creating ? 'x' : 'plus'} /> {creating ? 'Cancelar' : 'Nova automação'}
        </button>
      </header>

      {creating && (
        <div className="av-form">
          <label className="av-field">
            <span>Nome</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Resumo Matinal" />
          </label>
          <div className="av-field">
            <div className="av-label-row">
              <span>Objectivo (o que o agente faz)</span>
              <button type="button" className="av-optimize" onClick={optimize} disabled={optimizing || !objective.trim()}>
                {optimizing ? 'A optimizar…' : '✨ Optimizar'}
              </button>
            </div>
            <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={3}
              placeholder="Lê os meus emails não lidos com o gws e faz-me um resumo curto." />
          </div>
          <div className="av-trigger-row">
            <label className="av-field av-inline">
              <span>Agente</span>
              <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                {(providers.length ? providers : [{ id: 'claude', label: 'Claude', available: true, wired: true }]).map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.wired}>
                    {p.label}{!p.wired ? ' (indisponível)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {provider === 'claude' && (
              <label className="av-field av-inline">
                <span>Modelo (opcional)</span>
                <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="sonnet (default)" />
              </label>
            )}
          </div>
          <div className="av-trigger-row">
            <label className="av-field av-inline">
              <span>Skills/agentes a usar (opcional)</span>
              <input
                list="av-joca-items"
                value={skillQuery}
                onChange={(e) => { const v = e.target.value; if (knownNames.has(v)) addSkill(v); else setSkillQuery(v); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillQuery); } }}
                placeholder="procurar skill/agente do JOCA…"
              />
              <datalist id="av-joca-items">
                {jocaItems.map((i) => (
                  <option key={`${i.kind}:${i.name}`} value={i.name}>{i.kind === 'agent' ? 'agente' : 'skill'} · {(i.description ?? '').slice(0, 70)}</option>
                ))}
              </datalist>
              {selectedSkills.length > 0 && (
                <div className="av-chips">
                  {selectedSkills.map((s) => (
                    <button type="button" key={s} className="av-chip" onClick={() => setSelectedSkills((x) => x.filter((y) => y !== s))}>{s} ✕</button>
                  ))}
                </div>
              )}
            </label>
            <label className="av-field av-inline av-check">
              <input type="checkbox" checked={requireConfirm} onChange={(e) => setRequireConfirm(e.target.checked)} />
              <span>Confirmar antes de enviar/apagar</span>
            </label>
          </div>
          {triggerType === 'manual' && (
            <p className="av-hint">Acção (manual): usa <code>{'{{input}}'}</code> no objectivo para o texto que dás ao correr (ex.: "escreve um email formal a partir de: <code>{'{{input}}'}</code>").</p>
          )}
          <div className="av-trigger-row">
            <label className="av-field av-inline">
              <span>Quando</span>
              <select value={triggerType} onChange={(e) => setTriggerType(e.target.value as 'manual' | 'schedule')}>
                <option value="schedule">Agendado</option>
                <option value="manual">Manual (só correr à mão)</option>
              </select>
            </label>
            {triggerType === 'schedule' && (
              <>
                <label className="av-field av-inline">
                  <span>Repetição</span>
                  <select value={kind} onChange={(e) => setKind(e.target.value as ScheduleKind)}>
                    <option value="daily">Diária</option>
                    <option value="weekly">Semanal</option>
                    <option value="interval">Intervalo</option>
                  </select>
                </label>
                {kind === 'interval' ? (
                  <label className="av-field av-inline">
                    <span>A cada (min)</span>
                    <input type="number" min={1} value={everyMinutes} onChange={(e) => setEveryMinutes(Number(e.target.value))} />
                  </label>
                ) : (
                  <label className="av-field av-inline">
                    <span>Hora</span>
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </label>
                )}
                {kind === 'weekly' && (
                  <label className="av-field av-inline">
                    <span>Dia</span>
                    <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                      {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </label>
                )}
              </>
            )}
          </div>
          <button className="av-btn-primary" type="button" onClick={create} disabled={!name.trim() || !objective.trim()}>
            Criar automação
          </button>
        </div>
      )}

      <div className="av-list">
        {items.length === 0 && <div className="av-empty">Sem automações ainda. Cria a primeira.</div>}
        {items.map((a) => (
          <div key={a.id} className={`av-card ${a.enabled ? '' : 'disabled'}`}>
            <div className="av-card-main">
              <div className="av-card-top">
                <button className={`av-toggle ${a.enabled ? 'on' : ''}`} type="button" onClick={() => toggle(a)} aria-label="toggle">
                  <span className="av-toggle-dot" />
                </button>
                <span className="av-name">{a.name}</span>
                {a.lastStatus && <span className={`av-status av-status-${a.lastStatus}`}>{a.lastStatus}</span>}
              </div>
              <div className="av-meta">
                <span><LucideIcon name="clock" /> {describeTrigger(a)}</span>
                <span className="av-agent">{(a.provider ?? 'claude')}{a.model ? `·${a.model}` : ''}</span>
                {a.skills?.length ? <span className="av-agent">skills: {a.skills.join(', ')}</span> : null}
                {a.requireConfirm ? <span className="av-agent">✋ confirma</span> : null}
                {a.trigger.type === 'schedule' && <span>próxima: {fmtTs(a.nextRunAt)}</span>}
                <span>última: {fmtTs(a.lastRunAt)}</span>
              </div>
              {a.trigger.type === 'manual' && (
                <input
                  className="av-run-input"
                  value={runInputs[a.id] ?? ''}
                  onChange={(e) => setRunInputs((m) => ({ ...m, [a.id]: e.target.value }))}
                  placeholder="input para esta acção (preenche {{input}}) — opcional"
                  onKeyDown={(e) => { if (e.key === 'Enter') runNow(a); }}
                />
              )}
              {a.lastResult && <div className="av-result">{a.lastResult.slice(0, 240)}</div>}
            </div>
            <div className="av-card-actions">
              <button type="button" onClick={() => runNow(a)} disabled={busy === a.id} data-tooltip="Correr agora">
                <LucideIcon name={busy === a.id ? 'loader' : 'play'} />
              </button>
              <button type="button" onClick={() => remove(a)} data-tooltip="Apagar" className="av-danger">
                <LucideIcon name="trash-2" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
