#!/usr/bin/env bash
# Impede commits e pushes diretos na main/master.
#
# Enforcement real: nao depende de o Claude se lembrar da regra.
# Complementa o ruleset do GitHub, que protege o lado remoto.
#
# ⚠️ Hooks de .claude/settings.json so correm depois de aceitar o dialogo de
#    confianca da pasta (workspace trust). Confirmar no primeiro arranque.
#
# Historico: a versao anterior fazia ${COMMAND%%#*} para tirar comentarios.
# Isso cortava o comando a partir do PRIMEIRO '#', mesmo dentro de aspas — e
# `gh pr create --body "Closes #12" && git push` passava sem bloqueio. Como
# `Closes #<n>` e a convencao que o proprio metodo ensina, o comando canonico
# do fluxo desarmava o hook. Agora so se corta um '#' que seja mesmo inicio de
# comentario shell: fora de aspas E no inicio de um token.

set -uo pipefail

# Falhar de forma consciente se o jq nao existir, em vez de morrer a meio.
if ! command -v jq >/dev/null 2>&1; then
  echo "hook proteger-main: jq nao encontrado; verificacao de branch ignorada" >&2
  exit 0
fi

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Corta comentarios shell a serio: um '#' so abre comentario se estiver fora de
# aspas e no inicio de um token (inicio da string, ou precedido de espaco).
# Na duvida NAO corta — um bloqueio a mais custa uma frase, um bloqueio a menos
# custa um commit na main.
strip_comentarios() {
  local s=$1 out= q= c prev= i n=${#1}
  for (( i=0; i<n; i++ )); do
    c=${s:i:1}
    if [ -n "$q" ]; then
      out+=$c
      [ "$c" = "$q" ] && q=
    else
      case $c in
        \'|\") q=$c; out+=$c ;;
        '#')
          if [ -z "$prev" ] || [ "$prev" = " " ] || [ "$prev" = $'\t' ] || [ "$prev" = $'\n' ]; then
            break
          fi
          out+=$c ;;
        *) out+=$c ;;
      esac
    fi
    prev=$c
  done
  printf '%s' "$out"
}

COMANDO_LIMPO=$(strip_comentarios "$COMMAND")

# Apanha: git commit, git push, e as flags globais que mudam o repo-alvo ou a
# identidade — -C <path>, -c <chave>=<valor>, --config-env, --git-dir,
# --work-tree, --namespace. A minuscula `-c` faltava e deixava passar
# `git -c user.email=x commit`.
GIT_FLAGS='([[:space:]]+(-[Cc][[:space:]]+[^[:space:]]+|--config-env(=[^[:space:]]+)?([[:space:]]+[^[:space:]]+)?|--git-dir=[^[:space:]]+|--work-tree=[^[:space:]]+|--namespace=[^[:space:]]+))*'

if ! printf '%s' "$COMANDO_LIMPO" \
  | grep -qE "(^|[;&|(]|[[:space:]])git${GIT_FLAGS}[[:space:]]+(commit|push)([[:space:]]|$)"; then
  exit 0
fi

REPO_DIR="${CLAUDE_PROJECT_DIR:-.}"
BRANCH=$(git -C "$REPO_DIR" branch --show-current 2>/dev/null || echo "")

if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  jq -n --arg b "$BRANCH" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("Estas na branch \($b). O fluxo do projeto exige uma branch por issue. Cria uma com: git checkout -b <tipo>/<n>-<descricao>")
    }
  }'
fi

exit 0
