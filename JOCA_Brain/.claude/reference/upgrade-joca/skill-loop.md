# /upgrade-joca — loop skill-improver + skill-evaluator (Phase 4.3)

Lido a partir de `.claude/commands/upgrade-joca.md` §4.3, para cada `IMPROVE_SKILL` ou `NEW_SKILL`.

**Step A -- Draft/Revise (skill-improver agent)**

```
Agent(subagent_type="skill-improver")
```

Brief:
```
ORIGINAL REQUEST: [description of what the skill should do, from the feedback issue]
ITERATION: 1 of 3
PREVIOUS EVALUATOR FEEDBACK: [none for iteration 1, or evaluator's feedback array for iterations 2-3]
CURRENT SKILL CONTENT: [full content of existing skill, or "NEW -- create from scratch"]
RESEARCH CONTEXT: [actionable findings from Phase 2, if available]
```

**Step B -- Evaluate (skill-evaluator agent)**

```
Agent(subagent_type="skill-evaluator")
```

Brief:
```
ORIGINAL REQUEST: [same as above]
ITERATION: [N] of 3
SKILL TO EVALUATE:
[the full skill content returned by skill-improver]
```

**Step C -- Decision**

Parse the evaluator's JSON response:
- If `verdict` is `"PASS"` (score >= 8.0): accept the skill, proceed to write
- If `verdict` is `"FAIL"` and iteration < 3: go back to Step A with `feedback` array as `PREVIOUS EVALUATOR FEEDBACK`
- If `verdict` is `"FAIL"` and iteration == 3: report the skill as failed, include the best-scoring version in the report, suggest manual review

**Step D -- Write**

For accepted skills:
1. Write/overwrite the skill file at `.claude/skills/<name>.md`
2. **Origin marking depends on whether the file was CREATED or merely IMPROVED:**
   - `NEW_SKILL` (the file did not exist before this run) → add `origin: local` to the frontmatter.
   - `IMPROVE_SKILL` (the file already existed) → **add no origin marker, and remove none.** Leave the
     frontmatter's origin field exactly as it was.
   Rationale: `origin: local` is what `/update-joca` treats as "never touch". Stamping it on a skill
   that came from upstream freezes that skill against every future upstream fix, silently. An earlier
   version of this command did exactly that and froze 20 published skills/commands.
3. **Prove the file is on disk before calling it applied:** `ls -l .claude/skills/<name>.md` (and, for
   an improvement, `git diff --stat -- .claude/skills/<name>.md` non-empty). The `skill-improver` can
   return the full content **without writing anything** — it happened with `mutation-testing`, and
   Phase 4b only checks files that are already on its list. No hit → the item is `failed`, not `applied`.
4. Confirm: `[skill: <name>] score <X>/10 -- applied (iteration N)`

For failed skills (3 iterations, never passed):
1. Do NOT write the file
2. Report: `[skill: <name>] best score <X>/10 -- FAILED after 3 iterations. Manual review needed.`
