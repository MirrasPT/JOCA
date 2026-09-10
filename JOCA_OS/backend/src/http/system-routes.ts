// System routes — the persistent-inbox / multi-CLI surface.
//   /notifications  → persistent inbox (survives closed tabs; unread state)
//   /cli-profiles   → the CLIs a session can run on, with availability
import express, { Router } from 'express';
import {
  loadNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, unreadCount,
  pushNotification,
} from '../notifications/store';
import { loadCliProfiles, CLI_IDS, type CliId } from '../cli-profiles';
import { binExists } from '../providers/provider';
import { execFile } from 'child_process';

// ── Native folder picker: the per-platform command ───────────────────────────
// Pure + exported function so it is testable outside Windows (no Windows machine here
// can be reproduced; what is tested is the SHAPE of the command).
//
// Windows — the previous script failed silently for three reasons, all fixed here:
//  1. `ShowDialog()` with NO owner window. The dialog is born inside a tree of background
//     processes (`JOCA OS.vbs` runs `start.bat` with window style 0 → `start /b "" cmd /c` →
//     node → powershell), which never had the foreground. Windows does not let a process
//     in those conditions steal the foreground: the window opens BEHIND the browser or just
//     blinks in the taskbar — to the user, "the button does nothing". An owner window that is
//     `TopMost`, activated beforehand, and passed to `ShowDialog($owner)`, forces it to the front.
//  2. The script carried DOUBLE quotes inside it. On the Windows command line Node has to
//     escape them (`\"`) and the re-parsing powershell.exe does of its own command line
//     is well-known breaking ground. Here it is all single quotes: zero double quotes, zero escaping.
//  3. `RootFolder` stayed on the default (Desktop). On Windows there is no single root — the top
//     level is the drives. `MyComputer` puts C:\, D:\, G:\… at the head of the tree.
// See also point 4 in the handler: canceling (1) stopped being indistinguishable from blowing up (2).
const WINDOWS_PICKER_BODY = [
  `Add-Type -AssemblyName System.Windows.Forms`,
  `$owner=New-Object System.Windows.Forms.Form`,
  `$owner.StartPosition='Manual'`,
  `$owner.Left=-4000`,
  `$owner.Top=-4000`,
  `$owner.Width=1`,
  `$owner.Height=1`,
  `$owner.ShowInTaskbar=$false`,
  `$owner.TopMost=$true`,
  `$owner.Show()`,
  `$owner.Activate()`,
  `$d=New-Object System.Windows.Forms.FolderBrowserDialog`,
  `$d.Description='Choose the project folder'`,
  `$d.RootFolder=[System.Environment+SpecialFolder]::MyComputer`,
  `$d.ShowNewFolderButton=$true`,
  `$r=$d.ShowDialog($owner)`,
  `$owner.Close()`,
  `if($r -eq [System.Windows.Forms.DialogResult]::OK -and $d.SelectedPath){[Console]::Out.Write($d.SelectedPath);exit 0}`,
  `exit 1`,
].join('; ');

export const WINDOWS_PICKER_PS =
  `$ErrorActionPreference='Stop'; try{ ${WINDOWS_PICKER_BODY} }catch{ [Console]::Error.Write($_.Exception.Message); exit 2 }`;

export type FolderPickerSpec = { cmd: string; args: string[]; trimTrailingSlash: boolean };

export function folderPickerCommand(platform: NodeJS.Platform = process.platform): FolderPickerSpec {
  if (platform === 'win32') {
    return {
      cmd: 'powershell.exe',
      args: ['-NoProfile', '-STA', '-Command', WINDOWS_PICKER_PS],
      // On Windows the path can BE the root of a drive (`C:\`) — cutting the trailing slash
      // turned it into `C:` (a path relative to that drive's current directory).
      trimTrailingSlash: false,
    };
  }
  if (platform === 'darwin') {
    return {
      cmd: 'osascript',
      args: ['-e', 'POSIX path of (choose folder with prompt "Choose the project folder")'],
      trimTrailingSlash: true,
    };
  }
  // Linux: zenity when it exists; without it, the modal falls back to the manual field.
  return {
    cmd: 'zenity',
    args: ['--file-selection', '--directory', '--title=Choose the project folder'],
    trimTrailingSlash: true,
  };
}

export function systemRouter(): Router {
  const r = Router();

  // ── Native folder picker ───────────────────────────────────────────────────
  // JOCA runs on the owner's machine — the backend CAN open the native choose-folder dialog
  // (Finder/Explorer) and return the absolute path, something the browser alone cannot do
  // (webkitdirectory only gives relative paths). Used by the create/edit project modal.
  // Serialized: one dialog at a time — two requests in a row do not open two windows.
  let pickerBusy = false;
  r.post('/pick-folder', (_req, res) => {
    if (pickerBusy) return res.status(409).json({ error: 'there is already a folder picker open' });
    pickerBusy = true;
    const done = (status: number, body: object) => { pickerBusy = false; res.status(status).json(body); };
    const timeoutMs = 5 * 60_000; // the owner may take a while to choose — do not cut it short
    const spec = folderPickerCommand();
    execFile(spec.cmd, spec.args, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        const code = (err as { code?: number | string }).code;
        // 4. A REAL failure stops disguising itself as "I canceled". Before, any picker error
        //    (missing binary, WinForms unavailable, non-STA thread, PowerShell policy)
        //    returned 200 {canceled:true} — the user clicked and nothing happened,
        //    with no error at all on screen. Now only the cancellation is silent.
        if (code === 'ENOENT') {
          return done(500, { error: `folder picker unavailable: ${spec.cmd} not found` });
        }
        if (code === 2) { // Windows script convention: 2 = blew up, 1 = canceled
          const why = (stderr || '').trim().slice(0, 300) || 'unknown error in the picker';
          return done(500, { error: `folder picker failed: ${why}` });
        }
        return done(200, { canceled: true }); // canceling exits with code ≠ 0 in every picker
      }
      const raw = stdout.trim();
      const p = spec.trimTrailingSlash ? raw.replace(/\/$/, '') : raw;
      done(200, p ? { path: p } : { canceled: true });
    });
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
    if (typeof b.text !== 'string' || !b.text.trim()) return res.status(400).json({ error: 'text required' });
    res.json(pushNotification({
      kind: 'system',
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


  // ── Multi-CLI profiles ─────────────────────────────────────────────────────
  r.get('/cli-profiles', async (_req, res) => {
    const profiles = loadCliProfiles();
    const availability = await Promise.all(CLI_IDS.map((id) => binExists(profiles[id].bin)));
    res.json(CLI_IDS.map((id: CliId, i) => ({
      id, label: profiles[id].label, bin: profiles[id].bin, available: availability[i],
      startupSequence: profiles[id].startupSequence,
      // The command bar's "Resume" button reassembles the same startup command, and its shape
      // changes per CLI (`/resume` on claude, `resume` on the others) and is overridable in
      // cli-profiles.json — which is why it goes from here instead of being hand-written in the frontend.
      resumeCmd: profiles[id].resumeCmd,
    })));
  });

  return r;
}
