// Multi-CLI profiles — how to launch each supported coding agent inside a JOCA_OS PTY session.
// Claude Code is the base; Codex CLI, Antigravity (agy) and OpenCode are alternatives selectable
// per session / task / automation. Defaults below are best-effort for each CLI's current flags;
// everything is overridable via DATA_DIR/cli-profiles.json (partial merge by id) so a flag rename
// upstream is a config fix, not a code change.
//
// startupSequence: only Claude Code gets the /resume + trust-prompt choreography —
// the other CLIs have no JOCA commands, so project context is provided by cwd = project folder.
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
  startupSequence: boolean;  // run the Claude-specific /resume choreography after boot
}

const DEFAULTS: Record<CliId, CliProfile> = {
  claude: {
    id: 'claude', label: 'Claude Code', bin: 'claude',
    modelFlag: '--model',
    autonomousFlags: ['--dangerously-skip-permissions'],
    extraFlags: [],
    startupSequence: true,
  },
  codex: {
    id: 'codex', label: 'Codex CLI', bin: 'codex',
    modelFlag: '--model',
    autonomousFlags: ['--full-auto'],
    extraFlags: [],
    startupSequence: false,
  },
  agy: {
    id: 'agy', label: 'Antigravity', bin: 'agy',
    modelFlag: '--model',
    autonomousFlags: [],
    extraFlags: [],
    startupSequence: false,
  },
  opencode: {
    id: 'opencode', label: 'OpenCode', bin: 'opencode',
    modelFlag: '--model',
    autonomousFlags: [],
    extraFlags: [],
    startupSequence: false,
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
export function buildLaunchLine(profile: CliProfile, binPath: string, opts: { model?: string; autonomous?: boolean }): string {
  const parts = [binPath];
  if (opts.model && profile.modelFlag && MODEL_SAFE.test(opts.model)) {
    parts.push(profile.modelFlag, opts.model);
  }
  if (opts.autonomous && profile.autonomousFlags.length) parts.push(...profile.autonomousFlags);
  if (profile.extraFlags.length) parts.push(...profile.extraFlags);
  return parts.join(' ');
}
