#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKEND_PORT=7351
FRONTEND_PORT=7352
URL="http://localhost:$FRONTEND_PORT"

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

# Backend
nohup bash -c "while true; do cd '$DIR/backend' && PORT=$BACKEND_PORT npx tsx src/server.ts; echo '⚠ Backend caiu. A reiniciar em 2s...'; sleep 2; done" \
  >> /tmp/joca-backend.log 2>&1 &
BACKEND_PID=$!
disown $BACKEND_PID

sleep 2

# Frontend
nohup bash -c "while true; do cd '$DIR/frontend' && npx vite; echo '⚠ Frontend caiu. A reiniciar em 2s...'; sleep 2; done" \
  >> /tmp/joca-vite.log 2>&1 &
FRONTEND_PID=$!
disown $FRONTEND_PID

echo "$BACKEND_PID $FRONTEND_PID" > /tmp/joca-ui.pids

echo "✓ Backend  → http://localhost:$BACKEND_PORT  (PID $BACKEND_PID)"
echo "✓ Frontend → $URL  (PID $FRONTEND_PID)"
echo ""
echo "Podes fechar esta janela — os servidores continuam."
echo "Para parar: ./stop.sh"

sleep 3 && open "$URL"
