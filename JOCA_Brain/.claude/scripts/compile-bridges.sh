#!/usr/bin/env bash
# compile-bridges.sh — Generates cross-CLI bridge files from canonical .claude/ source
# Usage: ./compile-bridges.sh [--dry-run] [--target claude|codex|gemini|all]
#
# Source of truth: .claude/ (skills, agents, commands, settings)
# Targets: GEMINI.md, .agents/skills/, .codex/agents/, AGENTS.md
#
# Syncs AND prunes: what disappears from the source is removed from the mirror
# (enumerated name by name before deleting). --dry-run lists without touching anything.

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

# ─── 1b. Prune: remove from the mirror what no longer exists in the source ────
# Hard rule (rules/task-intake.md, Safety): a target defined by CRITERION and not
# by an explicit list → ENUMERATE and SHOW before deleting. Never delete silently,
# never a folder, never `rm -rf`.
#
# Without this, a skill/agent deleted from the source stayed in the mirror forever — and
# worse has already happened: a real host/user/SSH key survived in a mirror after
# being cleaned out of the canonical source.

# Files that live in the mirror by design and do NOT come from the source (never pruned).
# Names relative to the root of the respective mirror.
PRUNE_KEEP_SKILLS=( "README.md" )
PRUNE_KEEP_CODEX=( "README.md" )

in_list() {
  local needle="$1"; shift
  local item
  for item in "$@"; do [[ "$item" == "$needle" ]] && return 0; done
  return 1
}

# prune_mirror <label> <mirror_dir> <generated_ext> <source_probe> <keep...>
# <source_probe> takes the relative path and returns 0 if the source exists.
prune_mirror() {
  local label="$1" mirror_dir="$2" ext="$3" src_probe="$4"; shift 4
  local keep=( "$@" )

  # ── GUARDS (they run BEFORE any removal) ────────────────────────────────────
  [[ -n "$mirror_dir" ]] || die "prune $label: empty mirror dir"
  if [[ ! -d "$mirror_dir" ]]; then
    log "  Prune $label: mirror does not exist yet — nothing to prune"
    return 0
  fi

  # Collect: total generated files in the mirror + the orphans.
  local total=0
  local -a orphans=()
  local f rel
  while IFS= read -r -d '' f; do
    rel="${f#$mirror_dir/}"
    in_list "$rel" "${keep[@]}" && continue   # legitimate mirror file
    total=$((total + 1))
    "$src_probe" "$rel" || orphans+=("$rel")
  done < <(find "$mirror_dir" -type f -name "*$ext" -print0 2>/dev/null)

  if [[ ${#orphans[@]} -eq 0 ]]; then
    log "  Prune $label: 0 orphans (${total} mirrored files)"
    return 0
  fi

  # Safety brake: deleting more than half the mirror is a sign of a broken source
  # (wrong dir, mid-flight checkout), not of a cleanup. It aborts without touching.
  if [[ "$total" -gt 0 && $(( ${#orphans[@]} * 2 )) -gt "$total" ]]; then
    die "prune $label: ${#orphans[@]} of ${total} files declared orphans (>50%) — source probably invalid. Nothing was deleted."
  fi

  # ── ENUMERATE before deleting (name by name) ───────────────────────────────
  log "  Prune $label: ${#orphans[@]} orphan(s) to remove (they no longer exist in the source):"
  for rel in "${orphans[@]}"; do log "    - $rel"; done

  if $DRY_RUN; then
    echo "[dry-run] not removed (--dry-run)"
    return 0
  fi

  # ── REMOVE: file by file, regular files only, inside the mirror ─────────────
  local removed=0
  for rel in "${orphans[@]}"; do
    local victim="$mirror_dir/$rel"
    [[ -f "$victim" && ! -L "$victim" ]] || { log "    ⚠ skipped (not a regular file): $rel"; continue; }
    rm -f -- "$victim"
    removed=$((removed + 1))
  done
  log "  Prune $label: $removed removed"
}

# Source of a .md mirrored in .agents/skills/ → .claude/skills/<same path>
_src_has_skill() { [[ -f "$SKILLS_DIR/$1" ]]; }
# Source of a .toml in .codex/agents/ → .claude/agents/<name>.md
_src_has_agent() { [[ -f "$AGENTS_DIR/${1%.toml}.md" ]]; }

prune_skills() {
  log "Prune .agents/skills/ (orphans against .claude/skills/)..."
  [[ -d "$SKILLS_DIR" ]] || die "prune skills: source does not exist: $SKILLS_DIR"
  [[ "$(count_md "$SKILLS_DIR")" -gt 0 ]] || die "prune skills: 0 skills in the source — refused"
  prune_mirror "skills" "$BRIDGE_SKILLS_DIR" ".md" _src_has_skill "${PRUNE_KEEP_SKILLS[@]}"
}

prune_codex_agents() {
  log "Prune .codex/agents/ (orphans against .claude/agents/)..."
  [[ -d "$AGENTS_DIR" ]] || die "prune agents: source does not exist: $AGENTS_DIR"
  [[ "$(count_md "$AGENTS_DIR")" -gt 0 ]] || die "prune agents: 0 agents in the source — refused"
  prune_mirror "agents" "$CODEX_AGENTS_DIR" ".toml" _src_has_agent "${PRUNE_KEEP_CODEX[@]}"
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
      line="${line%$'\r'}"  # CRLF safety — with \r the "---" never matches and the whole frontmatter leaks into the body
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
            # block scalar continuation (description: | / >) — join with a space
            local cont="${BASH_REMATCH[1]}"
            if [[ -n "$cont" ]]; then
              [[ -n "$description" ]] && description+=" "
              description+="$cont"
            fi
            continue
          fi
          in_desc_block=false  # unindented line = new key; process it below
        fi
        if [[ "$line" =~ ^description:[[:space:]]*([\|\>][+-]?)[[:space:]]*$ ]]; then
          # YAML block scalar (description: | or >) — the value comes on the following indented lines
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

# ─── Extraction of canonical sections (fail-loud) ─────────────────────────────
die() { echo "[compile] ERROR: $*" >&2; exit 1; }

# extract_section <file> <literal heading>
# Prints the heading and everything up to the next heading of equal or higher level.
# Not finding the heading (or finding an empty section) is a FATAL ERROR — never write
# a half-empty bridge file silently.
extract_section() {
  local file="$1" heading="$2" out=""
  [[ -f "$file" ]] || die "extract_section: file does not exist: $file"
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
  ' "$file")" || die "extract_section: awk failed on $file"
  [[ -n "$out" ]] || die "section not found (or empty): '$heading' in ${file#$JOCA_ROOT/}"
  # heading alone, with no body → also a failure
  [[ "$(printf '%s\n' "$out" | wc -l | tr -d ' ')" -gt 1 ]] \
    || die "section with no body: '$heading' in ${file#$JOCA_ROOT/}"
  printf '%s\n' "$out"
}

# count_md <dir> — number of .md at depth 1
count_md() {
  find -L "$1" -maxdepth 1 -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' '
}

# Cross-checks the disk counts against the generated index; divergence = warning (the
# index may be pending regeneration), never an invented number in the bridge file.
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
    log "  ⚠ SKILL_INDEX.json stale (index: ${idx_skills} skills / ${idx_agents} agents · disk: ${fs_skills}/${fs_agents}) — it will be regenerated at the end"
  fi
}

# ─── 3. Shared body of the bridge files (AGENTS.md + GEMINI.md) ───────────────
# Rule (reference/orchestration-cases.md, anti-patterns): "capability lists written
# by hand into prompts go stale silently — point at the generated index, do not
# transcribe". Hence: counts derived from `ls`, inventory by POINTER to
# SKILL_INDEX.json, and every doctrinal section EXTRACTED from the canonical source
# (CLAUDE.md / soul.md / rules/*.md), never rewritten.
build_bridge_body() {
  local skills_count agents_count commands_count rules_count
  skills_count="$(count_md "$SKILLS_DIR")"
  agents_count="$(count_md "$AGENTS_DIR")"
  commands_count="$(count_md "$CLAUDE_DIR/commands")"
  rules_count="$(count_md "$CLAUDE_DIR/rules")"

  [[ "$skills_count" -gt 0 ]]   || die "0 skills in $SKILLS_DIR"
  [[ "$agents_count" -gt 0 ]]   || die "0 agents in $AGENTS_DIR"
  [[ "$commands_count" -gt 0 ]] || die "0 commands in $CLAUDE_DIR/commands"

  check_index_counts "$skills_count" "$agents_count"

  cat <<BODY_HEAD
## Inventory (derived at compile time — not transcribed)

| Component | No. | Canonical source |
|---|---|---|
| Skills | ${skills_count} | \`.claude/skills/<name>.md\` |
| Agents | ${agents_count} | \`.claude/agents/<name>.md\` |
| Commands | ${commands_count} | \`.claude/commands/<name>.md\` |
| Rules (global) | ${rules_count} | \`.claude/rules/<name>.md\` |

⚠ **There is no list of skills or agents here, deliberately.** The full inventory
(name · type · path · triggers) lives in \`memory/SKILL_INDEX.json\`, which is **generated**. Read
that index to find out what exists; a list transcribed into this file went stale silently, and a
wrong list is worse than none.
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
  extract_section "$CLAUDE_DIR/rules/task-intake.md" "## The 4 routes"
  echo
  extract_section "$CLAUDE_DIR/rules/task-intake.md" "## Thresholds"
  echo
  extract_section "$CLAUDE_DIR/rules/task-intake.md" "## Safety (non-negotiable)"
  echo
  extract_section "$CLAUDE_DIR/rules/pipelines.md" "## Project doctrine — it ALWAYS holds, with or without \`/start\`"
  echo
  extract_section "$CLAUDE_DIR/reference/pipelines-catalog.md" "## Pipeline catalog"
  echo
  extract_section "$JOCA_ROOT/CLAUDE.md" "## Context & Agents"
  echo
  cat <<'BODY_ORCH'
## Critical orchestration rule
BODY_ORCH
  extract_section "$CLAUDE_DIR/rules/orchestration-patterns.md" \
    "## CRITICAL RULE — sub-agents do not spawn sub-agents" | tail -n +2
  echo
  extract_section "$JOCA_ROOT/CLAUDE.md" "### Trigger Map"
  echo
  extract_section "$JOCA_ROOT/CLAUDE.md" "## Commands"
  echo
  cat <<'BODY_TAIL'
## Full doctrine (read on-demand, not transcribed here)

| File | What it brings |
|---|---|
| `CLAUDE.md` | canonical source of everything above |
| `memory/soul.md` | personality, principles, limits, calibration |
| `memory/SKILL_INDEX.json` | generated inventory of skills + agents (name/path/triggers) |
| `memory/INDEX.md` | readable index of the components |
| `.claude/rules/task-intake.md` | classification into 4 routes + thresholds + plan gate |
| `.claude/rules/pipelines.md` | auto-runner, static≠runtime gates, project doctrine |
| `.claude/reference/pipelines-catalog.md` | full catalog of named pipelines |
| `.claude/rules/chaining.md` | the `chain:` convention and automatic chaining |
| `.claude/rules/orchestration-patterns.md` | fan-out, cap 3-5, critical rule |
| `.claude/reference/orchestration-cases.md` | orchestration anti-patterns |
| `.claude/rules/default-stack.md` | house stack for new projects |
BODY_TAIL
}

# ─── 3b. GEMINI.md ────────────────────────────────────────────────────────────
compile_gemini() {
  log "Generating GEMINI.md..."

  local gemini_file="$JOCA_ROOT/GEMINI.md"
  local body
  body="$(build_bridge_body)" || die "failed to build the body of GEMINI.md"

  if dry "write GEMINI.md"; then
    {
      cat <<'GEMINI_HEAD'
# GEMINI.md

> ⚠ **GENERATED FILE — do not edit by hand.**
> Generated by `.claude/scripts/compile-bridges.sh` from `CLAUDE.md`, `memory/soul.md`,
> `.claude/rules/*.md` and the generated index `memory/SKILL_INDEX.json`.
> Any manual edit is wiped on the next compilation. Edit the **source**, and run
> `bash .claude/scripts/compile-bridges.sh`.

Project context for the Antigravity CLI (`agy`) / Gemini CLI.
Canonical source: `CLAUDE.md` + `.claude/`. JOCA is Claude-first — this file is a bridge.

## Where things live (in this CLI)
- Skills: `.claude/skills/<name>.md` — read them directly with your file reader.
- Agents: `.claude/agents/<name>.md` — each is a specialized sub-task prompt.
- Commands: `.claude/commands/<name>.md`.
- Activating a skill = **read the file before writing code** (relevance ≥ 60%).
GEMINI_HEAD
      echo
      printf '%s\n' "$body"
    } > "$gemini_file"
    log "  GEMINI.md generated ($(wc -l < "$gemini_file" | tr -d ' ') lines)"
  fi
}

# ─── 4. AGENTS.md (Codex context bridge) ──────────────────────────────────────
compile_agents_md() {
  log "Updating AGENTS.md..."

  local agents_file="$JOCA_ROOT/AGENTS.md"
  local body
  body="$(build_bridge_body)" || die "failed to build the body of AGENTS.md"

  if dry "write AGENTS.md"; then
    {
      cat <<'AGENTS_HEAD'
# AGENTS.md

> ⚠ **GENERATED FILE — do not edit by hand.**
> Generated by `.claude/scripts/compile-bridges.sh` from `CLAUDE.md`, `memory/soul.md`,
> `.claude/rules/*.md` and the generated index `memory/SKILL_INDEX.json`.
> Any manual edit is wiped on the next compilation. Edit the **source**, and run
> `bash .claude/scripts/compile-bridges.sh`.

Compatibility bridge for tools that read `AGENTS.md` (Codex/GPT and the like).
JOCA's canonical guidance lives in `CLAUDE.md`. Keep JOCA Claude-first.

## Where things live (in this CLI)
- Skills: `.agents/skills/<name>.md` — mirror of `.claude/skills/`, synced by this script.
- Agents: `.codex/agents/<name>.toml` — compiled from `.claude/agents/*.md` by this script.
- Commands: `.claude/commands/<name>.md` (no mirror of their own).
- Activating a skill = **read the file before writing code** (relevance ≥ 60%).
AGENTS_HEAD
      echo
      printf '%s\n' "$body"
    } > "$agents_file"
    log "  AGENTS.md updated ($(wc -l < "$agents_file" | tr -d ' ') lines)"
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
