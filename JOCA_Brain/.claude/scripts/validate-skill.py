#!/usr/bin/env python
"""validate-skill.py -- frontmatter linter for JOCA skills.

Inspired by mukul975/Anthropic-Cybersecurity-Skills tools/validate-skill.py;
clean implementation of our own, no external dependencies (hand-parses the
block between `---`). Windows-safe -- run with `python` (not `python3`, which
is the empty Microsoft Store stub).

USAGE
    # validate specific files
    python .claude/scripts/validate-skill.py .claude/skills/caveman.md [...]

    # sweep every skill (no args)
    python .claude/scripts/validate-skill.py

VALIDATIONS
    (a) has YAML frontmatter (block delimited by --- at the top)
    (b) `name` field present and kebab-case
    (c) `description` field present, non-empty, and ideally with triggers
    (d) `name` matches the file name (without .md)

OUTPUT
    One OK / WARN / FAIL line per file + summary.
    Exit 1 if any FAIL; exit 0 otherwise.
"""

import re
import sys
from pathlib import Path

SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills"

KEBAB_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# Light heuristic to detect triggers in the description.
TRIGGER_HINTS = (
    "trigger", "invoke", "invoked", "use when", "when the user",
    "must be", "activate", "activated", "usar quando", "quando",
)


def parse_frontmatter(text):
    """Extract the frontmatter block delimited by --- at the top of the file.

    Returns (dict_of_fields, error_or_None). Simple top-level key: value
    parse -- enough for name/description. Does not attempt full YAML.
    """
    lines = text.splitlines()
    # Ignore BOM/leading blank lines.
    idx = 0
    while idx < len(lines) and lines[idx].strip() == "":
        idx += 1
    if idx >= len(lines) or lines[idx].strip() != "---":
        return None, "no frontmatter (missing opening `---`)"

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
            # Strip the surrounding quotes (single or double).
            if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
                val = val[1:-1]
            fields[key] = val
        i += 1

    if not closed:
        return None, "frontmatter not closed (missing closing `---`)"
    return fields, None


def validate(path):
    """Validate a skill file. Returns (status, messages).

    status: "OK" | "WARN" | "FAIL".
    """
    p = Path(path)
    msgs = []

    if not p.is_file():
        return "FAIL", ["file does not exist"]

    try:
        text = p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return "FAIL", ["not decodable as UTF-8"]

    fields, err = parse_frontmatter(text)
    if err:
        return "FAIL", [err]

    fails = []
    warns = []

    # (b) name present and kebab-case
    name = fields.get("name")
    if not name:
        fails.append("`name` field missing")
    elif not KEBAB_RE.match(name):
        fails.append("`name` is not kebab-case: %r" % name)

    # (c) description present, non-empty, ideally with triggers
    desc = fields.get("description")
    if desc is None:
        fails.append("`description` field missing")
    elif desc.strip() == "":
        fails.append("`description` is empty")
    else:
        low = desc.lower()
        if not any(h in low for h in TRIGGER_HINTS):
            warns.append("`description` with no apparent triggers (use when/invoke/quando...)")

    # (d) name vs file name -- WARN, not FAIL.
    # JOCA convention: the descriptive `name:` wins (e.g. horizon.md -> horizon-queues);
    # the system refers to skills by `name:`, not by file (see docs/ARCHITECTURE.md).
    stem = p.stem
    if name and name != stem:
        warns.append("`name` (%r) != file name (%r) -- ok if intentional (JOCA convention)" % (name, stem))

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
            print("FAIL: skills directory not found: %s" % SKILLS_DIR)
            return 1
        targets = sorted(SKILLS_DIR.glob("*.md"))
        if not targets:
            print("WARN: no .md in %s" % SKILLS_DIR)
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
