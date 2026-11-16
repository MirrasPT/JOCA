import { randomUUID } from 'crypto';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { HttpError, isInside, realPathSafe } from '../security-fs';
import { BRAIN, parseFrontmatter } from '../toolkit-registry';

// Shared constants and pure helpers used across the HTTP route modules. No Express/closure state —
// everything here is a pure function or a constant, so any router can import it freely.

export const HOME = os.homedir();
export const IS_WINDOWS = process.platform === 'win32';
export const STARTED_AT = Date.now();


// All drops land in a dedicated folder (not the Desktop) so the worker gets a real, stable path
// without cluttering common dirs. Folders preserve their relative structure under here.
export const DROP_DIR = path.join(os.homedir(), 'JOCA_Drops');

// /open: macOS `open` dispatches by file metadata — extension AND executable mode bit AND shebang.
// Use an ALLOWLIST of known-safe document/media types. Extensionless files, scripts, and apps are
// rejected even if their extension is missing.
export const OPEN_ALLOWED_EXTS = new Set([
  'png','jpg','jpeg','gif','webp','bmp','svg','ico','pdf',
  'mp4','mov','webm','m4v','mkv','avi',
  'mp3','wav','m4a','ogg','flac','aac',
  'md','txt','json','csv','tsv','log','yaml','yml','toml','xml',
  'html','htm',
]);

// Allowlist of droppable extensions. Executables (exe/bat/cmd/ps1/msi/…) stay OUT — no reason to
// land them via a drop.
// 'svg'/'html'/'htm' ARE allowed (2026-08-13, decisão do dono). They can carry script, but the risk
// lives in the RENDER path, and /file-content already contains it: SVG is served under a CSP
// sandbox, HTML is forced to Content-Disposition: attachment on any active-render context. An
// attachment only hands the agent a PATH — the composer never renders it.
// 'bin' is the marker for EXTENSIONLESS files (README, Dockerfile, .env). The real guard for those
// is the name-based check in files-routes.ts, which judges the extension of the name actually
// written to disk — the x-file-ext header alone was never enough (`png` + `evil.exe` wrote an .exe).
export const UPLOAD_ALLOWED_EXTS = new Set([
  // images
  'png','jpg','jpeg','gif','webp','bmp','ico','heic','heif','tiff','tif','avif',
  // documents
  'pdf','txt','md','rtf','doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp',
  // data / text
  'json','csv','tsv','xml','yaml','yml','log','ini','toml',
  // archives
  'zip','rar','7z','tar','gz',
  // audio
  'mp3','wav','ogg','flac','m4a','aac',
  // video
  'mp4','mov','webm','mkv','avi','m4v',
  // design / raster
  'psd','ai','eps','sketch','fig',
  // common code/text attachments
  'ts','tsx','js','jsx','py','rb','go','rs','java','c','h','cpp','cs','php','sql','sh','css','scss',
  // markup — safe to STORE; /file-content is what sandboxes them on render
  'svg','html','htm',
  // extensionless files (README, Dockerfile, .env) — see note above
  'bin',
]);

/**
 * Caminho real de `p`, mesmo que ainda não exista (criar um item): o realpath do ancestral mais
 * fundo que existe, mais o resto. Um atalho PARTIDO pelo caminho é recusado — escrever através
 * dele criava o alvo onde quer que ele aponte.
 */
export function caminhoReal(p: string): string {
  let dir = path.resolve(p);
  const resto: string[] = [];
  for (;;) {
    let existe = true;
    try { fs.lstatSync(dir); } catch { existe = false; }
    if (existe) break;
    const pai = path.dirname(dir);
    if (pai === dir) break;
    resto.unshift(path.basename(dir));
    dir = pai;
  }
  let real: string;
  try { real = fs.realpathSync.native(dir); } catch { throw new HttpError('Forbidden', 403); }
  return path.join(real, ...resto);
}

/** Pastas do toolkit de um Brain (já resolvidas): `.claude`, e as do v2 `.agents` e `skills`. */
export function raizesDoToolkit(brainRoot: string): string[] {
  return ['.claude', '.agents', 'skills'].map((d) => realPathSafe(path.join(brainRoot, d)));
}

/**
 * Um item do toolkit só se lê/escreve se, DEPOIS de resolvido (atalhos incluídos), ficar dentro de
 * uma pasta de toolkit do Brain encontrado. As skills v2 vivem em `.agents/skills` e
 * `.agents/globais`, atrás de atalhos em `.claude/skills` — por isso conta o caminho real, não só o
 * `.claude`. `../`, atalho para fora do Brain e «sem Brain» → 403. Devolve o caminho lexical.
 */
export function assertClaudePath(targetPath: string, brainRoot: string | null = BRAIN?.root ?? null) {
  if (!brainRoot || !targetPath) throw new HttpError('Forbidden', 403);
  const lexical = path.resolve(targetPath);
  const real = caminhoReal(lexical);
  if (!raizesDoToolkit(brainRoot).some((raiz) => isInside(raiz, real))) throw new HttpError('Forbidden', 403);
  return lexical;
}

export function safeDesktopFilename(name: string, fallbackExt: string) {
  const fallback = `joca-drop-${randomUUID().slice(0, 8)}.${fallbackExt}`;
  const cleaned = path.basename(name || fallback).replace(/[^\w .@()-]/g, '-').trim();
  return cleaned || fallback;
}

export function validateToolkitContent(type: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return 'Content cannot be empty';
  if (type === 'skills') {
    const frontmatter = parseFrontmatter(trimmed);
    if (!frontmatter.name) return 'Skill frontmatter needs name';
    if (!frontmatter.description) return 'Skill frontmatter needs description';
  }
  if (type === 'agents') {
    const frontmatter = parseFrontmatter(trimmed);
    if (trimmed.startsWith('---') && !frontmatter.name) return 'Agent frontmatter needs name';
  }
  return null;
}

export function sanitizeToolkitName(name: string) {
  const safe = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[.\-]+|[.\-]+$/g, '');
  if (!safe) throw new Error('Invalid name');
  return safe;
}

export function sanitizeToolkitCategory(category?: string) {
  return (category || 'created-skills')
    .split(/[/\\]/)
    .filter(Boolean)
    .map((segment) => sanitizeToolkitName(segment))
    .join(path.sep);
}

// Validate a client-supplied relative path (folder drop). Rejects traversal/absolute/control chars;
// sanitizes each segment the same way single filenames are sanitized. Returns the segment list.
export function safeRelSegments(rel: string): string[] | null {
  if (/[\x00\r\n]/.test(rel)) return null;
  const segs = rel.split(/[\\/]+/).filter(Boolean);
  const out: string[] = [];
  for (const s of segs) {
    if (s === '.' || s === '..') return null;
    const clean = path.basename(s).replace(/[^\w .@()-]/g, '-').trim();
    if (!clean) return null;
    out.push(clean);
  }
  return out.length ? out : null;
}
