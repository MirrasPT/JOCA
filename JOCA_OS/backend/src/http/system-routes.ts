// System routes — the persistent-inbox / run-history / multi-CLI surface.
//   /notifications  → persistent inbox (survives closed tabs; unread state)
//   /runs           → append-only execution history with SDK cost (runs.jsonl)
//   /cli-profiles   → the CLIs a session/automation can run on, with availability
import express, { Router } from 'express';
import {
  loadNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, unreadCount,
  pushNotification,
} from '../notifications/store';
import { listRuns, runStats, type RunKind } from '../runs/store';
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
    const kind = b.kind === 'automation' ? b.kind : 'system';
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
    const kind = ['automation'].includes(String(req.query.kind))
      ? (String(req.query.kind) as RunKind) : undefined;
    const refId = typeof req.query.refId === 'string' ? req.query.refId : undefined;
    res.json(listRuns({ limit, kind, refId }));
  });

  r.get('/runs/stats', (req, res) => {
    const days = Math.max(1, Math.min(Number(req.query.days) || 30, 365));
    res.json(runStats(days));
  });

  // ── Multi-CLI profiles ─────────────────────────────────────────────────────
  r.get('/cli-profiles', async (_req, res) => {
    const profiles = loadCliProfiles();
    const availability = await Promise.all(CLI_IDS.map((id) => binExists(profiles[id].bin)));
    res.json(CLI_IDS.map((id: CliId, i) => ({
      id, label: profiles[id].label, bin: profiles[id].bin, available: availability[i],
      startupSequence: profiles[id].startupSequence,
      // O botão "Resume" da barra de comandos remonta o mesmo comando do arranque, e a forma dele
      // muda por CLI (`/resume` no claude, `resume` nos outros) e é sobreponível em
      // cli-profiles.json — por isso vai daqui em vez de estar escrito à mão no frontend.
      resumeCmd: profiles[id].resumeCmd,
    })));
  });

  return r;
}
