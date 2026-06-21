#!/usr/bin/env bash
# Stop hook — reads test queue and outputs test recommendations
# This script runs when Claude is about to stop. It checks if there are
# queued file changes that should trigger tests, and outputs a reminder.
#
# Install in project settings.json:
# "hooks": { "Stop": [{ "hooks": [{ "type": "command", "command": "bash .claude/hooks/auto-test-dispatch.sh" }] }] }

QUEUE_FILE=".joca/test-queue.jsonl"

[[ ! -f "$QUEUE_FILE" ]] && exit 0
[[ ! -s "$QUEUE_FILE" ]] && exit 0

# Count changes by domain
BACKEND=$(grep -c '"domain":"backend"' "$QUEUE_FILE" 2>/dev/null || echo 0)
FRONTEND=$(grep -c '"domain":"frontend"' "$QUEUE_FILE" 2>/dev/null || echo 0)
STYLE=$(grep -c '"domain":"style"' "$QUEUE_FILE" 2>/dev/null || echo 0)
DB=$(grep -c '"domain":"database"' "$QUEUE_FILE" 2>/dev/null || echo 0)
TOTAL=$(wc -l < "$QUEUE_FILE" | tr -d ' ')

# Build recommendation
TESTS=""
[[ $BACKEND -gt 0 ]] && TESTS="$TESTS tester-code tester-api"
[[ $FRONTEND -gt 0 ]] && TESTS="$TESTS tester-ui-ux"
[[ $DB -gt 0 ]] && TESTS="$TESTS query-debugger"
[[ $((BACKEND + FRONTEND)) -gt 3 ]] && TESTS="$TESTS tester-security"

if [[ -n "$TESTS" ]]; then
  echo "⚡ AUTO-TEST: $TOTAL files changed ($BACKEND backend, $FRONTEND frontend, $DB db). Recommended:$TESTS"
fi

# Clear queue after reporting
> "$QUEUE_FILE"
