#!/usr/bin/env bash
# joca-graphify — wrapper para a graphify Python API
# Evita ter de memorizar o one-liner; contorna o bug do CLI graphify
#
# Uso:
#   bash joca-graphify.sh               # usa directório actual
#   bash joca-graphify.sh /path/proj    # path explícito
#   bash joca-graphify.sh .             # directório actual (explícito)
#
# Alias sugerido no ~/.zshrc:
#   alias joca-graphify="bash <JOCA_PATH>/.claude/scripts/joca-graphify.sh"

set -euo pipefail

TARGET="${1:-.}"

python3 - "$TARGET" << 'PYEOF'
import sys
from pathlib import Path
from graphify.watch import _rebuild_code

path = Path(sys.argv[1]).resolve()
if not path.exists():
    print(f"✗ Path não existe: {path}")
    sys.exit(1)

print(f"→ graphify: {path}")
_rebuild_code(path)
print(f"✓ Graph actualizado")
PYEOF
