#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Portas configuráveis. Os defaults são 7491/7492, mas QUALQUER instalação que não seja a principal
# deve arrancar noutras — duas árvores do JOCA na mesma máquina (ex.: uma de trabalho e um clone do
# repo público) colidem, e a limpeza de portas abaixo mataria a outra.
#   JOCA_BACKEND_PORT=7591 JOCA_FRONTEND_PORT=7592 ./start.sh
# (Não se usa `PORT` como fallback de propósito: é uma variável genérica que muitos projectos já
# exportam na shell, e herdá-la aqui faria o JOCA arrancar numa porta que ninguém pediu.)
BACKEND_PORT="${JOCA_BACKEND_PORT:-7491}"
FRONTEND_PORT="${JOCA_FRONTEND_PORT:-7492}"
URL="http://localhost:$FRONTEND_PORT"
FRONTEND_VITE="$DIR/frontend/node_modules/.bin/vite"

# Ficheiros de runtime por porta — senão duas instalações partilham o mesmo .pids e o mesmo log,
# e o stop.sh de uma mata os processos da outra.
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

# O processo que está nesta porta é NOSSO? Compara o cwd do processo com esta árvore.
# Sem isto, arrancar esta instalação matava outro JOCA (ou outro serviço qualquer) que estivesse
# na porta — foi assim que um clone do repo público quase derrubou a instalação de trabalho.
is_ours() {
  local pid="$1" cwd
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep '^n' | sed 's/^n//')
  [ -n "$cwd" ] && case "$cwd" in "$DIR"*) return 0 ;; esac
  return 1
}

port_is_ours() {
  local pids; pids=$(lsof -ti:"$1" 2>/dev/null)
  [ -z "$pids" ] && return 1
  for p in $pids; do is_ours "$p" || return 1; done
  return 0
}

# Se ESTA instalação já estiver a correr, só abre o browser. A verificação de propriedade tem de vir
# antes: sem ela, uma segunda árvore encontrava as portas ocupadas pela primeira, dizia "já está a
# correr" e abria o browser na instalação do vizinho.
if port_is_ours "$BACKEND_PORT" && port_is_ours "$FRONTEND_PORT"; then
  echo "✓ JOCA OS (esta instalação) já está a correr → $URL"
  open "$URL"
  exit 0
fi

for PORT_TO_FREE in $BACKEND_PORT $FRONTEND_PORT; do
  PIDS=$(lsof -ti:$PORT_TO_FREE 2>/dev/null)
  [ -z "$PIDS" ] && continue
  for pid in $PIDS; do
    if ! is_ours "$pid"; then
      echo "✗ A porta $PORT_TO_FREE está ocupada por um processo que NÃO é desta instalação (PID $pid):"
      echo "    $(ps -o command= -p "$pid" 2>/dev/null | cut -c1-100)"
      echo "    cwd: $(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep '^n' | sed 's/^n//')"
      echo ""
      echo "  Não vou matá-lo. Arranca noutras portas:"
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

echo "▶ JOCA OS a arrancar... (backend :$BACKEND_PORT · frontend :$FRONTEND_PORT)"
[ -n "$JOCA_LOGIC_PATH" ] && echo "  JOCA_Brain → $JOCA_LOGIC_PATH"

# Backend
cd "$DIR/backend" || exit 1
npm run build >"$BUILD_LOG" 2>&1
if [ $? -ne 0 ]; then
  echo "ERROR: Backend build failed. See $BUILD_LOG"
  exit 1
fi
# O backend abre processos `claude` (o SDK do gestor e os terminais dos agentes). Se o JOCA for
# arrancado de DENTRO de uma sessão Claude Code (terminal do próprio Claude Code, ou o .command
# lançado a partir dela), estas variáveis são herdadas e cada `claude` filho julga-se uma
# sub-sessão dessa: herda o orçamento dela ("Reached maximum budget") e acaba a recusar arrancar,
# com uma mensagem enganadora sobre libc/musl que nada tem a ver com macOS.
# Limpar aqui, no arranque, é o único sítio que cobre os dois lançadores.
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
echo "Podes fechar esta janela — os servidores continuam."
echo "Para parar: ./stop.sh   (mesmas variáveis de porta, se as usaste no arranque)"

sleep 3 && open "$URL"
