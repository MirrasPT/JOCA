// Filesystem security boundary: path allowlist roots, sensitive-path blocking, safe-path
// resolution, and CSRF origin guard. Self-contained — derives HOME/IS_WINDOWS from os/process,
// so it has no dependency on server wiring. Exports pure functions + the ALLOWED_ROOTS singleton.
import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';

const HOME = os.homedir();
const IS_WINDOWS = process.platform === 'win32';

// Path allowlist for any value written into a PTY shell line. Unicode letters/numbers + safe punctuation.
// Includes both / and \ so Windows absolute paths (C:\Users\...) pass; still rejects shell metachars (" ; | $ ` newline).
export const PATH_SAFE = /^[\p{L}\p{N}._/\\ @()&,+:'-]+$/u;

export function isInside(root: string, targetPath: string) {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(path.resolve(root), resolved);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

// Resolve symlinks to their real physical path before any boundary check.
// Falls back to the lexical path if realpath fails (file doesn't exist yet, etc).
export function realPathSafe(p: string): string {
  try { return fs.realpathSync.native(p); } catch { return p; }
}

// Roots the file APIs are allowed to serve. HOME is always allowed. On Windows every
// existing fixed drive (C:\, D:\, ...) is allowed so the user can browse and add
// projects that live across disks. Override / extend with JOCA_EXTRA_ROOTS
// (path-list separated by ';' on Windows, ':' elsewhere). Sensitive-path blocking
// (.ssh, credentials, ...) still applies on top of this, scoped to HOME.
function computeAllowedRoots(): string[] {
  const roots = new Set<string>([path.resolve(HOME)]);
  const extra = process.env.JOCA_EXTRA_ROOTS;
  if (extra) {
    for (const r of extra.split(IS_WINDOWS ? ';' : ':')) {
      const trimmed = r.trim();
      if (trimmed) roots.add(path.resolve(trimmed));
    }
  }
  if (IS_WINDOWS) {
    for (let code = 65 /* A */; code <= 90 /* Z */; code++) {
      const drive = `${String.fromCharCode(code)}:\\`;
      try { if (fs.existsSync(drive)) roots.add(path.resolve(drive)); } catch { /* drive not ready */ }
    }
  }
  return [...roots];
}
export const ALLOWED_ROOTS = computeAllowedRoots();

export function isInsideAllowedRoot(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  return ALLOWED_ROOTS.some((root) => isInside(root, resolved));
}

export function isAllowedRoot(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  return ALLOWED_ROOTS.some((root) => resolved === path.resolve(root));
}

// Sensitive subdirs of $HOME that must NEVER be served via the file APIs, regardless of any
// other guard. Path is HOME-relative (no leading slash).
const SENSITIVE_HOME_SUBDIRS = [
  '.ssh', '.gnupg', '.aws', '.kube', '.docker', '.npmrc', '.netrc', '.pgpass',
  '.config/gcloud', '.config/gh', '.config/op', '.config/rclone',
  '.bash_history', '.zsh_history', '.python_history', '.psql_history', '.mysql_history',
  '.subversion/auth', '.cargo/credentials.toml', '.cargo/credentials',
  'Library/Keychains',
  // Shell/tool config: writes here = persistence vector on next terminal/process launch.
  '.zshrc', '.bashrc', '.bash_profile', '.profile', '.zprofile', '.zshenv', '.bash_logout',
  '.gitconfig', '.git-credentials', '.env', '.envrc',
];
export function isSensitivePath(absPath: string): boolean {
  const rel = path.relative(HOME, absPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return SENSITIVE_HOME_SUBDIRS.some((d) => rel === d || rel.startsWith(d + path.sep));
}

export class HttpError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// Read-only variant: allows HOME itself for directory listing.
// Use for GET operations only — never for mutations.
export function safePathForRead(targetPath: string): string {
  if (!targetPath) throw new HttpError('Missing path', 400);
  const real = realPathSafe(path.resolve(targetPath));
  if (!isInsideAllowedRoot(real)) throw new HttpError('Forbidden', 403);
  if (isSensitivePath(real)) throw new HttpError('Forbidden', 403);
  return real;
}

// Mutation variant: additionally blocks any allowed root itself (HOME, drive roots) to
// prevent accidental deletion/overwrite of an entire account or disk.
// Use for file-op and any write path.
export function safePath(targetPath: string): string {
  const real = safePathForRead(targetPath);
  if (isAllowedRoot(real)) throw new HttpError('Forbidden', 403);
  return real;
}

export function assertHomePath(targetPath: string) {
  return safePath(targetPath);
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // direct calls (curl, server-side) have no Origin header
  // Only loopback origins on http (any port — vite dev + prod served origin both qualify).
  // External attackers cannot forge a loopback origin from a remote browser tab.
  return /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
}

export function requireSafeOrigin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (!isAllowedOrigin(req.headers.origin as string | undefined)) {
    return res.status(403).json({ error: 'Forbidden origin' });
  }
  next();
}
