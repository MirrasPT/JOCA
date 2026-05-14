---
name: better-auth
description: Configure Better Auth server and client, set up database adapters, manage sessions, add plugins, implement 2FA/MFA, OAuth providers, and handle environment variables. Use when working with Better Auth, betterauth, auth.ts, TypeScript authentication, email/password login, OAuth, two-factor authentication, TOTP, backup codes, or magic links.
triggers: better-auth, betterauth, auth.ts, typescript auth, 2fa, totp, mfa, oauth providers, magic link, session management, better-auth plugin
---

# Better Auth

Complete guide for Better Auth: setup, configuration, 2FA, OAuth, and production hardening.

## Setup

```bash
npm install better-auth
```

Environment variables (required):
```
BETTER_AUTH_SECRET=<openssl rand -base64 32>   # min 32 chars
BETTER_AUTH_URL=https://example.com
```

Setup steps:
1. Create `auth.ts` with database + config
2. Create route handler for your framework
3. Run `npx @better-auth/cli@latest migrate`
4. Verify: `GET /api/auth/ok` → `{ status: "ok" }`

## Core Config

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
    github: { clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! },
  },
});
```

## Config Reference

| Option | Notes |
|--------|-------|
| `appName` | Optional display name |
| `baseURL` | Only if `BETTER_AUTH_URL` not set |
| `basePath` | Default `/api/auth`. Set `/` for root. |
| `secret` | Only if `BETTER_AUTH_SECRET` not set |
| `database` | Required for most features |
| `secondaryStorage` | Redis/KV for sessions & rate limits |
| `emailAndPassword` | `{ enabled: true }` to activate |
| `socialProviders` | `{ google: { clientId, clientSecret }, ... }` |
| `plugins` | Array of plugins |
| `trustedOrigins` | CSRF whitelist |

## Database Adapters

```ts
// Drizzle
import { drizzleAdapter } from "better-auth/adapters/drizzle";
database: drizzleAdapter(db, { provider: "pg" }) // or "mysql" | "sqlite"

// Prisma
import { prismaAdapter } from "better-auth/adapters/prisma";
database: prismaAdapter(prisma, { provider: "postgresql" })

// Direct (pg, mysql2, better-sqlite3)
database: { dialect: "postgresql", db: pool }
```

**Critical:** Better Auth uses adapter model names, NOT underlying table names. If Prisma model is `User` mapping to table `users`, use `modelName: "user"` — not `"users"`.

## Session Management

```ts
auth = betterAuth({
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days (default)
    updateAge: 24 * 60 * 60,       // refresh interval
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,               // 5 minutes
      strategy: "compact",          // "compact" | "jwt" | "jwe"
    },
  },
  secondaryStorage: redisAdapter,   // sessions go here by default if set
})
```

Cookie cache strategies: `compact` (default, smallest), `jwt` (readable, signed), `jwe` (encrypted, max security).

## Two-Factor Authentication (2FA)

```ts
import { twoFactor } from "better-auth/plugins/two-factor";

export const auth = betterAuth({
  plugins: [
    twoFactor({
      issuer: "My App",
      totpOptions: { digits: 6, period: 30 },
      otpOptions: {
        sendOTP: async ({ user, otp }) => {
          await sendEmail({ to: user.email, subject: "Your code", text: `Code: ${otp}` });
        },
        period: 5,           // minutes
        allowedAttempts: 5,
        storeOTP: "encrypted",
      },
      backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: "encrypted" },
      twoFactorCookieMaxAge: 600,           // 10 min
      trustDeviceMaxAge: 30 * 24 * 60 * 60, // 30 days
    }),
  ],
});
```

### 2FA Client Setup

```ts
import { createAuthClient } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() { window.location.href = "/2fa"; },
    }),
  ],
});
```

### 2FA Sign-In Flow

1. `signIn.email({ email, password })`
2. Check `context.data.twoFactorRedirect` in `onSuccess`
3. If `true` → redirect to `/2fa`
4. Verify via TOTP, OTP, or backup code
5. Session cookie created on success

```ts
const signIn = async (email: string, password: string) => {
  await authClient.signIn.email({ email, password }, {
    onSuccess(context) {
      if (context.data.twoFactorRedirect) window.location.href = "/2fa";
    },
  });
};
```

### Enable/Disable 2FA

```ts
// Enable — returns totpURI (for QR) and backupCodes
const { data } = await authClient.twoFactor.enable({ password });
// data.totpURI — pass to QR code component
// data.backupCodes — display to user once

// Disable
await authClient.twoFactor.disable({ password });
```

### Verify TOTP

```ts
await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
```

## OAuth Providers

Common env vars pattern:
```
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
  → callback: /api/auth/callback/google

GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
  → callback: /api/auth/callback/github

DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET
  → callback: /api/auth/callback/discord
```

Magic link (passwordless):
```ts
import { magicLink } from "better-auth/plugins";
plugins: [magicLink({ sendMagicLink: async ({ email, url }) => sendEmail({ to: email, url }) })]
```

## Plugins Reference

Import from dedicated paths for tree-shaking:
```ts
import { twoFactor } from "better-auth/plugins/two-factor"  // ✓
import { twoFactor } from "better-auth/plugins"              // ✗
```

Popular plugins: `twoFactor`, `organization`, `passkey`, `magicLink`, `emailOtp`, `username`, `phoneNumber`, `admin`, `apiKey`, `bearer`, `jwt`, `multiSession`, `sso`, `oauthProvider`, `openAPI`.

Client plugins go in `createAuthClient({ plugins: [...] })`.

## Client

```ts
import { createAuthClient } from "better-auth/react"; // or /vue /svelte /solid /client

const client = createAuthClient();

// Methods
client.signUp.email({ email, name, password })
client.signIn.email({ email, password })
client.signIn.social({ provider: "google" })
client.signOut()
client.useSession()  // React hook
client.getSession()
```

## Security Config

```ts
auth = betterAuth({
  advanced: {
    useSecureCookies: true,              // Force HTTPS cookies
    disableCSRFCheck: false,             // ⚠️ Never disable in prod
    crossSubDomainCookies: { enabled: false },
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
    storage: "secondary-storage",
  },
})
```

## Hooks

```ts
auth = betterAuth({
  hooks: {
    before: [{ matcher: (ctx) => ctx.path === "/sign-in", handler: createAuthMiddleware(async (ctx) => { /* ... */ }) }],
    after: [...],
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({ data: { ...user, role: "user" } }),
        after: async (user) => { await sendWelcomeEmail(user.email); },
      },
    },
  },
})
```

## Type Safety

```ts
type Session = typeof auth.$Infer.Session
type User = typeof auth.$Infer.Session.user

// Separate client/server projects:
createAuthClient<typeof auth>()
```

## Common Gotchas

1. **Model vs table name** — config uses ORM model name, not DB table name
2. **Re-run CLI after adding plugins** — schema changes require migration
3. **Secondary storage** — sessions go there by default when set, not to DB
4. **Cookie cache** — custom session fields NOT cached, always re-fetched
5. **Stateless mode** — no DB = session in cookie only, logout on cache expiry
6. **2FA limited to credential accounts** — social-only accounts cannot enable 2FA

## CLI Commands

```bash
npx @better-auth/cli@latest migrate   # Apply schema (built-in adapter)
npx @better-auth/cli@latest generate  # Generate schema for Prisma/Drizzle
npx @better-auth/cli mcp --cursor     # Add MCP to AI tools
```

## Resources

- [Docs](https://better-auth.com/docs)
- [Options Reference](https://better-auth.com/docs/reference/options)
- [LLMs.txt](https://better-auth.com/llms.txt)

<!-- Adapted from: https://github.com/better-auth/skills (better-auth-best-practices + twoFactor + providers) -->
