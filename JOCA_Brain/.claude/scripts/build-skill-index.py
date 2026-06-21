#!/usr/bin/env python3
"""Build SKILL_INDEX.json from .claude/skills/ — lightweight index for lazy loading."""

import json
import os
import re
from pathlib import Path

JOCA_ROOT = Path(__file__).resolve().parent.parent.parent
SKILLS_DIR = JOCA_ROOT / ".claude" / "skills"
AGENTS_DIR = JOCA_ROOT / ".claude" / "agents"
OUTPUT = JOCA_ROOT / "memory" / "SKILL_INDEX.json"


def parse_frontmatter(path: Path) -> dict:
    """Extract YAML frontmatter fields from a markdown file."""
    text = path.read_text(errors="ignore")
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not match:
        return {}
    fm = {}
    for line in match.group(1).splitlines():
        m = re.match(r"^(\w[\w-]*):\s*(.+)$", line)
        if m:
            key, val = m.group(1), m.group(2).strip().strip('"').strip("'")
            fm[key] = val
    return fm


def extract_first_sentence(path: Path) -> str:
    """Get first meaningful line after frontmatter as description fallback."""
    text = path.read_text(errors="ignore")
    # Skip frontmatter
    text = re.sub(r"^---.*?---\s*\n", "", text, count=1, flags=re.DOTALL)
    for line in text.splitlines():
        line = line.strip()
        if line and not line.startswith("#") and not line.startswith("```"):
            return line[:200]
    return ""


def extract_triggers(path: Path) -> list:
    """Extract trigger keywords from file content."""
    text = path.read_text(errors="ignore")
    triggers = []

    # From frontmatter triggers: field — inline comma-separated form
    # (e.g. `triggers: a, b, c`)
    inline_match = re.search(r"^triggers?:[ \t]*(?!\n)(.+)$", text, re.MULTILINE)
    if inline_match:
        for item in inline_match.group(1).split(","):
            item = item.strip().strip('"').strip("'").strip()
            if item:
                triggers.append(item)

    # From frontmatter triggers: field — YAML-list form
    fm_match = re.search(r"^triggers?:\s*\n((?:\s+-\s+.+\n)+)", text, re.MULTILINE)
    if fm_match:
        for line in fm_match.group(1).splitlines():
            m = re.match(r"\s+-\s+(.+)", line)
            if m:
                triggers.append(m.group(1).strip().strip('"'))

    # From "Triggered by:" in description
    tb_match = re.search(r"Triggered by:?\s*(.+?)(?:\.|$)", text)
    if tb_match:
        items = re.split(r'[,;]|"\s*"', tb_match.group(1))
        triggers.extend(i.strip().strip('"') for i in items if i.strip())

    return triggers[:10]


def build_index():
    entries = []

    # Index skills (flat structure: .claude/skills/<name>.md)
    for skill_file in sorted(SKILLS_DIR.glob("*.md")):
        rel = skill_file.relative_to(JOCA_ROOT)
        name = skill_file.stem

        fm = parse_frontmatter(skill_file)
        desc = fm.get("description", "") or extract_first_sentence(skill_file)
        triggers = extract_triggers(skill_file)
        category = fm.get("category", "general")

        entries.append({
            "type": "skill",
            "name": name,
            "category": category,
            "path": str(rel),
            "description": desc[:200],
            "triggers": triggers,
        })

    # Index agents
    for agent_file in sorted(AGENTS_DIR.glob("*.md")):
        name = agent_file.stem
        fm = parse_frontmatter(agent_file)
        desc = fm.get("description", "") or extract_first_sentence(agent_file)
        triggers = extract_triggers(agent_file)

        entries.append({
            "type": "agent",
            "name": name,
            "category": "agents",
            "path": str(agent_file.relative_to(JOCA_ROOT)),
            "description": desc[:200],
            "triggers": triggers,
        })

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(entries, indent=2, ensure_ascii=False))
    print(f"[index] Generated {OUTPUT}: {len(entries)} entries ({sum(1 for e in entries if e['type']=='skill')} skills, {sum(1 for e in entries if e['type']=='agent')} agents)")


if __name__ == "__main__":
    build_index()
