// Standalone stdio MCP server that bridges Codex → the JOCA backend's Master tools.
//
// Codex (running on the ChatGPT subscription) spawns THIS file as an MCP server. The 7 Master tools
// (spawn_worker, send_to_worker, read_worker, list_workers, create_project, search_memory,
// read_diary) live in the backend process (they drive the in-process SessionManager), so each tool
// call here just forwards to the backend's HTTP control plane:
//   GET  /master/tools-schema  → the tool list (name/description/jsonSchema), fetched once at startup
//   POST /master/tool {name,args} → runs the real handler, returns {text}
// Auth: a shared secret read from DATA_DIR/master-bridge.secret (same file the backend uses).
//
// Plain ESM, run by node directly (NOT compiled by tsc). Deps resolved from backend/node_modules.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)); // backend/src/master
const URL_BASE = process.argv[2] || 'http://127.0.0.1:7391';
// argv[3] = the EXACT secret-file path from bridge-config (= DATA_DIR/master-bridge.secret, the
// single source of truth). Do NOT recompute it from `here` with ../../ — that resolved to
// backend/data while the backend writes the secret to JOCA_OS/data, so the read threw, the bridge
// died, and codex ran with zero tools (it then did the work itself in the background instead of
// opening JOCA UI workers). Fall back to the legacy relative path only if argv[3] is absent.
// Fallback (argv[3] absent): here = backend/src/master → ../../../data = JOCA_OS/data (where the
// backend's DATA_DIR actually writes the secret). The old ../../data resolved to backend/data — wrong.
const SECRET_FILE = process.argv[3] || path.join(here, '..', '..', '..', 'data', 'master-bridge.secret');
let SECRET;
try {
  SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();
} catch (e) {
  process.stderr.write(`[joca-master-bridge] cannot read secret at ${SECRET_FILE}: ${e?.message ?? e}\n`);
  process.exit(1);
}
const headers = { 'content-type': 'application/json', 'x-joca-master': SECRET };

// Fetch the tool catalog from the backend (single source of truth — same defs the Claude/Ollama
// paths use). If this fails the bridge exits non-zero and codex reports no tools (fail loud).
const defs = await (await fetch(`${URL_BASE}/master/tools-schema`, { headers })).json();

const server = new Server({ name: 'joca-master', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: defs.map((d) => ({ name: d.name, description: d.description, inputSchema: d.jsonSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const r = await fetch(`${URL_BASE}/master/tool`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: req.params.name, args: req.params.arguments ?? {} }),
  });
  let data = {};
  try { data = await r.json(); } catch { /* non-json */ }
  const text = r.ok ? (data.text ?? '') : `erro: ${data.error ?? r.status}`;
  return { content: [{ type: 'text', text }] };
});

await server.connect(new StdioServerTransport());
