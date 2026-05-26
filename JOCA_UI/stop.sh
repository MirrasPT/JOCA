#!/bin/bash
echo "A parar JOCA UI..."
lsof -ti:7361 | xargs kill -9 2>/dev/null || true
lsof -ti:7362 | xargs kill -9 2>/dev/null || true
if [ -f /tmp/joca-ui-v2.pids ]; then
  kill $(cat /tmp/joca-ui-v2.pids) 2>/dev/null || true
  rm -f /tmp/joca-ui-v2.pids
fi
pkill -f "/JOCA_UI/mac_v2/backend/node_modules/.bin/tsx src/server.ts" 2>/dev/null || true
pkill -f "/JOCA_UI/mac_v2/frontend/node_modules/.bin/vite --host 127.0.0.1 --port 7362" 2>/dev/null || true
echo "✓ Parado."
