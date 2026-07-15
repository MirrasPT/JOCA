import express, { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { execSync, execFileSync, spawn } from 'child_process';
import {
  ALLOWED_ROOTS, HttpError,
  isInside, realPathSafe, isInsideAllowedRoot, isSensitivePath,
  safePath, safePathForRead, assertHomePath,
} from '../security-fs';
import {
  HOME, IS_WINDOWS, DROP_DIR,
  OPEN_ALLOWED_EXTS, UPLOAD_ALLOWED_EXTS,
  safeDesktopFilename, safeRelSegments,
} from './helpers';

// File browser + file operations: read content, list dirs, drive roots, mutate (create/rename/
// move/delete/duplicate/write), git diff, OS open, and drag-drop upload.
export function filesRouter(): Router {
  const r = Router();

  r.get('/file-content', (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: 'Missing path' });
    let resolved: string;
    try { resolved = safePath(filePath); }
    catch { return res.status(403).json({ error: 'Forbidden' }); }
    try {
      const ext = path.extname(resolved).toLowerCase().slice(1);
      const mimeMap: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
        webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
        mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
        mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
        pdf: 'application/pdf', html: 'text/html', htm: 'text/html',
      };
      if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Not found' });
      if (fs.statSync(resolved).isDirectory()) return res.status(400).json({ error: 'Cannot read directory' });
      res.setHeader('Content-Type', mimeMap[ext] || 'text/plain; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Active-content protection:
      //   SVG: <img> ignores CSP (just rasterizes); direct nav is blocked by CSP sandbox.
      //   HTML: only sandbox CSP on top-level direct navigation (Sec-Fetch-Dest=document).
      //         When loaded by the FilePreview iframe (dest=iframe), browsers compose iframe.sandbox
      //         AND response CSP sandbox using the MORE restrictive — applying CSP sandbox there would
      //         strip `allow-scripts` and break the intended interactive preview.
      if (ext === 'svg') {
        res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'self' data:");
      } else if (ext === 'html' || ext === 'htm') {
        // Only `Sec-Fetch-Dest: empty` (XHR/fetch) is a safe render context. document/iframe/frame/
        // embed/object/worker are ALL active-render — cross-site iframe of /file-content would otherwise
        // load with same-origin to our backend API.
        const dest = req.headers['sec-fetch-dest'];
        if (dest !== 'empty') {
          res.setHeader('Content-Disposition', `attachment; filename="${path.basename(resolved).replace(/"/g, '')}"`);
        }
      }
      res.sendFile(resolved);
    } catch { res.status(400).json({ error: 'Read failed' }); }
  });

  r.post('/open', express.json(), (req, res) => {
    const { path: filePath } = req.body as { path: string };
    if (!filePath) return res.status(400).json({ error: 'Missing path' });
    let resolved: string;
    try { resolved = safePath(filePath); }
    catch { return res.status(403).json({ error: 'Forbidden' }); }
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Path does not exist' });
    const stat = fs.statSync(resolved);
    // Only regular files and directories are openable. FIFOs/sockets/device files cause `open` to
    // block indefinitely or trigger unintended kernel behavior.
    if (stat.isDirectory()) {
      // Finder window — safe.
    } else if (stat.isFile()) {
      const ext = path.extname(resolved).toLowerCase().slice(1);
      if (!OPEN_ALLOWED_EXTS.has(ext)) {
        return res.status(400).json({ error: 'File type not allowed for /open (only documents/media)' });
      }
      // Defense in depth: refuse any file with executable mode bits set, regardless of extension.
      if (stat.mode & 0o111) {
        return res.status(400).json({ error: 'Executable files cannot be opened' });
      }
    } else {
      return res.status(400).json({ error: 'Only regular files and directories can be opened' });
    }
    try {
      const openCmd = IS_WINDOWS ? 'explorer' : 'open';
      spawn(openCmd, [resolved], { detached: true, stdio: 'ignore' }).unref();
      res.json({ ok: true });
    } catch { res.status(500).json({ error: 'Open failed' }); }
  });

  r.get('/files', (req, res) => {
    const dirPath = (req.query.path as string) || HOME;
    // Accept both `hidden=true` (legacy) and `showHidden=true` (frontend convention).
    const showHidden = req.query.hidden === 'true' || req.query.showHidden === 'true';
    let resolved: string;
    try { resolved = safePathForRead(dirPath); }
    catch { return res.status(403).json({ error: 'Forbidden' }); }
    try {
      if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Not found' });
      if (!fs.statSync(resolved).isDirectory()) return res.status(400).json({ error: 'Not a directory' });
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      const result = entries
        .filter((e) => showHidden || !e.name.startsWith('.'))
        // Hide sensitive subdirs even when showHidden=true (e.g. .ssh, .aws).
        .filter((e) => !isSensitivePath(path.join(resolved, e.name)))
        .map((e) => ({ name: e.name, path: path.join(resolved, e.name), isDir: e.isDirectory() }))
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      // Expose parent === path (frontend hides the ".." entry) when at a filesystem root
      // or when going up would leave every allowed root. Otherwise navigation up is allowed.
      const up = path.dirname(resolved);
      const parent = (up === resolved || !isInsideAllowedRoot(up)) ? resolved : up;
      res.json({ path: resolved, parent, entries: result });
    } catch { res.status(400).json({ error: 'Read failed' }); }
  });

  // Roots the file browser may jump straight to: HOME plus every allowed drive/extra root.
  // Lets the UI offer a drive selector (C:\, D:\, ...) instead of forcing ".." navigation.
  r.get('/roots', (_req, res) => {
    const roots = ALLOWED_ROOTS.map((root) => ({
      path: root,
      label: root === path.resolve(HOME) ? '~' : root,
      isHome: root === path.resolve(HOME),
    }));
    res.json({ home: path.resolve(HOME), roots });
  });

  r.post('/file-op', express.json({ limit: '10mb' }), (req, res) => {
    try {
      const { action, path: sourcePath, targetPath, name, content } = req.body as {
        action: 'create_file' | 'create_folder' | 'rename' | 'delete' | 'move' | 'duplicate' | 'write_file';
        path?: string;
        targetPath?: string;
        name?: string;
        content?: string;
      };
      if (!action) return res.status(400).json({ error: 'Missing action' });

      if (action === 'create_file' || action === 'create_folder') {
        const parent = assertHomePath(sourcePath || HOME);
        const safeName = path.basename(String(name || '').trim());
        if (!safeName) return res.status(400).json({ error: 'Missing name' });
        const nextPath = assertHomePath(path.join(parent, safeName));
        if (!isInside(parent, nextPath)) return res.status(403).json({ error: 'Forbidden' });
        // lstat (no symlink follow) — if path exists as a symlink, reject. Prevents post-validation
        // symlink TOCTOU where attacker plants a symlink pointing outside HOME.
        try {
          const lst = fs.lstatSync(nextPath);
          if (lst.isSymbolicLink()) return res.status(403).json({ error: 'Symlink targets not allowed' });
          return res.status(409).json({ error: 'Already exists' });
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        }
        if (action === 'create_folder') {
          fs.mkdirSync(nextPath); // no recursive — refuses if exists (incl. symlink)
        } else {
          // O_CREAT | O_EXCL: refuses pre-existing path AND symlinks (even dangling).
          const fd = fs.openSync(nextPath, 'wx');
          try { fs.writeFileSync(fd, content ?? ''); } finally { fs.closeSync(fd); }
        }
        return res.json({ ok: true, path: nextPath });
      }

      const resolvedSource = assertHomePath(sourcePath || '');
      if (!fs.existsSync(resolvedSource)) return res.status(404).json({ error: 'Path does not exist' });

      if (action === 'write_file') {
        // lstat — refuse symlink target (otherwise we'd write to whatever it points to).
        const lst = fs.lstatSync(resolvedSource);
        if (lst.isSymbolicLink()) return res.status(403).json({ error: 'Symlink targets not allowed' });
        if (lst.isDirectory()) return res.status(400).json({ error: 'Cannot write a directory' });
        // Refuse multi-hardlink files — they can alias sensitive files outside HOME.
        // lstat cannot distinguish a hardlink from a regular file; nlink>1 is the only signal.
        if (lst.nlink > 1) return res.status(403).json({ error: 'Multi-hardlink targets not allowed' });
        fs.writeFileSync(resolvedSource, content ?? '');
        return res.json({ ok: true, path: resolvedSource });
      }

      if (action === 'delete') {
        fs.rmSync(resolvedSource, { recursive: true, force: true });
        return res.json({ ok: true, parent: path.dirname(resolvedSource) });
      }

      if (action === 'rename') {
        const safeName = path.basename(String(name || '').trim());
        if (!safeName) return res.status(400).json({ error: 'Missing name' });
        const nextPath = assertHomePath(path.join(path.dirname(resolvedSource), safeName));
        // Refuse if target already exists as a symlink (renameSync would replace it).
        try {
          const lst = fs.lstatSync(nextPath);
          if (lst.isSymbolicLink()) return res.status(403).json({ error: 'Symlink targets not allowed' });
          return res.status(409).json({ error: 'Already exists' });
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        }
        fs.renameSync(resolvedSource, nextPath);
        return res.json({ ok: true, path: nextPath });
      }

      if (action === 'move') {
        const destinationDir = assertHomePath(targetPath || '');
        const nextPath = assertHomePath(path.join(destinationDir, path.basename(resolvedSource)));
        try {
          const lst = fs.lstatSync(nextPath);
          if (lst.isSymbolicLink()) return res.status(403).json({ error: 'Symlink targets not allowed' });
          return res.status(409).json({ error: 'Already exists' });
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        }
        fs.renameSync(resolvedSource, nextPath);
        return res.json({ ok: true, path: nextPath });
      }

      if (action === 'duplicate') {
        const parsed = path.parse(resolvedSource);
        let nextPath = path.join(parsed.dir, `${parsed.name} copy${parsed.ext}`);
        let index = 2;
        // Use lstat (not existsSync) so symlinks are detected as "exists" and we skip past them.
        while (true) {
          try {
            const lst = fs.lstatSync(nextPath);
            if (lst.isSymbolicLink()) {
              // Skip past planted symlinks — never write through them.
              nextPath = path.join(parsed.dir, `${parsed.name} copy ${index}${parsed.ext}`);
              index++;
              continue;
            }
            // Regular file/dir at nextPath — try next name.
            nextPath = path.join(parsed.dir, `${parsed.name} copy ${index}${parsed.ext}`);
            index++;
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') break;
            throw e;
          }
        }
        const stat = fs.statSync(resolvedSource);
        if (stat.isDirectory()) fs.cpSync(resolvedSource, nextPath, { recursive: true });
        else fs.copyFileSync(resolvedSource, nextPath);
        return res.json({ ok: true, path: nextPath });
      }

      res.status(400).json({ error: 'Unknown action' });
    } catch (e) {
      // Map OS errors to semantically correct HTTP codes.
      const code = (e as NodeJS.ErrnoException).code;
      const isPermission = code === 'EACCES' || code === 'EPERM';
      const status = e instanceof HttpError ? e.status : isPermission ? 403 : 400;
      const message = e instanceof Error ? e.message : String(e);
      res.status(status).json({ error: message });
    }
  });

  r.get('/file-diff', (req, res) => {
    try {
      const raw = String(req.query.path || '').trim();
      if (!raw) return res.status(400).json({ error: 'Missing path' });
      const filePath = assertHomePath(raw);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Path does not exist' });
      const cwd = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
      let root = '';
      try { root = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim(); } catch {}
      if (!root) return res.json({ diff: '', message: 'No git repository found for this path' });
      // Git can resolve to a worktree/submodule outside the allowed roots — re-validate.
      if (!isInsideAllowedRoot(realPathSafe(root))) return res.json({ diff: '', message: 'Git root outside allowed roots' });
      const relative = path.relative(root, filePath);
      const diff = execFileSync('git', ['diff', '--', relative], { cwd: root, encoding: 'utf8', maxBuffer: 5_000_000 });
      res.json({ diff, root, relative });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 400;
      res.status(status).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  r.post('/upload', express.raw({ type: '*/*', limit: '200mb' }), (req, res) => {
    // Strip CR/LF from headers — Express may receive multiple values when a client splits with \r\n.
    // We take only the first valid token and reject any non-alphanumeric/dash content.
    const rawExt = (req.headers['x-file-ext'] as string) || 'png';
    if (/[\r\n]/.test(rawExt)) return res.status(400).json({ error: 'Invalid extension header' });
    const ext = rawExt.replace(/[^\w-]/g, '').toLowerCase();
    if (!UPLOAD_ALLOWED_EXTS.has(ext)) return res.status(400).json({ error: `Extension .${ext} not allowed` });
    const originalName = (req.headers['x-file-name'] as string) || '';
    // Reject null bytes, CR, LF in filename — Node path.join truncates at \x00, bypassing ext check.
    if (/[\x00\r\n]/.test(originalName)) return res.status(400).json({ error: 'Invalid filename' });

    // Folder drop: x-rel-path carries the file's path relative to the dropped folder
    // (e.g. "Assets/sub/a.png"). We rebuild that tree under DROP_DIR and report the folder root.
    const rawRel = (req.headers['x-rel-path'] as string) || '';
    let filepath: string;
    let root: string | undefined;
    if (rawRel) {
      const segs = safeRelSegments(rawRel);
      if (!segs) return res.status(400).json({ error: 'Invalid relative path' });
      filepath = path.join(DROP_DIR, ...segs);
      root = path.join(DROP_DIR, segs[0]);
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
    } else {
      const filename = safeDesktopFilename(originalName, ext || 'bin');
      filepath = path.join(DROP_DIR, filename);
      fs.mkdirSync(DROP_DIR, { recursive: true });
    }
    fs.writeFileSync(filepath, req.body as Buffer);
    res.json({ path: filepath, ...(root ? { root } : {}) });
  });

  return r;
}
