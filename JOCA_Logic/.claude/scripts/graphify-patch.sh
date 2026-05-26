#!/usr/bin/env bash
# graphify-patch.sh — Re-aplica os patches ao graphifyy instalado
#
# Correr após: uv tool upgrade graphifyy  (ou pip/pipx upgrade)
# Uso: bash .claude/scripts/graphify-patch.sh
#
# O que este script faz:
#   1. Garante DOC_EXTENSIONS inclui json, yaml, toml, scss, sh, etc.
#   2. Remove exclusão de dotdirs (.claude/, .github/, etc.) — .git continua excluído via _SKIP_DIRS
#   3. Remove exclusão de dotfiles ao nível raiz (ficheiros como .env são protegidos pelo _SENSITIVE_PATTERNS)

set -euo pipefail

# Preferir o Python do CLI graphify (uv), senão usar python3 do PATH
GRAPHIFY_BIN=$(which graphify 2>/dev/null || true)
if [[ -n "$GRAPHIFY_BIN" ]]; then
  GRAPHIFY_PYTHON=$(head -1 "$GRAPHIFY_BIN" | sed 's/#! *//' | sed 's/ .*//')
  if [[ -x "$GRAPHIFY_PYTHON" ]]; then
    PYBIN="$GRAPHIFY_PYTHON"
  else
    PYBIN="python3"
  fi
else
  PYBIN="python3"
fi

DETECT=$("$PYBIN" -c "import graphify.detect as m; import inspect; print(inspect.getfile(m))" 2>/dev/null || true)
if [[ -z "$DETECT" ]]; then
  echo "✗ graphify não encontrado"
  exit 1
fi
echo "→ Python: $PYBIN"
echo "→ Patch:  $DETECT"

"$PYBIN" - "$DETECT" << 'PYEOF'
import sys, re
from pathlib import Path

detect = Path(sys.argv[1])
src = detect.read_text()
original = src

# --- Patch 1: DOC_EXTENSIONS ---
# Versão antiga (single-line) — homebrew
old_doc_v1 = "DOC_EXTENSIONS = {'.md', '.mdx', '.txt', '.rst', '.html'}"
# Versão nova já expandida (uv) — verificar se já tem os extras
needs_p1 = (old_doc_v1 in src)

if needs_p1:
    new_doc = """DOC_EXTENSIONS = {'.md', '.mdx', '.txt', '.rst', '.html', '.htm', '.xml',
                   '.json', '.jsonc', '.yaml', '.yml', '.toml',
                   '.css', '.scss', '.sass', '.less',
                   '.sh', '.bash', '.zsh', '.fish',
                   '.graphql', '.gql'}"""
    src = src.replace(old_doc_v1, new_doc)
    print("  ✓ Patch 1: DOC_EXTENSIONS expandido")
else:
    print("  ✓ Patch 1: já OK (DOC_EXTENSIONS)")

# --- Patch 2: Remover exclusão de dotdirs ---
# Versão antiga simples (homebrew):
old_filter_v1 = (
    "                dirnames[:] = [\n"
    "                    d for d in dirnames\n"
    "                    if not d.startswith(\".\")\n"
    "                    and not _is_noise_dir(d)\n"
    "                    and not _is_ignored(dp / d, root, ignore_patterns)\n"
    "                ]"
)
# Versão nova com has_negation + _could_contain_included_path (uv):
old_filter_v2 = (
    "                dirnames[:] = [\n"
    "                    d for d in dirnames\n"
    "                    if (not d.startswith(\".\") or _could_contain_included_path(dp / d, root, include_patterns))\n"
    "                    and not _is_noise_dir(d)\n"
    "                    and (has_negation or not _is_ignored(dp / d, root, ignore_patterns))\n"
    "                ]"
)
new_filter_v1 = (
    "                # Note: dotdirs (e.g. .claude/) are NOT excluded — .git is in _SKIP_DIRS\n"
    "                dirnames[:] = [\n"
    "                    d for d in dirnames\n"
    "                    if not _is_noise_dir(d)\n"
    "                    and not _is_ignored(dp / d, root, ignore_patterns)\n"
    "                ]"
)
new_filter_v2 = (
    "                # Note: dotdirs (e.g. .claude/) are NOT excluded — .git is in _SKIP_DIRS\n"
    "                dirnames[:] = [\n"
    "                    d for d in dirnames\n"
    "                    if not _is_noise_dir(d)\n"
    "                    and (has_negation or not _is_ignored(dp / d, root, ignore_patterns))\n"
    "                ]"
)

if old_filter_v1 in src:
    src = src.replace(old_filter_v1, new_filter_v1)
    print("  ✓ Patch 2: dotdirs incluídos (v1)")
elif old_filter_v2 in src:
    src = src.replace(old_filter_v2, new_filter_v2)
    print("  ✓ Patch 2: dotdirs incluídos (v2)")
elif 'd.startswith(".")' not in src:
    print("  ✓ Patch 2: já OK (dotdirs)")
else:
    print("  ⚠  Patch 2: padrão não reconhecido — verificar manualmente")

# --- Patch 3: Remover exclusão de dotfiles raiz ---
# Versão antiga (homebrew):
old_hidden_v1 = (
    "        if not in_memory:\n"
    "            # Hidden files are already excluded via dir pruning above,\n"
    "            # but catch hidden files at the root level\n"
    "            if p.name.startswith(\".\"):\n"
    "                continue\n"
    "            # Skip files inside our own converted/ dir (avoid re-processing sidecars)"
)
# Versão nova com _is_included check (uv):
old_hidden_v2 = (
    "        if not in_memory:\n"
    "            # Hidden files are already excluded via dir pruning above,\n"
    "            # but catch hidden files at the root level. A .graphifyinclude\n"
    "            # entry can opt a specific hidden file back in.\n"
    "            if p.name.startswith(\".\") and not _is_included(p, root, include_patterns):\n"
    "                continue\n"
    "            # Skip files inside our own converted/ dir (avoid re-processing sidecars)"
)
new_hidden = (
    "        if not in_memory:\n"
    "            # Skip files inside our own converted/ dir (avoid re-processing sidecars)"
)

if old_hidden_v1 in src:
    src = src.replace(old_hidden_v1, new_hidden)
    print("  ✓ Patch 3: dotfiles raiz incluídos (v1)")
elif old_hidden_v2 in src:
    src = src.replace(old_hidden_v2, new_hidden)
    print("  ✓ Patch 3: dotfiles raiz incluídos (v2)")
elif 'p.name.startswith(".")' not in src:
    print("  ✓ Patch 3: já OK (dotfiles)")
else:
    print("  ⚠  Patch 3: padrão não reconhecido — verificar manualmente")

if src != original:
    detect.write_text(src)
    print(f"\n✓ Patches escritos em {detect}")
else:
    print("\n✓ Nenhuma alteração necessária")
PYEOF

echo "Feito."
