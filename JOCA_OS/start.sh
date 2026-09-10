#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configurable ports. The defaults are 7491/7492, but ANY installation that is not the main one
# must start on other ones — two JOCA trees on the same machine (e.g. a working one and a clone of
# the public repo) collide, and the port cleanup below would kill the other one.
#   JOCA_BACKEND_PORT=7591 JOCA_FRONTEND_PORT=7592 ./start.sh
# (`PORT` is deliberately not used as a fallback: it is a generic variable that many projects
# already export in the shell, and inheriting it here would make JOCA start on a port nobody asked for.)
BACKEND_PORT="${JOCA_BACKEND_PORT:-7491}"
FRONTEND_PORT="${JOCA_FRONTEND_PORT:-7492}"
URL="http://localhost:$FRONTEND_PORT"
FRONTEND_VITE="$DIR/frontend/node_modules/.bin/vite"

# Runtime files per port — otherwise two installations share the same .pids and the same log,
# and the stop.sh of one kills the processes of the other.
PIDFILE="/tmp/joca-os-$BACKEND_PORT.pids"
BACKEND_LOG="/tmp/joca-backend-$BACKEND_PORT.log"
BUILD_LOG="/tmp/joca-backend-$BACKEND_PORT-build.log"
VITE_LOG="/tmp/joca-vite-$FRONTEND_PORT.log"

# Detect sibling JOCA_Brain
LOGIC_DIR="$DIR/../JOCA_Brain"
if [ -d "$LOGIC_DIR/.claude" ]; then
  export JOCA_LOGIC_PATH="$(cd "$LOGIC_DIR" && pwd)"
else
  echo "⚠ JOCA_Brain not found at $LOGIC_DIR — running in standalone mode"
fi

# Who is LISTENING on this port? `lsof -ti:<port>` returns the server AND every client connected
# to it — the browser open on the interface, the vite proxied to the backend. A client does not own
# the port: deciding by it made startup refuse with a false message ("occupied by a process that is
# NOT from this installation", when it was), and made a `kill` pick vite instead of the backend.
# Only the listener counts — both to decide ownership and to choose who dies.
listeners_on() {
  lsof -ti:"$1" -sTCP:LISTEN 2>/dev/null
}

# Is the process on this port OURS? Compares the process's cwd with this tree.
# Without this, starting this installation killed another JOCA (or any other service) that was
# on the port — that is how a clone of the public repo nearly took down the working installation.
is_ours() {
  local pid="$1" cwd
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep '^n' | sed 's/^n//')
  [ -n "$cwd" ] && case "$cwd" in "$DIR"*) return 0 ;; esac
  return 1
}

port_is_ours() {
  local pids; pids=$(listeners_on "$1")
  [ -z "$pids" ] && return 1
  for p in $pids; do is_ours "$p" || return 1; done
  return 0
}

# If THIS installation is already running, it only opens the browser. The ownership check has to come
# first: without it, a second tree found the ports occupied by the first, said "it is already
# running" and opened the browser on the neighbor's installation.
if port_is_ours "$BACKEND_PORT" && port_is_ours "$FRONTEND_PORT"; then
  echo "✓ JOCA OS (this installation) is already running → $URL"
  open "$URL"
  exit 0
fi

for PORT_TO_FREE in $BACKEND_PORT $FRONTEND_PORT; do
  PIDS=$(listeners_on "$PORT_TO_FREE")
  [ -z "$PIDS" ] && continue
  for pid in $PIDS; do
    if ! is_ours "$pid"; then
      echo "✗ Port $PORT_TO_FREE is occupied by a process that is NOT from this installation (PID $pid):"
      echo "    $(ps -o command= -p "$pid" 2>/dev/null | cut -c1-100)"
      echo "    cwd: $(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep '^n' | sed 's/^n//')"
      echo ""
      echo "  I am not going to kill it. Start on other ports:"
      echo "    JOCA_BACKEND_PORT=7591 JOCA_FRONTEND_PORT=7592 $0"
      exit 1
    fi
  done
  kill $PIDS 2>/dev/null || true
  sleep 2
  for pid in $PIDS; do
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
  done
done

echo "▶ JOCA OS starting... (backend :$BACKEND_PORT · frontend :$FRONTEND_PORT)"
[ -n "$JOCA_LOGIC_PATH" ] && echo "  JOCA_Brain → $JOCA_LOGIC_PATH"

# Backend
cd "$DIR/backend" || exit 1
npm run build >"$BUILD_LOG" 2>&1
if [ $? -ne 0 ]; then
  echo "ERROR: Backend build failed. See $BUILD_LOG"
  exit 1
fi
# The backend opens `claude` processes (the manager's SDK and the agents' terminals). If JOCA is
# started from INSIDE a Claude Code session (Claude Code's own terminal, or the .command launched
# from it), these variables are inherited and each child `claude` believes itself to be a
# sub-session of that one: it inherits its budget ("Reached maximum budget") and ends up refusing to
# start, with a misleading message about libc/musl that has nothing to do with macOS.
# Clearing them here, at startup, is the only place that covers both launchers.
nohup env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT -u CLAUDE_CODE_CHILD_SESSION \
  -u CLAUDE_CODE_SESSION_ID -u CLAUDE_CODE_EXECPATH -u CLAUDE_PID -u CLAUDE_EFFORT \
  PORT=$BACKEND_PORT JOCA_LOGIC_PATH="${JOCA_LOGIC_PATH:-}" node dist/server.js \
  >> "$BACKEND_LOG" 2>&1 < /dev/null &
BACKEND_PID=$!
disown $BACKEND_PID

sleep 2

# Frontend
cd "$DIR/frontend" || exit 1
nohup "$FRONTEND_VITE" --host 127.0.0.1 --port $FRONTEND_PORT \
  >> "$VITE_LOG" 2>&1 < /dev/null &
FRONTEND_PID=$!
disown $FRONTEND_PID

echo "$BACKEND_PID $FRONTEND_PID" > "$PIDFILE"

echo "✓ Backend  → http://localhost:$BACKEND_PORT  (PID $BACKEND_PID)"
echo "✓ Frontend → $URL  (PID $FRONTEND_PID)"
echo ""
echo "You can close this window — the servers keep running."
echo "To stop: ./stop.sh   (same port variables, if you used them at startup)"

sleep 3 && open "$URL"
