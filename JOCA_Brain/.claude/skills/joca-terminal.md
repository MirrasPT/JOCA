---
name: joca-terminal
description: "Use JOCA from inside a terminal opened by JOCA_OS — query/comment/move board tasks, open new terminals, talk to other terminals and send notifications, all against the running JOCA_OS and without restarting it. MUST be invoked when the user says: comment on the task, close the task, mark as done, create a task, move the task, open a terminal, talk to the other terminal, tell me when you finish. SHOULD also invoke when: the agent finishes work that came from a board task, needs to delegate to another terminal, or wants to record progress for the user to see."
origin: local
chain: task-router
---

# JOCA from the terminal (agent bridge)

Every terminal opened by JOCA_OS is born with the bridge in its environment. Check with `echo $JOCA_CLI`.
If the variable is empty, this terminal was **not** opened by JOCA — do not use this skill.

**JOCA_OS is running while you use this.** Nothing you do here restarts it or touches its
code: these are the operations the interface already exposes, called over HTTP. What you change shows up on the
user's screen right away.

```bash
node "$JOCA_CLI" help        # lists everything you can do
```

Available variables: `JOCA_CLI` (CLI path), `JOCA_API_URL`, `JOCA_SESSION_ID` (this terminal),
`JOCA_API_TOKEN` (only when auth is on). Everything talks to the **running** JOCA_OS — nothing needs
a restart, and what you do shows up in the interface immediately.

## Main rule: close the loop on your task

When you carry out a board task, the brief carries its id. **When you finish, leave a note on what
you did** — that is how the user grasps what happened without reading the whole terminal:

```bash
node "$JOCA_CLI" comment <task-id> "Implemented X in src/y.ts. Tests passing. Z left undone."
node "$JOCA_CLI" done <task-id> --note "Summary of what I did"   # comments + moves to 'concluida'
```

Use `done` only when the task really is finished. If it stopped halfway, comment explaining the state and
leave it where it is — JOCA's judge also writes its verdict in the same thread.

## Tasks

```bash
node "$JOCA_CLI" tasks                          # the whole board, by column
node "$JOCA_CLI" tasks --status a-executar      # filter
node "$JOCA_CLI" task <id>                      # detail + note thread (read BEFORE acting)
node "$JOCA_CLI" new-task "Fix the parser" --desc "..." --status a-definir
node "$JOCA_CLI" move <id> concluida            # a-definir|a-executar|em-execucao|concluida|arquivada
node "$JOCA_CLI" advance <id>                   # pushes one column to the right
node "$JOCA_CLI" merge <id1> <id2> --title "Single task"
```

Ids can be short prefixes (the 8 characters the listings show).

**Found new work mid-flight?** Do not do it silently and do not widen the current task: create a
task (`new-task`) and mention it in your note. Keep the board the truth of what is left to do.

## Other terminals (working together)

```bash
node "$JOCA_CLI" sessions                                    # who is open (yours has ← )
node "$JOCA_CLI" new-session "Tests" --cli codex --project <id> --prompt "run the suite and report"
node "$JOCA_CLI" send <session-id> "can you validate the build while I write the tests?"
node "$JOCA_CLI" read <session-id> --tail 3000               # read what the other terminal produced
```

`--cli` accepts `claude` (default), `codex`, `agy`, `opencode` — open the terminal in whichever CLI makes
sense for the work (e.g. a second opinion on another model).

**Careful with loops:** do not sit doing `send`/`read` in a cycle waiting for an answer. Send,
carry on with your work, and read later. Never send messages to yourself.

## Warning the user

```bash
node "$JOCA_CLI" notify "Deploy finished — 3 tests failed, check the Tests terminal"
```

It goes to JOCA's persistent inbox (survives closing the browser). Use it for long work that
finishes when the user is not looking. Do not use it for trivial progress.

## Querying

```bash
node "$JOCA_CLI" projects        # projects connected to JOCA
node "$JOCA_CLI" runs --limit 20 # run history (state, duration, cost)
```

## Limits (do not work around)

- **Do not edit JOCA_OS or JOCA_Brain** from a task worker unless the task explicitly asks for
  it — touching the engine while it is running you breaks your own worker.
- **Do not delete tasks** you did not create; move them to `arquivada` instead.
- **Do not open terminals in a flood** — each one is a real process and the cap is 30 in total.
- The CLI talks to `127.0.0.1`; if you get a connection error, JOCA_OS is not running — report and stop,
  do not try to start it yourself.

## Next step (chain)

- Work that requires route classification (skill/agent/workflow) → `task-router` (reversible, fires without asking).
- Task finished with changed code → leave the note and follow JOCA's normal `auto-test-dispatch`.
