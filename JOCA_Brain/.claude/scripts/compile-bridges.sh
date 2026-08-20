#!/usr/bin/env bash
# compile-bridges.sh — Generates cross-CLI bridge files from canonical .claude/ source
# Usage: ./compile-bridges.sh [--dry-run] [--target claude|codex|gemini|all]
#
# Source of truth: .claude/ (skills, agents, commands, settings)
# Targets: GEMINI.md, .agents/skills/, .codex/agents/, AGENTS.md
#
# Sincroniza E poda: o que desaparece da fonte é removido do espelho (enumerado
# nome a nome antes de apagar). --dry-run lista sem tocar em nada.

set -euo pipefail

JOCA_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLAUDE_DIR="$JOCA_ROOT/.claude"
AGENTS_DIR="$CLAUDE_DIR/agents"
SKILLS_DIR="$CLAUDE_DIR/skills"
CODEX_DIR="$JOCA_ROOT/.codex"
CODEX_AGENTS_DIR="$CODEX_DIR/agents"
BRIDGE_SKILLS_DIR="$JOCA_ROOT/.agents/skills"

DRY_RUN=false
TARGET="all"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --target) TARGET="$2"; shift 2 ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

log() { echo "[compile] $*"; }
dry() { if $DRY_RUN; then echo "[dry-run] $*"; return 1; fi; return 0; }

# ─── 1. Sync .agents/skills/ (Codex skill mirror) ─────────────────────────────
sync_skills() {
  log "Syncing .agents/skills/ from .claude/skills/..."

  local count=0
  while IFS= read -r -d '' skill_file; do
    local rel_path="${skill_file#$SKILLS_DIR/}"
    local dest="$BRIDGE_SKILLS_DIR/$rel_path"
    local dest_dir="$(dirname "$dest")"

    if [[ ! -d "$dest_dir" ]]; then
      dry "mkdir -p $dest_dir" && mkdir -p "$dest_dir"
    fi

    if [[ ! -f "$dest" ]] || ! cmp -s "$skill_file" "$dest"; then
      dry "cp $rel_path" && cp "$skill_file" "$dest"
      count=$((count + 1))
    fi
  done < <(find "$SKILLS_DIR" -name "SKILL.md" -print0 2>/dev/null)

  # Also sync standalone .md skills (not in subdirs with SKILL.md)
  while IFS= read -r -d '' skill_file; do
    local rel_path="${skill_file#$SKILLS_DIR/}"
    local dest="$BRIDGE_SKILLS_DIR/$rel_path"
    local dest_dir="$(dirname "$dest")"

    if [[ ! -d "$dest_dir" ]]; then
      dry "mkdir -p $dest_dir" && mkdir -p "$dest_dir"
    fi

    if [[ ! -f "$dest" ]] || ! cmp -s "$skill_file" "$dest"; then
      dry "cp $rel_path" && cp "$skill_file" "$dest"
      count=$((count + 1))
    fi
  done < <(find "$SKILLS_DIR" -maxdepth 2 -name "*.md" ! -name "SKILL.md" -print0 2>/dev/null)

  log "  Skills synced: $count files updated"
}

# ─── 1b. Prune: remover do espelho o que já não existe na fonte ───────────────
# Regra dura (rules/task-intake.md, Segurança): alvo definido por CRITÉRIO e não
# por lista explícita → ENUMERAR e MOSTRAR antes de apagar. Nunca apagar em
# silêncio, nunca uma pasta, nunca `rm -rf`.
#
# Sem isto, uma skill/agente apagado da fonte ficava no espelho para sempre — e
# já aconteceu pior: host/utilizador/chave SSH reais sobreviveram num espelho
# depois de limpos no canónico.

# Ficheiros que vivem no espelho por desenho e NÃO vêm da fonte (nunca podados).
# Nomes relativos à raiz do respectivo espelho.
PRUNE_KEEP_SKILLS=( "README.md" )
PRUNE_KEEP_CODEX=( "README.md" )

in_list() {
  local needle="$1"; shift
  local item
  for item in "$@"; do [[ "$item" == "$needle" ]] && return 0; done
  return 1
}

# prune_mirror <rótulo> <dir_espelho> <extensão_gerada> <função_de_origem> <keep...>
# <função_de_origem> recebe o path relativo e devolve 0 se a fonte existe.
prune_mirror() {
  local label="$1" mirror_dir="$2" ext="$3" src_probe="$4"; shift 4
  local keep=( "$@" )

  # ── GUARDAS (correm ANTES de qualquer remoção) ──────────────────────────────
  [[ -n "$mirror_dir" ]] || die "prune $label: dir de espelho vazio"
  if [[ ! -d "$mirror_dir" ]]; then
    log "  Prune $label: espelho não existe ainda — nada a podar"
    return 0
  fi

  # Recolher: total de ficheiros gerados no espelho + os órfãos.
  local total=0
  local -a orphans=()
  local f rel
  while IFS= read -r -d '' f; do
    rel="${f#$mirror_dir/}"
    in_list "$rel" "${keep[@]}" && continue   # ficheiro legítimo do espelho
    total=$((total + 1))
    "$src_probe" "$rel" || orphans+=("$rel")
  done < <(find "$mirror_dir" -type f -name "*$ext" -print0 2>/dev/null)

  if [[ ${#orphans[@]} -eq 0 ]]; then
    log "  Prune $label: 0 órfãos (${total} ficheiros espelhados)"
    return 0
  fi

  # Travão de segurança: apagar mais de metade do espelho é sinal de fonte
  # partida (dir errado, checkout a meio), não de limpeza. Aborta sem tocar.
  if [[ "$total" -gt 0 && $(( ${#orphans[@]} * 2 )) -gt "$total" ]]; then
    die "prune $label: ${#orphans[@]} de ${total} ficheiros dados como órfãos (>50%) — fonte provavelmente inválida. Nada foi apagado."
  fi

  # ── ENUMERAR antes de apagar (nome a nome) ─────────────────────────────────
  log "  Prune $label: ${#orphans[@]} órfão(s) a remover (já não existem na fonte):"
  for rel in "${orphans[@]}"; do log "    - $rel"; done

  if $DRY_RUN; then
    echo "[dry-run] não removido (--dry-run)"
    return 0
  fi

  # ── REMOVER: ficheiro a ficheiro, só ficheiros regulares, dentro do espelho ─
  local removed=0
  for rel in "${orphans[@]}"; do
    local victim="$mirror_dir/$rel"
    [[ -f "$victim" && ! -L "$victim" ]] || { log "    ⚠ ignorado (não é ficheiro regular): $rel"; continue; }
    rm -f -- "$victim"
    removed=$((removed + 1))
  done
  log "  Prune $label: $removed removido(s)"
}

# Origem de um .md espelhado em .agents/skills/ → .claude/skills/<mesmo path>
_src_has_skill() { [[ -f "$SKILLS_DIR/$1" ]]; }
# Origem de um .toml em .codex/agents/ → .claude/agents/<nome>.md
_src_has_agent() { [[ -f "$AGENTS_DIR/${1%.toml}.md" ]]; }

prune_skills() {
  log "Prune .agents/skills/ (órfãos face a .claude/skills/)..."
  [[ -d "$SKILLS_DIR" ]] || die "prune skills: fonte inexistente: $SKILLS_DIR"
  [[ "$(count_md "$SKILLS_DIR")" -gt 0 ]] || die "prune skills: 0 skills na fonte — recusado"
  prune_mirror "skills" "$BRIDGE_SKILLS_DIR" ".md" _src_has_skill "${PRUNE_KEEP_SKILLS[@]}"
}

prune_codex_agents() {
  log "Prune .codex/agents/ (órfãos face a .claude/agents/)..."
  [[ -d "$AGENTS_DIR" ]] || die "prune agentes: fonte inexistente: $AGENTS_DIR"
  [[ "$(count_md "$AGENTS_DIR")" -gt 0 ]] || die "prune agentes: 0 agentes na fonte — recusado"
  prune_mirror "agentes" "$CODEX_AGENTS_DIR" ".toml" _src_has_agent "${PRUNE_KEEP_CODEX[@]}"
}

# ─── 2. Generate .codex/agents/*.toml from .claude/agents/*.md ─────────────────
compile_codex_agents() {
  log "Compiling .codex/agents/ from .claude/agents/..."

  mkdir -p "$CODEX_AGENTS_DIR"
  local count=0

  for agent_file in "$AGENTS_DIR"/*.md; do
    [[ -f "$agent_file" ]] || continue
    local name="$(basename "$agent_file" .md)"
    local toml_file="$CODEX_AGENTS_DIR/$name.toml"

    # Extract frontmatter fields
    local description=""
    local body=""
    local in_frontmatter=false
    local past_frontmatter=false
    local in_desc_block=false

    while IFS= read -r line; do
      line="${line%$'\r'}"  # CRLF safety — com \r o "---" nunca casa e o frontmatter inteiro vaza para o body
      if [[ "$line" == "---" && "$past_frontmatter" == false ]]; then
        if $in_frontmatter; then
          past_frontmatter=true
        else
          in_frontmatter=true
        fi
        continue
      fi

      if $in_frontmatter && ! $past_frontmatter; then
        if $in_desc_block; then
          if [[ "$line" =~ ^[[:space:]]+(.*)$ ]]; then
            # continuação do block scalar (description: | / >) — juntar com espaço
            local cont="${BASH_REMATCH[1]}"
            if [[ -n "$cont" ]]; then
              [[ -n "$description" ]] && description+=" "
              description+="$cont"
            fi
            continue
          fi
          in_desc_block=false  # linha sem indentação = chave nova; processar abaixo
        fi
        if [[ "$line" =~ ^description:[[:space:]]*([\|\>][+-]?)[[:space:]]*$ ]]; then
          # YAML block scalar (description: | ou >) — valor vem nas linhas indentadas seguintes
          in_desc_block=true
          description=""
        elif [[ "$line" =~ ^description:\ *(.+)$ ]]; then
          description="${BASH_REMATCH[1]}"
          description="${description#\"}"
          description="${description%\"}"
        fi
      elif $past_frontmatter; then
        body+="$line"$'\n'
      fi
    done < "$agent_file"

    # If no frontmatter, use first paragraph as description, rest as body
    if [[ -z "$description" ]]; then
      description="$(head -5 "$agent_file" | grep -v '^---' | grep -v '^#' | head -1)"
      body="$(cat "$agent_file")"
    fi

    # Write TOML
    if dry "write $name.toml"; then
      cat > "$toml_file" << TOML
description = """${description}"""
developer_instructions = """
${body}"""
name = "${name}"
TOML
      count=$((count + 1))
    fi
  done

  log "  Codex agents compiled: $count"
}

# ─── Extracção de secções canónicas (fail-loud) ───────────────────────────────
die() { echo "[compile] ERRO: $*" >&2; exit 1; }

# extract_section <ficheiro> <heading literal>
# Imprime o heading e tudo até ao próximo heading de nível igual ou superior.
# Não encontrar o heading (ou encontrar secção vazia) é ERRO FATAL — nunca escrever
# um ficheiro-ponte meio-vazio em silêncio.
extract_section() {
  local file="$1" heading="$2" out=""
  [[ -f "$file" ]] || die "extract_section: ficheiro inexistente: $file"
  out="$(JOCA_HEADING="$heading" awk '
    BEGIN {
      h = ENVIRON["JOCA_HEADING"]; lvl = 0
      while (substr(h, lvl + 1, 1) == "#") lvl++
      found = 0
    }
    found == 0 { if ($0 == h) { found = 1; print } ; next }
    {
      if ($0 ~ /^#+ /) {
        n = 0; while (substr($0, n + 1, 1) == "#") n++
        if (n <= lvl) exit
      }
      print
    }
  ' "$file")" || die "extract_section: awk falhou em $file"
  [[ -n "$out" ]] || die "secção não encontrada (ou vazia): '$heading' em ${file#$JOCA_ROOT/}"
  # heading sozinho, sem corpo → também é falha
  [[ "$(printf '%s\n' "$out" | wc -l | tr -d ' ')" -gt 1 ]] \
    || die "secção sem corpo: '$heading' em ${file#$JOCA_ROOT/}"
  printf '%s\n' "$out"
}

# count_md <dir> — nº de .md à profundidade 1
count_md() {
  find -L "$1" -maxdepth 1 -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' '
}

# Cruza as contagens do disco com o índice gerado; divergência = aviso (o índice
# pode estar por regenerar), nunca um número inventado no ficheiro-ponte.
check_index_counts() {
  local fs_skills="$1" fs_agents="$2" idx="$JOCA_ROOT/memory/SKILL_INDEX.json"
  [[ -f "$idx" ]] || return 0
  command -v python3 >/dev/null 2>&1 || return 0
  local pair
  pair="$(python3 -c 'import json,sys
try: d=json.load(open(sys.argv[1]))
except Exception: sys.exit(0)
print(sum(1 for x in d if x.get("type")=="skill"), sum(1 for x in d if x.get("type")=="agent"))' "$idx" 2>/dev/null || true)"
  [[ -n "$pair" ]] || return 0
  local idx_skills="${pair% *}" idx_agents="${pair#* }"
  if [[ "$idx_skills" != "$fs_skills" || "$idx_agents" != "$fs_agents" ]]; then
    log "  ⚠ SKILL_INDEX.json desactualizado (índice: ${idx_skills} skills / ${idx_agents} agentes · disco: ${fs_skills}/${fs_agents}) — será regenerado no fim"
  fi
}

# ─── 3. Corpo partilhado dos ficheiros-ponte (AGENTS.md + GEMINI.md) ──────────
# Regra (rules/orchestration-patterns.md, anti-patterns): "listas de capacidades
# escritas à mão nos prompts desactualizam-se em silêncio — apontar ao índice
# gerado, não transcrever". Por isso: contagens derivadas do `ls`, inventário por
# PONTEIRO ao SKILL_INDEX.json, e todas as secções doutrinárias EXTRAÍDAS do
# canónico (CLAUDE.md / soul.md / rules/*.md), nunca reescritas.
build_bridge_body() {
  local skills_count agents_count commands_count rules_count
  skills_count="$(count_md "$SKILLS_DIR")"
  agents_count="$(count_md "$AGENTS_DIR")"
  commands_count="$(count_md "$CLAUDE_DIR/commands")"
  rules_count="$(count_md "$CLAUDE_DIR/rules")"

  [[ "$skills_count" -gt 0 ]]   || die "0 skills em $SKILLS_DIR"
  [[ "$agents_count" -gt 0 ]]   || die "0 agentes em $AGENTS_DIR"
  [[ "$commands_count" -gt 0 ]] || die "0 comandos em $CLAUDE_DIR/commands"

  check_index_counts "$skills_count" "$agents_count"

  cat <<BODY_HEAD
## Inventário (derivado em tempo de compilação — não transcrito)

| Componente | Nº | Fonte canónica |
|---|---|---|
| Skills | ${skills_count} | \`.claude/skills/<nome>.md\` |
| Agentes | ${agents_count} | \`.claude/agents/<nome>.md\` |
| Comandos | ${commands_count} | \`.claude/commands/<nome>.md\` |
| Rules (globais) | ${rules_count} | \`.claude/rules/<nome>.md\` |

⚠ **Não existe aqui lista de skills nem de agentes, de propósito.** O inventário completo
(nome · tipo · path · triggers) vive em \`memory/SKILL_INDEX.json\`, que é **gerado**. Ler esse
índice para descobrir o que existe; uma lista transcrita neste ficheiro desactualizava-se em
silêncio e uma lista errada é pior do que nenhuma.
BODY_HEAD

  echo
  extract_section "$JOCA_ROOT/memory/soul.md" "## Drives"
  echo
  extract_section "$JOCA_ROOT/memory/soul.md" "## Hard Limits"
  echo
  extract_section "$JOCA_ROOT/memory/soul.md" "## Calibration Parameters"
  echo
  extract_section "$JOCA_ROOT/CLAUDE.md" "## Communication"
  echo
  extract_section "$JOCA_ROOT/CLAUDE.md" "## Code"
  echo
  extract_section "$JOCA_ROOT/CLAUDE.md" "## Decision Filter (sequential, before any action)"
  echo
  extract_section "$CLAUDE_DIR/rules/task-intake.md" "## As 4 vias"
  echo
  extract_section "$CLAUDE_DIR/rules/task-intake.md" "## Thresholds"
  echo
  extract_section "$CLAUDE_DIR/rules/task-intake.md" "## Segurança (não negociável)"
  echo
  extract_section "$CLAUDE_DIR/rules/pipelines.md" "## Doutrina de projecto — vale SEMPRE, com ou sem \`/start\`"
  echo
  extract_section "$CLAUDE_DIR/rules/pipelines.md" "## Catálogo de pipelines"
  echo
  extract_section "$JOCA_ROOT/CLAUDE.md" "## Context & Agents"
  echo
  cat <<'BODY_ORCH'
## Regra crítica de orquestração
BODY_ORCH
  extract_section "$CLAUDE_DIR/rules/orchestration-patterns.md" \
    "## REGRA CRÍTICA — sub-agentes não fazem spawn de sub-agentes" | tail -n +2
  echo
  extract_section "$JOCA_ROOT/CLAUDE.md" "### Trigger Map"
  echo
  extract_section "$JOCA_ROOT/CLAUDE.md" "## Commands"
  echo
  cat <<'BODY_TAIL'
## Doutrina completa (ler on-demand, não transcrita aqui)

| Ficheiro | O que traz |
|---|---|
| `CLAUDE.md` | fonte canónica de tudo o que está acima |
| `memory/soul.md` | personalidade, princípios, limites, calibração |
| `memory/SKILL_INDEX.json` | inventário gerado de skills + agentes (nome/path/triggers) |
| `memory/INDEX.md` | índice legível dos componentes |
| `.claude/rules/task-intake.md` | classificação em 4 vias + thresholds + gate de plano |
| `.claude/rules/pipelines.md` | auto-runner, gates estático≠runtime, catálogo completo |
| `.claude/rules/chaining.md` | convenção `chain:` e encadeamento automático |
| `.claude/rules/orchestration-patterns.md` | fan-out, cap 3-5, anti-patterns |
| `.claude/rules/stack-padrao.md` | stack da casa para projectos novos |
BODY_TAIL
}

# ─── 3b. GEMINI.md ────────────────────────────────────────────────────────────
compile_gemini() {
  log "Generating GEMINI.md..."

  local gemini_file="$JOCA_ROOT/GEMINI.md"
  local body
  body="$(build_bridge_body)" || die "falha a construir o corpo do GEMINI.md"

  if dry "write GEMINI.md"; then
    {
      cat <<'GEMINI_HEAD'
# GEMINI.md

> ⚠ **FICHEIRO GERADO — não editar à mão.**
> Gerado por `.claude/scripts/compile-bridges.sh` a partir de `CLAUDE.md`, `memory/soul.md`,
> `.claude/rules/*.md` e do índice gerado `memory/SKILL_INDEX.json`.
> Qualquer edição manual é apagada na próxima compilação. Editar a **fonte**, e correr
> `bash .claude/scripts/compile-bridges.sh`.

Contexto de projecto para o Antigravity CLI (`agy`) / Gemini CLI.
Fonte canónica: `CLAUDE.md` + `.claude/`. O JOCA é Claude-first — este ficheiro é uma ponte.

## Onde vivem as coisas (neste CLI)
- Skills: `.claude/skills/<nome>.md` — ler directamente com o teu leitor de ficheiros.
- Agentes: `.claude/agents/<nome>.md` — cada um é um prompt de sub-tarefa especializada.
- Comandos: `.claude/commands/<nome>.md`.
- Activar uma skill = **ler o ficheiro antes de escrever código** (relevância ≥ 60%).
GEMINI_HEAD
      echo
      printf '%s\n' "$body"
    } > "$gemini_file"
    log "  GEMINI.md generated ($(wc -l < "$gemini_file" | tr -d ' ') linhas)"
  fi
}

# ─── 4. AGENTS.md (Codex context bridge) ──────────────────────────────────────
compile_agents_md() {
  log "Updating AGENTS.md..."

  local agents_file="$JOCA_ROOT/AGENTS.md"
  local body
  body="$(build_bridge_body)" || die "falha a construir o corpo do AGENTS.md"

  if dry "write AGENTS.md"; then
    {
      cat <<'AGENTS_HEAD'
# AGENTS.md

> ⚠ **FICHEIRO GERADO — não editar à mão.**
> Gerado por `.claude/scripts/compile-bridges.sh` a partir de `CLAUDE.md`, `memory/soul.md`,
> `.claude/rules/*.md` e do índice gerado `memory/SKILL_INDEX.json`.
> Qualquer edição manual é apagada na próxima compilação. Editar a **fonte**, e correr
> `bash .claude/scripts/compile-bridges.sh`.

Ponte de compatibilidade para ferramentas que lêem `AGENTS.md` (Codex/GPT e afins).
A orientação canónica do JOCA vive em `CLAUDE.md`. Manter o JOCA Claude-first.

## Onde vivem as coisas (neste CLI)
- Skills: `.agents/skills/<nome>.md` — espelho de `.claude/skills/`, sincronizado por este script.
- Agentes: `.codex/agents/<nome>.toml` — compilados de `.claude/agents/*.md` por este script.
- Comandos: `.claude/commands/<nome>.md` (sem espelho próprio).
- Activar uma skill = **ler o ficheiro antes de escrever código** (relevância ≥ 60%).
AGENTS_HEAD
      echo
      printf '%s\n' "$body"
    } > "$agents_file"
    log "  AGENTS.md updated ($(wc -l < "$agents_file" | tr -d ' ') linhas)"
  fi
}

# ─── 5. Generate skill index for lazy loading ─────────────────────────────────
compile_skill_index() {
  log "Generating memory/SKILL_INDEX.json..."
  if dry "run build-skill-index.py"; then
    python3 "$JOCA_ROOT/.claude/scripts/build-skill-index.py"
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  log "JOCA Cross-CLI Bridge Compiler"
  log "Source: $CLAUDE_DIR"
  log "Target: $TARGET"
  log ""

  case "$TARGET" in
    all)
      sync_skills
      prune_skills
      compile_codex_agents
      prune_codex_agents
      compile_gemini
      compile_agents_md
      compile_skill_index
      ;;
    codex)
      sync_skills
      prune_skills
      compile_codex_agents
      prune_codex_agents
      ;;
    gemini)
      compile_gemini
      ;;
    claude)
      compile_agents_md
      compile_skill_index
      ;;
    *)
      echo "Unknown target: $TARGET (use: all|codex|gemini|claude)"
      exit 1
      ;;
  esac

  log ""
  log "Done. Bridge files generated from canonical .claude/ source."
}

main
