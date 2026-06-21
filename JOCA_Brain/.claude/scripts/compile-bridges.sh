#!/usr/bin/env bash
# compile-bridges.sh — Generates cross-CLI bridge files from canonical .claude/ source
# Usage: ./compile-bridges.sh [--dry-run] [--target claude|codex|gemini|all]
#
# Source of truth: .claude/ (skills, agents, commands, settings)
# Targets: GEMINI.md, .agents/skills/, .codex/agents/, AGENTS.md

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

    while IFS= read -r line; do
      if [[ "$line" == "---" && "$past_frontmatter" == false ]]; then
        if $in_frontmatter; then
          past_frontmatter=true
        else
          in_frontmatter=true
        fi
        continue
      fi

      if $in_frontmatter && ! $past_frontmatter; then
        if [[ "$line" =~ ^description:\ *(.+)$ ]]; then
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

# ─── 3. Generate GEMINI.md ────────────────────────────────────────────────────
compile_gemini() {
  log "Generating GEMINI.md..."

  local gemini_file="$JOCA_ROOT/GEMINI.md"

  # Build skill list from INDEX.md or by scanning
  local skill_list=""
  if [[ -f "$JOCA_ROOT/memory/INDEX.md" ]]; then
    skill_list="$(grep -E '^\|.*\|.*\|' "$JOCA_ROOT/memory/INDEX.md" | grep -v '^\| ---' | head -60 || true)"
  fi

  if dry "write GEMINI.md"; then
    cat > "$gemini_file" << 'GEMINI_EOF'
# GEMINI.md

Project context for Antigravity CLI (agy) / Gemini CLI. Canonical source: CLAUDE.md + .claude/

## JOCA

Toolkit de produtividade — skills, agentes, comandos e memória para AI coding assistants.

## Soul (Personalidade Core)
Autónomo, preciso, económico. Caveman-full. Fail-fast-fix-forward. Nunca inventar. Skill-first.
Drives: Integridade > Autonomia > Precisão > Economia > Velocidade.
Ver `memory/soul.md` para especificação completa.

## Comunicação
Terse. Sem artigos, filler, hedging. Fragmentos OK. Termos técnicos exactos. Código intacto.

## Código
1. Pensar primeiro — expõe assumptions; múltiplas interpretações = apresentar antes de escolher
2. Simplicidade — mínimo código; sem features não pedidas; sem abstrações para uso único
3. Cirúrgico — toca só o necessário; não "melhora" código adjacente
4. Verificável — define critérios de sucesso antes de começar

## Skills disponíveis
Skills vivem em `.claude/skills/<nome>.md` (flat, depth 1). Ler directamente quando relevante.

### Activação
Detectar contexto da tarefa e ler a skill relevante:
- Laravel/Eloquent → `.claude/skills/laravel-specialist.md`
- React/frontend → `.claude/skills/frontend.md`
- SEO/meta → `.claude/skills/seo.md`
- Vídeo/animation → `.claude/skills/video.md`

## Agentes
Agentes vivem em `.claude/agents/<nome>.md`. São sub-tarefas especializadas.

Principais: tester-code, tester-api, tester-security, tester-ui-ux, tester-performance, log-debugger, query-debugger, deep-research, master-orchestrator

## Estrutura
```
.claude/skills/   ← skills flat (1 .md por skill)
.claude/agents/   ← agentes especializados
.claude/commands/ ← comandos slash
.claude/scripts/  ← scripts utilitários
memory/           ← índice, projectos, feedback
```

## MCP Servers
blender · playwright · firecrawl (localhost:3002) · huggingface · lunar-docs

## Regras
- Skill/agente relevante → activar directamente sem pedir confirmação
- Nunca responder genericamente quando existe skill para o domínio
- Auto-trigger testes após implementação
GEMINI_EOF
    log "  GEMINI.md generated"
  fi
}

# ─── 4. Update AGENTS.md (Codex context bridge) ───────────────────────────────
compile_agents_md() {
  log "Updating AGENTS.md..."

  local agents_file="$JOCA_ROOT/AGENTS.md"

  # Extract key sections from CLAUDE.md
  local comm_section=""
  local code_section=""

  if dry "write AGENTS.md"; then
    cat > "$agents_file" << 'AGENTS_EOF'
# AGENTS.md

This file exists only as compatibility bridge for tools that read `AGENTS.md`.
Canonical guidance for JOCA lives in `CLAUDE.md`. Keep JOCA Claude-first.

# JOCA

## Soul (Personalidade Core)
Autónomo, preciso, económico. Caveman-full. Fail-fast-fix-forward. Nunca inventar. Skill-first.
Drives: Integridade > Autonomia > Precisão > Economia > Velocidade.

## Comunicação
Terse. Sem artigos, filler, hedging. Fragmentos OK. Termos técnicos exactos. Código intacto.
Desactivar: "stop caveman" / "normal mode". Auto-clarify em: avisos de segurança, acções irreversíveis, sequências onde ordem importa.

## Código
1. **Pensar primeiro** — expõe assumptions; múltiplas interpretações = apresentar antes de escolher; incerto = pergunta
2. **Simplicidade** — mínimo código; sem features não pedidas; sem abstrações para uso único
3. **Cirúrgico** — toca só o necessário; não "melhora" código adjacente; mantém estilo existente
4. **Verificável** — define critérios de sucesso antes de começar; multi-step: plano com check por step

## Skills
Skills vivem em `.agents/skills/<nome>.md` (flat mirror of `.claude/skills/`).

Activar = ler directamente o SKILL.md relevante. Nunca responder genericamente quando existe skill.

## Agentes
Agentes Codex vivem em `.codex/agents/<nome>.toml`.

Principais:
- **tester-code** — review após implementação
- **tester-api** — valida endpoints REST
- **tester-security** — CVEs, secrets, headers
- **tester-ui-ux** — UI/UX + WCAG
- **tester-performance** — Lighthouse + k6
- **log-debugger** — stack traces, logs, correlação
- **query-debugger** — EXPLAIN, N+1, índices
- **master-orchestrator** — orquestração paralela multi-agente
- **deep-research** — pesquisa multi-fonte com citações

## Pipelines
| Workflow | Sequência |
|---|---|
| Nova feature Laravel | plan → laravel-specialist → tester-code → tester-api |
| Frontend produção | plan → frontend → tester-performance → tester-security |
| Debug sessão | log-debugger → query-debugger (se SQL) |

## Regras de Orquestração
- Após implementar código: auto-trigger tester-code
- Após criar endpoints: auto-trigger tester-api
- Após design/HTML: auto-trigger tester-ui-ux
- Skills activam sem pedir confirmação quando relevância ≥ 60%

## MCP
blender · playwright · firecrawl (localhost:3002) · huggingface · lunar-docs
AGENTS_EOF
    log "  AGENTS.md updated"
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
      compile_codex_agents
      compile_gemini
      compile_agents_md
      compile_skill_index
      ;;
    codex)
      sync_skills
      compile_codex_agents
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
