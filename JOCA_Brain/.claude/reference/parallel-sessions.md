# Parallel sessions — full protocol (on-demand)

Summary auto-loaded in `.claude/rules/orchestration-patterns.md` §5b. `Read()` when you discover another Claude session in the same repo/project.

### 5b. Parallel sessions (two Claudes in the same repo)

They are not sub-agents — they are **peers**, each with its own main loop. It has happened several
times (JOCA_OS multi-worker, two sessions on the same site, two on the same installation) and it went
well only because the sessions invented, on their own and by chance, the same protocol. Codified:

- **Handshake on discovering a peer:** the path I am in · what I am going to do · which files I have
  dirty.
- **Boundary by directory.** Reading is free; writing only in my own territory. Touching someone
  else's file requires a warning first. Two workers in the same tree have already reverted each
  other's intentional work (`AppShell.jsx` ended up with edits from both mixed in — and the build
  compiled all the same).
- **Shared state is always announced:** DB, ports, configuration files, `~/CLAUDE.md`.
- **A shared file is edited with a surgical `Edit`, never `Write`.** Re-read before writing. A
  `Write` on `memory/projects/<x>.md` would have deleted the other session's work — it was only
  found out because `Edit` warned "the file had been modified on disk".
- **Addressing: the `ListAgents` names are opaque** (`joca-brain-be`, `joca-brain-dc`) and do **not**
  identify project or session — a message addressed by name ended up in the wrong session. The
  reliable address is the `from=` socket of whoever wrote (`uds:/tmp/cc-socks/NNNNN.sock`). Always
  reply through that; use the name only to start contact, and confirm who it is before assuming context.
- **Artifacts per session, not per repo.** Checkpoints, queues and `.joca/intermediate/` derived from
  the cwd's repo collide between sessions — `latest` starts returning the other one's. Derive from
  the **project**.

