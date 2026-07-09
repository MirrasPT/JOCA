---
name: joca-os-macos-setup
description: Como correr o JOCA_OS em macOS (node-pty prebuild, spawn-helper +x, launchers, JOCA_EXTRA_ROOTS). Setup validado 2026-07-08 neste Mac.
type: knowledge
---

**Contexto:** JOCA_OS pulled do `MirrasPT/JOCA-OS` para `/Users/renatoferreira/JOCA` (migração de PC 2026-07-08). Últimas alterações tinham sido só em Windows. Código É cross-platform (guardas `process.platform`, `SHELL` default `/bin/zsh`, `which claude`), mas o setup em macOS tem 4 gotchas.

**Why:** Evitar repetir o diagnóstico ao instalar noutro Mac / após novo clone. Ambiente validado: darwin arm64, Node 22.16, npm 10.9, Xcode CLT.

## Passos de setup (macOS)
1. `cd JOCA_OS/backend && npm install` — node-pty usa **prebuild `darwin-arm64`** (não compila). ⚠ **NÃO correr `npm run setup`** (script da raiz): força `npx node-gyp rebuild`, que **compila** e parte no **Python 3.12+/3.14** (distutils removido). O install por pasta + `start.sh` (só `tsc`) chega.
2. `cd JOCA_OS/frontend && npm install`
3. `bash start.sh` → faz `tsc` do backend e arranca. Portas **7491** (backend) / **7492** (frontend Vite). Abre `http://localhost:7492`.

## Gotchas
- **node-pty `posix_spawnp failed`**: o `spawn-helper` do prebuild vem sem bit executável no Mac. O servidor **auto-corrige no arranque** via `ensureNodePtyHelpersExecutable()` (chmod 755 em `node_modules/node-pty/prebuilds/*/spawn-helper`). Fix manual se preciso: `chmod +x backend/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper`.
- **Launchers sem +x**: `start.sh`, `stop.sh`, `JOCA OS.command` vieram do Windows sem bit executável → `chmod +x`. (Line endings já são LF.)
- **Pré-requisito:** CLI `claude` no PATH (alimenta os terminais das sessões).

## File browser — allowed roots
`security-fs.ts` restringe o file browser a **HOME** (`/Users/renatoferreira`). No Windows todos os discos eram roots (por isso lá navegava tudo); no Mac só HOME → aceder acima (`/Users`, `/`) dava **403**. Alargar com `JOCA_EXTRA_ROOTS` (colon-separated). **`start.sh` foi editado 2026-07-08 para default `JOCA_EXTRA_ROOTS=/`** (disco inteiro, paridade com Windows). Overridable: `JOCA_EXTRA_ROOTS="/Users:/Volumes" bash start.sh`.
⚠ Com root `/`, o bloqueio de paths sensíveis (`.ssh`/`.aws`/Keychains/`.env`/histórico) **só se aplica dentro da HOME** (`isSensitivePath` é relativo à home) — fora da home não protege. Aceitável por ser local-only / localhost / máquina própria.

## Docs desatualizados (não são a fonte de verdade)
`JOCA_OS/CLAUDE.md` ainda diz portas 7381/7382 e recomenda `npm run setup` — stale, ignorar. Portas reais 7491/7492; setup = install por pasta.
