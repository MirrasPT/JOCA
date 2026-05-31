---
name: wix-cli
description: "Develop, build and deploy Wix CLI projects (apps + headless sites): project structure, extension types (dashboard/backend/site), CLI commands, and bootstrap of the official Wix skills + MCP. MUST be invoked when the user mentions: Wix, Wix CLI, Wix app, dashboard extension, wix.config.json, Velo."
compatibility: "Wix CLI 1.x. Node.js 20.11+. Built on Astro. Requires a Wix account (wix login). App projects need a Wix app in the dashboard."
---

# Wix CLI

## When to use

Any task involving a Wix CLI project — apps (dashboard/backend/site extensions) or headless sites. Detect, route, then defer deep work to the **official Wix skills** (installed in-project), falling back to this reference.

## First move — bootstrap official skills

Wix ships 16 specialised skills + an MCP server as a Claude Code plugin. They live **per-project** in `.claude/`, not in JOCA. Always ensure they are present before coding:

```bash
# inside the Wix project root (has wix.config.json):
wix skills add        # add official skills to an existing project
wix skills update     # keep skills aligned with CLI version
```

- New CLI projects include skills by default → nothing to do.
- Keep CLI and skills aligned: upgrade one → upgrade the other.
- The official skills handle extension registration, TypeScript validation, build checks, and Wix Design System component knowledge. **Prefer them over this file when present.**

## Project detection

| Signal | Meaning |
|---|---|
| `wix.config.json` (has `appId`, `projectId`) | Wix CLI project root |
| `.claude/` with Wix skills | official skills installed |
| `src/extension.ts` | extension registry (imports + registers all extensions) |
| `astro.config.mjs` | Astro-based (all Wix CLI projects) |
| extra `pages/ components/ layouts/` | headless site project |

```bash
wix --version 2>/dev/null || echo "cli_missing"   # install: npm i -g @wix/cli
node --version                                     # need 20.11+
wix whoami 2>/dev/null || wix login                # auth
```

## Structure

```
project/
├── wix.config.json   ← appId + projectId (DON'T edit by hand)
├── .env.local        ← local auth env vars
├── astro.config.mjs  ← Astro config
├── package.json · tsconfig.json
├── .wix/  .astro/  dist/   ← internal/build, auto-managed (don't edit)
├── public/           ← static, served at root
├── .claude/ .cursor/ ← AI skills per tool
└── src/
    ├── extension.ts  ← central registry: imports + registers EVERY extension
    └── extensions/   ← extension code (layout flexible; default dashboard/pages/...)
```

Rule: every extension must be wired into `src/extension.ts` or it won't register. The official skills do this automatically.

## Extension types

| Category | Builds |
|---|---|
| **Dashboard** | pages, modals, plugins, menu plugins |
| **Backend** | service plugins, event handlers, backend APIs, data collections |
| **Site** | custom elements, site plugins, embedded scripts |
| **Headless** | Astro pages, components, layouts |

Decision: external service / multi-site / monetised → **app**. Admin UI inside Wix dashboard → **dashboard extension**. Server logic, webhooks, CMS → **backend extension**. Storefront widget/script → **site extension**.

## CLI commands

```bash
# project
wix dev          # local dev server + live preview
wix generate     # scaffold an extension
wix build        # production build → dist/
wix preview      # deploy a shareable preview build
wix release      # release the app

# auth (global)
wix login | wix logout | wix whoami

# skills
wix skills add | wix skills update

# env
wix env-pull | wix env-set | wix env-remove

# misc
wix telemetry
```

## Workflow

1. **Setup** — `wix login`; ensure skills (`wix skills add`); `npm install`.
2. **Generate** — `wix generate` to scaffold the extension type.
3. **Develop** — `wix dev` for live preview; edit under `src/`, registered via `src/extension.ts`.
4. **Validate** — TypeScript check + build (official skills run these automatically).
5. **Ship** — `wix build` → `wix preview` (shareable) → `wix release`.

## Verification

- `wix.config.json` present and `wix whoami` authenticated before `dev`/`build`.
- New extension appears registered in `src/extension.ts`.
- `wix build` exits clean (no TS errors) before `release`.

## Escalation

- Official skills absent and `wix skills add` fails → CLI/project mismatch; run `wix skills update` and confirm Node ≥ 20.11.
- Routing ambiguous → ask: "Wix app extension (dashboard/backend/site) or a headless site?"

## References

- Project structure: https://dev.wix.com/docs/wix-cli/guides/get-started/project-structure
- About Wix skills: https://dev.wix.com/docs/wix-cli/guides/development/about-wix-skills
- Official plugin (16 skills + MCP): https://claude.com/plugins/wix
- Skills source: https://github.com/wix/skills
