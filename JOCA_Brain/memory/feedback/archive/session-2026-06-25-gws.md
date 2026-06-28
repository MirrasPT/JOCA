---
type: feedback-joca
source: auto-extracted-by-save
session_date: 2026-06-25
project: JOCA
processed: true
processed_date: 2026-06-27
---

# Feedback JOCA — sessão 2026-06-25 (cont.4): setup do `gws` (Google Workspace CLI)

**Categoria:** doc-gap | **Severidade:** low | **Descrição:** O `install.md` lista `gws` como "Google Workspace (Drive, Gmail, Calendar, Sheets) — requer gcloud" sem dizer QUAL é o pacote nem os gotchas de auth. O CLI real é **`@googleworkspace/cli`** (npm global, binário `gws`, v0.22.5). Setup vivido revelou armadilhas reais e não-óbvias: (1) `gws auth setup --login` pede **86 scopes** (incl. `cloud-identity.devices`, admin de Workspace) → numa conta **pessoal** dá `invalid_scope`/Erro 400; (2) `gws auth login --services gmail --readonly` **NÃO** restringe os scopes — só `--scopes <lista explícita>` restringe (ex.: `https://www.googleapis.com/auth/gmail.readonly`); (3) consent screen em "Testing" sem test users → `403 access_denied` (fix: add user em `console.cloud.google.com/auth/audience?project=<id>`); (4) app em "Testing" → Google **expira o refresh token ~7 dias** (fix: publicar em Production; conta pessoal não tem via Workspace-Internal). | **Componente afectado:** `.claude/commands/install.md` (FASE 3 — CLIs externos, linha `gws`) + eventual skill futura "google-workspace"/"personal-comms". | **Fix sugerido:** no `install.md`, trocar a linha `gws` por: pacote `@googleworkspace/cli` (`npm i -g`), auth `gws auth setup --login` (precisa gcloud) e a nota dos gotchas (usar `--scopes` explícito; conta pessoal → publicar app p/ não expirar em 7 dias; creds no keyring + `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` p/ headless/VPS). Capacidades úteis p/ automações: `gws gmail +triage` (não-lidos), `+read`, `+send`/`+reply`/`+forward` (verificadas e2e). gws corre non-interactive via `child_process.exec` lendo o keyring → bom p/ nós `shell` de automações.
