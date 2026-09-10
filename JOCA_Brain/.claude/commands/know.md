# /know — Ingest into the Knowledge Base

Saves content into the personal second brain. `/know <url|file|text>`.

Shortcut to the `knowledge-ingest` agent.

## Flow

1. Receive the source: URL (article/YouTube/Instagram), file path (PDF/Office/image/audio), or free text.
2. Detect irreversible actions: none (it only writes to `memory/knowledge/`) → proceed without confirmation.
3. `Agent(subagent_type="knowledge-ingest")` with the source in the brief.
4. The agent: converts to Markdown via **markitdown** → generates a summary → assigns hierarchical tags → writes a wiki note in `memory/knowledge/` (immutable raw + `.md` note with wikilinks + index).
5. Report: title, assigned tags, and the path of the note.

## Search

Natural language (you do not need to know the tags): "do I have tricks about X?", "what did I save about AI this week?".
The agent reads the index + notes in `memory/knowledge/` and returns the source.

## Setup (once)

markitdown: `python -m pip install 'markitdown[all]'` (Windows: `python`, not `python3`).
Optional: register `markitdown-mcp` as a global MCP. See the `knowledge-ingest` skill.
