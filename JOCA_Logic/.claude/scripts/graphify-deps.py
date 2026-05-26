#!/usr/bin/env python3
"""
graphify-deps.py — Augments graphify graph.json with file-system dependency edges.

What it adds:
  • Folder tree nodes (dir → dir, dir → file)
  • Cross-file references (HTML src/href/url() → target file)
  • Asset references (img, video, link, script)
  • Markdown links between .md files

Run from project root:
  python3 graphify-deps.py
  graphify cluster-only .    (regenerate GRAPH_REPORT.md)
"""

import json, re, hashlib, sys
from pathlib import Path

ROOT      = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).parent.resolve()
GRAPH_IN  = ROOT / "graphify-out" / "graph.json"
GRAPH_OUT = ROOT / "graphify-out" / "graph.json"

IGNORE_DIRS  = {".git", "node_modules", "__pycache__", "graphify-out"}
IGNORE_FILES = {"graphify-deps.py"}

# ── helpers ──────────────────────────────────────────────────────────────────

def node_id(path: str) -> str:
    return "fs_" + re.sub(r"[^a-z0-9]", "_", path.lower())

def short(path: Path) -> str:
    """Relative path from ROOT."""
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)

def collect_all_files():
    files, dirs = [], []
    for p in sorted(ROOT.rglob("*")):
        rel = short(p)
        parts = Path(rel).parts
        if any(d in IGNORE_DIRS for d in parts):
            continue
        if p.name in IGNORE_FILES or p.name.startswith("."):
            continue
        if p.is_dir():
            dirs.append(p)
        elif p.is_file():
            files.append(p)
    return files, dirs

def file_type(p: Path) -> str:
    """Map to graphify valid types: code|concept|document|image|paper|rationale"""
    ext = p.suffix.lower()
    if ext in {".html", ".htm", ".css", ".scss", ".js", ".ts", ".json", ".toml", ".yaml", ".yml"}: return "code"
    if ext in {".md", ".mdx", ".txt", ".rst"}:  return "document"
    if ext in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".psd"}: return "image"
    if ext in {".mp4", ".mov", ".webm", ".mp3"}: return "document"
    if ext in {".pdf"}:            return "paper"
    return "document"

# ── reference extractors ──────────────────────────────────────────────────────

def refs_from_html(p: Path):
    """Extract src/href/url() targets from an HTML file."""
    try:
        text = p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return []
    targets = []
    for pattern in [
        r'src=["\']([^"\'#?]+)["\']',
        r'href=["\']([^"\'#?]+)["\']',
        r'url\(["\']?([^"\')\s#?]+)["\']?\)',
    ]:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            ref = m.group(1).strip()
            if ref.startswith(("http", "//", "data:", "mailto:", "tel:")):
                continue
            targets.append(ref)
    return targets

def refs_from_md(p: Path):
    """Extract [text](path) links from a Markdown file."""
    try:
        text = p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return []
    return [m.group(1) for m in re.finditer(r'\[([^\]]*)\]\(([^)#?]+)\)', text)
            if not m.group(2).startswith(("http", "//", "mailto:"))
            and m.group(2)]

def resolve_ref(source: Path, ref: str) -> Path | None:
    """Resolve a relative reference to an absolute path."""
    candidate = (source.parent / ref).resolve()
    if candidate.exists():
        return candidate
    # Try from ROOT
    candidate2 = (ROOT / ref).resolve()
    if candidate2.exists():
        return candidate2
    return None

# ── build graph augmentation ─────────────────────────────────────────────────

def build_dep_graph():
    files, dirs = collect_all_files()

    new_nodes = {}
    new_edges = []

    def add_node(p: Path, ntype: str = None):
        rel = short(p)
        nid = node_id(rel)
        if nid not in new_nodes:
            # dirs map to "concept" — represents a container/namespace
            resolved_type = ntype or ("concept" if p.is_dir() else file_type(p))
            new_nodes[nid] = {
                "id": nid,
                "label": p.name if p.is_file() else rel,
                "path": rel,
                "file_type": resolved_type,
                "source_file": rel,
                "source_location": "L1",
                "norm_label": rel,
            }
        return nid

    def add_edge(src_id, tgt_id, ctx):
        new_edges.append({"source": src_id, "target": tgt_id,
                          "context": ctx, "weight": 1.0, "confidence": 1.0,
                          "edge_type": "EXTRACTED"})

    # 1. Folder tree
    for d in dirs:
        d_id = add_node(d, "dir")
        parent = d.parent
        if parent != ROOT.parent and short(parent) not in IGNORE_DIRS:
            p_id = add_node(parent, "dir")
            add_edge(p_id, d_id, "contains")

    # 2. File → parent dir
    for f in files:
        f_id = add_node(f)
        parent = f.parent
        p_id = add_node(parent, "dir")
        add_edge(p_id, f_id, "contains")

    # 3. Cross-file references from HTML
    for f in files:
        if f.suffix.lower() in {".html", ".htm"}:
            f_id = add_node(f)
            for ref in refs_from_html(f):
                target = resolve_ref(f, ref)
                if target and short(target) not in ["", "."]:
                    t_id = add_node(target)
                    add_edge(f_id, t_id, f"references: {ref}")

    # 4. Cross-file references from Markdown
    for f in files:
        if f.suffix.lower() in {".md", ".mdx"}:
            f_id = add_node(f)
            for ref in refs_from_md(f):
                target = resolve_ref(f, ref)
                if target:
                    t_id = add_node(target)
                    add_edge(f_id, t_id, f"links: {ref}")

    return list(new_nodes.values()), new_edges


# ── merge into existing graph.json ────────────────────────────────────────────

def merge_and_save():
    new_nodes, new_edges = build_dep_graph()

    if GRAPH_IN.exists():
        existing = json.loads(GRAPH_IN.read_text(encoding="utf-8"))
    else:
        existing = {"directed": False, "multigraph": False, "graph": {},
                    "nodes": [], "links": []}

    # Index existing nodes by id
    existing_ids = {n["id"] for n in existing.get("nodes", [])}
    existing_edge_pairs = {
        (e.get("source"), e.get("target"))
        for e in existing.get("links", [])
    }

    added_nodes = 0
    for n in new_nodes:
        if n["id"] not in existing_ids:
            existing["nodes"].append(n)
            existing_ids.add(n["id"])
            added_nodes += 1
        else:
            # Enrich existing node with path metadata
            for ex in existing["nodes"]:
                if ex["id"] == n["id"] and "path" not in ex:
                    ex["path"] = n.get("path", "")

    added_edges = 0
    for e in new_edges:
        pair = (e["source"], e["target"])
        pair_r = (e["target"], e["source"])
        if pair not in existing_edge_pairs and pair_r not in existing_edge_pairs:
            # Only add edge if both nodes exist
            if e["source"] in existing_ids and e["target"] in existing_ids:
                existing.setdefault("links", []).append(e)
                existing_edge_pairs.add(pair)
                added_edges += 1

    GRAPH_OUT.parent.mkdir(exist_ok=True)
    GRAPH_OUT.write_text(json.dumps(existing, ensure_ascii=False, indent=2),
                         encoding="utf-8")
    return added_nodes, added_edges


if __name__ == "__main__":
    print(f"Root: {ROOT}")
    added_n, added_e = merge_and_save()
    data = json.loads(GRAPH_OUT.read_text())
    print(f"Added: {added_n} nodes, {added_e} edges")
    print(f"Total: {len(data['nodes'])} nodes, {len(data.get('links', []))} edges")
    print(f"\nNow run: graphify cluster-only {ROOT}")
