---
name: meu-site-github
description: Portfolio pessoal Renato Ferreira — Node.js + Express + SQLite + Vanilla JS + GSAP
type: project
directorio: C:\Users\renat\Projetos\meu-site-github
---

**Stack:** Node.js + Express 5.1 | SQLite 3 | Vanilla HTML/CSS/JS | GSAP 3.12.2
**Objectivo:** Portfolio pessoal com backoffice admin, i18n PT/EN, captação de contactos
**Directório:** `C:\Users\renat\Projetos\meu-site-github`
**Repo:** https://github.com/MirrasPT/portfolio
**Iniciado:** pré-existente (último update 2026-04-01)
**PRD:** PRD.md
**Why:** Presença online profissional para mostrar portfolio e captar clientes
**How to apply:** Foco em polish, deploy, e hardening — MVP completo. Respeitar decisão de vanilla JS sem framework.

## Estado actual

**`main` é a versão atual** (`fb2cc2b`), no GitHub. `claude/repo-analysis-6dqo03` == `main`. Todo o trabalho de hoje commitado e pushed; história git purgada (ver decisões).
Graphify: 802 nodes, 976 edges, 50 comunidades.
Local: deps instaladas, `.env` criado (JWT_SECRET gerado), admin `renato`, servidor corre em `localhost:3001` (NODE_ENV=development). Nota: a shell desta máquina tem `PORT=7371` exportado → arrancar sempre com `PORT=3001 node server.js`.
Segurança: auditado + corrigido, `npm audit` 0 vulns, cookie httpOnly. Deploy: artefactos prontos (CI, `.cpanel.yml`, `DEPLOY.md`); gate = confirmar Node ≥ 20.17 no cPanel.

## Última sessão

2026-06-19 — Sessão grande: hardening de auth (JWT→cookie httpOnly), frontend optimizado + Lenis smooth scroll, auditoria + correções de segurança (workflows), fix CSP backoffice, CI + config de deploy cPanel, purga do histórico git, e `main` consolidado como versão atual.

## Decisões tomadas

- 2026-06-18: **Hardening** (branch claude/repo-analysis-6dqo03, não commitado) — JWT migrado de localStorage+Bearer para cookie `httpOnly`+`SameSite=Strict`+`secure`(prod); `cookie-parser` antes das rotas; `authMiddleware` lê `req.cookies.token`; nova rota `POST /api/logout`; CORS `credentials:true` com allowlist; frontend `credentials:'include'`, sem `authToken`. CSRF coberto por SameSite=Strict (same-origin). Verificado por workflow (funcional live + review segurança + re-audit).
- 2026-06-19: **Trabalho de hoje commitado** (`fb2cc2b` no branch claude, depois reescrito pela purga) — auth+frontend+segurança+infra num commit.
- 2026-06-19: **Purga do histórico git** feita via `git-filter-repo --replace-text`. Redigidos em TODA a história (23 commits, ambos branches): password `Webmaster.0303`, fallbacks JWT `super-secret-key-change-this-in-env` / `dev-only-secret-change-in-production` → marcadores `***REDACTED-*`. Force-push (`--force-with-lease`) de `main` (a2cde37) e `claude/repo-analysis-6dqo03` (fb2cc2b). Sem PRs abertos. Backup local: `C:/Users/renat/Projetos/portfolio-history-backup.bundle`. Caveat: GitHub pode reter cópias em cache até GC; clones antigos mantêm história — mas credenciais já estão mortas (admin=renato, fallbacks eram dev). git-filter-repo instalado via pip.
- 2026-06-19: **Correções de segurança aplicadas** (workflow, 5 implementers paralelos disjuntos + verify funcional-browser/security-recheck/static). Feito e verificado: upload bloqueia SVG + valida magic bytes (`isValidImageSignature` em helpers.js); escape XSS em todos os sinks `innerHTML` do backoffice (`script.js`); CDNs pinados + **SRI sha384/512** nas 8 páginas (TODOS os hashes verificados manualmente contra ficheiro real, incl. FA backoffice `PPIZEGYM`=correto); `x-powered-by` off; política de password no `create_admin.js` (min 12, letra+dígito, blocklist); bug `safeUnlink` em `DELETE /about-images` corrigido; cap defensivo `LIMIT/OFFSET` (max 200) nas listas sem mudar envelope; bump express→5.2.1, cors→2.8.6. Excluídos (à parte): purga histórico git, CSP unsafe-inline, JWT revocation. Notas low residuais: `img.image_path` (filename server-safe) e `mailto` com `msg.email` no backoffice (admin-only) por escapar — opcional.
- 2026-06-18: **Auditoria de segurança** (workflow, 5 especialistas + verificação adversarial + cross-model Codex) → `SECURITY_AUDIT.md`. Veredicto: **razoavelmente seguro** para o threat model (single-admin, sem registo público/PII/pagamentos). 0 Critical, 0 High, 1 Medium, ~8 Low, ~9 Info (26 falsos positivos descartados). Fundamentos OK: todas as rotas mutantes autenticadas, SQL 100% parametrizado, JWT em cookie httpOnly+SameSite=Strict, CORS allowlist, 0 vulns npm. Top riscos: (Medium) creds `Mirras`/`Webmaster.0303` + fallback JWT_SECRET no histórico git; SVG upload sem sanitização de conteúdo; falta de SRI nos scripts CDN (41 refs) + pacotes `@latest` não-pinned.
- 2026-06-18: **Fix CSP backoffice** — `e31c1b5` passou a aplicar CSP ao HTML (antes só `/api`), bloqueando Sortable.js + Chart.js que o backoffice carrega de `cdn.jsdelivr.net`. Sintoma: "Erro ao carregar dados da homepage." (catch em `backoffice/script.js:376`, `initializeSortableLists()` rebenta com `Sortable` undefined). Fix: `cdn.jsdelivr.net` adicionado ao `script-src` em `server.js`. Restante ruído de consola = GA `region1.google-analytics.com` (connect-src, pré-existente, inócuo).
- 2026-06-18: **Frontend optimize + smooth scroll** (não commitado) — `defer` em todos os libs do `<head>` (render-blocking 6/4/4/4/0/5 → 0 nas 6 páginas), `preconnect` cdnjs+unpkg, fix typo `fonts.gstatic`→`.com`, `loading=lazy` em imagens below-the-fold (hero eager). **Lenis** smooth scroll (momentum ease-out) nas 6 páginas públicas: `public/js/smooth-scroll.js` + 5 regras CSS em `style.css`, integrado com GSAP ticker/ScrollTrigger, intercepta anchors, `data-lenis-prevent` em `.modal-left-column`. **prefers-reduced-motion desliga** (acessibilidade). CSP-safe (JS unpkg, CSS local). Backoffice excluído. Sem bump de versões. **Zero regressão visual** confirmada por screenshots antes/depois (6 páginas × desktop+mobile, workflow). Artefactos `.visual-baseline/`/`.visual-after/` git-ignored.
- 2026-06-18: **Deploy alvo = cPanel** (host actual: LiteSpeed/stableserver.net, IP 194.42.98.200) via "Setup Node.js App" (Passenger). **Cutover directo** no domínio (substitui site antigo). Artefactos criados: `.github/workflows/ci.yml` (npm ci + audit + smoke, Node 20.17/22), `.cpanel.yml` (Git VC deploy, editar `__CPANEL_USER__`), `DEPLOY.md` (runbook). Gate por resolver: confirmar Node ≥ 20.17 no dropdown do cPanel (senão reverter sqlite3@5). Gotcha: cookie `secure` em prod → AutoSSL TEM de estar activo antes do login funcionar.
- 2026-06-18: `npm audit fix` + **sqlite3 ^5.1.7 → ^6.0.1** (mantido por decisão do owner) → **0 vulnerabilidades** (eram 14). ⚠️ sqlite3@6 exige **Node ≥ 20.17 no host de deploy**.
- Vanilla JS sem framework (controlo total pelo designer)
- SQLite ficheiro local (sem servidor de BD externo)
- Backoffice sem i18n (intencional, só admin)
- Assets frontend via CDN (sem npm/bundler)
- 2026-05-26: Skills seleccionadas — frontend, anima, rest-api, auth, seo, security, github, google-analytics
- 2026-05-26: Browser Use MCP adicionado ao projecto
- 2026-05-26: PRD gerado — métrica de sucesso principal: contactos via formulário

## Pendente

- Deploy execução no cPanel (gate: Node ≥ 20.17; AutoSSL activo ANTES do login por causa do cookie `secure`)
- Residuais Low de segurança (opcionais): escapar `mailto` `msg.email` + `img.image_path` no backoffice
- `ponto_situacao.md` DESATUALIZADO — descreve estado pré-2026-06-18 (localStorage JWT, 14 vulns por corrigir); reescrever quando houver tempo
- Tradução nomes de serviços (campo `name_en`)
- Refactoring main.js (~816 linhas) e backoffice/script.js (~1400 linhas)
- Arquitetural/futuro: revogação server-side de JWT + rate-limit persistente; remover CSP `unsafe-inline` (precisa nonce/templating)
- Testes automatizados (CI já corre smoke + audit)
