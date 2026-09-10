#!/usr/bin/env bash
# Blocks direct commits and pushes on main/master.
#
# Real enforcement: does not depend on Claude remembering the rule.
# Complements the GitHub ruleset, which protects the remote side.
#
# ⚠️ Hooks from .claude/settings.json only run after accepting the folder trust
#    dialog (workspace trust). Confirm on the first startup.
#
# History: the previous version did ${COMMAND%%#*} to strip comments.
# That cut the command from the FIRST '#', even inside quotes — and
# `gh pr create --body "Closes #12" && git push` went through unblocked. Since
# `Closes #<n>` is the convention the method itself teaches, the canonical
# command of the flow disarmed the hook. Now only a '#' that really starts a
# shell comment is cut: outside quotes AND at the start of a token.

set -uo pipefail

# Fail knowingly if jq does not exist, instead of dying halfway.
if ! command -v jq >/dev/null 2>&1; then
  echo "hook protect-main: jq not found; branch check skipped" >&2
  exit 0
fi

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Strips shell comments for real: a '#' only opens a comment if it is outside
# quotes and at the start of a token (start of the string, or preceded by space).
# When in doubt DO NOT cut — one block too many costs a sentence, one block too
# few costs a commit on main.
strip_comentarios() {
  local s=$1 out= q= c prev= i n=${#1}
  for (( i=0; i<n; i++ )); do
    c=${s:i:1}
    if [ -n "$q" ]; then
      out+=$c
      [ "$c" = "$q" ] && q=
    else
      case $c in
        \'|\") q=$c; out+=$c ;;
        '#')
          if [ -z "$prev" ] || [ "$prev" = " " ] || [ "$prev" = $'\t' ] || [ "$prev" = $'\n' ]; then
            break
          fi
          out+=$c ;;
        *) out+=$c ;;
      esac
    fi
    prev=$c
  done
  printf '%s' "$out"
}

COMANDO_LIMPO=$(strip_comentarios "$COMMAND")

# Catches: git commit, git push, and the global flags that change the target
# repo or the identity — -C <path>, -c <key>=<value>, --config-env, --git-dir,
# --work-tree, --namespace. The lowercase `-c` was missing and let
# `git -c user.email=x commit` through.
GIT_FLAGS='([[:space:]]+(-[Cc][[:space:]]+[^[:space:]]+|--config-env(=[^[:space:]]+)?([[:space:]]+[^[:space:]]+)?|--git-dir=[^[:space:]]+|--work-tree=[^[:space:]]+|--namespace=[^[:space:]]+))*'

if ! printf '%s' "$COMANDO_LIMPO" \
  | grep -qE "(^|[;&|(]|[[:space:]])git${GIT_FLAGS}[[:space:]]+(commit|push)([[:space:]]|$)"; then
  exit 0
fi

REPO_DIR="${CLAUDE_PROJECT_DIR:-.}"
BRANCH=$(git -C "$REPO_DIR" branch --show-current 2>/dev/null || echo "")

if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  jq -n --arg b "$BRANCH" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("You are on branch \($b). The project flow requires one branch per issue. Create one with: git checkout -b <type>/<n>-<description>")
    }
  }'
fi

exit 0
