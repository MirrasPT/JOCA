---
name: public-release-audit
description: "Prepare and audit a repo before pushing it to a remote that is NOT the work one — public, a client's, or another organization's (even private/internal). Sweeps by git and not by disk, catches compiled mirrors, symlinks, author metadata and dependencies on the owner's personal setup. MUST be invoked when the user says: publish to the public repo, open source release, prepare public release, scrub before publishing, audit what is going out, sanitize repo, push to a client repo, hand code to third parties, the client's org repo. SHOULD also invoke when: a push is going to a remote that is not the work repo (public, a client's, another organization's), or when a `git remote add` is followed by a push to that new remote."
triggers: publish public repo, open source release, public release, scrub PII, sanitize repo, prepare publication, what goes out in the push, audit release, public vs private, PII scan, push to a client repo, hand code to third parties, the client's org repo, first push to a new remote, add a second remote, internal repo, delivery to the client
chain: ship
metadata:
  origin: user
---
# public-release-audit — does what goes out of here serve whoever clones it?

Audit a repo before pushing it to a remote that is not the work one. Improvising this has already
cost dearly three times: 44 of the 52 findings of one audit were the same data surviving in a
compiled mirror, including **real host, user and SSH key name**; `/sync-brain` was published
sanitized of PII and useless all the same, because it depended on the owner's personal setup; and an
internal `CLAUDE.md` ended up in a client's **internal** repo, with infra, a pointer to the private
repo and the description of a token pending rotation.

> **The scrub happens before the FIRST push. After that there is no clean undo** — force-push
> removes the reference, not the object (see "You already published" at the end).

## Step 0 — where is this going?

Before anything else, know the destination. "Public" is not the criterion: the criterion is **it is
not my work repo**. A client's `internal` repo is the same class of risk.

```bash
git remote -v                      # which remotes exist, and which is the push target
git rev-parse --abbrev-ref @{u}    # where the current branch pushes today
```

New remote, second remote, third-party org, or any target different from the work one → run the
whole checklist. **Publishing by warning ≠ publishing by sweep:** a warning in memory about one
specific file does not delimit the scope — the flagged item was handled rigorously and everything
else went through intact.

## The two criteria (the second one is the one that escapes)

1. **Does it have PII/secrets?** — names, emails, hosts, IPs, keys, `/Users/<user>` paths,
   `C:\Users\<user>`.
2. **Does it depend on the owner's personal setup?** — two named machines, one specific private
   repo, a cloud folder of their own, a real client. It passes any PII sweep **and still does not
   serve whoever clones it**. This is the one that fails silently.

## Hard checklist

**1. Ship-list against the previous release.** Diff what is going out vs what already went out —
decide file by file, not by folder.

**2. Sweep by `git`, never by disk.** What publishes is what is in the index; `find`/`ls` show things
that are not going and hide things that are.
```bash
git ls-tree -r HEAD --name-only          # what really exists in the commit
git grep -n '<term>' -- $(git ls-files)  # grep the tracked files, not the working dir
git ls-files | grep -vFxf <(find . -type f | sed 's|^\./||')   # tracked that is not on disk
```

**3. Compiled mirrors.** `.claude/` is canonical; **`.agents/` and `.codex/` are generated mirrors**
and publish all the same. Editing skills/agents without running `compile-bridges.sh` makes the
mirrors diverge silently — and that is where host + user + SSH key from `cpanel.md` survived.
```bash
bash .claude/scripts/compile-bridges.sh   # recompile BEFORE auditing, otherwise you audit the old version
```

**4. Symlinks.** `git grep` does not follow them.
```bash
git ls-tree -r HEAD | awk '$1=="120000" {print $4}'
```

**5. Author metadata.** It travels with the commits.
```bash
git log --format='%an <%ae>' | sort -u     # expect only the GitHub noreply
```

**6. Absolute paths expanded at runtime.** Some files are rewritten by the app itself with the
machine's path. **Name `JOCA_Brain/.claude/settings.json` explicitly** — it expands `<JOCA_ROOT>` to
`/Users/<user>/...` when the app runs, and it has already been ready to be published with the owner's
name inside (caught by luck, and it was the second time). Better than sweeping: keep the expansion at
runtime and do not persist the expanded path in the versioned file.

**7. PII sweep of the staged diff** (not of the whole repo — what matters is what is going out).
**The sweep covers code and tests, not just documentation** — fixtures, seeders, snapshots and test
files carry personal paths and real client names, and nobody reads them before publishing:
```bash
git diff --cached | grep -nE '/Users/[a-z]|C:\\\\Users\\\\|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|sk-[A-Za-z0-9]|ghp_[A-Za-z0-9]|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY'
```

**8. New history, not `--orphan`.** `--orphan` **preserves the index** — what you thought had been
left behind goes in the first commit. Do `rm -rf .git && git init`.

**9. Verify with a fresh clone, never with the local one.** Clone the public repo into a temporary
folder and run steps 2, 4, 5 and 7 there. The local one has gitignored files that mask the result.

## You already published — what can still be done

Getting here is already the failure. What is left is containment, and the first thing is not to
report as resolved what is not.

1. **Force-push removes the reference, not the object.** The old commit stays dangling on GitHub and
   is served **by SHA** until there is a garbage-collect. The branch gives a 404 and looks resolved —
   it is not.
2. **Verify by the old SHA, never by the branch:**
   ```bash
   gh api "repos/<org>/<repo>/contents/<file>?ref=<old-sha>"   # 200 = still served
   ```
3. **The only two real ways out:** delete and recreate the repo (requires the `delete_repo` scope,
   which the normal `gh` token does **not** have — confirm before promising: `gh auth status`), or
   ask GitHub Support for a garbage-collect.
4. **Clean the local one too:** `filter-branch` leaves `refs/original/` holding the old history.

A recipe that worked (⚠ `git filter-branch` **refuses to run with a dirty tree** — `Cannot rewrite
branches: You have unstaged changes` — even if the changes have nothing to do with the target):
```bash
git stash            # or commit — the tree MUST be clean
git filter-branch --index-filter 'git rm -r --cached --ignore-unmatch <target>' <branch>
git rev-list <branch> | head          # confirm the history changed
git push --force-with-lease <remote> <branch>
# and only then: verify the old SHA via the API (point 2)
```

## Report

```
RELEASE AUDIT — <repo> → <target remote> (public | client | other org)
Ship-list: N files (+X new, −Y removed vs previous release)
PII: N findings  [file:line — type]
Dependencies on the personal setup: N  [file — what it assumes]
Mirrors: .agents/.codex recompiled ✓ | DIVERGENT ✗
Symlinks: N | Authors: <list>
Verified by fresh clone: ✓ | ✗
VERDICT: ready to publish | DO NOT publish — <reason>
```

## Next step (chain)
- Clean audit → `/ship` (push gate).
- Personal-dependency findings → fix the component to be generic, or take it out of the ship-list.
