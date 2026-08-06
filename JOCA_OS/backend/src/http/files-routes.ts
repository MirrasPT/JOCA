import express, { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { HttpError, safePath } from '../security-fs';
import { DROP_DIR, UPLOAD_ALLOWED_EXTS, safeDesktopFilename, safeRelSegments } from './helpers';

// Ficheiros no JOCA são só anexo ou caminho — sem navegador/listagem. Só resta leitura pontual
// (1 ficheiro por path, para previews/anexos) e o upload que alimenta esses anexos.
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

  r.post('/upload', express.raw({ type: '*/*', limit: '200mb' }), (req, res) => {
    // Strip CR/LF from headers — Express may receive multiple values when a client splits with \r\n.
    // We take only the first valid token and reject any non-alphanumeric/dash content.
    const rawExt = (req.headers['x-file-ext'] as string) || 'png';
    if (/[\r\n]/.test(rawExt)) return res.status(400).json({ error: 'Invalid extension header' });
    const ext = rawExt.replace(/[^\w-]/g, '').toLowerCase();
    if (!UPLOAD_ALLOWED_EXTS.has(ext)) return res.status(400).json({ error: `Extension .${ext} not allowed` });
    // Client percent-encodes x-file-name / x-rel-path: HTTP headers are Latin-1 only, but real
    // filenames aren't (macOS screenshots carry a U+202F before AM/PM). Decode here; malformed → 400.
    let originalName: string;
    let rawRel: string;
    try {
      originalName = decodeURIComponent((req.headers['x-file-name'] as string) || '');
      rawRel = decodeURIComponent((req.headers['x-rel-path'] as string) || '');
    } catch {
      return res.status(400).json({ error: 'Invalid header encoding' });
    }
    // Reject null bytes, CR, LF in filename — Node path.join truncates at \x00, bypassing ext check.
    if (/[\x00\r\n]/.test(originalName)) return res.status(400).json({ error: 'Invalid filename' });

    // Folder drop: x-rel-path carries the file's path relative to the dropped folder
    // (e.g. "Assets/sub/a.png"). We rebuild that tree under DROP_DIR and report the folder root.
    let filepath: string;
    let root: string | undefined;
    if (rawRel) {
      const segs = safeRelSegments(rawRel);
      if (!segs) return res.status(400).json({ error: 'Invalid relative path' });
      // A extensão REAL é a do nome final do rel-path, não a do header x-file-ext — validar essa,
      // senão `x-file-ext: png` + `x-rel-path: drop/payload.html` escrevia um .html fora da
      // allowlist (auditoria 2026-08-06 #2).
      const finalExt = path.extname(segs[segs.length - 1]).slice(1).toLowerCase();
      if (finalExt && !UPLOAD_ALLOWED_EXTS.has(finalExt)) {
        return res.status(400).json({ error: `Extension .${finalExt} not allowed` });
      }
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
