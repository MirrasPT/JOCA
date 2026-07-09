#!/bin/bash
# JOCA OS — One-click launcher (macOS)
# Double-click this file to start JOCA OS in background and open browser.

DIR="$(cd "$(dirname "$0")" && pwd)"

BACKEND_PORT=7491
FRONTEND_PORT=7492
URL="http://localhost:$FRONTEND_PORT"
# File-browser roots beyond HOME (parity with start.sh). Default: whole filesystem (/).
EXTRA_ROOTS="${JOCA_EXTRA_ROOTS:-/}"

# Already running?
if lsof -ti:$BACKEND_PORT > /dev/null 2>&1 && lsof -ti:$FRONTEND_PORT > /dev/null 2>&1; then
  open "$URL"
  osascript -e 'tell application "Terminal" to close front window' &>/dev/null &
  exit 0
fi

# Detect sibling JOCA_Brain
LOGIC_DIR="$DIR/../JOCA_Brain"
if [ -d "$LOGIC_DIR/.claude" ]; then
  export JOCA_LOGIC_PATH="$(cd "$LOGIC_DIR" && pwd)"
fi

# Clean ports
lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
sleep 1

# Backend
cd "$DIR/backend" || exit 1
npm run build >/dev/null 2>&1
nohup env PORT=$BACKEND_PORT JOCA_LOGIC_PATH="${JOCA_LOGIC_PATH:-}" JOCA_EXTRA_ROOTS="$EXTRA_ROOTS" node dist/server.js \
  >> /tmp/joca-backend.log 2>&1 < /dev/null &
disown $!

sleep 2

# Frontend
cd "$DIR/frontend" || exit 1
VITE="$DIR/frontend/node_modules/.bin/vite"
nohup "$VITE" --host 127.0.0.1 --port $FRONTEND_PORT \
  >> /tmp/joca-vite.log 2>&1 < /dev/null &
disown $!

sleep 2
open "$URL"

# Close the Terminal window that opened this script
osascript -e 'tell application "Terminal" to close front window' &>/dev/null &
