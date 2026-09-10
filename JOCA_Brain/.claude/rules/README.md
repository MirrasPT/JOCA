# .claude/rules/ — READ BEFORE ADDING

⚠ **Cost:** every `.md` in this folder is **auto-loaded in EVERY session** (they count as "memory files in `/context`). Every line here is re-sent in **every message** — it costs recurring tokens, not a one-off.

Rules:
- **Only global behavior directives** that always hold (task-intake, chaining, pipelines, orchestration, testing). Do not put niche reference/gotchas here.
- **Terse.** Tables > prose. No repeating what is already in `CLAUDE.md` or in another rule.
- **Extensive detail → `.claude/reference/`** (NOT auto-loaded; `Read()` on-demand) or `memory/projects/*.md`. `api-design.md` and `workflows-and-tooling.md` already live there — the 1-paragraph pointers stay here in `rules/`.
- Before adding a new rule, ask: "does this have to be in context ALWAYS?" If not → it is not a rule.
- **Intruder signal:** a `.md` here with skill frontmatter (`name:` + `description:` + `triggers:`) ended up there by mistake → move it to `.claude/skills/`. It happened with `testing.md` (it was the third-party `test-master` skill): 94 lines / ~1k tokens in **every message**, zero behavioral value, and the table of `references/*.md` it contained pointed to files that never existed in the repo. When adding/editing a rule, confirm that **every path cited resolves** (`ls`).
- This README is auto-loaded too → keep it short.
