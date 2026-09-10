#!/usr/bin/env python3
"""
graphify-global.py — Global JOCA knowledge graph

Builds a structural graph of JOCA (skills, agents, commands, memory)
+ graphs of the active projects, and merges them into a single queryable graph.

Usage:
    python3 .claude/scripts/graphify-global.py
    python3 .claude/scripts/graphify-global.py --refresh   # regenerates everything
    python3 .claude/scripts/graphify-global.py --joca-only # JOCA only
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

JOCA = Path(__file__).resolve().parent.parent.parent
MEMORY_PROJECTS = JOCA / "memory" / "projects"
GLOBAL_OUT = JOCA / "graphify-out" / "global"
REFRESH = "--refresh" in sys.argv
JOCA_ONLY = "--joca-only" in sys.argv


# ──────────────────────────────────────────────
# Basic YAML frontmatter reading
# ──────────────────────────────────────────────

def parse_frontmatter(text: str) -> dict:
    """Extract simple YAML frontmatter (key: value) from a Markdown file."""
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not m:
        return {}
    result = {}
    for line in m.group(1).splitlines():
        kv = re.match(r'^(\w[\w\-]*)\s*:\s*(.+)', line.strip())
        if kv:
            result[kv.group(1).strip()] = kv.group(2).strip().strip('"\'')
    return result


def node_id(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")


# ──────────────────────────────────────────────
# Building the JOCA structural graph
# ──────────────────────────────────────────────

def build_joca_graph() -> dict:
    """Build JOCA's structural graph from files and frontmatter."""
    nodes: list[dict] = []
    links: list[dict] = []
    seen_ids: set[str] = set()

    def add_node(label: str, ntype: str, source_file: str = "", description: str = "", **extra) -> str:
        nid = node_id(label)
        # Disambiguate duplicate IDs
        base = nid
        i = 2
        while nid in seen_ids:
            nid = f"{base}_{i}"
            i += 1
        seen_ids.add(nid)
        nodes.append({
            "id": nid, "label": label,
            "file_type": ntype, "source_file": source_file,
            "source_location": "L1", "description": description,
            **extra,
        })
        return nid

    def add_edge(src: str, tgt: str, relation: str):
        links.append({
            "source": src, "target": tgt,
            "relation": relation, "confidence": "EXTRACTED",
            "confidence_score": 1.0, "weight": 1.0,
        })

    # Root
    joca_id = add_node("JOCA", "document", str(JOCA / "CLAUDE.md"),
                        description="JOCA toolkit root — skills, agents, commands, memory")

    # ── Skills ──────────────────────────────
    skills_root = add_node("skills", "document", "", description="Skill categories")
    add_edge(joca_id, skills_root, "contains")

    skills_dir = JOCA / ".claude" / "skills"
    for cat_dir in sorted(skills_dir.iterdir()):
        if not cat_dir.is_dir():
            continue
        cat_id = add_node(f"skills/{cat_dir.name}", "document", str(cat_dir),
                          description=f"Skill category: {cat_dir.name}")
        add_edge(skills_root, cat_id, "contains")

        for skill_file in sorted(cat_dir.rglob("*.md")):
            # Only SKILL.md or direct files (not references/)
            if "references" in skill_file.parts:
                continue
            text = skill_file.read_text(errors="ignore")
            fm = parse_frontmatter(text)
            name = fm.get("name") or skill_file.stem
            desc = fm.get("description", "")[:120]
            skill_id = add_node(f"skill:{name}", "document", str(skill_file),
                                description=desc)
            add_edge(cat_id, skill_id, "contains")

    # ── Agents ──────────────────────────────
    agents_dir = JOCA / ".claude" / "agents"
    if agents_dir.exists():
        agents_root = add_node("agents", "document", str(agents_dir),
                               description="Available agents (subagent_type)")
        add_edge(joca_id, agents_root, "contains")

        for agent_file in sorted(agents_dir.glob("*.md")):
            text = agent_file.read_text(errors="ignore")
            fm = parse_frontmatter(text)
            name = fm.get("name") or agent_file.stem
            desc = fm.get("description", "")[:120]
            agent_id = add_node(f"agent:{name}", "document", str(agent_file),
                                description=desc)
            add_edge(agents_root, agent_id, "contains")

    # ── Commands ────────────────────────────
    commands_dir = JOCA / ".claude" / "commands"
    if commands_dir.exists():
        cmds_root = add_node("commands", "document", str(commands_dir),
                             description="Slash commands")
        add_edge(joca_id, cmds_root, "contains")

        for cmd_file in sorted(commands_dir.glob("*.md")):
            text = cmd_file.read_text(errors="ignore")
            fm = parse_frontmatter(text)
            name = fm.get("name") or cmd_file.stem
            desc = fm.get("description", "")[:120]
            cmd_id = add_node(f"cmd:/{name}", "document", str(cmd_file),
                              description=desc)
            add_edge(cmds_root, cmd_id, "contains")

    # ── Memory ──────────────────────────────
    memory_root = add_node("memory", "document", str(JOCA / "memory" / "INDEX.md"),
                           description="JOCA persistent memory")
    add_edge(joca_id, memory_root, "contains")

    # Tools
    tools_dir = JOCA / "memory" / "tools"
    if tools_dir.exists():
        for tool_file in sorted(tools_dir.glob("*.md")):
            text = tool_file.read_text(errors="ignore")
            fm = parse_frontmatter(text)
            name = fm.get("name") or tool_file.stem
            tool_id = add_node(f"tool:{name}", "document", str(tool_file),
                               description=fm.get("description", "")[:120])
            add_edge(memory_root, tool_id, "documents")

    # Projects
    if MEMORY_PROJECTS.exists():
        for proj_file in sorted(MEMORY_PROJECTS.glob("*.md")):
            text = proj_file.read_text(errors="ignore")
            fm = parse_frontmatter(text)
            name = (fm.get("name") or fm.get("projecto") or proj_file.stem)
            desc = fm.get("description", "")[:120]
            proj_mem_id = add_node(f"project-ref:{proj_file.stem}", "document",
                                   str(proj_file), description=desc, project_name=name)
            add_edge(memory_root, proj_mem_id, "documents")

    return {
        "directed": False,
        "multigraph": False,
        "graph": {"name": "JOCA", "root": str(JOCA)},
        "nodes": nodes,
        "links": links,
        "hyperedges": [],
    }


def save_joca_graph() -> Path:
    """Generate and save the JOCA graph. Returns the path to graph.json."""
    out_dir = JOCA / "graphify-out"
    out_dir.mkdir(exist_ok=True)
    graph_path = out_dir / "graph.json"

    if graph_path.exists() and not REFRESH:
        size_kb = graph_path.stat().st_size // 1024
        print(f"  ✓ existing graph ({size_kb}KB) — pass --refresh to regenerate")
        return graph_path

    print(f"  → building the JOCA graph ...", end=" ", flush=True)
    graph = build_joca_graph()
    graph_path.write_text(json.dumps(graph, indent=2, ensure_ascii=False))
    size_kb = graph_path.stat().st_size // 1024
    print(f"✓ ({len(graph['nodes'])} nodes, {len(graph['links'])} edges, {size_kb}KB)")
    return graph_path


# ──────────────────────────────────────────────
# Project discovery
# ──────────────────────────────────────────────

def find_project_dirs() -> list[tuple[str, Path]]:
    """Read project paths from memory/projects/*.md."""
    dirs = []
    for f in sorted(MEMORY_PROJECTS.glob("*.md")):
        text = f.read_text(errors="ignore")
        # Supports several formats:
        #   directorio: /path
        #   **Directório:** `/path`
        #   **Directório:** /path
        m = re.search(
            r'(?i)direc[^\n:*]{0,12}[:\*]+\s*[`"\*]*([/~][^\s`"*\n\)]+)',
            text,
        )
        if m:
            raw = m.group(1).strip("`\"'*)")
            p = Path(raw).expanduser()
            if p.exists():
                dirs.append((f.stem, p))
            else:
                print(f"  ⚠  {f.stem}: directory not found ({p})")
        else:
            print(f"  ⚠  {f.stem}: no recognized 'directorio' field")
    return dirs


# ──────────────────────────────────────────────
# Project graph via graphify update
# ──────────────────────────────────────────────

def get_project_graph(name: str, path: Path) -> Path | None:
    """Return the project's graph.json — uses the existing one or generates it via graphify update."""
    graph = path / "graphify-out" / "graph.json"

    if graph.exists() and not REFRESH:
        size_kb = graph.stat().st_size // 1024
        print(f"  ✓ existing graph ({size_kb}KB) — pass --refresh to regenerate")
        return graph

    print(f"  → graphify update ...", end=" ", flush=True)
    r = subprocess.run(
        ["graphify", "update", str(path)],
        capture_output=True, text=True,
    )
    if graph.exists():
        size_kb = graph.stat().st_size // 1024
        print(f"✓ ({size_kb}KB)")
        return graph

    print(f"✗")
    if r.stderr:
        print(f"    {r.stderr[:300]}")
    return None


# ──────────────────────────────────────────────
# Merge + report
# ──────────────────────────────────────────────

def merge_graphs(graphs: list[Path]) -> Path | None:
    GLOBAL_OUT.mkdir(parents=True, exist_ok=True)
    merged = GLOBAL_OUT / "graph.json"
    print(f"\n→ merge-graphs ({len(graphs)} graphs) ...", end=" ", flush=True)
    r = subprocess.run(
        ["graphify", "merge-graphs", *[str(g) for g in graphs], "--out", str(merged)],
        capture_output=True, text=True,
    )
    if not merged.exists():
        print(f"✗\n  {r.stderr[:400]}")
        return None
    size_kb = merged.stat().st_size // 1024
    print(f"✓ ({size_kb}KB)")
    return merged


def build_project_bridges(merged_path: Path, projects: list[tuple[str, Path]]) -> int:
    """Build filesystem bridges between project-ref (JOCA) and every file of each project.

    For each project:
      1. Groups nodes by connected component → hub of each component (= the file's root node)
      2. Builds a directory tree from the source_file paths
      3. Injects directory nodes (prefixed with the project name)
      4. Links: project_ref → root_dir → subdirs → file_hubs

    Returns the total number of injected edges.
    """
    import re as _re
    from collections import defaultdict, Counter

    data = json.loads(merged_path.read_text(encoding="utf-8"))
    nodes_list: list[dict] = data["nodes"]
    links: list[dict] = data["links"]

    existing_ids: set[str] = {n["id"] for n in nodes_list}
    existing_edges: set[tuple] = {(l["source"], l["target"]) for l in links}

    deg: Counter = Counter()
    for lnk in links:
        deg[lnk["source"]] += 1
        deg[lnk["target"]] += 1

    # Union-find for connected components
    uf: dict[str, str] = {n["id"]: n["id"] for n in nodes_list}

    def uf_find(x: str) -> str:
        while uf[x] != x:
            uf[x] = uf[uf[x]]
            x = uf[x]
        return x

    for lnk in links:
        ra, rb = uf_find(lnk["source"]), uf_find(lnk["target"])
        if ra != rb:
            uf[ra] = rb

    total_added = 0

    def emit_edge(src: str, tgt: str, rel: str = "contains") -> None:
        nonlocal total_added
        pair = (src, tgt)
        if pair not in existing_edges and src in existing_ids and tgt in existing_ids:
            links.append({
                "source": src, "target": tgt, "relation": rel,
                "confidence": "EXTRACTED", "confidence_score": 1.0, "weight": 1.0,
            })
            existing_edges.add(pair)
            total_added += 1

    def emit_node(nid: str, label: str, ftype: str = "dir",
                  source_file: str = "", desc: str = "", **extra) -> None:
        if nid not in existing_ids:
            nodes_list.append({
                "id": nid, "label": label, "file_type": ftype,
                "source_file": source_file, "source_location": "L1",
                "description": desc, **extra,
            })
            existing_ids.add(nid)

    for mem_name, proj_path in projects:
        repo_name = proj_path.name
        proj_ref_id = node_id(f"project-ref:{mem_name}")
        prefix = _re.sub(r"[^a-z0-9]+", "_", repo_name.lower()).strip("_")

        if proj_ref_id not in existing_ids:
            continue

        # Nodes of this project
        proj_nodes = [n for n in nodes_list if n.get("repo") == repo_name]
        if not proj_nodes:
            continue

        # Hub per connected component (the node with the most edges in the component)
        comp_members: dict[str, list[dict]] = defaultdict(list)
        for n in proj_nodes:
            comp_members[uf_find(n["id"])].append(n)

        # file_hubs: source_file → [hub_node_ids]  (one file can have several hubs
        # if it was indexed with absolute and relative paths in the same run)
        file_hubs: dict[str, list[str]] = defaultdict(list)
        orphan_hubs: list[str] = []  # hubs with no useful source_file (e.g. graphify-out/)
        for _root, members in comp_members.items():
            hub = max(members, key=lambda n: deg.get(n["id"], 0))
            sf = hub.get("source_file", "").strip()
            if not sf or sf.startswith("graphify-out"):
                orphan_hubs.append(hub["id"])
                continue
            # Normalize: strip the project's absolute prefix if present
            try:
                sf_rel = str(Path(sf).relative_to(proj_path))
            except ValueError:
                sf_rel = sf
            file_hubs[sf_rel].append(hub["id"])

        # Unique directories (derived from all the source_files)
        dirs: set[str] = set()
        for sf in file_hubs:
            for ancestor in Path(sf).parents:
                s = str(ancestor)
                if s in ("", "."):
                    break
                dirs.add(s)

        def dir_nid(path_str: str) -> str:
            slug = _re.sub(r"[^a-z0-9]+", "_", path_str.lower()).strip("_")
            return f"fs_{prefix}_{slug}"

        # Check whether the project already has a filesystem root node (graphs generated from inside the folder)
        existing_root = next(
            (n for n in proj_nodes if n.get("label") == "." and n.get("file_type") == "dir"),
            None
        )
        if existing_root:
            root_nid = existing_root["id"]
        else:
            root_nid = f"fs_{prefix}__"
            emit_node(root_nid, repo_name, "dir", str(proj_path),
                      f"Project root: {repo_name}", repo=repo_name)

        # project_ref → root
        emit_edge(proj_ref_id, root_nid)

        # Create directory nodes and link parent → child
        for d in sorted(dirs, key=lambda x: x.count("/")):
            nid = dir_nid(d)
            emit_node(nid, Path(d).name, "dir", d,
                      f"Dir: {d}", repo=repo_name)
            parent_str = str(Path(d).parent)
            if parent_str in ("", "."):
                emit_edge(root_nid, nid)
            else:
                parent_nid = dir_nid(parent_str)
                emit_edge(parent_nid if parent_nid in existing_ids else root_nid, nid)

        # Link ALL of each file's hubs to the parent directory
        for sf, hub_ids in file_hubs.items():
            parent_str = str(Path(sf).parent)
            for hub_id in hub_ids:
                if parent_str in ("", "."):
                    emit_edge(root_nid, hub_id)
                else:
                    parent_nid = dir_nid(parent_str)
                    emit_edge(parent_nid if parent_nid in existing_ids else root_nid, hub_id)

        # Link orphans (e.g. graphify-out/) directly to the root
        for hub_id in orphan_hubs:
            emit_edge(root_nid, hub_id)

    data["nodes"] = nodes_list
    data["links"] = links
    merged_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    return total_added


def rebuild_report():
    """Regenerate clustering + GRAPH_REPORT.md via the Python API (avoids the cluster-only CLI path issue)."""
    print(f"→ cluster-only + report ...", end=" ", flush=True)
    try:
        import sys as _sys
        _sys.path.insert(0, str(pathlib.Path.home() / '.local/share/uv/tools/graphifyy/lib/python3.12/site-packages'))
        import json as _json
        import networkx as _nx
        from networkx.readwrite import json_graph as _jg
        from graphify.cluster import cluster, score_all
        from graphify.analyze import god_nodes, surprising_connections, suggest_questions
        from graphify.report import generate
        from graphify.export import to_json, to_html

        merged_path = GLOBAL_OUT / "graph.json"
        data = _json.loads(merged_path.read_text(encoding="utf-8"))
        try:
            G = _jg.node_link_graph(data, edges="links")
        except TypeError:
            G = _jg.node_link_graph(data)

        communities = cluster(G)
        cohesion = score_all(G, communities)

        # community labels = most-connected node per community
        labels: dict[int, str] = {}
        for cid, members in communities.items():
            deg = {n: G.degree(n) for n in members}
            labels[cid] = max(deg, key=deg.get) if deg else str(cid)

        god_list = god_nodes(G)
        surprise_list = surprising_connections(G, communities)
        questions = suggest_questions(G, communities, labels)

        detect_result = {
            "total_files": G.number_of_nodes(),
            "total_words": 0,
            "files": {"code": [], "document": [], "paper": [], "image": [], "video": []},
        }
        token_cost: dict = {}

        report_md = generate(G, communities, cohesion, labels, god_list,
                             surprise_list, detect_result, token_cost,
                             str(GLOBAL_OUT), questions)

        (GLOBAL_OUT / "GRAPH_REPORT.md").write_text(report_md, encoding="utf-8")
        to_json(G, communities, str(merged_path))
        to_html(G, communities, str(GLOBAL_OUT / "graph.html"), community_labels=labels)
        print("✓")
    except Exception as e:
        print(f"⚠  ({e})")


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

def main():
    print(f"JOCA Global Graph\n{'─' * 50}")
    graphs: list[Path] = []

    # 1. JOCA
    print(f"\n1. JOCA  ({JOCA})")
    g = save_joca_graph()
    if g:
        graphs.append(g)

    # 2. Projects
    if not JOCA_ONLY:
        projects = find_project_dirs()
        if not projects:
            print("\n  ⚠  No project with 'directorio' in memory/projects/")
        for i, (name, path) in enumerate(projects, 2):
            print(f"\n{i}. {name}  ({path})")
            g = get_project_graph(name, path)
            if g:
                graphs.append(g)

    if len(graphs) < 2:
        print(f"\n⚠  Only {len(graphs)} graph(s) — nothing to merge")
        if graphs:
            report = graphs[0].parent / "GRAPH_REPORT.md"
            print(f"  Graph: {graphs[0]}")
        sys.exit(0)

    # 3. Merge + cross-edges + report
    merged = merge_graphs(graphs)
    if not merged:
        sys.exit(1)
    if not JOCA_ONLY and projects:
        print(f"→ filesystem bridges ...", end=" ", flush=True)
        n = build_project_bridges(merged, projects)
        print(f"  + {n} edges/nodes injected")
    rebuild_report()

    print(f"\n{'─' * 50}")
    print(f"✓ Global graph:  {merged}")
    print(f"  Report:        {GLOBAL_OUT}/GRAPH_REPORT.md")
    print(f"\nQuery it in Claude: graphify-out/global/GRAPH_REPORT.md")


if __name__ == "__main__":
    main()
