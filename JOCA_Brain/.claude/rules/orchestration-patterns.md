# Orchestration Patterns

Catalog of endorsed orchestration patterns for JOCA. Loaded in every session. Terse by design.

Re-encoded from public references (addyosmani/agent-skills, system_prompts_leaks) — **concepts**, not proprietary prompts. Nothing copied verbatim.

---

## CRITICAL RULE — sub-agents do not spawn sub-agents

An agent dispatched via `Agent()` **cannot** dispatch another agent. The tree has 1 level: main loop → workers. There are no grandchildren.

Direct consequences:
- **Auto-orchestration lives in the main loop or in a command** (e.g. `/one-shot`, `/goal`) — **never** in an agent-that-calls-agents. `master-orchestrator.md` is a **PLAYBOOK that the main loop/command ADOPTS** — it is the **main loop** that reads the index, decomposes and **dispatches the workers itself** (via `Agent()`). You do **NOT** do `Agent(subagent_type="master-orchestrator")`: a subagent could not dispatch workers (they would be grandchildren, forbidden). The file lives in `.claude/agents/` as canonical doctrine, but it is **executed by the main loop**, not spawned.
- A classifier (`task-router`) **returns a decision**; the one who executes it is the **caller** (main loop / command). See `.claude/agents/task-router.md`.
- An N-phase pipeline that needs fan-out in each phase → orchestrate from the main loop / command, do not cram everything into a single agent.

If a design requires an "agent that coordinates agents", the coordinator has to be the main loop or a command — not a `subagent_type`.

---

## Endorsed patterns

### 1. Router-that-classifies-does-not-execute
Separate **classification** from **execution**. A lightweight agent receives the NL task, decides the route, returns JSON, **stops**. The caller fires.
- JOCA implementation: `.claude/agents/task-router.md` (4 routes A/B/C/D).
- Canonical thresholds in `rules/task-intake.md` (it exists; it is the source of truth of the decision). If for some reason it is missing, the router uses a heuristic fallback and says so in `justificacao`. Do not invent thresholds.
- Advantage: cheap classification (`inherit`/lightweight model) decides before spending tokens on a heavy orchestrator.

### 2. Steward-not-initiator loop (with a brake)
An autonomous loop is a **steward** (it maintains/advances existing work), not an **initiator** (it does not invent new work). Mandatory brake:
- **max iterations** — hard limit of cycles.
- **3x-nothing → stop** — 3 consecutive iterations without measurable progress → finish and report.
- Without a brake, a loop "helps" indefinitely and burns rate limit. See also `loop`/`schedule` (harness).

### 3. Parallel fan-out in a single message
Independent workers → emit **all** the `Agent()` calls in the **same turn** (one message, multiple tool calls). Parallel in fact, not sequential in disguise.
- Only for **independent** streams. Dependent streams (DB → API → frontend) = sequential.
- Cap: 3-5 concurrent workers (context cost ~15x/agent — see `CLAUDE.md` Context & Agents).
- Before the fan-out: define shared components in a **sequential foundation phase**; workers IMPORT, they do not recreate (see `workflows-and-tooling.md`).

### 4. Agents write to disk, not to the supervisor's context
Each worker writes the output to a file (e.g. `.joca/intermediate/<stream>.md`) and returns to the supervisor only a **short summary + path**.
- Why: the cap of 3-5 workers exists because each full result floods the supervisor's context. Results on disk **escape** the cap — the supervisor reads only what it needs, when it needs it.
- The supervisor aggregates by reading the files (`Read`), not by accumulating inline dumps.
- A pattern complementary to the test queue that already exists (`.joca/test-queue.jsonl`).
- **⚠ `.joca/intermediate/` is picked up by the target project's content-scanners.** When the summaries sit INSIDE the project tree, the Tailwind v4 (and similar) content-scan treats them as code and regenerates classes cited in them — a broken class in a `.md` summary breaks the target project's build (and the `tsc`/`build` gate does NOT catch it; only the dev runtime does). Mitigate: `.joca/` in `.gitignore` AND excluded from the content-scan (`@source not`), OR write the summaries to the session scratchpad (outside the project tree). See `tailwind.md` + `workflows-and-tooling.md`. (Source: React + Tailwind v4 project, 2026-06-23.)

### 5b. Parallel sessions (two Claudes in the same repo)

Peers, not subagents — each with its own main loop. Minimum protocol: **handshake** on discovering a
peer (path · what I am going to do · dirty files) · **boundary per directory** (free reading, writing
only in my territory) · shared state (DB, ports, config, `~/CLAUDE.md`) is always announced ·
a shared file is edited with surgical `Edit`, **never** `Write` · address by the socket in
`from=`, not by the opaque names from `ListAgents` · artifacts derived from the **project**, not from the cwd.
Cases and detail: `.claude/reference/parallel-sessions.md`.
### 5. Agent / Skill / Workflow doctrine
When to use each:

| Route | When | Not for |
|---|---|---|
| **Skill** | Domain with ≥60% match, fits in one context, no isolation needed. `Read(skill)` in the main loop. | Work that needs isolated context or fan-out. |
| **Agent** | Isolated context (adversarial review, refactor, deep debug, scaffold), or a task that would dirty the main loop. Cost ~15x. | Trivial classification (use the router); orchestrating other agents (it cannot — critical rule). |
| **Workflow / command** | Cross-stack (≥2 dependent domains), parallel fan-out, multi-phase with gates, or a deterministic destructive sequence. | A 1-file/1-domain task (overkill). |

Selection hierarchy: specialized skill > agent > generic response (see `CLAUDE.md`).
Deterministic non-parallelisable sequence + destructive git → **versioned script**, not a workflow (see `workflows-and-tooling.md`).

### 6. Post-fan-out cross-cutting sweep
After N agents write in parallel, run **one** agent that audits the **whole system** — not
the individual scopes. Every piece correct, the junction broken, is the typical hole of parallel work.
That agent **cannot be any of the producers**. It covers content contradictions (interface vs
document, copy vs implemented rule), not only code ones.

---

## Links

- `.claude/agents/master-orchestrator.md` — fan-out **playbook** for `/one-shot`/`/goal`, **executed BY the main loop/command** (not spawned via `Agent()` — see Critical Rule).
- `.claude/agents/task-router.md` — pure classifier (pattern 1).
- `.claude/commands/one-shot.md` — autonomous PRD entry point → the main loop adopts the playbook → workers → testers.
- `.claude/commands/goal.md` — NL entry point with no PRD: the main loop synthesises GOAL+criteria and adopts the orchestrator's playbook (loop until done).
- `rules/task-intake.md` — thresholds of the 4 routes (source of truth of the classification).
- `rules/workflows-and-tooling.md` — sub-agent briefs, shared components, workflow gotchas.

---

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
