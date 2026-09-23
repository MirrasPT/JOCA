# Orchestration — anti-patterns

Moved from `.claude/rules/orchestration-patterns.md` (auto-loaded) to cut per-message tokens. `Read()` before a fan-out, before writing a sub-agent brief, or before auditing the junction.

## Anti-patterns

| Wrong | Right |
|---|---|
| An agent that spawns agents | Coordination in the main loop / command |
| Accepting an agent's **diagnosis** without reproducing the failure | The report locates the **symptom**; the cause is confirmed in the artifact (buffer, log, real state). Fixing the symptom and testing again comes cheaper than assuming the cause was right |
| A brief that presents a triage decision as fact ("the AgentsView was discarded and is not coming back") | Separate verifiable **FACTS** (paths, contracts, what is on disk) from the **DECISIONS** of whoever dispatches, and mark the latter as revocable: *"if this contradicts what you find, stop and report"*. An agent obeys a wrong decision and propagates it with nobody questioning it |
| Sending new scope by `SendMessage` to an agent already running | New scope **invalidates work in progress**: 4 points sent mid-flight expired contrast measurements and cancelled the strategy given in the previous point (~40 min lost). Either you wait for the report and dispatch a second round, or you cancel and re-dispatch with the complete brief. `SendMessage` is for **unblocking** (supplying a missing datum), not for adding objectives |
| An agent with a tool whitelist that answers "I don't have that tool" and stops | The absence of a tool is a **signal to delegate**, not an impossibility — it has to be written in the prompt as such (dispatch → verify → try to fix → only then report), otherwise the model reads "it is not on my list" as "the system cannot do it" |
| Capability lists written by hand in the prompts | They go stale silently and the model believes them — a wrong list is worse than none. Point to the generated index (`memory/SKILL_INDEX.json`), do not transcribe |
| Reading a command's output from the start (`\| head`) | `git apply` is **atomic** but prints `Applied patch to X` for the files that passed **before** aborting — a `\| head -40` shows successes and hides the fatal error in the tail. Always verify by the **effect** (`git status`: 1 file changed instead of 214), never by the report |
| Loop with no brake (infinite iterations) | max iterations + 3x-nothing-stop |
| Workers dispatched in separate messages (serial) | All the `Agent()` calls in a single turn |
| Worker returns a full dump to the supervisor | It writes `.joca/intermediate/` + summary + path |
| Acting on an agent's report without verifying | Report = **lead**, not conclusion. Confirm the finding before fixing (`grep`/`ls`/test). A wrong diagnosis costs more than the command that confirmed it |
| >5 concurrent workers | Cap 3-5; merge thin streams |
| Fan-out with no foundation phase | Shared components first; workers import |
| Router that also executes | The router returns JSON and stops; the caller executes |
| Inventing thresholds when `task-intake.md` is missing | Heuristic fallback + saying so in `justificacao` |
| Workflow for a destructive git sequence | Versioned script |
| Fan-out closes when the last worker returns | Cross-cutting sweep at the end: 1 agent (non-producer) audits the junction |
