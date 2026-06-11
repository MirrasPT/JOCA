#!/usr/bin/env python3
"""memory-search.py — pesquisa nas 3 camadas de memória do JOCA.

Nível 1: memory/curta.md          (snapshot — já injectado no contexto, listado para confirmação)
Nível 2: memory/longa/*.md        (resumos detalhados por sessão — encontra O log certo)
Nível 3: memory/diario/*.md       (extractos do chat completo — detalhe exacto)

Usage:
    python3 .claude/scripts/memory-search.py <termo> [termo2 ...]
    python3 .claude/scripts/memory-search.py --deep <termo>   # inclui contexto do diário

Fluxo recomendado ao responder a perguntas sobre o passado:
pergunta → curta (no contexto?) → longa (resumo aponta o log) → diario (Read ao .md/.jsonl)
"""

import re
import sys
from pathlib import Path

JOCA_ROOT = Path(__file__).resolve().parent.parent.parent
CURTA = JOCA_ROOT / "memory" / "curta.md"
LONGA = JOCA_ROOT / "memory" / "longa"
DIARIO = JOCA_ROOT / "memory" / "diario"


def score(text: str, terms: list) -> int:
    low = text.lower()
    return sum(low.count(t) for t in terms)


def snippet(text: str, terms: list, width: int = 160) -> str:
    low = text.lower()
    for t in terms:
        pos = low.find(t)
        if pos >= 0:
            start = max(0, pos - width // 2)
            return re.sub(r"\s+", " ", text[start:start + width]).strip()
    return re.sub(r"\s+", " ", text[:width]).strip()


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--deep"]
    deep = "--deep" in sys.argv
    terms = [t.lower() for t in args if t.strip()]
    if not terms:
        print(__doc__)
        return 1

    # Nível 1 — curta
    if CURTA.exists():
        text = CURTA.read_text(errors="ignore")
        s = score(text, terms)
        if s:
            print(f"[curta] memory/curta.md ({s} hits) — já deve estar no contexto")
            print(f"    …{snippet(text, terms)}…")
            print()

    # Nível 2 — longa (resumos)
    hits_longa = []
    if LONGA.exists():
        for f in sorted(LONGA.glob("*.md"), reverse=True):
            text = f.read_text(errors="ignore")
            s = score(text, terms)
            if s:
                hits_longa.append((s, f, text))
    if hits_longa:
        print(f"[longa] {len(hits_longa)} resumos com match:")
        for s, f, text in sorted(hits_longa, key=lambda x: -x[0])[:6]:
            print(f"  {f.relative_to(JOCA_ROOT)} ({s} hits)")
            print(f"    …{snippet(text, terms)}…")
        print()

    # Nível 3 — diário (extractos do chat completo)
    hits_diario = []
    if DIARIO.exists():
        for f in sorted(DIARIO.glob("*.md"), reverse=True):
            text = f.read_text(errors="ignore")
            s = score(text, terms)
            if s:
                hits_diario.append((s, f, text))
    if hits_diario:
        print(f"[diario] {len(hits_diario)} sessões com match:")
        for s, f, text in sorted(hits_diario, key=lambda x: -x[0])[:6]:
            print(f"  {f.relative_to(JOCA_ROOT)} ({s} hits)")
            if deep:
                low = text.lower()
                shown = 0
                for m in re.finditer("|".join(re.escape(t) for t in terms), low):
                    if shown >= 3:
                        break
                    start = max(0, m.start() - 100)
                    ctx = re.sub(r"\s+", " ", text[start:start + 220]).strip()
                    print(f"    …{ctx}…")
                    shown += 1
            else:
                print(f"    …{snippet(text, terms)}…")
        print("  → detalhe exacto: Read() ao .md acima (ou ao .jsonl com o mesmo nome)")
        print()

    if not hits_longa and not hits_diario:
        print("0 matches na memória longa/diário.")
        print("Verificar também: memory/projects/<nome>.md e git log da memória.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
