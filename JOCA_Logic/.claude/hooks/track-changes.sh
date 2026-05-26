#!/usr/bin/env bash
# PostToolUse hook — tracks files modified by Write/Edit tools
# Appends to .joca/test-queue.jsonl for autonomous test dispatch
#
# Install in project settings.json:
# "hooks": { "PostToolUse": [{ "matcher": { "tool_name": "Write|Edit" }, "hooks": [{ "type": "command", "command": "bash .claude/hooks/track-changes.sh \"$TOOL_INPUT_FILE_PATH\"" }] }] }

FILE_PATH="${1:-}"
[[ -z "$FILE_PATH" ]] && exit 0

QUEUE_DIR=".joca"
QUEUE_FILE="$QUEUE_DIR/test-queue.jsonl"

mkdir -p "$QUEUE_DIR"

# Determine file type for test routing
EXT="${FILE_PATH##*.}"
case "$EXT" in
  php)       domain="backend" ;;
  ts|tsx)    domain="frontend" ;;
  js|jsx)    domain="frontend" ;;
  vue|svelte) domain="frontend" ;;
  css|scss)  domain="style" ;;
  sql)       domain="database" ;;
  md)        domain="docs" ;;
  *)         domain="other" ;;
esac

# Append to queue (JSONL format)
echo "{\"file\":\"$FILE_PATH\",\"domain\":\"$domain\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> "$QUEUE_FILE"
