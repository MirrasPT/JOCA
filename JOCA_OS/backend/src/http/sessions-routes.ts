// Sessions over HTTP — the terminal-facing half of the agent bridge.
//
// The browser drives terminals over the WebSocket; agents inside a PTY cannot. These routes expose
// the same SessionManager operations over plain HTTP so an agent (through the `joca` CLI) can list
// terminals, open a new one on any CLI, send a message to a sibling terminal and read its output —
// all against the RUNNING JOCA_OS, with no restart.
//
// Every mutation still flows through the SessionManager, so the WS broadcasts fire exactly as if
// the browser had done it: a terminal opened by an agent shows up in the UI immediately.
import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { sessionManager, MAX_SESSIONS } from '../session-manager';
import { safePath } from '../security-fs';
import { HOME } from './helpers';
import { loadProjects } from '../project-store';

// Resolve a project by id OR by (case-insensitive) name — agents think in names, not uuids.
function resolveProject(ref: string | undefined) {
  if (!ref) return undefined;
  const projects = loadProjects();
  return projects.find((p) => p.id === ref)
    ?? projects.find((p) => p.name.toLowerCase() === ref.toLowerCase());
}

export function sessionsRouter(): Router {
  const r = Router();

  r.get('/sessions', (_req, res) => {
    res.json(sessionManager.listInfo().map((s) => ({ ...s, cap: MAX_SESSIONS })));
  });

  // Open a terminal. `project` accepts an id or a name; `cli` picks claude|codex|agy|opencode.
  r.post('/sessions', express.json({ limit: '1mb' }), (req, res) => {
    const b = (req.body ?? {}) as {
      name?: unknown; cli?: unknown; model?: unknown; project?: unknown; cwd?: unknown; prompt?: unknown;
    };
    if (sessionManager.size >= MAX_SESSIONS) {
      return res.status(429).json({ error: `limite de ${MAX_SESSIONS} sessões atingido` });
    }
    const project = resolveProject(typeof b.project === 'string' ? b.project : undefined);

    let cwd: string | undefined;
    if (typeof b.cwd === 'string' && b.cwd.trim()) {
      try {
        const raw = b.cwd.trim();
        if (raw.startsWith('~') && raw.length > 1 && raw[1] !== '/') {
          return res.status(400).json({ error: 'só ~/caminho é suportado' });
        }
        const resolved = safePath(raw.startsWith('~') ? path.join(HOME, raw.slice(1)) : raw);
        if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
          return res.status(400).json({ error: 'cwd tem de ser uma pasta existente' });
        }
        cwd = resolved;
      } catch {
        return res.status(400).json({ error: 'cwd inválido' });
      }
    }

    const session = sessionManager.spawn({
      cwd,
      resumePath: project?.path,
      projectId: project?.id,
      sessionName: typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 80) : undefined,
      cli: typeof b.cli === 'string' ? b.cli : undefined,
      model: typeof b.model === 'string' ? b.model : undefined,
      initialInput: typeof b.prompt === 'string' && b.prompt.trim() ? b.prompt : undefined,
      origin: 'auto',
    });
    res.json(sessionManager.info(session));
  });

  // Send a message into a terminal (paced/chunked submit — same path the UI uses).
  r.post('/sessions/:id/input', express.json({ limit: '2mb' }), (req, res) => {
    const b = (req.body ?? {}) as { text?: unknown; submit?: unknown };
    if (typeof b.text !== 'string' || !b.text) return res.status(400).json({ error: 'text obrigatorio' });
    const ok = b.submit === false
      ? sessionManager.input(req.params.id, b.text)
      : sessionManager.submitMessage(req.params.id, b.text);
    if (!ok) return res.status(404).json({ error: 'sessão não encontrada' });
    res.json({ ok: true });
  });

  // Read a terminal's output. ANSI-stripped by default so an agent gets plain text.
  r.get('/sessions/:id/buffer', (req, res) => {
    const raw = req.query.raw === '1';
    const buffer = sessionManager.readBuffer(req.params.id, { strip: !raw });
    if (buffer === undefined) return res.status(404).json({ error: 'sessão não encontrada' });
    const tail = Math.max(1, Math.min(Number(req.query.tail) || 4000, 200_000));
    res.json({ sessionId: req.params.id, text: buffer.slice(-tail), truncated: buffer.length > tail });
  });

  r.post('/sessions/:id/interrupt', (req, res) => {
    res.json({ ok: sessionManager.interrupt(req.params.id) });
  });

  r.delete('/sessions/:id', (req, res) => {
    res.json({ ok: sessionManager.kill(req.params.id) });
  });

  return r;
}
