#!/usr/bin/env python3
"""Build SKILL_INDEX.json from .claude/skills/ — lightweight index for lazy loading.

Usage:
    python3 build-skill-index.py             # build + warnings
    python3 build-skill-index.py --strict    # exit 1 on empty triggers / truncated descriptions
"""

import json
import re
import sys
from pathlib import Path

JOCA_ROOT = Path(__file__).resolve().parent.parent.parent
SKILLS_DIR = JOCA_ROOT / ".claude" / "skills"
AGENTS_DIR = JOCA_ROOT / ".claude" / "agents"
OUTPUT = JOCA_ROOT / "memory" / "SKILL_INDEX.json"

MAX_DESC = 1024


def parse_frontmatter(path: Path) -> dict:
    """Extract YAML frontmatter fields from a markdown file."""
    text = path.read_text(errors="ignore")
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not match:
        return {}
    fm = {}
    current_key = None
    for line in match.group(1).splitlines():
        m = re.match(r"^(\w[\w-]*):\s*(.*)$", line)
        if m:
            current_key = m.group(1)
            fm[current_key] = m.group(2).strip().strip('"').strip("'")
        elif current_key and line.startswith("  ") and not line.lstrip().startswith("-"):
            # Continuation line of a folded/multiline scalar (description: > / |)
            fm[current_key] = (fm[current_key] + " " + line.strip()).strip()
    return fm


def clean_description(desc: str) -> str:
    """Normalise whitespace, remove `,,` artifacts, truncate at sentence boundary."""
    desc = re.sub(r"\s+", " ", desc).strip()
    desc = re.sub(r",\s*,", ",", desc)
    if len(desc) <= MAX_DESC:
        return desc
    cut = desc[:MAX_DESC]
    # Truncate at last sentence end; fall back to last word boundary.
    sentence_end = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    if sentence_end > MAX_DESC // 3:
        return cut[: sentence_end + 1]
    space = cut.rfind(" ")
    return (cut[:space] if space > 0 else cut) + "…"


def extract_first_sentence(path: Path) -> str:
    """Get first meaningful line after frontmatter as description fallback."""
    text = path.read_text(errors="ignore")
    text = re.sub(r"^---.*?---\s*\n", "", text, count=1, flags=re.DOTALL)
    for line in text.splitlines():
        line = line.strip()
        if line and not line.startswith("#") and not line.startswith("```"):
            return line
    return ""


def extract_triggers(path: Path, description: str) -> list:
    """Extract trigger keywords from frontmatter or description trigger phrases."""
    text = path.read_text(errors="ignore")
    triggers = []

    # Frontmatter triggers: inline comma-separated form (`triggers: a, b, c`)
    inline_match = re.search(r"^triggers?:[ \t]*(?!\n)(.+)$", text, re.MULTILINE)
    if inline_match:
        for item in inline_match.group(1).split(","):
            item = item.strip().strip('"').strip("'").strip()
            if item:
                triggers.append(item)

    # Frontmatter triggers: YAML-list form
    fm_match = re.search(r"^triggers?:\s*\n((?:\s+-\s+.+\n)+)", text, re.MULTILINE)
    if fm_match:
        for line in fm_match.group(1).splitlines():
            m = re.match(r"\s+-\s+(.+)", line)
            if m:
                triggers.append(m.group(1).strip().strip('"'))

    # "Triggered by/after:" in normalised description (handles folded YAML) or body
    tb_match = re.search(r"Trigger(?:ed (?:by|after)[^:]*|s)\s*:\s*(.+?)(?:\.|$)", description) or \
               re.search(r"Trigger(?:ed (?:by|after)[^:]*|s)\s*:\s*(.+?)(?:\.|$)", text, re.MULTILINE)
    if tb_match:
        items = re.split(r'[,;]|"\s*"', tb_match.group(1))
        triggers.extend(i.strip().strip('"') for i in items if i.strip())

    # Fallback: mine RFC 2119 trigger phrases from the description itself
    # ("MUST be invoked when the user says: a, b, c. SHOULD also invoke when: x, y")
    if not triggers:
        for m in re.finditer(
            r"(?:MUST be invoked when(?: the user says| the user mentions)?|SHOULD also invoke when)\s*:?\s*([^.]+)",
            description,
            re.IGNORECASE,
        ):
            for item in m.group(1).split(","):
                item = item.strip().strip('"').strip("'").strip()
                if 2 < len(item) <= 60:
                    triggers.append(item)

    # Dedupe, preserve order
    seen = set()
    out = []
    for t in triggers:
        key = t.lower()
        if key not in seen:
            seen.add(key)
            out.append(t)
    return out[:12]


def build_index(strict: bool = False) -> int:
    entries = []
    problems = []

    sources = [("skill", f) for f in sorted(SKILLS_DIR.glob("*.md"))] + \
              [("agent", f) for f in sorted(AGENTS_DIR.glob("*.md"))]

    for kind, file in sources:
        # Companion reference files are loaded by their core skill, not indexed.
        if file.name.endswith(".ref.md"):
            continue
        name = file.stem
        fm = parse_frontmatter(file)
        desc = clean_description(fm.get("description", "") or extract_first_sentence(file))
        triggers = extract_triggers(file, desc)

        if not triggers:
            problems.append(f"{kind} '{name}': sem triggers")
        if not desc:
            problems.append(f"{kind} '{name}': sem descrição")

        entries.append({
            "type": kind,
            "name": name,
            "path": file.relative_to(JOCA_ROOT).as_posix(),
            "description": desc,
            "triggers": triggers,
        })

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n")
    n_skills = sum(1 for e in entries if e["type"] == "skill")
    n_agents = sum(1 for e in entries if e["type"] == "agent")
    print(f"[index] Generated {OUTPUT}: {len(entries)} entries ({n_skills} skills, {n_agents} agents)")

    if problems:
        print(f"[index] {len(problems)} warnings:")
        for p in problems:
            print(f"  ⚠ {p}")
        if strict:
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(build_index(strict="--strict" in sys.argv))
