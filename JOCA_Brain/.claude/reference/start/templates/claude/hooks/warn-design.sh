#!/usr/bin/env bash
# Warns when views are edited without the design system existing.
#
# Does not block — Phase D may legitimately not be done yet.
# But it makes the omission visible instead of silent.
#
# NOTE: in a PreToolUse with exit 0, what is written to stderr goes only to the
# debug log and nobody sees it. For the warning to reach the user, JSON with the
# systemMessage field has to come out on stdout.

set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Covers the three stacks. Laravel only would leave Next.js and Flutter without
# a warning — the visual system phase is the same, the directories change.
case "$FILE" in
  # Laravel / Livewire
  *resources/views/*|*resources/css/*|*resources/js/*) ;;
  # Next.js (App Router)
  */app/*.tsx|*/app/*.css|*/components/*.tsx|*/src/app/*.tsx|*/src/components/*.tsx) ;;
  # Flutter
  */lib/*/widgets/*.dart|*/lib/*/screens/*.dart|*/lib/*/theme/*.dart|*/lib/theme.dart) ;;
  *) exit 0 ;;
esac

# Path anchored at the project root — the hook runs in the cwd, which may be another.
RAIZ="${CLAUDE_PROJECT_DIR:-.}"

if [ ! -f "$RAIZ/docs/DESIGN.md" ]; then
  jq -n '{
    systemMessage: "⚠️  docs/DESIGN.md does not exist — Phase D of the playbook (visual system) was not done. Designing an interface without a defined system produces an incoherent set, and the cost only shows up at the tenth screen. Write docs/DESIGN.md before continuing — the four decisions: typography, color, shape, density."
  }'
fi

exit 0
