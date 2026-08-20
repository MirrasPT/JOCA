// Multi-CLI profiles — how to launch each supported coding agent inside a JOCA_OS PTY session.
// Claude Code is the base; Codex CLI, Antigravity (agy) and OpenCode are alternatives selectable
// por sessao. Defaults below are best-effort for each CLI's current flags;
// everything is overridable via DATA_DIR/cli-profiles.json (partial merge by id) so a flag rename
// upstream is a config fix, not a code change.
//
// startupSequence: correr a coreografia de arranque — esperar que a TUI esteja pronta e responder
// aos diálogos que aparecem sozinhos ("trust this folder?", "Update available!"). NÃO envia nenhum
// comando de contexto: o resume é MANUAL, pelo botão da barra do chat (ver session-manager).
//   ⚠ O comentário anterior dizia que esta flag mandava um resume no arranque. Nunca mandou: a
//   coreografia era disparada por haver resume ou brief, e a flag não era lida em lado nenhum.
//   Deixar um terminal parado no diálogo de update é pior do que qualquer contexto em falta — um
//   Enter cego nesse diálogo dispara um `npm install -g` e mata o terminal.
// resumeCmd: a forma do comando que o BOTÃO manual compõe. Claude Code entende o `/resume` custom;
// os outros CLIs não têm comandos custom e recebem `resume "<pasta>"` em texto simples (o
// AGENTS.md/GEMINI.md compilado no JOCA_Brain diz-lhes o que isso significa).
import path from 'path';
import { DATA_DIR, readJsonFile } from './project-store';

export type CliId = 'claude' | 'codex' | 'agy' | 'opencode';
export const CLI_IDS: CliId[] = ['claude', 'codex', 'agy', 'opencode'];

export interface CliProfile {
  id: CliId;
  label: string;
  bin: string;               // executable name looked up on PATH
  modelFlag?: string;        // e.g. '--model' → `--model <m>`; undefined = CLI has no model flag
  autonomousFlags: string[]; // appended when JOCA's skip-permissions/autonomous toggle is on
  extraFlags: string[];      // always appended (user-configurable)
  startupSequence: boolean;  // correr a coreografia de arranque (diálogos); ver nota no topo
  resumeCmd: string;         // how this CLI receives the project folder: '/resume' | 'resume'
}

const DEFAULTS: Record<CliId, CliProfile> = {
  claude: {
    id: 'claude', label: 'Claude Code', bin: 'claude',
    modelFlag: '--model',
    autonomousFlags: ['--dangerously-skip-permissions'],
    extraFlags: [],
    startupSequence: true,
    resumeCmd: '/resume',
  },
  codex: {
    id: 'codex', label: 'Codex CLI', bin: 'codex',
    modelFlag: '--model',
    // O codex ≥0.146 removeu o `--full-auto`; o equivalente ao skip-permissions do claude é este.
    autonomousFlags: ['--dangerously-bypass-approvals-and-sandbox'],
    extraFlags: [],
    startupSequence: true,
    resumeCmd: 'resume',
  },
  agy: {
    id: 'agy', label: 'Antigravity', bin: 'agy',
    modelFlag: '--model',
    autonomousFlags: [],
    extraFlags: [],
    startupSequence: true,
    // O agy não reconhece comandos custom com `/` — recebe `resume "<pasta>"` como prompt normal.
    resumeCmd: 'resume',
  },
  opencode: {
    id: 'opencode', label: 'OpenCode', bin: 'opencode',
    modelFlag: '--model',
    autonomousFlags: [],
    extraFlags: [],
    startupSequence: true,
    resumeCmd: 'resume',
  },
};

const OVERRIDES_FILE = path.join(DATA_DIR, 'cli-profiles.json');

// Merge user overrides (partial, keyed by id) over the defaults. Unknown keys are ignored.
export function loadCliProfiles(): Record<CliId, CliProfile> {
  const overrides = readJsonFile<Partial<Record<CliId, Partial<CliProfile>>>>(OVERRIDES_FILE, {});
  const out = {} as Record<CliId, CliProfile>;
  for (const id of CLI_IDS) {
    const o = overrides[id] ?? {};
    out[id] = {
      ...DEFAULTS[id],
      ...(typeof o.label === 'string' ? { label: o.label } : {}),
      ...(typeof o.bin === 'string' && o.bin.trim() ? { bin: o.bin.trim() } : {}),
      ...('modelFlag' in o ? { modelFlag: typeof o.modelFlag === 'string' ? o.modelFlag : undefined } : {}),
      ...(Array.isArray(o.autonomousFlags) ? { autonomousFlags: o.autonomousFlags.filter((f) => typeof f === 'string') } : {}),
      ...(Array.isArray(o.extraFlags) ? { extraFlags: o.extraFlags.filter((f) => typeof f === 'string') } : {}),
      ...(typeof o.startupSequence === 'boolean' ? { startupSequence: o.startupSequence } : {}),
      ...(typeof o.resumeCmd === 'string' && o.resumeCmd.trim() ? { resumeCmd: o.resumeCmd.trim() } : {}),
    };
  }
  return out;
}

export function getCliProfile(cli?: string): CliProfile {
  const id = (CLI_IDS as string[]).includes(cli ?? '') ? (cli as CliId) : 'claude';
  return loadCliProfiles()[id];
}

// Model values reach a PTY shell line — restrict to a safe charset (model ids, aliases, provider/model).
const MODEL_SAFE = /^[A-Za-z0-9._:/-]{1,120}$/;

// Build the full launch command line for a profile (binPath resolved by the caller via PATH lookup).
export function buildLaunchLine(
  profile: CliProfile,
  binPath: string,
  opts: { model?: string; autonomous?: boolean; remoteControl?: boolean },
): string {
  const parts = [binPath];
  // `--remote-control` é uma flag de ARRANQUE do Claude Code: não há como ligá-la a meio de uma
  // conversa, o terminal tem de nascer com ela. Só se aplica ao claude — os outros CLIs não a têm.
  if (opts.remoteControl && profile.id === 'claude') parts.push('--remote-control');
  if (opts.model && profile.modelFlag && MODEL_SAFE.test(opts.model)) {
    parts.push(profile.modelFlag, opts.model);
  }
  if (opts.autonomous && profile.autonomousFlags.length) parts.push(...profile.autonomousFlags);
  if (profile.extraFlags.length) parts.push(...profile.extraFlags);
  return parts.join(' ');
}
