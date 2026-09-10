// Multi-CLI profiles — how to launch each supported coding agent inside a JOCA_OS PTY session.
// Claude Code is the base; Codex CLI, Antigravity (agy) and OpenCode are alternatives selectable
// per session. Defaults below are best-effort for each CLI's current flags;
// everything is overridable via DATA_DIR/cli-profiles.json (partial merge by id) so a flag rename
// upstream is a config fix, not a code change.
//
// startupSequence: run the startup choreography — wait for the TUI to be ready and answer the
// dialogs that show up on their own ("trust this folder?", "Update available!"). It sends NO
// context command: the resume is MANUAL, from the button on the chat bar (see session-manager).
//   ⚠ The previous comment said this flag sent a resume at startup. It never did: the
//   choreography was fired by there being a resume or a brief, and the flag was not read anywhere.
//   Leaving a terminal stuck on the update dialog is worse than any missing context — a blind
//   Enter on that dialog fires an `npm install -g` and kills the terminal.
// resumeCmd: the shape of the command the manual BUTTON composes. Claude Code understands the
// custom `/resume`; the other CLIs have no custom commands and receive `resume "<folder>"` as plain
// text (the AGENTS.md/GEMINI.md compiled in JOCA_Brain tells them what that means).
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
  startupSequence: boolean;  // run the startup choreography (dialogs); see the note at the top
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
    // codex ≥0.146 removed `--full-auto`; this is the equivalent of claude's skip-permissions.
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
    // agy does not recognize custom commands with `/` — it takes `resume "<folder>"` as a normal prompt.
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
  // `--remote-control` is a Claude Code STARTUP flag: there is no turning it on mid conversation,
  // the terminal has to be born with it. It only applies to claude — the other CLIs do not have it.
  if (opts.remoteControl && profile.id === 'claude') parts.push('--remote-control');
  if (opts.model && profile.modelFlag && MODEL_SAFE.test(opts.model)) {
    parts.push(profile.modelFlag, opts.model);
  }
  if (opts.autonomous && profile.autonomousFlags.length) parts.push(...profile.autonomousFlags);
  if (profile.extraFlags.length) parts.push(...profile.extraFlags);
  return parts.join(' ');
}
