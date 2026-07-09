---
name: joca-archive-mac-2026-07-08
description: Registo do JOCA antigo (Mac) arquivado e apagado em 2026-07-08, substituído pelo snapshot de migração MirrasPT/JOCA-OS
type: project
---

**O quê:** Snapshot do JOCA que estava instalado neste Mac (`/Users/renatoferreira/JOCA`) **antes** da migração de PC. Foi arquivado para `/Users/renatoferreira/JOCA_archive_2026-07-08` e depois apagado. Este ficheiro preserva a informação base para não se perder nada.

**Why:** O JOCA de produção mais atual passou a viver noutro computador e foi publicado em `github.com/MirrasPT/JOCA-OS`. Puxou-se esse repo para `/Users/renatoferreira/JOCA` (snapshot `3067e6d` — "chore(migration): full JOCA snapshot for PC transfer") e o JOCA local antigo deixou de ser fonte de verdade.

**How to apply:** Este é um registo histórico/arquivo. Não recuperar deste snapshot — a fonte de verdade é o repo `MirrasPT/JOCA-OS`. Consultar só se faltar contexto sobre o que o JOCA local tinha antes da migração.

## JOCA antigo (arquivado)
- **Remote:** `github.com/MirrasPT/JOCA.git` (repo antigo, superseded por `JOCA-OS`)
- **HEAD no arquivamento:** `ba4eba1` — "feat(joca-ui): add Claude Code base slash commands to terminal autocomplete"
- **Estrutura:** `JOCA_Logic/` (motor: skills/agents/commands/memory) + `JOCA_UI/` (browser terminal UI — React + Vite + xterm.js + node-pty, sidebar multi-sessão)
- **Inventário de componentes:** 102 skills · 30 agents · 18 commands · 9 memórias de projeto · 26 feedback
- **Trabalho local não-commitado (perdido ao apagar o arquivo):** 39 ficheiros tracked modificados (incl. conflito de merge em `JOCA_UI/backend/src/server.ts`) + 61 untracked — scripts Python de img-gen (`generate_*.py`, `download_image*.py`), imagens de teste, `graphify-out/`, `scratch/`. Histórico commitado continua seguro em `MirrasPT/JOCA`.

## JOCA novo (fonte de verdade)
- **Remote:** `github.com/MirrasPT/JOCA-OS.git` · **snapshot:** `3067e6d`
- **Estrutura:** `JOCA_Brain/` (motor, era `JOCA_Logic`) + `JOCA_OS/` (interface Next.js, era `JOCA_UI`)
- **Inventário:** 133 skills · 42 agents · 26 commands · 25 memórias de projeto · 37 feedback — superconjunto/evolução do antigo

**Migração feita:** 2026-07-08 (arquivar antigo → clonar `JOCA-OS` → registar esta memória → apagar arquivo).
