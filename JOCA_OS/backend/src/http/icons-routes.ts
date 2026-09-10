import express, { Router } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { DATA_DIR, loadProjects, ProjectIcon } from '../project-store';
import { loadProjectGroups } from '../project-groups-store';

// Project and group icons: upload, delivery and removal. Follows the POST /upload pattern
// (express.raw + x-file-ext header), but saves into data/icons and NEVER reuses the client's
// name — the name is a UUID generated here, which closes path traversal by construction.
//
// SVG is REJECTED deliberately. An SVG is a document with script/foreignObject and this endpoint
// returns the file to be drawn inline in the sidebar; serving user-uploaded SVG would be stored
// XSS. It is the same decision already made in UPLOAD_ALLOWED_EXTS (helpers.ts), kept
// consistent. Whoever wants a vector icon exports PNG/WEBP.
export const ICONS_DIR = path.join(DATA_DIR, 'icons');

const MAX_ICON_BYTES = 2 * 1024 * 1024;

// Canonical extension → Content-Type. 'jpg' normalizes to 'jpeg' in the saved file's name.
const ICON_MIME: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

// Only names THIS server generates. It doubles as validation on delivery/removal and on the PATCH
// (an `icon.value` of type 'image' has to match this, otherwise it was an arbitrary path).
const ICON_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpeg|webp)$/;

// The declared extension often lies (and it is the client declaring it). What decides is the
// content: without these magic bytes the file is not the image it says it is.
function sniffImageExt(buf: Buffer): 'png' | 'jpeg' | 'webp' | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

export function isGeneratedIconFilename(name: string): boolean {
  return ICON_FILE_RE.test(name);
}

// An emoji = exactly one pictographic grapheme cluster. Counting code points is not enough: a
// family with ZWJ has 7 and is still a single glyph, and "ab" has 2 and is no emoji at all.
function isSingleEmoji(value: string): boolean {
  if (!value || value.length > 32) return false;
  if ([...value].length > 12) return false;
  const clusters = [...new Intl.Segmenter('pt', { granularity: 'grapheme' }).segment(value)];
  if (clusters.length !== 1) return false;
  return /\p{Extended_Pictographic}/u.test(value);
}

export type IconParseResult =
  | { ok: true; icon: ProjectIcon | undefined }
  | { ok: false; error: string };

// Validates the `icon` field of a PATCH. `null`/`''` clears the icon (→ undefined). It always
// returns a NEW object with only the two known fields — never the body's object, which would carry
// arbitrary keys into the persisted JSON.
export function parseIconInput(raw: unknown): IconParseResult {
  if (raw === null || raw === '') return { ok: true, icon: undefined };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'invalid icon' };
  const { type, value } = raw as { type?: unknown; value?: unknown };
  if (typeof value !== 'string') return { ok: false, error: 'icon.value has to be text' };
  if (type === 'emoji') {
    if (!isSingleEmoji(value)) return { ok: false, error: 'icon.value has to be a single emoji' };
    return { ok: true, icon: { type: 'emoji', value } };
  }
  if (type === 'image') {
    if (!isGeneratedIconFilename(value)) return { ok: false, error: 'icon.value is not a valid icon file' };
    if (!fs.existsSync(path.join(ICONS_DIR, value))) return { ok: false, error: 'Icon not found' };
    return { ok: true, icon: { type: 'image', value } };
  }
  return { ok: false, error: "icon.type has to be 'image' or 'emoji'" };
}

// A file is only deleted once nobody else points at it: the same upload can be reused by several
// projects/groups and deleting it would leave the others with a dead icon.
export function isIconReferenced(filename: string): boolean {
  const used = (icon?: ProjectIcon) => icon?.type === 'image' && icon.value === filename;
  return loadProjects().some((p) => used(p.icon)) || loadProjectGroups().some((g) => used(g.icon));
}

// Called AFTER saving the change, when an image icon was replaced or removed: without this
// data/icons grew forever with files nobody points at any more.
export function collectIconIfUnused(previous: ProjectIcon | undefined, next: ProjectIcon | undefined): void {
  if (previous?.type !== 'image') return;
  if (next?.type === 'image' && next.value === previous.value) return;
  if (isIconReferenced(previous.value)) return;
  try { fs.unlinkSync(path.join(ICONS_DIR, previous.value)); } catch { /* no longer there — nothing to do */ }
}

export function iconsRouter(): Router {
  const r = Router();

  // Upload. Body = the image's raw bytes (same pattern as POST /upload), extension declared in
  // x-file-ext only as a hint — what rules is the content sniff.
  r.post('/icons', express.raw({ type: '*/*', limit: MAX_ICON_BYTES }), (req, res) => {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: 'Empty body' });
    if (body.length > MAX_ICON_BYTES) return res.status(413).json({ error: 'Icon too large (max. 2 MB)' });

    const rawExt = (req.headers['x-file-ext'] as string) || '';
    if (/[\r\n]/.test(rawExt)) return res.status(400).json({ error: 'Invalid extension header' });
    const declared = rawExt.replace(/[^\w-]/g, '').toLowerCase();
    if (declared === 'svg') return res.status(400).json({ error: 'SVG is not accepted as an icon (script risk)' });

    const ext = sniffImageExt(body);
    if (!ext) return res.status(400).json({ error: 'Only PNG, JPEG or WEBP' });

    const filename = `${randomUUID()}.${ext}`;
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    // Atomic write: the icon GET can arrive before a long write finishes and would serve
    // half the file.
    const target = path.join(ICONS_DIR, filename);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, body);
    fs.renameSync(tmp, target);

    res.json({ filename, url: `/icons/${filename}`, icon: { type: 'image', value: filename } });
  });

  r.get('/icons/:name', (req, res) => {
    const name = req.params.name;
    if (!isGeneratedIconFilename(name)) return res.status(400).json({ error: 'Invalid name' });
    const file = path.join(ICONS_DIR, name);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
    const ext = name.slice(name.lastIndexOf('.') + 1);
    res.setHeader('Content-Type', ICON_MIME[ext] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Defense in depth in case a raster smuggles markup: nothing here is executable.
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    // The name is a UUID: the content never changes, changing icon generates another name.
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.sendFile(file);
  });

  r.delete('/icons/:name', (req, res) => {
    const name = req.params.name;
    if (!isGeneratedIconFilename(name)) return res.status(400).json({ error: 'Invalid name' });
    if (isIconReferenced(name)) return res.status(409).json({ error: 'Icon still in use' });
    try { fs.unlinkSync(path.join(ICONS_DIR, name)); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') return res.status(500).json({ error: 'Removal failed' });
    }
    res.json({ ok: true });
  });

  return r;
}
