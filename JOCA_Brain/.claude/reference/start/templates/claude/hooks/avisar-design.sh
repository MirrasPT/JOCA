#!/usr/bin/env bash
# Avisa quando se editam views sem o sistema de design existir.
#
# Não bloqueia — a Fase D pode legitimamente ainda não estar feita.
# Mas torna a omissão visível em vez de silenciosa.
#
# NOTA: num PreToolUse com exit 0, o que se escreve em stderr vai só para o
# log de debug e ninguém o vê. Para o aviso chegar ao utilizador tem de sair
# JSON em stdout com o campo systemMessage.

set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Cobre as tres stacks. So Laravel deixava Next.js e Flutter sem aviso — a
# fase do sistema visual e a mesma, mudam os directorios.
case "$FILE" in
  # Laravel / Livewire
  *resources/views/*|*resources/css/*|*resources/js/*) ;;
  # Next.js (App Router)
  */app/*.tsx|*/app/*.css|*/components/*.tsx|*/src/app/*.tsx|*/src/components/*.tsx) ;;
  # Flutter
  */lib/*/widgets/*.dart|*/lib/*/screens/*.dart|*/lib/*/theme/*.dart|*/lib/theme.dart) ;;
  *) exit 0 ;;
esac

# Caminho ancorado na raiz do projeto — o hook corre no cwd, que pode ser outro.
RAIZ="${CLAUDE_PROJECT_DIR:-.}"

if [ ! -f "$RAIZ/docs/DESIGN.md" ]; then
  jq -n '{
    systemMessage: "⚠️  docs/DESIGN.md não existe — a Fase D do playbook (sistema visual) não foi feita. Desenhar interface sem sistema definido produz um conjunto incoerente, e o custo só aparece ao décimo ecrã. Escrever docs/DESIGN.md antes de continuar — as quatro decisões: tipografia, cor, forma, densidade."
  }'
fi

exit 0
