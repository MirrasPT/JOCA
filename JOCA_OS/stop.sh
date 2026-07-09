#!/bin/bash
echo "Stopping JOCA OS..."

BACKEND_PORT=7491
FRONTEND_PORT=7492

graceful_kill() {
  local pids="$1"
  [ -z "$pids" ] && return
  kill $pids 2>/dev/null || true
  sleep 2
  for pid in $pids; do
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
  done
}

graceful_kill "$(lsof -ti:$BACKEND_PORT 2>/dev/null)"
graceful_kill "$(lsof -ti:$FRONTEND_PORT 2>/dev/null)"

if [ -f /tmp/joca-os-v2.pids ]; then
  graceful_kill "$(cat /tmp/joca-os-v2.pids)"
  rm -f /tmp/joca-os-v2.pids
fi
echo "✓ Stopped."
