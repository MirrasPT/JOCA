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
    lines = match.group(1).splitlines()
    i = 0
    while i < len(lines):
        m = re.match(r"^(\w[\w-]*):\s*(.*)$", lines[i])
        if not m:
            i += 1
            continue
        key, val = m.group(1), m.group(2).strip()
        # YAML block scalars: `description: |` / `>` put the value on the following indented lines.
        # Treating them as plain values stored a literal "|" — which is what several agents had as
        # their whole description in the index, losing both the text and any triggers inside it.
        if val in ("|", ">", "|-", ">-", "|+", ">+"):
            fold = val.startswith(">")
            block, i = [], i + 1
            while i < len(lines) and (not lines[i].strip() or lines[i].startswith((" ", "\t"))):
                block.append(lines[i].strip())
                i += 1
            fm[key] = (" " if fold else "\n").join(b for b in block if b)
            continue
        fm[key] = val.strip('"').strip("'")
        i += 1
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


def extract_triggers(path: Path, description: str = "") -> list:
    """Extract trigger keywords from file content.

    `description` is the already-parsed frontmatter value. The prose patterns below are matched
    against it alone, never the whole file: run over the raw text they would sail past the end of
    the description: value and swallow the keys that follow it (chain:, compatibility:), yielding
    triggers like 'tarefa irreversivel."\\nchain: design-review'.
    """
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

    # From the invocation phrases that live INSIDE description:. 43% of the skills carry their
    # triggers only in this prose form, which used to leave them in the index with an empty
    # triggers list — present, but unreachable by keyword.
    #
    #   description: "... MUST be invoked when the user says: adr, architecture decision, ...
    #                 SHOULD also invoke when: record this decision, ..."
    #   description: "... Invocar quando o utilizador disser: automacao, cron, ..."
    #
    # The list ends at the sentence stop, so we cut on '.' — but not on a '.' inside a token
    # (node.js, .claude/, wix.config.json), which is why the stop must be followed by a space or
    # end of line.
    for phrase in (
        r"MUST be invoked when(?:ever)? the user (?:says|mentions)",
        r"MUST be invoked when(?:ever)? the user",
        r"MUST be invoked when",
        r"SHOULD also invoke when",
        r"Invocar quando o utilizador disser",
        r"Invocar quando",
        r"Invoke on",
        r"Triggers?",
    ):
        # Each list ends at its sentence stop; the next phrase starts its own match.
        for m in re.finditer(phrase + r":\s*(.+?)(?:\.\s|\.$|$)", description, re.IGNORECASE):
            for item in m.group(1).split(","):
                item = item.strip().strip('"').strip("'").strip("`").rstrip(".").strip()
                # Drop leftovers: empty pieces from "x,,", and prose fragments that are clearly
                # sentences rather than keywords.
                if item and len(item) <= 60 and item.count(" ") <= 6:
                    triggers.append(item)

    # De-duplicate case-insensitively, keeping first-seen order (frontmatter beats prose).
    seen, unique = set(), []
    for t in triggers:
        key = t.lower()
        if key not in seen:
            seen.add(key)
            unique.append(t)

    return unique[:15]


def build_index():
    entries = []

    # Index skills (flat structure: .claude/skills/<name>.md)
    for skill_file in sorted(SKILLS_DIR.glob("*.md")):
        rel = skill_file.relative_to(JOCA_ROOT)
        name = skill_file.stem

        fm = parse_frontmatter(skill_file)
        desc = fm.get("description", "") or extract_first_sentence(skill_file)
        triggers = extract_triggers(skill_file, desc)
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
        triggers = extract_triggers(agent_file, desc)

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
