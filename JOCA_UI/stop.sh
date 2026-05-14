#!/bin/bash
echo "A parar JOCA UI..."
lsof -ti:7351 | xargs kill -9 2>/dev/null || true
lsof -ti:7352 | xargs kill -9 2>/dev/null || true
if [ -f /tmp/joca-ui.pids ]; then
  kill $(cat /tmp/joca-ui.pids) 2>/dev/null || true
  rm -f /tmp/joca-ui.pids
fi
pkill -f "tsx src/server.ts" 2>/dev/null || true
echo "✓ Parado."
