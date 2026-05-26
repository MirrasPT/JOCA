#!/bin/bash
echo "A parar JOCA UI..."
lsof -ti:7371 | xargs kill -9 2>/dev/null || true
lsof -ti:7372 | xargs kill -9 2>/dev/null || true
if [ -f /tmp/joca-ui-v2.pids ]; then
  kill $(cat /tmp/joca-ui-v2.pids) 2>/dev/null || true
  rm -f /tmp/joca-ui-v2.pids
fi
echo "✓ Parado."
