import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import { safePath } from '../security-fs';
import { sessionManager, MAX_SESSIONS } from '../session-manager';
import { HOME } from '../http/helpers';
import { addClient, removeClient, broadcast, send } from './broadcast';

interface ClientMessage {
  type: 'create_session' | 'close_session' | 'input' | 'resize' | 'get_buffer' | 'rename_session' | 'interrupt_session';
  sessionId?: string;
  cwd?: string;
  resumePath?: string;
  sessionName?: string;
  projectId?: string;
  initialInput?: string;
  data?: string;
  name?: string;
  cols?: number;
  rows?: number;
}

// Wire up the WebSocket lifecycle: new connection → register client + send sessions snapshot, then
// route each ClientMessage to the SessionManager. Identical message shapes to v1.
export function attachConnectionHandler(wss: WebSocketServer) {
  wss.on('connection', (ws) => {
    addClient(ws);

    send(ws, {
      type: 'sessions_list',
      sessions: sessionManager.listInfo(),
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;

        switch (msg.type) {
          case 'create_session': {
            if (sessionManager.size >= MAX_SESSIONS) {
              send(ws, { type: 'error', error: `Max ${MAX_SESSIONS} concurrent sessions reached` });
              break;
            }
            let safeCwd: string | undefined = undefined;
            if (typeof msg.cwd === 'string' && msg.cwd.trim()) {
              try {
                const rawCwd = msg.cwd.trim();
                // Reject ~user/... (other users' homes) — only ~/path is supported.
                if (rawCwd.startsWith('~') && rawCwd.length > 1 && rawCwd[1] !== '/') {
                  send(ws, { type: 'error', error: 'Only ~/path tilde expansion is supported' });
                  break;
                }
                const expanded = rawCwd.startsWith('~') ? path.join(HOME, rawCwd.slice(1)) : rawCwd;
                // safePath resolves symlinks AND blocks sensitive dirs, matching all other file APIs.
                const resolved = safePath(expanded);
                if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
                  safeCwd = resolved;
                } else {
                  send(ws, { type: 'error', error: 'Invalid cwd — must be an existing directory inside your home' });
                  break;
                }
              } catch {
                send(ws, { type: 'error', error: 'Invalid cwd' });
                break;
              }
            }
            sessionManager.spawn({
              cwd: safeCwd,
              resumePath: msg.resumePath,
              sessionName: msg.sessionName,
              projectId: msg.projectId,
              initialInput: msg.initialInput,
            });
            // Broadcast is emitted by the SessionManager 'spawn' event subscriber in server.ts.
            break;
          }

          case 'close_session': {
            sessionManager.kill(msg.sessionId!);
            break;
          }

          case 'input': {
            if (msg.data !== undefined) sessionManager.input(msg.sessionId!, msg.data);
            break;
          }

          case 'interrupt_session': {
            sessionManager.interrupt(msg.sessionId!);
            break;
          }

          case 'resize': {
            if (msg.cols && msg.rows) sessionManager.resize(msg.sessionId!, msg.cols, msg.rows);
            break;
          }

          case 'get_buffer': {
            const buffer = sessionManager.getBuffer(msg.sessionId!);
            if (buffer !== undefined) send(ws, { type: 'buffer', sessionId: msg.sessionId, data: buffer });
            break;
          }

          case 'rename_session': {
            if (typeof msg.name === 'string') {
              const cleaned = sessionManager.rename(msg.sessionId!, msg.name);
              if (cleaned !== null) broadcast({ type: 'session_renamed', sessionId: msg.sessionId, name: cleaned });
            }
            break;
          }

        }
      } catch (e) {
        console.error('Message error:', e);
      }
    });

    ws.on('close', () => removeClient(ws));
  });
}
