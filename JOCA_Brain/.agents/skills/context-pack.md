---
name: context-pack
description: "Packs a code tree into a single AI-readable file (repomix-style) for sub-agent briefs or long-context models (gemini-brain 1M). Use when: preparing an agent brief about a large project, pack codebase, pack repo, context for gemini, repo in one file."
triggers: pack codebase, pack repo, pack context, context pack, repo in one file, pack the project, codebase in one file, prepare context for agent, repomix
chain: gemini-brain
---
# context-pack — repo → 1 context file

A sub-agent with a brief that says "read these 40 paths" spends 40 Reads and gets lost; with "read this single file" it spends 1. This skill packs the relevant tree into a single artifact via `pack-context.mjs`.

## Run
```bash
node "<JOCA_ROOT>/JOCA_Brain/.claude/scripts/pack-context.mjs" <target-dir> [--out <file>] [--max-kb 512] [--ext php,ts,tsx] [--exclude tests,fixtures]
```
- Respects `.gitignore` (via `git ls-files`; fallback walk with standard exclusions: node_modules, vendor, dist, storage…).
- Binaries/locks/minified are always left out.
- Budget: small ones first; whatever did not fit is **listed in the header** (no silent truncation).

## Rules
1. **Output ALWAYS outside the target project's tree** (default: %TEMP%). A pack inside the project gets picked up by content-scanners (Tailwind v4 gotcha — `rules/orchestration-patterns.md` #4).
2. Size it to the consumer: sub-agent brief → `--max-kb 256-512`; gemini-brain (1M tokens) → up to `--max-kb 2048`.
3. Filter before raising the budget: `--ext`/`--exclude` first, `--max-kb` after. A focused pack > a fat pack.
4. In the agent brief, reference the pack path + the instruction "read the pack first; do NOT re-Read the original files except to edit".

## When NOT to use
- Small project (≤5 files) → direct paths in the brief.
- You need structure/dependencies, not content → `/map-joca` (graphify).

## Next step (chain)
- Pack for second-model analysis → `gemini-brain` (1M context).
- Pack for a worker brief → dispatch the agent with the path.
