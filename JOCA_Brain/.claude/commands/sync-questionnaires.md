# /sync-questionnaires — Auditar e actualizar os questionários do JOCA

Workflow de manutenção. Detecta **drift** entre o inventário real (skills, agents, commands, CLIs) e os questionários/listas que os referenciam, depois aplica as correcções. Corre após adicionar/renomear/remover skills ou agents, ou quando os contadores ("92 skills") deixam de bater certo.

**Âmbito:** JOCA interno apenas. Nunca toca em projectos ou dados do utilizador.

**Ficheiros-alvo (os que contêm questionários ou listas de inventário):**
- `.claude/commands/install.md` — FASE 2 (mapa áreas→skills), FASE 3 (CLIs), contadores, lista de comandos no `~/CLAUDE.md`
- `.claude/commands/init-project.md` — FASE 1 (Q4 tipos), FASE 2 (tabela tipo→skills), FASE 3 (CLIs)
- `install.md` (root, bootstrap) — contadores, lista de skills
- `README.md` — contadores, secções Skills/Agents/Commands/Pipelines
- `CLAUDE.md` — Trigger Map, Pipelines
- `memory/INDEX.md` — catálogo de componentes

---

## Fase 1 — Construir inventário real (source of truth = disco)

```bash
DEV="$(git rev-parse --show-toplevel)/JOCA_Brain"; [ -d "$DEV" ] || DEV="$(pwd)"
cd "$DEV"

# Skills: name (frontmatter) + 1ª linha de description
for f in .claude/skills/*.md; do
  name=$(grep -m1 '^name:' "$f" | sed 's/^name:[[:space:]]*//')
  desc=$(grep -m1 '^description:' "$f" | sed 's/^description:[[:space:]]*//' | cut -c1-80)
  echo "SKILL ${name:-$(basename "$f" .md)} :: $desc"
done

# Agents (.md no topo de .claude/agents/)
for f in .claude/agents/*.md; do
  name=$(grep -m1 '^name:' "$f" | sed 's/^name:[[:space:]]*//')
  echo "AGENT ${name:-$(basename "$f" .md)}"
done

# Commands
ls .claude/commands/*.md | xargs -n1 basename | sed 's/\.md$//' | sed 's/^/CMD /'

# Contadores
echo "COUNT skills=$(ls .claude/skills/*.md | wc -l | tr -d ' ') agents=$(ls .claude/agents/*.md | wc -l | tr -d ' ') commands=$(ls .claude/commands/*.md | wc -l | tr -d ' ')"
```

> Nota: o `name:` do frontmatter manda, não o nome do ficheiro. Ex.: `horizon.md`→`horizon-queues`, `marketing.md`→`marketing-router`, `search.md`→`search-engine`. Listar sempre pelo `name:`.

---

## Fase 2 — Extrair referências dos questionários

Para cada ficheiro-alvo, recolher todos os nomes de skill/agent/command referenciados e todos os contadores ("N skills", "N agents", "N componentes", "N commands").

```bash
# Skills/agents mencionados nos ficheiros-alvo (tokens em backticks ou listas)
grep -rhoE '`[a-z0-9-]+`' .claude/commands/install.md .claude/commands/init-project.md \
  README.md CLAUDE.md ../install.md 2>/dev/null | tr -d '`' | sort -u

# Contadores
grep -rnoE '[0-9]+ (skills|agents|componentes|commands|comandos)' \
  .claude/commands/install.md README.md ../install.md CLAUDE.md 2>/dev/null
```

---

## Fase 3 — Diff (drift report)

Cruzar inventário (Fase 1) com referências (Fase 2). Produzir:

```
QUESTIONNAIRE DRIFT REPORT
==========================

Contadores desactualizados:
  README.md:43   "92 skills"   → real 102
  install.md:197 "92 skills"   → real 102
  ...

Skills referenciadas que NÃO existem (fantasma — corrigir/remover):
  install.md FASE 2: frontend-design, frontend-dev, api-designer, devops-engineer, canvas-design, blender
  README.md: nodejs, flutter, realtime, comfyui-*

Skills no disco AUSENTES dos questionários (cobertura em falta):
  deploy-cpanel, deploy-docker, deploy-ploi, portugal-invoicing, portugal-payments,
  react-composition, react-patterns, react-email, tailwind, shadcn, laravel-react, ...

Agents fantasma / em falta:
  <lista>

CLIs em FASE 3 vs CLIs realmente referenciados em skills/agents:
  <lista de CLIs mencionados em skills mas ausentes do form de install>
```

> Para a verificação de CLIs, fazer `grep` por nomes de binários em `.claude/skills/` e `.claude/agents/` e comparar com o form da FASE 3 do `/install` e da FASE 3 do `/init-project`.

Se `--report` for passado como argumento: parar aqui (só relatório).

---

## Fase 4 — Aplicar correcções

Edições **cirúrgicas** (nunca reescrever ficheiros inteiros sem necessidade):

1. **Contadores:** substituir cada número desactualizado pelo real.
2. **Skills fantasma:** substituir pelo nome correcto actual (ex.: `frontend-design`/`frontend-dev` → `frontend`; `api-designer` → `rest-api`; `devops-engineer` → `deploy-docker`/`deploy-ploi`/`deploy-cpanel`) ou remover se já não existir.
3. **Skills em falta:** adicionar à categoria/área certa do mapa (FASE 2 do install, tabela tipo→skills do init-project, secção Skills do README). Agrupar por domínio existente.
4. **CLIs:** alinhar o form da FASE 3 com os CLIs realmente usados pelas skills/agents.
5. **Pipelines / Trigger Map** (`CLAUDE.md`, README): adicionar workflows novos, remover os que referenciem componentes inexistentes.

> Categorização: usar a primeira palavra/domínio da `description` da skill para a colocar na secção certa (Design, Dev, Marketing, WordPress, Shopify, Vídeo, Base, etc.).

---

## Fase 5 — Validar

```bash
python3 .claude/scripts/build-skill-index.py 2>/dev/null || python .claude/scripts/build-skill-index.py
bash .claude/scripts/compile-bridges.sh 2>/dev/null || true
```

Re-correr Fase 1+2+3: o drift report deve vir **vazio** (contadores batem, zero skills fantasma). Caso contrário, repetir Fase 4 para o que ficou.

---

## Fase 6 — Relatório

```
SYNC-QUESTIONNAIRES — COMPLETO
==============================
Inventário: N skills · M agents · K commands

Corrigido:
  Contadores: X ocorrências (92→102 ...)
  Skills fantasma resolvidas: <lista>
  Skills adicionadas aos questionários: <lista>
  CLIs alinhados: <lista>

Ficheiros alterados: install.md, init-project.md, README.md, CLAUDE.md, INDEX.md
Validação: SKILL_INDEX regenerado · bridges recompilados · drift report vazio ✓
```

---

## Regras

- Source of truth = disco (`name:` do frontmatter). Os questionários seguem o disco, nunca o contrário.
- Edições cirúrgicas. Preservar estilo e ordem existentes.
- Nunca inventar skills: só listar o que existe em `.claude/skills/`.
- `--report` → só diagnóstico, sem alterações.
- Correr no fim de qualquer sessão que adicione/renomeie/remova skills ou agents (o `/save` pode sugeri-lo).
