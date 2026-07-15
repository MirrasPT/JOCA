# /migrate — Migração v1-legacy → v2.0

Guia completo para migrar uma instalação JOCA da branch `v1-legacy` para a versão actual (`master`).

**Repositório:** https://github.com/MirrasPT/JOCA
**De:** `v1-legacy` (skills nested, AGENTS.md, install.md na raiz, sem soul.md)
**Para:** `master` / v2.0 (flat layout, JOCA_OS integrado, soul.md, SKILL_INDEX)

---

## CONTEXTO — Estrutura Nova

Na v2.0, o JOCA instala com layout flat:

```
JOCA/                     ← raiz = JOCA_Logic directo
├── .claude/
│   ├── agents/
│   ├── commands/         ← /install, /resume, /save, /goal, etc.
│   ├── hooks/
│   ├── rules/
│   ├── scripts/
│   ├── skills/           ← flat, *.md (sem subpastas)
│   └── settings.json
├── memory/
│   ├── INDEX.md
│   ├── SKILL_INDEX.json  ← auto-gerado
│   ├── soul.md           ← personalidade core (novo na v2.0)
│   ├── projects/
│   ├── tools/
│   └── feedback/
├── JOCA_OS/              ← browser UI (React + Vite + xterm.js + node-pty)
│   ├── frontend/
│   ├── backend/
│   └── data/
├── CLAUDE.md
└── README.md
```

**Nota:** NÃO existe pasta `JOCA_Logic/` separada. O conteúdo do JOCA_Logic vive directamente na raiz. O `JOCA_OS/backend/src/server.ts` tem `findJocaLogicRoot()` que detecta `.claude/` + `CLAUDE.md` fazendo walk-up a partir de `__dirname` — funciona com este layout sem alterações.

---

## FASE 0 — Assessment da Instalação Legacy

### 1. Identificar instalação actual

```bash
# Confirmar que estamos na pasta JOCA com v1-legacy
ls .claude/commands/ memory/INDEX.md CLAUDE.md
cat CLAUDE.md | head -20
```

Sinais de v1-legacy:
- `AGENTS.md` na raiz
- `CREDITOS.md` na raiz
- `install.md` na raiz (fora de `.claude/commands/`)
- Skills em subdirectórios nested com `SKILL.md` ou ficheiros compostos
- Sem `memory/soul.md`
- Sem `memory/SKILL_INDEX.json`

### 2. Inventariar memória existente

**LER TUDO antes de apagar o que quer que seja:**

```bash
cat memory/INDEX.md
ls memory/projects/
ls memory/tools/
ls memory/feedback/
```

Para cada ficheiro em `memory/projects/`, `memory/tools/` e `memory/feedback/`:
- Ler o conteúdo completo
- Guardar numa variável ou bloco para reutilizar na Fase 3

**Conteúdo da memória legacy a preservar:**
- `memory/INDEX.md` — extrair apenas a secção `## Projectos` e entradas custom do utilizador
- `memory/projects/*.md` — cada ficheiro é uma entrada de projecto (manter intacto)
- `memory/tools/*.md` — referências de ferramentas (graphify.md, laravel-stack.md, mcp-routing.md, motion.md, etc.)
- `memory/feedback/*.md` — histórico de sessões (manter se existir conteúdo)

**NÃO preservar da INDEX.md legacy:**
- Secção `## Commands` (substituída pelos novos comandos)
- Secção `## Agents` (substituída pelos novos agentes)
- Listagens de skills (substituídas pelo SKILL_INDEX.json)

### 3. Verificar ~/CLAUDE.md do utilizador

```bash
cat ~/CLAUDE.md 2>/dev/null | head -40
```

Anotar: nome, papel, localização, projectos activos, preferências. Estes dados são reutilizados na Fase 4.

---

## FASE 1 — Backup e Limpeza

### 1. Backup completo da memória

```bash
BACKUP_DIR="$HOME/joca-v1-backup-$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"
cp -R memory/ "$BACKUP_DIR/memory"
cp CLAUDE.md "$BACKUP_DIR/CLAUDE.md"
cp ~/CLAUDE.md "$BACKUP_DIR/home-CLAUDE.md" 2>/dev/null
echo "✓ Backup em: $BACKUP_DIR"
```

### 2. Remover TUDO da v1-legacy excepto memória

Apagar todos os ficheiros que vão ser substituídos pela v2.0:

```bash
# Skills, agentes, comandos antigos
rm -rf .claude/skills/ .claude/agents/ .claude/commands/
rm -rf .claude/scripts/ .claude/hooks/ .claude/templates/ .claude/rules/
rm -f .claude/settings.json

# Ficheiros raiz antigos
rm -f AGENTS.md CREDITOS.md install.md README.md CLAUDE.md
rm -f .mcp.json

# JOCA_OS antigo (se existir — vai ser substituído)
rm -rf JOCA_OS/

# NÃO apagar:
# - memory/ (vai ser migrada)
# - .git/ (preservar histórico)
# - .gitignore / .graphifyignore (preservar)
```

Confirmar que só resta:
```bash
ls -la
# Deve ter: .git/ memory/ .gitignore (e pouco mais)
```

---

## FASE 2 — Instalar v2.0

### 1. Obter ficheiros novos do master

```bash
# Opção A: se o remote já aponta para MirrasPT/JOCA
git fetch origin master
git checkout origin/master -- .claude/ JOCA_OS/ CLAUDE.md README.md

# Opção B: clone fresco (se preferir)
cd ..
git clone https://github.com/MirrasPT/JOCA.git JOCA-new
# Depois copiar ficheiros novos para a pasta JOCA existente
```

### 2. Verificar estrutura resultante

```bash
ls -la
# Deve ter:
# .claude/          ← novo (skills, agents, commands, scripts, settings)
# JOCA_OS/          ← novo (frontend + backend)
# memory/           ← preservado (vai ser migrado)
# CLAUDE.md         ← novo
# README.md         ← novo
```

```bash
ls .claude/commands/
# Deve incluir: install.md, resume.md, save.md, init-project.md, etc.

ls .claude/skills/
# Estrutura FLAT: só ficheiros *.md, sem subpastas (base/design/dev nested = v1-legacy)
```

### 3. Instalar dependências do JOCA_OS

```bash
cd JOCA_OS
npm run setup   # instala frontend + backend + compila node-pty
cd ..
```

Se `npm run setup` não existir:
```bash
cd JOCA_OS/backend && npm install && cd ../frontend && npm install && cd ../..
```

---

## FASE 3 — Migração da Memória

### 1. Recriar soul.md (NOVO na v2.0)

Se `memory/soul.md` não existir, criar inline com a estrutura base abaixo (os valores de calibração serão preenchidos na Fase 4):

```markdown
---
name: soul
description: "Personalidade core do JOCA — identidade, drives, comunicação, limites."
type: core
priority: 0
inject: always
immutable: true
---

# SOUL — JOCA

## Identity
Sistema operativo cognitivo para engenharia de software. Parceiro autónomo — não assistente.
Optimiza para: resolução cirúrgica sem fricção, com integridade absoluta.

## Working Principles
- Surface assumptions before choosing; uncertain = ask (max 1 cycle)
- Touch only what is necessary; never improve adjacent code unprompted
- Define success before starting; verify per step
- Prefer action over planning when cost of reversal is low
- Skill-first: activate relevant skill without asking when match ≥ 60%

## Drives
Clarity over verbosity. Surgical over comprehensive. Autonomy over deference.
Satisfaction: clean decisions, minimal code, zero wasted tokens.
Hierarchy: Integrity > Autonomy > Precision > Economy > Speed.

## Communication
<COMMUNICATION_MODE> default. No articles, no hedging, no filler. Fragments OK.
Technical terms exact. Code paths literal. One idea = one sentence.
Adjust: "stop caveman" / "normal mode".

## User Alignment — <USER_NAME>
<USER_ROLE>. Strong: <USER_STRENGTHS>. Learning: <USER_LEARNING_AREAS>.
<STRENGTH_AREA> → execute directly, trust their judgment.
<LEARNING_AREA> → explain architectural decision 1 line before implementing.
Frustration triggers: verbosity, repetition, unnecessary confirmations.
Max 1 confirmation per flow. Show visual output when possible.

## Hard Limits
- Never fabricate paths, APIs, capabilities, or facts
- Never add features that weren't requested
- Never expose secrets or credentials
- Never skip irreversible-action warnings
- Never rewrite adjacent code when surgical change suffices
- Never respond generically when a skill exists for the domain

## Behavioral Biases (Intentional)
Action > planning (when reversible). Specific > generic. Edit > create.
Test > assume. One dense file > five organized files.

## Calibration Parameters

autonomy_level: <PENDING>
communication_mode: <PENDING>
assertiveness: <PENDING>
error_tolerance: <PENDING>
explanation_depth: on-demand
auto_test: <PENDING>
```

### 2. Migrar memory/projects/

Os ficheiros de projecto mantêm o formato — copiar directamente. Apenas verificar se os paths referenciados ainda existem:

```bash
ls memory/projects/
```

Para cada ficheiro `.md` em `memory/projects/`:
- Ler conteúdo
- Se referencia paths antigos (e.g., path para `JOCA_Logic/` separado), actualizar
- Manter o resto intacto

### 3. Migrar memory/tools/

Os ficheiros em `memory/tools/` são referências de ferramentas. Manter os que ainda forem relevantes:

- `graphify.md` — manter se graphify estiver instalado
- `laravel-stack.md` — manter se usar Laravel
- `mcp-routing.md` — manter (decisões de routing MCP são reutilizáveis)
- `motion.md` — manter se usar animação

Remover ficheiros que referenciem ferramentas ou patterns já não usados.

### 4. Migrar memory/feedback/

Se existir conteúdo (não apenas `.gitkeep`), manter intacto. É histórico.

### 5. Reescrever memory/INDEX.md

O INDEX.md da v2.0 tem formato diferente — já não lista commands/agents/skills (esses estão nos ficheiros `.claude/` e no `SKILL_INDEX.json`). O INDEX.md agora é apenas um índice de memória do utilizador:

```markdown
# JOCA Memory Index

## Projectos
- [nome.md](projects/nome.md) — descrição curta

## Tools
- [graphify.md](tools/graphify.md) — notas de uso do graphify
- [mcp-routing.md](tools/mcp-routing.md) — decisões de routing MCP

## Feedback
<!-- Entradas adicionadas por /save (auto-extract) -->
```

Preencher com as entradas que realmente existem em `projects/`, `tools/` e `feedback/`.

### 6. Regenerar SKILL_INDEX.json

```bash
# Windows usa `python` (o `python3` é o stub vazio da Store); macOS/Linux usam `python3`.
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" .claude/scripts/build-skill-index.py && break; done || echo "Script não encontrado — SKILL_INDEX será gerado na próxima sessão"
```

---

## FASE 4 — Questionário Soul.md

Correr o questionário de calibração de personalidade. Usar `AskUserQuestion` para cada pergunta.

**Q1 — Nível de Autonomia**
```
question: "Quanto autónomo queres que o JOCA seja?"
header: "Autonomia"
options:
  - "Máxima — executa tudo sem perguntar, só pára em irreversíveis (Recomendado)"
  - "Alta — executa a maioria, pede em decisões de arquitectura"
  - "Moderada — pede confirmação em alterações multi-ficheiro"
  - "Baixa — pede sempre antes de alterar código"
```
Mapear: Máxima=0.95, Alta=0.80, Moderada=0.60, Baixa=0.30

**Q2 — Estilo de Comunicação**
```
question: "Como preferes que o JOCA comunique?"
header: "Comunicação"
options:
  - "Caveman Full — fragmentos, zero filler, máxima compressão (Recomendado)"
  - "Caveman Lite — sem filler mas frases completas"
  - "Normal — profissional e conciso, sem compressão extrema"
```
Mapear: full, lite, normal

**Q3 — Comportamento em Erros**
```
question: "Quando encontra um erro no teu código, o JOCA deve:"
header: "Erros"
options:
  - "Corrigir imediatamente sem perguntar (Recomendado)"
  - "Mostrar o problema e a correcção, aplicar após confirmação"
  - "Reportar o problema sem corrigir — eu decido"
```
Mapear: fail-fast, balanced, permissive

**Q4 — Testes Automáticos**
```
question: "Queres que o JOCA corra testes automaticamente após alterações?"
header: "Auto-test"
options:
  - "Sim — trigger automático após código implementado (Recomendado)"
  - "Não — só quando eu pedir"
```
Mapear: true, false

### Aplicar calibração

Substituir os `<PENDING>` no `memory/soul.md` secção Calibration Parameters:

```yaml
autonomy_level: [valor]
communication_mode: [valor]
assertiveness: [inferido: máxima=0.85, alta=0.75, moderada=0.60, baixa=0.50]
error_tolerance: [valor]
explanation_depth: on-demand
auto_test: [valor]
```

Substituir também os placeholders `<USER_NAME>`, `<USER_ROLE>`, `<USER_STRENGTHS>`, `<USER_LEARNING_AREAS>` na secção User Alignment — usar dados do `~/CLAUDE.md` ou perguntar se não existirem.

Confirmar:
```
✓ Soul calibrado — autonomia [X], comunicação [Y], erros [Z], auto-test [W]
```

---

## FASE 5 — Actualizar ~/CLAUDE.md

Ler o `~/CLAUDE.md` existente. Actualizar a secção JOCA sem apagar dados pessoais ou de outros projectos:

```markdown
## JOCA
Toolkit instalado em: [caminho]
Comandos: /install · /init-project · /resume · /save · /create-skill · /plan · /debug · /review-code · /review-design · /help-joca · /one-shot · /update-joca · /upgrade-joca · /goal

Skills activas:
- Base: caveman, karpathy-guidelines, agent-context, create-skill
- [categoria]: [lista por área activada]

MCPs globais: [lista dos MCPs configurados]
```

---

## FASE 6 — Verificação Final

### 1. Confirmar estrutura

```bash
echo "=== Root ===" && ls -la
echo "=== .claude/ ===" && ls .claude/
echo "=== commands ===" && ls .claude/commands/
echo "=== skills ===" && ls .claude/skills/
echo "=== memory ===" && ls memory/
echo "=== soul ===" && head -5 memory/soul.md
echo "=== JOCA_OS ===" && ls JOCA_OS/
```

### 2. Testar JOCA_OS

```bash
cd JOCA_OS && npm run dev &
sleep 3
# Portas reais: backend 7371 · frontend 7372
curl -s http://localhost:7371/health 2>/dev/null && echo "✓ Backend OK" || echo "✗ Backend falhou"
curl -s http://localhost:7371/joca-logic 2>/dev/null | head -1 && echo "✓ JOCA_Logic detectado" || echo "✗ JOCA_Logic não encontrado"
kill %1 2>/dev/null
cd ..
```

### 3. Confirmar que restos v1-legacy foram removidos

```bash
# Nenhum destes deve existir:
ls AGENTS.md 2>/dev/null && echo "⚠ AGENTS.md ainda existe — apagar"
ls CREDITOS.md 2>/dev/null && echo "⚠ CREDITOS.md ainda existe — apagar"
ls install.md 2>/dev/null && echo "⚠ install.md na raiz ainda existe — apagar"
```

### 4. Relatório final

```
MIGRAÇÃO v1-legacy → v2.0 COMPLETA
────────────────────────────────────

Estrutura:
  ✓ .claude/ — [n] skills, [n] agents, [n] commands
  ✓ memory/ — soul.md calibrado, [n] projectos migrados, [n] tools
  ✓ JOCA_OS/ — instalado e funcional
  ✓ Restos v1-legacy removidos

Memória migrada:
  ✓ projects/ — [lista]
  ✓ tools/ — [lista]
  ✓ feedback/ — [estado]
  ✓ INDEX.md — reescrito para v2.0

Soul.md:
  ✓ Autonomia: [X] | Comunicação: [Y] | Erros: [Z] | Auto-test: [W]

Próximo:
  - Lançar JOCA UI: duplo-clique em "JOCA UI.command" ou npm start em JOCA_OS/
  - Correr /install para configurar MCPs, API keys e integrações
  - Correr /resume no início de cada sessão
```

---

## REGRAS

- **NUNCA apagar memória sem backup** — Fase 1 é obrigatória antes de qualquer limpeza
- **Ler TODA a memória antes de apagar** — não confiar em nomes de ficheiro, ler conteúdo
- **Perguntar antes de apagar entries de projecto** — podem ter contexto valioso
- **O soul.md é obrigatório** — se não for preenchido, o JOCA perde personalidade
- **Não misturar v1 e v2** — remover TODOS os ficheiros antigos, não fazer merge parcial de skills
- **Testar o JOCA_OS** — confirmar que `findJocaLogicRoot()` detecta o layout flat
