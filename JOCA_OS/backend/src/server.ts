import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { isAllowedOrigin, isAllowedHost, requireSafeHost, requireSafeOrigin } from './security-fs';
import { JOCA_LOGIC_ROOT, collectToolkitItems } from './toolkit-registry';
import { sessionManager } from './session-manager';
import type { Session } from './session-manager';
import { broadcast } from './ws/broadcast';
import { attachConnectionHandler } from './ws/connection-handler';
import { projectsRouter } from './http/projects-routes';
import { projectGroupsRouter } from './http/project-groups-routes';
import { toolkitRouter } from './http/toolkit-routes';
import { filesRouter } from './http/files-routes';
import { systemRouter } from './http/system-routes';
import { sessionsRouter } from './http/sessions-routes';
import { setApiPort, JOCA_CLI_PATH } from './agent-bridge';
import { setNotificationsBroadcaster } from './notifications/store';
import { installSessionsSnapshot } from './sessions-snapshot';
import { authRouter, requireAuth, authEnabled, isAuthenticated } from './auth';

// Forward SessionManager lifecycle events to the WS broadcast — identical message shapes to v1.
// ('done' is not broadcast.)
// 'spawn' is the single broadcast source for session_created — covers both UI-created sessions
// and workers spawned programmatically, so workers show in the UI.
sessionManager.on('spawn', ({ session, requestedBy }: { session: Session; requestedBy?: string }) => {
  // `requestedBy` comes back verbatim: it is what lets the client that asked jump to the new
  // terminal without dragging the others along with it.
  broadcast({ type: 'session_created', session: sessionManager.info(session), requestedBy });
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

// Periodic snapshot of the live sessions in `data/sessions-snapshot.json`, plus the flush on
// SIGTERM/SIGINT. When this process dies, the PTYs die with it — this is what lets the next
// instance tell the owner what was open, instead of the list showing up empty with no
// explanation. Installed AFTER the broadcasts so they do not get in front of them.
installSessionsSnapshot();

// New persistent notifications reach connected clients live; offline clients pick them up from the
// inbox (GET /notifications) on reconnect.
setNotificationsBroadcaster((n) => broadcast({ type: 'notification', notification: n }));

/**
 * Safety net: a socket failure cannot kill the whole server.
 *
 * EPIPE/ECONNRESET/ECONNABORTED happen when the other side disappears — a PTY that died, a
 * browser that closed mid-response, an SDK subprocess that exited. They are normal and local.
 * Without this guard, Node treats them as a fatal exception and takes the backend down with ALL the
 * sessions, and the queues behind them — one badly started worker wiped out the whole of JOCA.
 *
 * Deliberately narrow: only these three codes. Any other uncaught exception still takes the
 * process down, which is what should happen to a real bug — swallowing everything here would be
 * hiding problems instead of solving them.
 */
const SOCKET_NOISE = new Set(['EPIPE', 'ECONNRESET', 'ECONNABORTED']);
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  if (err && SOCKET_NOISE.has(err.code ?? '')) {
    console.warn(`[socket] ${err.code} ignored: ${err.message}`);
    return;
  }
  throw err;
});

const app = express();
app.use(requireSafeHost);     // before everything: blocks DNS rebinding, on reads as well as writes
app.use(requireSafeOrigin);
const server = createServer(app);
const wss = new WebSocketServer({
  server,
  path: '/ws',
  // Auth + origin, both pre-handshake: a WS from a non-allowed origin OR without a valid session
  // token (when auth is on; the httpOnly cookie rides the upgrade request) is rejected with 401.
  verifyClient: (info: { origin?: string; req: { headers: import('http').IncomingMessage['headers'] } }) =>
    isAllowedHost(info.req.headers.host)
    && isAllowedOrigin(info.origin, info.req.headers.host)
    && isAuthenticated(info.req),
});

// Auth first (public: /auth/login, /auth/status, /auth/set-password handles its own gate), then the
// API routers behind requireAuth. The static SPA shell stays public — it contains no data.
app.use(authRouter());
app.use(requireAuth, projectsRouter());
app.use(requireAuth, projectGroupsRouter());
app.use(requireAuth, toolkitRouter());
app.use(requireAuth, systemRouter());
app.use(requireAuth, sessionsRouter());
app.use(requireAuth, filesRouter());

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
// Remote (VPS) binding is opt-in via JOCA_HOST and HARD-GATED on auth being configured — never
// expose an unauthenticated JOCA_OS beyond loopback (the OpenClaw lesson: 30k+ exposed instances).
const HOST = process.env.JOCA_HOST || '127.0.0.1';
const isLoopback = HOST === '127.0.0.1' || HOST === 'localhost' || HOST === '::1';
if (!isLoopback && !authEnabled()) {
  console.error(`✗ JOCA_HOST=${HOST} requires authentication configured.`);
  console.error('  Set JOCA_PASSWORD=<strong password> (or configure the password in the local UI before deploying).');
  console.error('  On a VPS, TLS via reverse proxy (Caddy/nginx) or a private network (Tailscale) is also recommended.');
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  const logicConnected = fs.existsSync(path.join(JOCA_LOGIC_ROOT, '.claude'));
  // Terminals reach the API on the port we actually bound to (PORT may be overridden).
  setApiPort(PORT);
  console.log(`JOCA_OS → http://${isLoopback ? 'localhost' : HOST}:${PORT}${authEnabled() ? ' (auth ON)' : ''}`);
  console.log(`Agent bridge → ${fs.existsSync(JOCA_CLI_PATH) ? 'node "$JOCA_CLI" help' : 'cli/joca.mjs missing'}`);
  console.log(`JOCA_Brain → ${JOCA_LOGIC_ROOT} (${logicConnected ? 'connected' : 'not found'})`);
  if (logicConnected) {
    const items = collectToolkitItems();
    console.log(`  Skills: ${items.skills.length} · Agents: ${items.agents.length} · Commands: ${items.commands.length}`);
  }
  // No terminal is born on its own: projects open EMPTY and the one who opens terminals is the owner.
});
