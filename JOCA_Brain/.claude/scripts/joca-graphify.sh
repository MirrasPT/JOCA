#!/usr/bin/env bash
# joca-graphify — wrapper for the graphify Python API
# Avoids having to memorize the one-liner; works around the graphify CLI bug
#
# Usage:
#   bash joca-graphify.sh               # uses the current directory
#   bash joca-graphify.sh /path/proj    # explicit path
#   bash joca-graphify.sh .             # current directory (explicit)
#
# Suggested alias in ~/.zshrc:
#   alias joca-graphify="bash <JOCA_PATH>/.claude/scripts/joca-graphify.sh"

set -euo pipefail

TARGET="${1:-.}"

python3 - "$TARGET" << 'PYEOF'
import sys
from pathlib import Path
from graphify.watch import _rebuild_code

path = Path(sys.argv[1]).resolve()
if not path.exists():
    print(f"✗ Path does not exist: {path}")
    sys.exit(1)

print(f"→ graphify: {path}")
_rebuild_code(path)
print(f"✓ Graph updated")
PYEOF
