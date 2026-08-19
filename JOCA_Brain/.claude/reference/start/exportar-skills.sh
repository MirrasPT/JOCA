#!/usr/bin/env bash
# Gera as skills do PROJECTO a partir das skills do JOCA — fonte unica.
#
# Porque existe: a versao anterior do pacote guardava uma COPIA de cada skill
# em templates/claude/skills/. As copias divergiram em silencio — o `novo-issue`
# do template ficou sem a seccao "Ficheiros provaveis", que e exactamente o
# campo de que o `planear-ondas` depende para decidir paralelismo. O pacote
# instalava uma cadeia partida. Aqui nao ha copia: le-se a fonte.
#
# Uso: exportar-skills.sh <raiz-do-projecto> <raiz-do-JOCA_Brain> [skill...]

set -euo pipefail

PROJECTO=${1:?uso: exportar-skills.sh <projecto> <joca_brain> [skill...]}
BRAIN=${2:?falta a raiz do JOCA_Brain}
shift 2
SKILLS=("$@")
[ ${#SKILLS[@]} -eq 0 ] && SKILLS=(novo-issue escrever-testes preparar-design validar-design planear-ondas)

ORIGEM="$BRAIN/.claude/skills"
DESTINO="$PROJECTO/.claude/skills"

[ -d "$ORIGEM" ] || { echo "erro: nao encontro $ORIGEM" >&2; exit 1; }
mkdir -p "$DESTINO"

for s in "${SKILLS[@]}"; do
  src="$ORIGEM/$s.md"
  if [ ! -f "$src" ]; then
    echo "erro: skill '$s' nao existe em $ORIGEM" >&2
    exit 1
  fi
  dst_dir="$DESTINO/$s"
  dst="$dst_dir/SKILL.md"
  # Escrever por cima de um ficheiro existente e irreversivel: parar, nao adivinhar.
  if [ -e "$dst" ]; then
    echo "erro: $dst ja existe — remover ou renomear primeiro (nao sobrescrevo)" >&2
    exit 1
  fi
  mkdir -p "$dst_dir"
  # O aviso de "gerado" tem de entrar DEPOIS do frontmatter fechar: um comentario
  # HTML antes do primeiro `---` empurra o YAML para baixo e o Claude Code deixa
  # de reconhecer a skill. O ficheiro continua a existir e a parecer bem — este
  # defeito so aparece a validar o artefacto, nunca a olhar para o script.
  #
  # `triggers:` e `chain:` sao convencoes do JOCA e nao significam nada num
  # projecto solto — saem. O resto do frontmatter passa tal e qual.
  awk -v origem="$s" '
    /^---[[:space:]]*$/ { delim++ }
    /^triggers:|^chain:/ { if (delim == 1) next }
    { print }
    delim == 2 && !avisado {
      print ""
      print "<!-- GERADO por exportar-skills.sh a partir de JOCA_Brain/.claude/skills/" origem ".md"
      print "     Nao editar aqui: editar a fonte e voltar a correr o script. -->"
      avisado = 1
    }
  ' "$src" > "$dst"
  echo "  $s → .claude/skills/$s/SKILL.md"
done

echo "${#SKILLS[@]} skill(s) exportada(s)."
