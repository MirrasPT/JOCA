---
name: knowledge-ingest
description: "Ingest URL/file into the personal Knowledge Base — convert to Markdown via markitdown, summarize, assign hierarchical tags, save raw+wiki+index. Backs the /know flow (FUTUROS Phase 5). MUST be invoked when the user says: /know, save this, knowledge base, second brain, ingest link, ingest PDF, transcribe YouTube, save reel, markitdown, catalog this, search what I saved."
metadata:
  version: 1.0.0
  origin: local
---

# Knowledge Ingest

Engine of `/know` (FUTUROS Phase 5). Takes a source (URL or file), converts it to Markdown, summarizes it, assigns hierarchical tags, and files it in the Knowledge Base, searchable in natural language. Personal second brain, Obsidian style.

## Base Principle

Heterogeneous source (PDF/Office/YouTube/Instagram/article/image/audio) → **a single format**: Markdown. All the intelligence (summary, tags, search) operates on the `.md`, never on the original format. Conversion is mandatory step 1.

Pipeline:
```
source ──→ markitdown ──→ raw .md ──→ summary + tags ──→ wiki .md ──→ index.json
```

---

## Folder Structure

Everything lives in `<JOCA_ROOT>/JOCA_Brain/memory/knowledge/`. The folder **does not exist yet** — create it on the first ingestion.

```
memory/knowledge/
├── index.json            # searchable global index (one entry per item)
├── tags.md               # hierarchical tag tree (Obsidian style)
├── raw/                  # raw markitdown output, untouched
│   └── 2026-06-21--reel-diapers.md
└── wiki/                 # curated note: summary + tags + frontmatter + link to raw
    └── 2026-06-21--reel-diapers.md
```

Rules:
- **`raw/`** — literal markitdown output. Never edit by hand. It is the source of truth for the content.
- **`wiki/`** — the note the user reads/edits. Summary + metadata. Points to the matching `raw/`.
- **Filename** — `YYYY-MM-DD--slug.md`. Slug = kebab-case derived from the title/topic. Same name in `raw/` and `wiki/`.
- `raw/` and `wiki/` share the name → trivial pairing.

---

## Setup — markitdown (Windows)

Converter: [microsoft/markitdown](https://github.com/microsoft/markitdown). Supports PDF, Office (docx/pptx/xlsx), HTML, images (OCR/description), audio (transcription), and more.

**Windows uses `python`, NEVER `python3`** (`python3` is the empty Microsoft Store stub → `ModuleNotFoundError`).

```bash
# install with all the extras (PDF, audio, OCR, etc.)
python -m pip install 'markitdown[all]'

# check
python -m markitdown --help
```

Robust detection of the right interpreter:
```bash
for PY in python python3; do
  command -v "$PY" >/dev/null 2>&1 && "$PY" -c "import markitdown" 2>/dev/null && { MD="$PY"; break; }
done
# use "$MD -m markitdown ..." from here on
```

**MCP alternative** — if the `markitdown-mcp` server is registered in the environment, use the MCP tool instead of the CLI. Do NOT assume it is registered: check the list of available MCPs first. Neither CLI nor MCP → install the CLI (above) before going on.

### Convert

```bash
# local file → stdout
python -m markitdown "C:/path/to/doc.pdf" > raw/2026-06-21--doc.md

# or via the output flag
python -m markitdown "C:/path/to/slides.pptx" -o raw/2026-06-21--slides.md
```

For **URLs** (article/YouTube/Instagram): markitdown accepts some URIs directly; when it does not, download first and convert the local file. Confirm the real behavior per type (see validation below) — do not infer.

---

## Credentials and sources that need auth

Some sources need a key/login (e.g. audio transcription via API, certain YouTube/Instagram endpoints, markitdown image plugins that call an LLM).

- Always prefer the **no-auth** route (local markitdown extracts captions/transcription already present; local OCR).
- Missing credential → **do NOT invent a key/endpoint**. Leave `TODO: missing credential — <source>` in the wiki note, mark the item `status: incomplete` in the index, and report to the user. (Hard limit from soul.md.)
- Dead link / deleted or private post → record `status: dead-link`, save whatever could be extracted, and say so. Never fabricate content.

---

## Steps of /know

1. **Receive source** — URL or file path (free text = save directly, skips markitdown).
2. **Convert** — `markitdown` → `raw/YYYY-MM-DD--slug.md`. If the conversion fails/comes back empty → report, do not invent.
3. **Summarize** — read the `raw/`, write a short summary (3-6 lines) + bullets of key points.
4. **Hierarchical tags** — assign 2-4 tags from the tree (see below). Reuse existing tags from `tags.md` before creating new ones. New tags → add them to the tree.
5. **Write the wiki** — `wiki/YYYY-MM-DD--slug.md` with frontmatter (see format).
6. **Index** — add/update the entry in `index.json`.
7. **Update `tags.md`** — if new tags came up.
8. **Confirm** — one line: `[know] <title> → #tag1 #tag2 (wiki/…md)`.

---

## Hierarchical Tags (Obsidian style)

Tree suggested by JOCA, editable by the user. It grows with the interests. Notation `#parent/child`.

`tags.md` (example — generate/expand according to real usage):
```markdown
# Tag Tree

- #work
  - #work/design
  - #work/programming
  - #work/productivity
- #personal
  - #personal/parenting
    - #personal/parenting/tricks
  - #personal/health
  - #personal/finances
- #learning
  - #learning/ai
  - #learning/tools
  - #learning/tutorials
```

Rule: **reuse before creating**. Before inventing a tag, look for an equivalent in the tree. Keep the tree lean.

---

## Wiki Note Format

`wiki/YYYY-MM-DD--slug.md`:
```markdown
---
title: "Trick for changing diapers without crying"
source: "https://instagram.com/reel/xyz"
source_type: instagram
date_saved: 2026-06-21
tags: [personal/parenting/tricks]
raw: raw/2026-06-21--reel-diapers.md
status: ok          # ok | incomplete | dead-link
---

## Summary
Reel shows a distraction technique (toy in the hand) that reduces fussing
during the change. Takes ~30s. Works up to ~18 months.

## Key points
- Giving a new/unexpected object holds the attention
- A waist-height surface avoids back injuries
- Prepare everything before starting

## Notes
(space for the user to annotate)
```

Controlled `source_type`: `pdf | office | youtube | instagram | article | image | audio | text`.

---

## Index Format

`index.json` — one entry per item. It is what the search walks through.

```json
{
  "version": 1,
  "items": [
    {
      "id": "2026-06-21--reel-diapers",
      "title": "Trick for changing diapers without crying",
      "source": "https://instagram.com/reel/xyz",
      "source_type": "instagram",
      "date_saved": "2026-06-21",
      "tags": ["personal/parenting/tricks"],
      "summary": "Distraction technique that reduces fussing during the change.",
      "wiki": "wiki/2026-06-21--reel-diapers.md",
      "raw": "raw/2026-06-21--reel-diapers.md",
      "status": "ok"
    }
  ]
}
```

`summary` in the index = one sentence (for fast matching). The full summary stays in the wiki.

---

## Natural Language Search

The user does NOT need to know the exact tags. Natural question → JOCA maps it to tags + terms and returns the items.

Examples:
- "Do I have tricks about diapers?" → look for `#personal/parenting/tricks` + the term "diaper" in `title/summary`.
- "What did I save about AI this week?" → filter `tags ~ #learning/ai` + `date_saved` in the last week.
- "That productivity article from last month" → `source_type=article` + `tags ~ productivity` + date window.
- "Everything about design" → `tags ~ design`.

Matching strategy (over `index.json`):
1. Infer candidate tags from the question (map synonyms → the `tags.md` tree).
2. Filter `items` by tag AND/OR by term in `title`/`summary`.
3. Apply date filters when the question mentions them ("this week", "last month").
4. Return title + summary + wiki link + source. Several results → list ordered by `date_saved` desc.

No hits → say so clearly and suggest nearby existing tags. Do not invent results.

---

## Management

- **Browse** — by tags via `tags.md` / tree view in JOCA_OS.
- **Edit** — fix tags/summary in the `wiki/` and reflect it in `index.json` (keep the two in sync).
- **Delete** — remove `wiki/` + `raw/` + the `index.json` entry.
- **Export** — copy the `knowledge/` folder (pure markdown = portable to Obsidian).

---

## Validation Before Declaring It Ready

markitdown behaves differently per source type. **Validate the produced `.md` against 1 REAL file per type** before calling the flow working (anti-fabrication rule + check the parser against real output):

1. Run 1 real conversion per `source_type` you intend to support (pdf, office, youtube, instagram, article, image, audio).
2. Open the `raw/*.md` and confirm it has substantive content — not empty, not just metadata, not a silent error.
3. Critical fields: YouTube/audio transcription cannot come back empty if it exists; OCR of an image with text has to contain it.
4. Only then mark the type as supported. A type that fails → document it as unsupported / `TODO`, do not pretend it works.

File existing ≠ file ready. Sample the content, do not trust the name.

---

## Anti-patterns

| Wrong | Right |
|--------|----------|
| `python3 -m markitdown` on Windows | `python -m markitdown` (python3 = Store stub) |
| Inferring that markitdown supports a type | 1 real conversion + inspect the `.md` |
| Inventing a key/endpoint for a source with auth | No-auth source or `TODO: missing credential` + report |
| Summarizing without reading the `raw/` | Read the converted `.md`, then summarize |
| Creating a new tag without looking at the existing ones | Reuse `tags.md`; only create if there is no equivalent |
| Editing `wiki/` and forgetting `index.json` | Keep wiki + index in sync |
| Editing the `raw/` by hand | `raw/` is immutable; notes go to `wiki/` |
| Declaring it ready because the file exists | Sample content (non-empty transcription/OCR) |
| Fabricating content for a dead link | `status: dead-link` + save what was extracted + say so |

---

## Related

- **browser-automate** — when a source needs browser driving to extract (dynamic post).
- **agent-context** — memory/INDEX conventions where the Knowledge Base fits in.
- FUTUROS.md Phase 5 — vision and pending decisions (final storage, embeddings for vector search).
