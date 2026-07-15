// WorkerBrief builder — Fase 1a.
// Sub-agents (workers) do NOT inherit soul.md; the brief must carry the rules explicitly.
// Each task gets a unique nonce so the done-sentinel can be matched on its OWN line without
// the brief's own literal mention of the sentinel triggering a false-positive "done".
import { randomUUID } from 'crypto';

export interface WorkerBriefInput {
  objective: string;          // 1-2 sentences: what the worker must achieve
  projectPath?: string;       // relevant paths/cwd
  constraints?: string;       // project constraints
  doNot?: string;             // what NOT to do
  skills?: string[];          // skills the worker should Read() before acting (Step 0)
}

export interface BuiltBrief {
  nonce: string;              // unique per task
  text: string;               // the full brief to send to the worker
  donePattern: RegExp;        // matches the sentinel alone on its own line (post strip-ANSI/trim)
}

// Generates the per-task done matcher. Anchored to a full line so the literal sentinel inside
// the brief text never matches — only a line the worker prints that is EXACTLY the sentinel.
export function makeDoneMatcher(nonce: string): RegExp {
  return new RegExp(`^<<<JOCA_DONE:${nonce}>>>$`, 'm');
}

export function buildWorkerBrief(input: WorkerBriefInput): BuiltBrief {
  const nonce = randomUUID().slice(0, 8);
  const skills = (input.skills ?? []).filter(Boolean);

  const lines: string[] = [];
  lines.push(`OBJECTIVO (2 frases): ${input.objective}`);
  if (input.projectPath) lines.push(`PATHS/CWD relevantes: ${input.projectPath}`);
  if (input.constraints) lines.push(`CONSTRAINTS do projecto: ${input.constraints}`);
  if (input.doNot) lines.push(`O QUE NAO FAZER: ${input.doNot}`);
  if (skills.length) {
    lines.push(`STEP 0 (obrigatorio, antes de codigo): Read das skills relevantes — ${skills.map((s) => `.claude/skills/${s}.md`).join(', ')}`);
  }
  lines.push('ANTI-FABRICACAO: credencial/endpoint/key em falta -> fonte sem-auth ou `TODO: credencial em falta` + reportar. NUNCA inventar key/URL/path/API.');
  lines.push('VERIFICAR PARSERS: cliente de API externa -> 1 chamada real e validar o parsing antes de finalizar.');
  lines.push('COMPONENTES PARTILHADOS: em build paralelo, IMPORTAR player/card/layout definidos na fundacao; nao recriar.');
  // Done sentinel — instruct the worker to print it on its OWN line at the very end.
  lines.push('');
  lines.push(`QUANDO TERMINARES a tarefa por completo, imprime numa linha SOZINHA, exactamente: <<<JOCA_DONE:${nonce}>>>`);
  lines.push('Nao imprimas esse marcador antes de estar realmente concluido, e nunca no meio de texto.');

  return { nonce, text: lines.join('\n'), donePattern: makeDoneMatcher(nonce) };
}
