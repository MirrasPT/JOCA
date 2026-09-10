---
name: file-organization
description: "Audits a folder of files (design assets, documents, exports) and produces a renaming/reorganisation plan with content that was REALLY verified, not guessed from the name. MUST be invoked when the user says: organize folder, tidy up files, rename files, clean up the assets folder, organization plan. SHOULD also invoke when: a disorganised client folder, names like v1/v2/op1, duplicate files, loose files in the root."
triggers: organize folder, tidy up files, rename files, clean up folder, organization plan, file organization, duplicates, loose files, name assets
chain: none — ends at the approved plan + execution; does not chain automatically
---

# File Organization

Organizing a folder of real files (design, docs, exports) — this is not a code refactor. The value is in **verifying the content before renaming**, never inferring from the current name, and never deleting without explicit approval.

## When to use it

A request like "organize this folder", "this is a mess", generic names (`v1/v2/v3`, `op1-op4`, `IMG_1234`), a client folder with years of accumulated material, duplicate exports in different formats.

**Not this skill:** organizing source code (that is a refactor — `laravel-refactor`/`tech-debt-auditor`), nor tidying up `.claude/skills`/code repos (their structure is already governed by the project's `CLAUDE.md`).

## Workflow

### 1. Recon — map the independent zones

`find`/`ls` to understand the tree and the volume before deciding on a method:
```bash
find . -type f -not -path "*/graphify-out/*" -not -name ".DS_Store" | wc -l
find . -maxdepth 3 -type d
```
Every top-level subfolder (per project/client/brand) is an **independent zone** — a candidate for fan-out if the volume justifies it (see section 5).

### 2. Detect exclusion zones BEFORE proposing any rename

Look for signs of an active pipeline that renaming would break:
- Scripts that read fixed names: `build.py`, `Makefile`, `package.json` with hardcoded paths, HTML/CSS that references an asset by its exact name.
- `_src/`, `_build/`, `dist/`, `_backup/` folders next to a generator.
- If one exists → **mark the zone as untouched in the plan**, explain why (the exact name is read by X), and organize only around it. Do not ask for confirmation — it is an objective fact (grep finds the reference).

### 3. Open the real content — never rename from the name

Hard rule (soul.md): **design tokens count as facts** — the same holds here for filenames. A plausible name is not verification.
- Images/SVG/small PDFs → `Read()` them directly (the Read tool renders images/PDFs).
- Large `.ai`/PSD files (>15MB) and non-renderable binaries → they do not open; infer from metadata (size, date, an already-verified sibling name) and mark them explicitly as **"not visually verified"** in the plan. Never pretend they were opened.
- `.md`/`.txt`/`.rtf` files → read the real content, not just the name.
- Names like `v1/v2/v3`, `op1-op4`, `(1)/(2)` **almost always hide a real difference** (color, background, variant, discarded vs chosen version) — open every candidate in the series and name them by the difference you find, do not keep the generic index.

### 4. Detect exact duplicates

`md5`/`md5sum` for pairs that look redundant (the same folder with different names, or sibling folders with the same content):
```bash
md5 "path/a" "path/b"
```
- **Never delete automatically.** List the pair, point out which one looks like the canonical copy (more complete/more recent/better named) and leave the removal pending the user's explicit approval — even if they approved "the plan" as a block. Deleting is irreversible; renaming/moving is not.
- Orphan macOS metadata files (`._*`, `.DS_Store`) → flag them, do not open them, do not rename them.

### 5. Fan out if the volume justifies it

The parallelism rule from `task-intake.md`: **≥2 independent zones → dispatch in parallel**, one `Agent()` per zone, in the same turn. Each agent:
- Receives the zone (path) + the naming convention to apply + the list of what NOT to touch (pipelines already identified in step 2).
- Opens the real content of every file in its zone (step 3).
- Returns Markdown: `current path → proposed path/name` + reason, grouped, plus a section of the duplicates found.
- **Moves nothing and deletes nothing** — it only inventories. Execution happens afterwards, centrally, once the plan is approved.

Small zones (a few obvious files) are done inline, without an agent — the ~15x token cost is not worth it for 3 files.

### 6. Naming convention (default, adjust to the project)

- lowercase, hyphens, no spaces/accents **in the filename** (the content may have accents);
- the language follows the rest of the project (do not translate brand/product names);
- preserve the existing extension and semantics if it is already a coherent convention — only fix what is genuinely wrong (a typo, an ambiguity, or a name that does not match the content);
- if a folder/project already has its own consistent convention (confirmed by sampling, not by assumption), **do not rewrite it out of personal preference** — only flag what breaks the pattern.

### 7. Present the plan

By default: **text/tables directly in the chat**, grouped by zone, with the duplicates section highlighted at the end. Do not publish it as an Artifact unless the user explicitly asks — a plan is for quick reading and approval, it is not a visual deliverable.

Always include: the total count reviewed, how many renames are proposed, how many duplicates, what was left untouched and why.

### 8. Execute (only after approval)

- Renaming/moving is reversible → execute without asking for extra confirmation per file, given that the plan itself was approved.
- Deleting duplicates → **1 explicit confirmation per group**, even if "apply the plan" was said as a block — approving the plan covers the reorganisation, not the removal, unless the user says so unambiguously.
- **Case-insensitive filesystem gotcha** (local macOS, and most Google Drive/iCloud mounts): `mv File.md file.md` (a rename that only changes case) is treated as the same file and `mv` either fails or does nothing — silently, with no visible error. Always go through a temporary name:
  ```bash
  mv -n "ANALYSIS.md" "__tmp_analysis.md"
  mv -n "__tmp_analysis.md" "analysis.md"
  ```
- Always use `mv -n` (no-clobber) — never overwrite an existing file without explicit intent (hard rule: writing over an existing file is irreversible).
- Verify at the end: `find` the tree again and confirm that no old name is left outside the zones marked as untouched.

## Anti-patterns

| Wrong | Correct |
|---|---|
| Renaming from the filename without opening it | Open the real content (image/PDF/md) before proposing a name |
| Deleting duplicates because "the plan" was approved as a block | Explicit confirmation per group of duplicates, always |
| Renaming files inside a `_src`/`_build` folder that has a generator | Detect the pipeline first (grep for fixed names in scripts), mark it as untouched |
| `mv Name.md name.md` in a Google Drive/macOS folder | Go through a temporary name — a case-insensitive filesystem treats it as the same file |
| Always publishing the plan as an Artifact | Chat by default; Artifact only on request |
| Keeping `v1/v2/v3` generic after already opening them and seeing the real difference | Name them by the difference (color/background/variant), not by the index |
