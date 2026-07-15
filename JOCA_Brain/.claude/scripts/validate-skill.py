#!/usr/bin/env python
"""validate-skill.py -- linter de frontmatter de skills JOCA.

Inspirado em mukul975/Anthropic-Cybersecurity-Skills tools/validate-skill.py;
implementacao limpa propria, sem dependencias externas (parse a mao do bloco
entre `---`). Windows-safe -- correr com `python` (nao `python3`, que e o stub
vazio da Microsoft Store).

USO
    # validar ficheiros especificos
    python .claude/scripts/validate-skill.py .claude/skills/caveman.md [...]

    # varrer todas as skills (sem args)
    python .claude/scripts/validate-skill.py

VALIDACOES
    (a) tem frontmatter YAML (bloco delimitado por --- no topo)
    (b) campo `name` presente e kebab-case
    (c) campo `description` presente, nao-vazio, e idealmente com triggers
    (d) `name` bate com o nome do ficheiro (sem .md)

SAIDA
    Linha OK / WARN / FAIL por ficheiro + sumario.
    Exit 1 se algum FAIL; exit 0 caso contrario.
"""

import re
import sys
from pathlib import Path

SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills"

KEBAB_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# Heuristica leve para detectar triggers na description.
TRIGGER_HINTS = (
    "trigger", "invoke", "invoked", "use when", "when the user",
    "must be", "activate", "activated", "usar quando", "quando",
)


def parse_frontmatter(text):
    """Extrai o bloco frontmatter delimitado por --- no topo do ficheiro.

    Devolve (dict_de_campos, erro_ou_None). Parse simples chave: valor de
    topo de nivel -- suficiente para name/description. Nao tenta YAML completo.
    """
    lines = text.splitlines()
    # Ignorar BOM/linhas em branco iniciais.
    idx = 0
    while idx < len(lines) and lines[idx].strip() == "":
        idx += 1
    if idx >= len(lines) or lines[idx].strip() != "---":
        return None, "sem frontmatter (falta `---` de abertura)"

    fields = {}
    closed = False
    i = idx + 1
    while i < len(lines):
        line = lines[i]
        if line.strip() == "---":
            closed = True
            break
        m = re.match(r"^([A-Za-z0-9_-]+)\s*:\s*(.*)$", line)
        if m:
            key = m.group(1).strip().lower()
            val = m.group(2).strip()
            # Remover aspas envolventes (simples ou duplas).
            if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
                val = val[1:-1]
            fields[key] = val
        i += 1

    if not closed:
        return None, "frontmatter nao fechado (falta `---` de fecho)"
    return fields, None


def validate(path):
    """Valida um ficheiro de skill. Devolve (status, mensagens).

    status: "OK" | "WARN" | "FAIL".
    """
    p = Path(path)
    msgs = []

    if not p.is_file():
        return "FAIL", ["ficheiro nao existe"]

    try:
        text = p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return "FAIL", ["nao decodificavel como UTF-8"]

    fields, err = parse_frontmatter(text)
    if err:
        return "FAIL", [err]

    fails = []
    warns = []

    # (b) name presente e kebab-case
    name = fields.get("name")
    if not name:
        fails.append("campo `name` em falta")
    elif not KEBAB_RE.match(name):
        fails.append("`name` nao e kebab-case: %r" % name)

    # (c) description presente, nao-vazia, idealmente com triggers
    desc = fields.get("description")
    if desc is None:
        fails.append("campo `description` em falta")
    elif desc.strip() == "":
        fails.append("`description` vazia")
    else:
        low = desc.lower()
        if not any(h in low for h in TRIGGER_HINTS):
            warns.append("`description` sem triggers aparentes (use when/invoke/quando...)")

    # (d) name vs nome do ficheiro -- WARN, nao FAIL.
    # Convencao JOCA: o `name:` descritivo manda (ex.: horizon.md -> horizon-queues);
    # o sistema refere as skills pelo `name:`, nao pelo ficheiro (ver sync-questionnaires.md).
    stem = p.stem
    if name and name != stem:
        warns.append("`name` (%r) != nome do ficheiro (%r) -- ok se intencional (convencao JOCA)" % (name, stem))

    if fails:
        return "FAIL", fails + warns
    if warns:
        return "WARN", warns
    return "OK", []


def main(argv):
    args = argv[1:]
    if args:
        targets = [Path(a) for a in args]
    else:
        if not SKILLS_DIR.is_dir():
            print("FAIL: diretorio de skills nao encontrado: %s" % SKILLS_DIR)
            return 1
        targets = sorted(SKILLS_DIR.glob("*.md"))
        if not targets:
            print("WARN: nenhum .md em %s" % SKILLS_DIR)
            return 0

    counts = {"OK": 0, "WARN": 0, "FAIL": 0}
    for t in targets:
        status, msgs = validate(t)
        counts[status] += 1
        line = "[%-4s] %s" % (status, t.name)
        print(line)
        for m in msgs:
            print("        - %s" % m)

    print("")
    print("Total: %d  OK: %d  WARN: %d  FAIL: %d" % (
        len(targets), counts["OK"], counts["WARN"], counts["FAIL"]))

    return 1 if counts["FAIL"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
