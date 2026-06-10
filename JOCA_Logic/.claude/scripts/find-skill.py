#!/usr/bin/env python3
"""find-skill.py — pesquisa PT/EN sobre o SKILL_INDEX.json (long tail de skills).

Usage:
    python3 .claude/scripts/find-skill.py <termo> [termo2 ...]

Procura em name, description e triggers. Devolve top 8 matches com path para Read().
"""

import json
import sys
from pathlib import Path

JOCA_ROOT = Path(__file__).resolve().parent.parent.parent
INDEX = JOCA_ROOT / "memory" / "SKILL_INDEX.json"


def main() -> int:
    terms = [t.lower() for t in sys.argv[1:] if t.strip()]
    if not terms:
        print("uso: find-skill.py <termo> [termo2 ...]")
        return 1
    if not INDEX.exists():
        print(f"índice não encontrado: {INDEX} — correr build-skill-index.py")
        return 1

    entries = json.loads(INDEX.read_text())
    scored = []
    for e in entries:
        hay_name = e.get("name", "").lower()
        hay_desc = e.get("description", "").lower()
        hay_trig = " ".join(e.get("triggers", [])).lower()
        score = 0
        for t in terms:
            if t in hay_name:
                score += 5
            if t in hay_trig:
                score += 3
            if t in hay_desc:
                score += 1
        if score > 0:
            scored.append((score, e))

    if not scored:
        print("0 matches — responder genericamente ou /create-skill.")
        return 0

    scored.sort(key=lambda x: -x[0])
    for score, e in scored[:8]:
        print(f"[{e['type']}] {e['name']}  →  Read(\"{e['path']}\")")
        print(f"    {e['description'][:140]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
