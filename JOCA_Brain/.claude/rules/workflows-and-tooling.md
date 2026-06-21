# Workflows & Tooling

Gotchas recorrentes em workflows multi-agente e ambiente local. Carregado em todas as sessões. Terso por design.

---

## Briefs de sub-agentes (Agent / Workflow)

Cada brief de worker DEVE carregar explicitamente:
- **Anti-fabricação** — credencial/endpoint/key em falta → no-auth source ou `TODO: credencial em falta` + reportar. Nunca inventar (ver `soul.md`).
- **Verificar parsers contra resposta real** — quem escreve cliente de API externa faz 1 chamada real e valida o parsing antes de finalizar (ver `api-design.md`).
- **Componentes partilhados antes do fan-out** — em builds paralelos por página/feature, definir player/card/layout numa fase de fundação sequencial; agentes de fan-out IMPORTAM, não recriam (ver `frontend.md`).
- **Convenções do JOCA em briefs que mexem no próprio JOCA** — agente que escreve validador/linter/script sobre o JOCA recebe as convenções no brief, não as infere: `name:` do frontmatter é descritivo e ≠ ficheiro de propósito (ex.: `horizon`→`horizon-queues`); o campo `skills:` no frontmatter NÃO carrega skill (garantia = `Read()` no corpo); skills flat depth 1. Fonte: `sync-questionnaires.md` + `CLAUDE.md`. (Lição: um linter escrito sem isto marcou 3 skills válidas como FAIL.)

Sub-agentes **não herdam** `soul.md` automaticamente — só recebem o brief. Por isso estas regras vão no brief, não se assumem.

## Workflow tool

- **`args` não-fiável** — dados passados em `args` podem chegar `undefined` ao script. Embeber dados como literais no script, ou validar `args` no arranque com erro claro antes de usar.
- **Verify adversarial sem falsos positivos** — passar ao verificador o conjunto exacto de ficheiros/linhas DESTA tarefa (ou commitar por fase). Caso contrário o review estático sobre o `git diff` cumulativo marca trabalho anterior aprovado como "scope creep".
- **Git destrutivo ≠ workflow** — sequência determinística não-paralelizável → usar script versionado. Workflow é bom para fan-out (auditoria, research, drafting).
- **Upgrades grandes do próprio JOCA = 2 fases** (padrão validado): Fase 1 = workflow de análise → escreve plano + drafts em staging (`_improvement/`), não toca canónicos. Fase 2 = aplicação: ficheiros independentes (skills/agentes/hooks novos) via workflow paralelo; ficheiros canónicos partilhados (`CLAUDE.md`, `soul.md`, `settings.json`) via main loop sequencial (anti-clobber). Verificar hooks com `node` antes de confiar.

## Ambiente local (Windows-first)

Renato corre **Windows** como ambiente primário. Ao escrever scripts/skills que tocam credenciais, binários ou paths:
- **`python`, não `python3`** — `python3` é o stub vazio da Microsoft Store (`ModuleNotFoundError`). Detectar: `for PY in python python3; do command -v "$PY" && "$PY" -c "import <mod>" && break; done`.
- **Credenciais** — Claude em `~/.claude/.credentials.json` (não Keychain macOS); Codex sem binário `sqlite3` → usar `node:sqlite`.
- **Detecção de processo local** — filtrar `Name='python.exe'` + `CommandLine -like '*main.py*'`. NUNCA incluir o nome único da app no filtro `Win32_Process` — a própria pwsh que corre a query contém essa string (falso positivo "loop de reinício").
- **Matar servidores por porta** — `taskkill /F /T /PID` (o `/T` mata a árvore; vite/esbuild children seguram a porta).
- **Renomear/mover a pasta-raiz do projecto** — NÃO se faz de dentro do Claude: o cwd do próprio processo Claude (e dos shells persistentes) segura o directório → `Permission denied`/`Sharing violation` no `git mv`/`move`. Padrão: (1) actualizar TODAS as refs in-session por `sed`/Edit — ficheiros *internos* são graváveis, só o *rename do dir* bloqueia; (2) parar apps que leem a pasta (libertar handles); (3) deixar um `.bat` (`cd /d %~dp0` + `git mv old new`) que o user corre **com o Claude fechado**; (4) reabrir o Claude na pasta nova. Preferir `git mv` (preserva história) com fallback `move`.

## Plugins Claude Code

Gerir por CLI, não só pelo `/plugin` TUI interactivo:
```bash
claude plugin marketplace add <repo>
claude plugin install <plugin>@<marketplace>
```
Plugins de marketplace são sempre **user-scope** → custo always-on em todas as sessões.

## Browser (Playwright) no main loop

O MCP playwright pode não estar exposto ao loop principal (só aos sub-agentes). Browser checks (screenshots, console, DOM) no main loop → delegar a um agente; não assumir disponível inline.

## Asset readiness

Um plano que depende de **propriedades visuais** de assets (vídeo sem watermark, hook ao seg. 0, imagem limpa) não é verificável pelo nome do ficheiro. Antes de declarar "pronto a publicar", amostrar frames via `gemini-brain`/`watch`. Ficheiro existir ≠ ficheiro pronto.
