// Shared config for the Codex (and future agy) MCP bridge.
//
// The Master tools operate on the in-process SessionManager. Codex spawns its MCP server as a
// SEPARATE child process, so that child reaches back into this backend over HTTP (the control
// endpoints POST /master/tool + GET /master/tools-schema). A shared secret (stored in a gitignored
// file under DATA_DIR, stable across reboots) authenticates the bridge → backend calls; the bridge
// reads the same file by path, so the secret never travels on the command line / process list.
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../project-store';

export const MASTER_SECRET_FILE = path.join(DATA_DIR, 'master-bridge.secret');

function loadOrCreateSecret(): string {
  try {
    const s = fs.readFileSync(MASTER_SECRET_FILE, 'utf8').trim();
    if (s) return s;
  } catch { /* not created yet */ }
  const s = randomUUID();
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(MASTER_SECRET_FILE, s);
  } catch { /* best effort; the bridge will fail loudly if it can't read it */ }
  return s;
}

export const MASTER_BRIDGE_SECRET = loadOrCreateSecret();
export const MASTER_BACKEND_URL = `http://127.0.0.1:${process.env.PORT || 7491}`;
export const NODE_BIN = process.execPath; // the same node that runs the backend
// The bridge is a standalone .mjs (not compiled). From dist/master → ../../src/master.
export const CODEX_BRIDGE_PATH = path.join(__dirname, '..', '..', 'src', 'master', 'codex-master-bridge.mjs');
