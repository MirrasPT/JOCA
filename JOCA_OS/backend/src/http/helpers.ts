import { randomUUID } from 'crypto';
import path from 'path';
import os from 'os';
import { HttpError, isInside, realPathSafe } from '../security-fs';
import { CLAUDE_DIR, parseFrontmatter } from '../toolkit-registry';

// Shared constants and pure helpers used across the HTTP route modules. No Express/closure state —
// everything here is a pure function or a constant, so any router can import it freely.

export const HOME = os.homedir();
export const IS_WINDOWS = process.platform === 'win32';
export const STARTED_AT = Date.now();

export const LLM_PROVIDERS = ['claude', 'ollama'] as const;
export type LlmProvider = typeof LLM_PROVIDERS[number];

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

// Allowlist of droppable extensions. 'svg'/'html'/'htm' are intentionally EXCLUDED — they can
// carry executable scripts and would be XSS vectors when rendered via /file-content. Executables
// (exe/bat/cmd/ps1/sh/…) are also excluded — no reason to land them via a drop.
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
]);

export function assertClaudePath(targetPath: string) {
  const lexical = path.resolve(targetPath);
  // Resolve any symlinks before checking containment — prevents symlink-escape
  // (planted symlink inside .claude pointing to /etc).
  const real = realPathSafe(lexical);
  if (!isInside(CLAUDE_DIR, real)) throw new HttpError('Forbidden', 403);
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
