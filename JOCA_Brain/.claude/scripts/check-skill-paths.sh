#!/usr/bin/env bash
# check-skill-paths.sh — Guard contra reintrodução de paths de skill partidos.
#
# Estrutura flat actual: .claude/skills/<name>.md
# Paths legacy partidos (NÃO permitir):
#   - placeholder:   skills/SKILL.md            (sem nome — o bug dos 19 ficheiros)
#   - nested antigo: skills/<categoria>/<nome>/SKILL.md
#
# Excepções válidas (NÃO são bug):
#   - skills/created-skills/<nome>/SKILL.md  — convenção de skills geradas por /create-skill
#   - linhas com placeholders em <...>        — documentação, não paths reais
#
# Uso:
#   bash .claude/scripts/check-skill-paths.sh <ficheiro>  # 1 ficheiro (hook PostToolUse)
#   bash .claude/scripts/check-skill-paths.sh --all        # varre o repo inteiro (manual)
#
# Sai com 0 se limpo, 2 se encontrar paths partidos.
# Sem argumento (ex.: $TOOL_INPUT_FILE_PATH vazio) → no-op, exit 0.

set -uo pipefail

TARGET="${1:-}"

PAT_PLACEHOLDER='skills/SKILL\.md'
PAT_NESTED='skills/[^/]+/[^/]+/SKILL\.md'

# Filtra falsos positivos comuns (excepção created-skills + placeholders <...>).
filter_fp() { grep -v -e 'skills/created-skills/' -e '<[A-Za-z_]*>'; }

scan_one() {  # $1 = ficheiro
  grep -nE -e "$PAT_PLACEHOLDER" -e "$PAT_NESTED" "$1" 2>/dev/null | filter_fp || true
}

scan_repo() {
  if command -v rg >/dev/null 2>&1; then
    rg -n --no-heading \
      --glob '!.git/**' --glob '!node_modules/**' --glob '!vendor/**' \
      --glob '!graphify-out/**' --glob '!memory/feedback/**' \
      --glob '!**/check-skill-paths.sh' \
      -e "$PAT_PLACEHOLDER" -e "$PAT_NESTED" . 2>/dev/null | filter_fp || true
  else
    grep -rnE \
      --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=vendor \
      --exclude-dir=graphify-out --exclude-dir=feedback \
      --exclude='check-skill-paths.sh' \
      -e "$PAT_PLACEHOLDER" -e "$PAT_NESTED" . 2>/dev/null | filter_fp || true
  fi
}

# --- dispatch ---
if [[ -z "$TARGET" ]]; then
  # Hook chamado sem path (var vazia) → não bloquear.
  exit 0
fi

if [[ "$TARGET" == "--all" ]]; then
  HITS="$(scan_repo)"
  MODE="all"
else
  # Per-ficheiro. Isenta o próprio guard (contém os padrões como documentação).
  case "$TARGET" in
    *check-skill-paths.sh) exit 0 ;;
  esac
  [[ -f "$TARGET" ]] || exit 0   # ficheiro inexistente/apagado → no-op
  HITS="$(scan_one "$TARGET")"
  MODE="file"
fi

if [[ -n "$HITS" ]]; then
  echo "✗ Path de skill partido detectado (legacy)."
  echo "  Estrutura correcta (flat): .claude/skills/<name>.md"
  echo "  Proibido: 'skills/SKILL.md' e nested 'skills/<cat>/<name>/SKILL.md'"
  echo "  (Excepção válida: skills/created-skills/<name>/SKILL.md)"
  echo "  Ocorrências:"
  echo "$HITS" | sed 's/^/    /'
  exit 2
fi

[[ "$MODE" == "all" ]] && echo "✓ Sem paths de skill partidos."
exit 0
