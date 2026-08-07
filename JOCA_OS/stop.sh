#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Mesmas variáveis do start.sh — se arrancaste noutras portas, pára com as mesmas:
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

# Só matamos processos DESTA árvore. Duas instalações do JOCA na mesma máquina partilham o número da
# porta com facilidade; sem esta verificação, parar uma parava a outra.
is_ours() {
  local pid="$1" cwd
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep '^n' | sed 's/^n//')
  [ -n "$cwd" ] && case "$cwd" in "$DIR"*) return 0 ;; esac
  return 1
}

for PORT_TO_STOP in $BACKEND_PORT $FRONTEND_PORT; do
  for pid in $(lsof -ti:$PORT_TO_STOP 2>/dev/null); do
    if is_ours "$pid"; then
      graceful_kill "$pid"
    else
      echo "  ↷ PID $pid na porta $PORT_TO_STOP não é desta instalação — deixado a correr."
    fi
  done
done

if [ -f "$PIDFILE" ]; then
  graceful_kill "$(cat "$PIDFILE")"
  rm -f "$PIDFILE"
fi
echo "✓ Stopped."
