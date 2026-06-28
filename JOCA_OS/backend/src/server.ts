import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { isAllowedOrigin, requireSafeOrigin } from './security-fs';
import { JOCA_LOGIC_ROOT, collectToolkitItems } from './toolkit-registry';
import { sessionManager } from './session-manager';
import type { Session } from './session-manager';
import { startScheduler } from './automations/scheduler';
import { broadcast } from './ws/broadcast';
import { attachConnectionHandler } from './ws/connection-handler';
import { projectsRouter } from './http/projects-routes';
import { toolkitRouter } from './http/toolkit-routes';
import { filesRouter } from './http/files-routes';
import { masterRouter } from './http/master-routes';
import { automationsRouter, automationDeps } from './http/automations-routes';

// Forward SessionManager lifecycle events to the WS broadcast — identical message shapes to v1.
// ('done' is consumed by the Master; it is NOT broadcast, so the UI is unchanged.)
// 'spawn' is the single broadcast source for session_created — covers both UI-created sessions
// and workers the Master spawns programmatically (MCP spawn_worker), so workers show in the UI.
sessionManager.on('spawn', ({ session }: { session: Session }) => {
  broadcast({ type: 'session_created', session: sessionManager.info(session) });
});
sessionManager.on('output', ({ sessionId, data }: { sessionId: string; data: string }) => {
  broadcast({ type: 'output', sessionId, data });
});
sessionManager.on('status', ({ sessionId, status, isDone }: { sessionId: string; status: 'working' | 'idle'; isDone?: boolean }) => {
  broadcast(status === 'idle'
    ? { type: 'session_status', sessionId, status, isDone }
    : { type: 'session_status', sessionId, status });
});
sessionManager.on('closed', ({ sessionId }: { sessionId: string }) => {
  broadcast({ type: 'session_closed', sessionId });
});

const app = express();
app.use(requireSafeOrigin);
const server = createServer(app);
const wss = new WebSocketServer({
  server,
  path: '/ws',
  verifyClient: (info: { origin?: string }) => isAllowedOrigin(info.origin),
});

// HTTP routes, grouped by domain (see backend/src/http/*).
app.use(projectsRouter());
app.use(toolkitRouter());
app.use(masterRouter());
app.use(automationsRouter());
app.use(filesRouter());

// JSON error handler — must precede static + catch-all to intercept errors from API routes
// before the SPA fallback swallows them. 5xx responses use a generic message to avoid leaking
// internal paths or stack info to the client (full err logged server-side).
app.use((err: Error & { status?: number; type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  const message = status >= 500 ? 'Internal error' : (err.message || 'Error');
  res.status(status).json({ error: message });
});

app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

attachConnectionHandler(wss);

const PORT = Number(process.env.PORT || 7491);
server.listen(PORT, '127.0.0.1', () => {
  const logicConnected = fs.existsSync(path.join(JOCA_LOGIC_ROOT, '.claude'));
  console.log(`JOCA_OS → http://localhost:${PORT}`);
  console.log(`JOCA_Brain → ${JOCA_LOGIC_ROOT} (${logicConnected ? 'connected' : 'not found'})`);
  if (logicConnected) {
    const items = collectToolkitItems();
    console.log(`  Skills: ${items.skills.length} · Agents: ${items.agents.length} · Commands: ${items.commands.length}`);
  }
  startScheduler(automationDeps);
});
