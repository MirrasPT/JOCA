---
name: auth-security
description: Router skill for authentication and security. Routes to the appropriate sub-skill based on context. Covers OWASP security reviews, Better Auth configuration, OAuth, 2FA/MFA, session management, and security hardening. Triggers on: auth setup, login, security audit, vulnerability review, 2FA, OAuth.
triggers: auth, authentication, login, security, owasp, 2fa, mfa, oauth, session, jwt, better-auth, password, vulnerability, sanctum, passport, spatie, laravel auth
---

# Auth & Security Router

## Decision Table

| Situation | Sub-skill to activate |
|-----------|----------------------|
| Security review, vulnerability audit, OWASP compliance, code review for security | `auth-security/owasp` |
| Better Auth setup, auth.ts configuration, 2FA/TOTP, OAuth providers, session management | `auth-security/better-auth` |
| Laravel auth: Sanctum, Passport, Spatie RBAC, 2FA TOTP, Socialite, Policies/Gates | `auth-security/auth-laravel` |
| General security hardening (headers, CSRF, rate limiting) without a specific auth library | `auth-security/owasp` |
| LLM/AI agent security, prompt injection prevention | `auth-security/owasp` |

## How to Activate Sub-skills

```
Read(".claude/skills/dev/auth-security/owasp/SKILL.md")
Read(".claude/skills/dev/auth-security/better-auth/SKILL.md")
Read(".claude/skills/dev/auth-security/auth-laravel/SKILL.md")
```

## Quick Reference

### OWASP Top 10:2025 (one-liner)
A01 Broken Access Control · A02 Misconfiguration · A03 Supply Chain · A04 Crypto Failures · A05 Injection · A06 Insecure Design · A07 Auth Failures · A08 Integrity · A09 Logging · A10 Exception Handling

### Better Auth (one-liner)
`npm install better-auth` → set `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` → create `auth.ts` → `npx @better-auth/cli migrate`

### Always Apply
- Deny by default on access control failures
- Argon2/bcrypt for password hashing (never MD5/SHA1)
- 128+ bit entropy on session tokens
- Fail-closed on auth errors (return `false`, not `true`)
- Secrets in env/vault, never in code
