// Sessions over HTTP — the terminal-facing half of the agent bridge.
//
// The browser drives terminals over the WebSocket; agents inside a PTY cannot. These routes expose
// the same SessionManager operations over plain HTTP so an agent (through the `joca` CLI) can list
// terminals, open a new one on any CLI, send a message to a sibling terminal and read its output —
// all against the RUNNING JOCA_OS, with no restart.
//
// Every mutation still flows through the SessionManager, so the WS broadcasts fire exactly as if
// the browser had done it: a terminal opened by an agent shows up in the UI immediately.
import express, { Router, type Request } from 'express';
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

// Who is calling. A PTY identifies itself with the id of its own session (the `joca` CLI sends the
// header from JOCA_SESSION_ID); the browser and the manager send nothing and stay unrestricted.
//
// The header is a CLAIM, not a credential — it can only ever NARROW what the caller sees, never
// widen it, so forging it grants nothing that dropping it would not already grant.
const CALLER_HEADER = 'x-joca-session';

function callerScope(req: Request): { sessionId: string; projectId?: string } | undefined {
  const raw = req.headers[CALLER_HEADER];
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (!id) return undefined;
  const s = sessionManager.get(id);
  return s ? { sessionId: s.id, projectId: s.projectId } : undefined;
}

// An agent that belongs to a project only talks to agents of the SAME project. Enforced here (not
// only in the CLI) because the CLI is just one client — the rule has to hold on the wire.
// Returns the refusal message, or undefined when the call is allowed.
function crossProjectDenial(req: Request, targetId: string): string | undefined {
  const caller = callerScope(req);
  if (!caller?.projectId) return undefined;          // humano, Joca, ou terminal sem projecto
  if (targetId === caller.sessionId) return undefined;
  const target = sessionManager.get(targetId);
  if (!target) return undefined;                     // deixa a rota devolver o 404 dela
  if (target.projectId === caller.projectId) return undefined;
  return 'esse terminal é de outro projecto — só podes falar com terminais do teu projecto';
}

export function sessionsRouter(): Router {
  const r = Router();

  // Listing doubles as DISCOVERY for agents: besides the terminal itself, each entry carries the
  // talking to without opening every buffer.
  // talking to without opening every buffer.
  r.get('/sessions', (req, res) => {
    const caller = callerScope(req);
    const projects = loadProjects();
    const visible = sessionManager.listInfo()
      .filter((s) => !caller?.projectId || s.projectId === caller.projectId);
    res.json(visible.map((s) => {
      return {
        ...s,
        cap: MAX_SESSIONS,
        projectName: s.projectId ? projects.find((p) => p.id === s.projectId)?.name : undefined,
      };
    }));
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
    const denial = crossProjectDenial(req, req.params.id);
    if (denial) return res.status(403).json({ error: denial });
    const ok = b.submit === false
      ? sessionManager.input(req.params.id, b.text)
      : sessionManager.submitMessage(req.params.id, b.text);
    if (!ok) return res.status(404).json({ error: 'sessão não encontrada' });
    res.json({ ok: true });
  });

  // Read a terminal's output. ANSI-stripped by default so an agent gets plain text.
  r.get('/sessions/:id/buffer', (req, res) => {
    const denial = crossProjectDenial(req, req.params.id);
    if (denial) return res.status(403).json({ error: denial });
    const raw = req.query.raw === '1';
    const buffer = sessionManager.readBuffer(req.params.id, { strip: !raw });
    if (buffer === undefined) return res.status(404).json({ error: 'sessão não encontrada' });
    const tail = Math.max(1, Math.min(Number(req.query.tail) || 4000, 200_000));
    res.json({ sessionId: req.params.id, text: buffer.slice(-tail), truncated: buffer.length > tail });
  });

  // Interromper e fechar são mais destrutivos que ler — valem a mesma fronteira de projecto.
  r.post('/sessions/:id/interrupt', (req, res) => {
    const denial = crossProjectDenial(req, req.params.id);
    if (denial) return res.status(403).json({ error: denial });
    res.json({ ok: sessionManager.interrupt(req.params.id) });
  });

  r.delete('/sessions/:id', (req, res) => {
    const denial = crossProjectDenial(req, req.params.id);
    if (denial) return res.status(403).json({ error: denial });
    res.json({ ok: sessionManager.kill(req.params.id) });
  });

  return r;
}
