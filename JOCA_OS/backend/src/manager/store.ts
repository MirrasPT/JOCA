// Project manager store — the conversation and the state of one manager per project.
//
// Two files, two shapes, for two very different growth curves:
//   • data/manager-chats/<projectId>.jsonl — the conversation. Append-only, one message per line,
//     rotated like runs.jsonl. A project's chat is a months-long log; rewriting the whole file on
//     every message (the tasks.json pattern) would be wrong here.
//   • data/manager-state.json — small mutable state per project (SDK session id, wake budget).
//     Map keyed by projectId, same shape as project-memory.json.
//
// The chat is readable without the SDK: losing the SDK session only costs conversational memory,
// never the record of what was said.
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { DATA_DIR, readJsonFile, writeJsonFile } from '../project-store';

export type ManagerRole = 'user' | 'manager' | 'system';

export interface ManagerMessage {
  id: string;
  role: ManagerRole;
  text: string;
  ts: number;
  // 'author' exists from day one so a future multi-user setup (several people talking to the same
  // manager) does not need a data migration. Undefined = the single local user.
  author?: string;
  costUsd?: number;
  // Short trace of what the manager did during this turn ("abriu Worker Design", "leu o terminal").
  actions?: string[];
}

export interface ManagerState {
  projectId: string;
  sdkSessionId?: string;      // resume handle for the SDK conversation
  busy?: boolean;             // a turn is running right now
  lastTurnAt?: number;
  autoWakeCount: number;      // consecutive wakes without human input — the anti-loop budget
  totalCostUsd?: number;
}

const CHATS_DIR = path.join(DATA_DIR, 'manager-chats');
const STATE_FILE = path.join(DATA_DIR, 'manager-state.json');
const MAX_LINES = 4000;       // rotate keeps the newest half
const TEXT_MAX = 20_000;

// Broadcast injected by server.ts (persist first, then notify — same rule as notifications/store).
let managerBroadcaster: ((projectId: string, message: ManagerMessage) => void) | null = null;
export function setManagerBroadcaster(fn: (projectId: string, message: ManagerMessage) => void): void {
  managerBroadcaster = fn;
}
let managerBusyBroadcaster: ((projectId: string, busy: boolean) => void) | null = null;
export function setManagerBusyBroadcaster(fn: (projectId: string, busy: boolean) => void): void {
  managerBusyBroadcaster = fn;
}

// projectId comes from our own store (uuid), but it lands in a filename — keep it strictly safe.
function chatFile(projectId: string): string {
  const safe = projectId.replace(/[^A-Za-z0-9_-]/g, '');
  if (!safe) throw new Error('projectId inválido');
  return path.join(CHATS_DIR, `${safe}.jsonl`);
}

export function loadChat(projectId: string, limit = 200): ManagerMessage[] {
  let lines: string[];
  try { lines = fs.readFileSync(chatFile(projectId), 'utf8').split('\n'); } catch { return []; }
  const out: ManagerMessage[] = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try { out.push(JSON.parse(line) as ManagerMessage); } catch { /* skip corrupt line */ }
  }
  return out.reverse();
}

export function appendMessage(
  projectId: string,
  spec: { role: ManagerRole; text: string; author?: string; costUsd?: number; actions?: string[] },
): ManagerMessage {
  const msg: ManagerMessage = {
    id: randomUUID(),
    role: spec.role,
    text: (spec.text ?? '').slice(0, TEXT_MAX),
    ts: Date.now(),
    author: spec.author,
    costUsd: spec.costUsd,
    actions: spec.actions?.length ? spec.actions.slice(0, 40) : undefined,
  };
  try {
    fs.mkdirSync(CHATS_DIR, { recursive: true });
    fs.appendFileSync(chatFile(projectId), JSON.stringify(msg) + '\n');
  } catch (e) {
    console.error('[manager] falhou a escrita do chat:', e instanceof Error ? e.message : e);
  }
  try { managerBroadcaster?.(projectId, msg); } catch { /* already persisted */ }
  return msg;
}

export function clearChat(projectId: string): void {
  try { fs.rmSync(chatFile(projectId), { force: true }); } catch { /* nothing to clear */ }
  const all = loadAllState();
  if (all[projectId]) {
    // Dropping the SDK session id is what makes the next turn start a fresh conversation.
    all[projectId] = { ...all[projectId], sdkSessionId: undefined, autoWakeCount: 0 };
    writeJsonFile(STATE_FILE, all);
  }
}

export function rotateChat(projectId: string): void {
  try {
    const file = chatFile(projectId);
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
    if (lines.length <= MAX_LINES) return;
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, lines.slice(-Math.floor(MAX_LINES / 2)).join('\n') + '\n');
    fs.renameSync(tmp, file);
  } catch { /* nothing to rotate */ }
}

// ── State ─────────────────────────────────────────────────────────────────────
function loadAllState(): Record<string, ManagerState> {
  return readJsonFile<Record<string, ManagerState>>(STATE_FILE, {});
}

export function getState(projectId: string): ManagerState {
  return loadAllState()[projectId] ?? { projectId, autoWakeCount: 0 };
}

export function patchState(projectId: string, patch: Partial<ManagerState>): ManagerState {
  const all = loadAllState();
  const next: ManagerState = { ...(all[projectId] ?? { projectId, autoWakeCount: 0 }), ...patch, projectId };
  all[projectId] = next;
  writeJsonFile(STATE_FILE, all);
  if (patch.busy !== undefined) {
    try { managerBusyBroadcaster?.(projectId, patch.busy); } catch { /* ignore */ }
  }
  return next;
}

// Busy flags are in-memory-truthy but persisted; a crash mid-turn would leave them stuck, so the
// server clears them on boot.
export function clearAllBusy(): void {
  const all = loadAllState();
  let touched = false;
  for (const id of Object.keys(all)) {
    if (all[id].busy) { all[id] = { ...all[id], busy: false }; touched = true; }
  }
  if (touched) writeJsonFile(STATE_FILE, all);
}
