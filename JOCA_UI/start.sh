#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKEND_PORT=7371
FRONTEND_PORT=7372
URL="http://localhost:$FRONTEND_PORT"
FRONTEND_VITE="$DIR/frontend/node_modules/.bin/vite"

# Detect sibling JOCA_Logic
LOGIC_DIR="$DIR/../JOCA_Logic"
if [ -d "$LOGIC_DIR/.claude" ]; then
  export JOCA_LOGIC_PATH="$(cd "$LOGIC_DIR" && pwd)"
else
  echo "⚠ JOCA_Logic not found at $LOGIC_DIR — running in standalone mode"
fi

# Se já estiver a correr, só abre o browser
if lsof -ti:$BACKEND_PORT > /dev/null 2>&1 && lsof -ti:$FRONTEND_PORT > /dev/null 2>&1; then
  echo "✓ JOCA UI já está a correr → $URL"
  open "$URL"
  exit 0
fi

# Limpar portas
lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
sleep 1

echo "▶ JOCA UI a arrancar..."
[ -n "$JOCA_LOGIC_PATH" ] && echo "  JOCA_Logic → $JOCA_LOGIC_PATH"

# Backend
cd "$DIR/backend" || exit 1
npm run build >/tmp/joca-backend-v2-build.log 2>&1
if [ $? -ne 0 ]; then
  echo "ERROR: Backend build failed. See /tmp/joca-backend-v2-build.log"
  exit 1
fi
nohup env PORT=$BACKEND_PORT JOCA_LOGIC_PATH="${JOCA_LOGIC_PATH:-}" node dist/server.js \
  >> /tmp/joca-backend-v2.log 2>&1 < /dev/null &
BACKEND_PID=$!
disown $BACKEND_PID

sleep 2

# Frontend
cd "$DIR/frontend" || exit 1
nohup "$FRONTEND_VITE" --host 127.0.0.1 --port $FRONTEND_PORT \
  >> /tmp/joca-vite-v2.log 2>&1 < /dev/null &
FRONTEND_PID=$!
disown $FRONTEND_PID

echo "$BACKEND_PID $FRONTEND_PID" > /tmp/joca-ui-v2.pids

echo "✓ Backend  → http://localhost:$BACKEND_PORT  (PID $BACKEND_PID)"
echo "✓ Frontend → $URL  (PID $FRONTEND_PID)"
echo ""
echo "Podes fechar esta janela — os servidores continuam."
echo "Para parar: ./stop.sh"

sleep 3 && open "$URL"
