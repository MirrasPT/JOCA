#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Same variables as start.sh — if you started on other ports, stop with the same ones:
#   JOCA_BACKEND_PORT=7591 JOCA_FRONTEND_PORT=7592 ./stop.sh
BACKEND_PORT="${JOCA_BACKEND_PORT:-7491}"
FRONTEND_PORT="${JOCA_FRONTEND_PORT:-7492}"
PIDFILE="/tmp/joca-os-$BACKEND_PORT.pids"

echo "Stopping JOCA OS (backend :$BACKEND_PORT · frontend :$FRONTEND_PORT)..."

graceful_kill() {
  local pids="$1"
  [ -z "$pids" ] && return
  kill $pids 2>/dev/null || true
  sleep 2
  for pid in $pids; do
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
  done
}

# Who is LISTENING on this port? `lsof -ti:<port>` returns the server AND every client connected
# to it (the browser on the interface, the vite proxied to the backend). A client connection
# cannot pick the victim of a `kill` — only the listener counts.
listeners_on() {
  lsof -ti:"$1" -sTCP:LISTEN 2>/dev/null
}

# We only kill processes from THIS tree. Two JOCA installations on the same machine share the port
# number easily; without this check, stopping one stopped the other.
is_ours() {
  local pid="$1" cwd
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep '^n' | sed 's/^n//')
  [ -n "$cwd" ] && case "$cwd" in "$DIR"*) return 0 ;; esac
  return 1
}

for PORT_TO_STOP in $BACKEND_PORT $FRONTEND_PORT; do
  for pid in $(listeners_on "$PORT_TO_STOP"); do
    if is_ours "$pid"; then
      graceful_kill "$pid"
    else
      echo "  ↷ PID $pid on port $PORT_TO_STOP is not from this installation — left running."
    fi
  done
done

if [ -f "$PIDFILE" ]; then
  graceful_kill "$(cat "$PIDFILE")"
  rm -f "$PIDFILE"
fi
echo "✓ Stopped."
