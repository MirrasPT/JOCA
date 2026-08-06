// System routes — the new persistent-inbox / run-history / heartbeat / multi-CLI surface.
//   /notifications  → persistent inbox (survives closed tabs; unread state)
//   /runs           → append-only execution history with SDK cost (runs.jsonl)
//   /heartbeat      → proactivity loop config + manual beat
//   /cli-profiles   → the CLIs a session/task/automation can run on, with availability
import express, { Router } from 'express';
import {
  loadNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, unreadCount,
  pushNotification,
} from '../notifications/store';
import { listRuns, runStats, type RunKind } from '../runs/store';
import {
  loadHeartbeatConfig, saveHeartbeatConfig, runHeartbeat, clampMaxAutoWakes, DEFAULT_HEARTBEAT, type HeartbeatConfig,
} from '../heartbeat';
import { loadCliProfiles, CLI_IDS, type CliId } from '../cli-profiles';
import { binExists } from '../providers/provider';
import { execFile } from 'child_process';

export function systemRouter(): Router {
  const r = Router();

  // ── Native folder picker ───────────────────────────────────────────────────
  // O JOCA corre na máquina do dono — o backend PODE abrir o diálogo nativo de escolher pasta
  // (Finder/Explorer) e devolver o caminho absoluto, coisa que o browser sozinho não consegue
  // (webkitdirectory só dá caminhos relativos). Usado pelo modal de criar/editar projecto.
  // Serializado: um diálogo de cada vez — dois pedidos seguidos não abrem duas janelas.
  let pickerBusy = false;
  r.post('/pick-folder', (_req, res) => {
    if (pickerBusy) return res.status(409).json({ error: 'já há um selector de pasta aberto' });
    pickerBusy = true;
    const done = (status: number, body: object) => { pickerBusy = false; res.status(status).json(body); };
    const timeoutMs = 5 * 60_000; // o dono pode demorar a escolher — não cortar cedo
    if (process.platform === 'darwin') {
      execFile('osascript', ['-e', 'POSIX path of (choose folder with prompt "Escolhe a pasta do projecto")'],
        { timeout: timeoutMs }, (err, stdout) => {
          if (err) return done(200, { canceled: true }); // Cancelar no diálogo sai com código ≠0
          const p = stdout.trim().replace(/\/$/, '');
          done(200, p ? { path: p } : { canceled: true });
        });
    } else if (process.platform === 'win32') {
      const ps = 'Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = "Escolhe a pasta do projecto"; if ($d.ShowDialog() -eq "OK") { Write-Output $d.SelectedPath }';
      execFile('powershell.exe', ['-NoProfile', '-STA', '-Command', ps], { timeout: timeoutMs }, (err, stdout) => {
        if (err) return done(200, { canceled: true });
        const p = stdout.trim();
        done(200, p ? { path: p } : { canceled: true });
      });
    } else {
      // Linux: zenity quando existe; sem ele, o modal cai no campo manual.
      execFile('zenity', ['--file-selection', '--directory', '--title=Escolhe a pasta do projecto'],
        { timeout: timeoutMs }, (err, stdout) => {
          if (err) return done(200, { canceled: true });
          const p = stdout.trim();
          done(200, p ? { path: p } : { canceled: true });
        });
    }
  });

  // ── Notifications inbox ────────────────────────────────────────────────────
  r.get('/notifications', (req, res) => {
    const onlyUnread = req.query.unread === '1';
    const list = loadNotifications();
    res.json({
      unread: unreadCount(),
      notifications: (onlyUnread ? list.filter((n) => !n.read) : list).slice(-200).reverse(),
    });
  });

  // Push a notification into the inbox. Used by agents inside terminals (joca notify) to reach the
  // user when they finish something long-running.
  r.post('/notifications', express.json({ limit: '256kb' }), (req, res) => {
    const b = (req.body ?? {}) as { text?: unknown; title?: unknown; kind?: unknown };
    if (typeof b.text !== 'string' || !b.text.trim()) return res.status(400).json({ error: 'text obrigatorio' });
    const kind = b.kind === 'automation' || b.kind === 'task_question' || b.kind === 'heartbeat' ? b.kind : 'system';
    res.json(pushNotification({
      kind,
      title: typeof b.title === 'string' && b.title.trim() ? b.title : 'Terminal',
      text: b.text,
    }));
  });

  r.patch('/notifications/:id', express.json(), (req, res) => {
    const read = (req.body ?? {}).read !== false;
    const n = markNotificationRead(req.params.id, read);
    if (!n) return res.status(404).json({ error: 'not found' });
    res.json(n);
  });

  r.post('/notifications/read-all', (_req, res) => {
    res.json({ marked: markAllNotificationsRead() });
  });

  r.delete('/notifications/:id', (req, res) => {
    res.json({ ok: deleteNotification(req.params.id) });
  });

  // ── Run history + cost ─────────────────────────────────────────────────────
  r.get('/runs', (req, res) => {
    const limit = Number(req.query.limit) || 100;
    const kind = ['automation', 'task', 'heartbeat'].includes(String(req.query.kind))
      ? (String(req.query.kind) as RunKind) : undefined;
    const refId = typeof req.query.refId === 'string' ? req.query.refId : undefined;
    res.json(listRuns({ limit, kind, refId }));
  });

  r.get('/runs/stats', (req, res) => {
    const days = Math.max(1, Math.min(Number(req.query.days) || 30, 365));
    res.json(runStats(days));
  });

  // ── Heartbeat ──────────────────────────────────────────────────────────────
  r.get('/heartbeat', (_req, res) => res.json(loadHeartbeatConfig()));

  r.patch('/heartbeat', express.json({ limit: '256kb' }), (req, res) => {
    const cur = loadHeartbeatConfig();
    const b = (req.body ?? {}) as Partial<HeartbeatConfig>;
    const next: HeartbeatConfig = { ...cur };
    if (typeof b.enabled === 'boolean') next.enabled = b.enabled;
    if (typeof b.everyMinutes === 'number') next.everyMinutes = Math.max(5, Math.min(24 * 60, Math.floor(b.everyMinutes)));
    if ('activeHours' in b) {
      const ah = b.activeHours;
      next.activeHours = ah && typeof ah.start === 'string' && typeof ah.end === 'string'
        ? { start: ah.start.slice(0, 5), end: ah.end.slice(0, 5) }
        : null;
    }
    if (typeof b.model === 'string') next.model = b.model.trim().slice(0, 80) || DEFAULT_HEARTBEAT.model;
    // Orçamento de wakes automáticos por gestor. Sem esta linha só se mudava editando
    // `data/heartbeat.json` à mão. O clamp vive no módulo do heartbeat (chão 1, nunca 0: o travão
    // configura-se, não se desliga).
    if (b.maxAutoWakes !== undefined) next.maxAutoWakes = clampMaxAutoWakes(b.maxAutoWakes);
    if (typeof b.scratch === 'string') next.scratch = b.scratch;
    saveHeartbeatConfig(next);
    res.json(loadHeartbeatConfig());
  });

  // Manual beat ("testar agora") — forces the LLM call even with an empty scratch/quiet state.
  r.post('/heartbeat/run', (_req, res) => {
    runHeartbeat({ force: true })
      .then((out) => res.json(out))
      .catch((e) => res.status(500).json({ error: e instanceof Error ? e.message : String(e) }));
  });

  // ── Multi-CLI profiles ─────────────────────────────────────────────────────
  r.get('/cli-profiles', async (_req, res) => {
    const profiles = loadCliProfiles();
    const availability = await Promise.all(CLI_IDS.map((id) => binExists(profiles[id].bin)));
    res.json(CLI_IDS.map((id: CliId, i) => ({
      id, label: profiles[id].label, bin: profiles[id].bin, available: availability[i],
      startupSequence: profiles[id].startupSequence,
    })));
  });

  return r;
}
