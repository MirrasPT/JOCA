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

Projecto inicializado no JOCA. CLAUDE.md, PRD.md, .mcp.json (Browser Use) criados. Graphify scan feito (720 nodes, 895 edges, 42 comunidades). MVP funcional, sem trabalho de código nesta sessão.

## Decisões tomadas

- Vanilla JS sem framework (controlo total pelo designer)
- SQLite ficheiro local (sem servidor de BD externo)
- Backoffice sem i18n (intencional, só admin)
- Assets frontend via CDN (sem npm/bundler)
- 2026-05-26: Skills seleccionadas — frontend, anima, rest-api, auth, seo, security, github, google-analytics
- 2026-05-26: Browser Use MCP adicionado ao projecto
- 2026-05-26: PRD gerado — métrica de sucesso principal: contactos via formulário

## Pendente

- Deploy para produção (renatoferreira.org)
- CI/CD GitHub Actions
- Tradução nomes de serviços (campo name_en)
- Refactoring main.js (~816 linhas) e backoffice/script.js (~1400 linhas)
- Migrar JWT para httpOnly cookies
- Testes automatizados
