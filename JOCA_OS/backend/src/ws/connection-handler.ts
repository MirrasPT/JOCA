import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { safePath } from '../security-fs';
import { appendMasterChat, loadUiSettings } from '../project-store';
import { sessionManager, MAX_SESSIONS } from '../session-manager';
import { runMaster } from '../master/orchestrator';
import { resetWorkerAutoCounts } from '../master/worker-watch';
import { HOME } from '../http/helpers';
import { addClient, removeClient, broadcast, send } from './broadcast';

interface ClientMessage {
  type: 'create_session' | 'close_session' | 'input' | 'resize' | 'get_buffer' | 'rename_session' | 'interrupt_session' | 'master_message';
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
  text?: string;   // master_message: the user's NL instruction to the Master
  model?: string;  // master_message: optional brain model override
}

// Wire up the WebSocket lifecycle: new connection → register client + send sessions snapshot, then
// route each ClientMessage to the SessionManager / Master. Identical message shapes to v1.
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

          case 'master_message': {
            // Fase 1a: NL instruction → Master brain orchestrates visible workers. Streams steps
            // back to THIS client only (orchestration state is per-conversation, not broadcast).
            const text = (msg.text ?? '').trim();
            if (!text) { send(ws, { type: 'error', error: 'master_message needs text' }); break; }
            // Fresh user intent → refill each worker's auto-continuation budget (worker-watch).
            resetWorkerAutoCounts();
            // Persist the user turn so the chat survives reloads/restarts (see GET /master-chat).
            appendMasterChat({ id: randomUUID(), role: 'user', text, ts: Date.now() });
            // Fire-and-forget; steps stream via onStep. Errors surface as a master_error message.
            // Provider + model come from Settings (overridable per-message via msg.model).
            const uiSettings = loadUiSettings();
            void runMaster(text, {
              provider: uiSettings.masterProvider ?? 'claude',
              model: msg.model ?? uiSettings.masterModel,
              onStep: (step) => {
                if (step.type === 'message') send(ws, { type: 'master_message', text: step.text });
                else if (step.type === 'step') send(ws, { type: 'orchestration_step', tool: step.tool, input: step.input });
                else if (step.type === 'done') {
                  send(ws, { type: 'worker_summary', summary: step.summary, isError: step.isError, costUsd: step.costUsd, auto: false, continued: step.continued });
                  appendMasterChat({ id: randomUUID(), role: 'summary', text: step.summary, isError: step.isError, costUsd: step.costUsd, ts: Date.now() });
                }
              },
              // Master created/registered a project → tell all clients to refresh their project list.
              onProjectsChanged: () => broadcast({ type: 'projects_changed' }),
            }).catch((e) => {
              console.error('Master error:', e);
              const errText = e instanceof Error ? e.message : String(e);
              send(ws, { type: 'master_error', error: errText });
              appendMasterChat({ id: randomUUID(), role: 'error', text: errText, ts: Date.now() });
            });
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
