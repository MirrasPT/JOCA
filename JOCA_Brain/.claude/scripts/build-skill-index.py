#!/usr/bin/env python3
"""Build SKILL_INDEX.json from .claude/skills/ — lightweight index for lazy loading."""

import fnmatch
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

JOCA_ROOT = Path(__file__).resolve().parent.parent.parent
SKILLS_DIR = JOCA_ROOT / ".claude" / "skills"
AGENTS_DIR = JOCA_ROOT / ".claude" / "agents"
OUTPUT = JOCA_ROOT / "memory" / "SKILL_INDEX.json"

# Cap de triggers por entrada. O corte é SILENCIOSO por natureza — quem acrescenta um trigger no
# fim da lista do frontmatter (o que qualquer editor faz por omissão) fica com uma alteração que
# existe no ficheiro e não faz nada, porque as skills carregam lazy por este índice.
# Regra: triggers novos vão para o INÍCIO da lista. O `cap_triggers()` avisa sempre que corta.
MAX_TRIGGERS = 25

# F4.1 — domínio de cada entrada: o 1.º nível do encaminhamento no prompt-triage.js (domínio → ramo).
# A 1.ª regra que casa ganha (padrões fnmatch); `dominio:` no frontmatter manda sobre a tabela; o gémeo
# `<skill>-agent` herda o da skill (o `dominio:` do frontmatter DA SKILL, senão a tabela pelo nome da
# skill); sem regra → "geral". Skill nova fora da tabela → acrescentar aqui.
DOMINIOS = [
    ("wordpress", ["wp-*", "woocommerce-elementor"]),
    ("ecommerce", ["shopify-*", "wix-cli"]),
    ("jogos", ["unity-*", "card-*", "game-balance", "tcg-*"]),
    ("3d", ["blender*", "meshy*", "impressao-3d"]),
    ("marketeer", ["mkt-*", "marketeer*"]),  # o pack separado da marketing genérica: medido +0,3 pp no top-1
    ("marketing", ["marketing", "seo*", "page-cro", "ab-test-setup", "analytics-tracking",
                   "paid-ads", "lead-capture", "launch-strategy", "competitor-profiling", "content-*",
                   "social-*", "email-sequence", "brand-positioning", "cloudflare-analytics"]),
    ("conteudo", ["copywriting", "stop-slop", "pt-pt-translator", "fact-check"]),
    ("media", ["img-gen*", "image-upscale", "raster-para-vector", "video*", "hyperframes", "remotion", "picsart",
               "suno", "lyric-align", "screen-record", "watch", "comfy-*", "foto-produto", "h3-prompt-writing",
               "gemini-brain"]),
    ("design", ["design-*", "preparar-design", "validar-design", "brand-guidelines", "icon-design", "graphic-design",
                "slides", "anima", "lottie-animator", "component-system", "c4-diagram", "html-review"]),
    ("frontend", ["frontend", "react-*", "tailwind", "shadcn", "mobile", "landing-page", "laravel-react",
                  "a11y-fixer", "android-compose", "electron-teste-ao-vivo", "click-path-audit", "site-capture"]),
    ("backend", ["laravel-*", "filament", "auth", "rest-api", "caching", "queues", "bullmq", "horizon",
                 "reverb-realtime", "mysql", "query-debugger", "webhooks", "search", "saas-patterns", "file-storage",
                 "transactional-email", "postmark", "react-email", "portugal-*", "payment-integration",
                 "algoritmo-de-terceiros", "error-tracking-dev"]),
    ("deploy", ["deploy-*", "cpanel", "cloudflare-dns", "selfhosted-arr", "availability", "error-tracking-prod",
                "github", "pr-repair"]),
    ("qualidade", ["escrever-testes", "tdd", "mutation-testing", "tester-*", "security*", "seguranca", "cso", "gdpr-compliance",
                   "credential-handling", "dependency-auditor", "tech-debt-auditor", "codex-review", "gemini-auditor",
                   "log-debugger", "public-release-audit", "source-driven-development", "yagni", "careful",
                   "auditoria-site-live", "browser-automate"]),
    ("documentos", ["pdf-*", "html-to-pdf", "pacote-entrega", "questionario-local", "notion", "file-organization",
                    "knowledge-ingest", "deep-research", "personal-comms", "email-dashboard", "android-adb"]),
    ("projecto", ["start", "novo-issue", "planear-ondas", "prd*", "executar-projeto", "plan",
                  "tech-spec", "freeze", "unfreeze", "guard", "caveman", "create-skill", "gauntlet-loop",
                  "context-pack", "joca-*", "clean-install-audit", "self-improver", "skill-*", "task-router"]),
]


def dominio_de(name: str, fm: dict) -> str:
    """Domínio da entrada (ver DOMINIOS)."""
    if fm.get("dominio"):
        return fm["dominio"]
    for dom, padroes in DOMINIOS:
        if any(fnmatch.fnmatchcase(name, p) for p in padroes):
            return dom
    return "geral"


def parse_frontmatter(path: Path) -> dict:
    """Extract YAML frontmatter fields from a markdown file."""
    text = path.read_text(encoding="utf-8", errors="ignore")
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
    text = path.read_text(encoding="utf-8", errors="ignore")
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
    text = path.read_text(encoding="utf-8", errors="ignore")
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
    # A chave ignora pontuação e espaços, portanto variantes de escrita da mesma coisa colapsam
    # ("re-render"/"rerender", "node.js"/"nodejs", "seo local"/"seo-local") em vez de gastarem
    # duas posições do cap. Só se removem separadores — nada de stemming, que geraria falsos
    # positivos. F4.1: os acentos também saem da chave ("autenticação"/"autenticacao") — o hook
    # normaliza-os, portanto eram o mesmo gatilho a gastar dois lugares do cap (lugares → ramos distintos).
    seen, unique = set(), []
    for t in triggers:
        sem_acentos = "".join(c for c in unicodedata.normalize("NFD", t.lower()) if not unicodedata.combining(c))
        key = re.sub(r"[\s\-_./]+", "", sem_acentos)
        if key and key not in seen:
            seen.add(key)
            unique.append(t)

    return unique


def cap_triggers(kind: str, name: str, triggers: list) -> list:
    """Corta aos MAX_TRIGGERS — mas nunca em silêncio (ver comentário do MAX_TRIGGERS)."""
    if len(triggers) <= MAX_TRIGGERS:
        return triggers
    dropped = len(triggers) - MAX_TRIGGERS
    msg = (f"[index] AVISO {kind} {name}: {len(triggers)} triggers, {dropped} descartados "
           f"(cap {MAX_TRIGGERS}) -- triggers novos vao para o INICIO da lista: "
           f"{', '.join(triggers[MAX_TRIGGERS:])}")
    # A consola do Windows é cp1252: um trigger acentuado abortaria o build inteiro por
    # UnicodeEncodeError. O ficheiro sai sempre em UTF-8; só o eco para a consola degrada.
    enc = sys.stdout.encoding or "utf-8"
    print(msg.encode(enc, "replace").decode(enc, "replace"))
    return triggers[:MAX_TRIGGERS]


def build_index():
    entries = []

    # Index skills (flat structure: .claude/skills/<name>.md)
    for skill_file in sorted(SKILLS_DIR.glob("*.md")):
        rel = skill_file.relative_to(JOCA_ROOT)
        name = skill_file.stem

        fm = parse_frontmatter(skill_file)
        desc = fm.get("description", "") or extract_first_sentence(skill_file)
        triggers = cap_triggers("skill", name, extract_triggers(skill_file, desc))
        category = fm.get("category", "general")

        entries.append({
            "type": "skill",
            "name": name,
            "category": category,
            "dominio": dominio_de(name, fm),
            "path": rel.as_posix(),   # POSIX sempre: `str()` daria `\` no Windows e o indice invertia 269 linhas a cada sync
            "description": desc[:200],
            "triggers": triggers,
        })

    # Index agents
    for agent_file in sorted(AGENTS_DIR.glob("*.md")):
        name = agent_file.stem
        fm = parse_frontmatter(agent_file)
        desc = fm.get("description", "") or extract_first_sentence(agent_file)
        triggers = cap_triggers("agent", name, extract_triggers(agent_file, desc))
        gemea = SKILLS_DIR / f"{name[:-6]}.md" if name.endswith("-agent") else None
        if gemea and gemea.exists():
            dominio = parse_frontmatter(gemea).get("dominio") or dominio_de(name[:-6], fm)
        else:
            dominio = dominio_de(name, fm)

        entries.append({
            "type": "agent",
            "name": name,
            "category": "agents",
            "dominio": dominio,
            "path": agent_file.relative_to(JOCA_ROOT).as_posix(),
            "description": desc[:200],
            "triggers": triggers,
        })

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[index] Generated {OUTPUT}: {len(entries)} entries ({sum(1 for e in entries if e['type']=='skill')} skills, {sum(1 for e in entries if e['type']=='agent')} agents)")


if __name__ == "__main__":
    build_index()
