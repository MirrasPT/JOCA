export interface WorkflowState {
  activeSkill: string | null;
  activeType: 'skill' | 'agente' | null;
  nextStep: string | null;
  history: string[];
}

export const emptyWorkflow: WorkflowState = {
  activeSkill: null,
  activeType: null,
  nextStep: null,
  history: [],
};

const ANSI_RE = /\x1b\[[0-9;]*[mGKHFABCDJsulh]/g;
const stripAnsi = (s: string) => s.replace(ANSI_RE, '');

export function parseWorkflowLine(line: string, current: WorkflowState): WorkflowState | null {
  const clean = stripAnsi(line);

  const skillMatch = clean.match(/\[(skill|agente):\s*([^\]]+)\]/);
  if (skillMatch) {
    const type = skillMatch[1] as 'skill' | 'agente';
    const name = skillMatch[2].trim();
    const history = current.activeSkill
      ? [...current.history.slice(-4), current.activeSkill]
      : current.history;
    return { activeSkill: name, activeType: type, nextStep: null, history };
  }

  const nextMatch = clean.match(/→\s*próximo:\s*([^\n\r]+)/);
  if (nextMatch) {
    return { ...current, nextStep: nextMatch[1].trim() };
  }

  return null;
}

export default function WorkflowPanel({ state }: { state: WorkflowState | null }) {
  if (!state?.activeSkill) return null;

  const recentHistory = state.history.slice(-2);

  return (
    <div className="workflow-strip">
      {recentHistory.length > 0 && (
        <span className="workflow-history">{recentHistory.join(' → ')} →</span>
      )}
      <span className="workflow-badge">{state.activeType ?? 'skill'}</span>
      <span className="workflow-skill">{state.activeSkill}</span>
      {state.nextStep && (
        <>
          <span className="workflow-sep">→</span>
          <span className="workflow-next">{state.nextStep}</span>
        </>
      )}
    </div>
  );
}
