// Authentication — opt-in password gate that makes remote (VPS) deployment safe. Disabled by
// default (local-only mode keeps today's zero-friction behavior). Enabled when either:
//   • env JOCA_PASSWORD is set (quick VPS setup), or
//   • data/auth.json exists (password set from the local UI via POST /auth/set-password).
// Passwords are stored as scrypt hashes (salt per password); login issues a random bearer token,
// persisted in data/auth-tokens.json with a 30-day TTL, delivered as an httpOnly cookie (the WS
// upgrade sends it automatically) and in the JSON body for API clients.
//
// Binding beyond loopback REQUIRES auth: server.ts refuses JOCA_HOST != 127.0.0.1 without a
// password configured — the OpenClaw lesson (30k+ exposed instances) baked in as a hard rule.
import express, { Router } from 'express';
import path from 'path';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { IncomingMessage } from 'http';
import { DATA_DIR, readJsonFile, writeJsonFile } from './project-store';

interface AuthFile { salt: string; hash: string }         // scrypt(password, salt, 64) hex
interface TokenFile { [token: string]: { createdAt: number; expiresAt: number } }

const AUTH_FILE = path.join(DATA_DIR, 'auth.json');
const TOKENS_FILE = path.join(DATA_DIR, 'auth-tokens.json');
const TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;
const COOKIE_NAME = 'joca_token';
const MAX_TOKENS = 50;

// Brute-force guard: after MAX_FAILS consecutive failures, login locks for LOCKOUT_MS.
const MAX_FAILS = 5;
const LOCKOUT_MS = 30_000;
let failCount = 0;
let lockedUntil = 0;

function hashPassword(password: string, saltHex: string): string {
  return scryptSync(password, Buffer.from(saltHex, 'hex'), 64).toString('hex');
}

function loadAuthFile(): AuthFile | null {
  const f = readJsonFile<Partial<AuthFile>>(AUTH_FILE, {});
  return f.salt && f.hash ? (f as AuthFile) : null;
}

// env JOCA_PASSWORD wins (ephemeral, not persisted); otherwise data/auth.json.
export function authEnabled(): boolean {
  return Boolean(process.env.JOCA_PASSWORD || loadAuthFile());
}

function verifyPassword(password: string): boolean {
  const envPw = process.env.JOCA_PASSWORD;
  if (envPw) {
    const a = Buffer.from(password), b = Buffer.from(envPw);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const f = loadAuthFile();
  if (!f) return false;
  const candidate = Buffer.from(hashPassword(password, f.salt), 'hex');
  const stored = Buffer.from(f.hash, 'hex');
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

export function setPassword(password: string): void {
  const salt = randomBytes(16).toString('hex');
  writeJsonFile<AuthFile>(AUTH_FILE, { salt, hash: hashPassword(password, salt) });
  writeJsonFile<TokenFile>(TOKENS_FILE, {}); // password change revokes every session
}

function loadTokens(): TokenFile {
  const all = readJsonFile<TokenFile>(TOKENS_FILE, {});
  const now = Date.now();
  const live: TokenFile = {};
  for (const [t, meta] of Object.entries(all)) if (meta.expiresAt > now) live[t] = meta;
  return live;
}

function issueToken(): string {
  const token = randomBytes(32).toString('hex');
  const tokens = loadTokens();
  // Cap stored tokens (oldest evicted) so the file can't grow unbounded.
  const entries = Object.entries(tokens).sort((a, b) => a[1].createdAt - b[1].createdAt);
  while (entries.length >= MAX_TOKENS) entries.shift();
  const next = Object.fromEntries(entries);
  next[token] = { createdAt: Date.now(), expiresAt: Date.now() + TOKEN_TTL_MS };
  writeJsonFile(TOKENS_FILE, next);
  return token;
}

function tokenValid(token: string | undefined): boolean {
  if (!token) return false;
  const meta = loadTokens()[token];
  return Boolean(meta && meta.expiresAt > Date.now());
}

// Token handed to an agent running inside a PTY (see agent-bridge). Same lifetime rules as a login
// token — the terminal already has full shell access, so this is convenience, not privilege.
export function mintAgentToken(): string {
  return issueToken();
}

function revokeToken(token: string): void {
  const tokens = loadTokens();
  if (tokens[token]) { delete tokens[token]; writeJsonFile(TOKENS_FILE, tokens); }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function tokenFromRequest(req: { headers: IncomingMessage['headers'] }): string | undefined {
  const bearer = req.headers.authorization;
  if (typeof bearer === 'string' && bearer.startsWith('Bearer ')) return bearer.slice(7).trim();
  return parseCookies(req.headers.cookie)[COOKIE_NAME];
}

export function isAuthenticated(req: { headers: IncomingMessage['headers'] }): boolean {
  if (!authEnabled()) return true;
  return tokenValid(tokenFromRequest(req));
}

// Express middleware guarding the API routers. The static SPA shell stays public (it holds no
// data); every data/action route sits behind this.
export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (isAuthenticated(req)) return next();
  res.status(401).json({ error: 'Não autenticado' });
}

export function authRouter(): Router {
  const r = Router();

  r.get('/auth/status', (req, res) => {
    res.json({ enabled: authEnabled(), authenticated: isAuthenticated(req) });
  });

  r.post('/auth/login', express.json(), (req, res) => {
    if (!authEnabled()) return res.json({ ok: true });
    if (Date.now() < lockedUntil) return res.status(429).json({ error: 'Demasiadas tentativas — espera 30s' });
    const password = typeof (req.body ?? {}).password === 'string' ? (req.body as { password: string }).password : '';
    if (!verifyPassword(password)) {
      failCount++;
      if (failCount >= MAX_FAILS) { lockedUntil = Date.now() + LOCKOUT_MS; failCount = 0; }
      return res.status(401).json({ error: 'Password errada' });
    }
    failCount = 0;
    const token = issueToken();
    // Secure flag intentionally omitted: TLS terminates at the reverse proxy on a VPS (documented);
    // adding it here would break plain-http localhost logins.
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(TOKEN_TTL_MS / 1000)}`);
    res.json({ ok: true, token });
  });

  r.post('/auth/logout', (req, res) => {
    const token = tokenFromRequest(req);
    if (token) revokeToken(token);
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    res.json({ ok: true });
  });

  // First-time password setup from the local UI (before a VPS deploy). Allowed only when no
  // password exists yet OR the caller is already authenticated (password change).
  r.post('/auth/set-password', express.json(), (req, res) => {
    if (authEnabled() && !isAuthenticated(req)) return res.status(401).json({ error: 'Não autenticado' });
    if (process.env.JOCA_PASSWORD) return res.status(400).json({ error: 'Password gerida por env JOCA_PASSWORD — remove a env para gerir aqui' });
    const password = typeof (req.body ?? {}).password === 'string' ? (req.body as { password: string }).password : '';
    if (password.length < 8) return res.status(400).json({ error: 'Password demasiado curta (mínimo 8 caracteres)' });
    setPassword(password);
    const token = issueToken();
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(TOKEN_TTL_MS / 1000)}`);
    res.json({ ok: true, token });
  });

  return r;
}
