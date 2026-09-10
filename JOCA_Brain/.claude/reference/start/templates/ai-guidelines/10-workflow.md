# Workflow

## Before writing code

All work starts in a GitHub issue with verifiable acceptance
criteria. If there is none, create it with `/new-issue`.

If the work involves interface that does not exist yet, the mockup comes first:
`/prepare-design`, and the mockup goes through `/validate-design` before
implementing.

## Branch

One branch per issue, created from an up-to-date `main`:

```bash
git status                              # must be clean
git checkout main && git pull
git checkout -b <type>/<n>-<description>
```

Types: `feat`, `fix`, `chore`.

## During

- One issue at a time. At most two branches in flight.
- Issues that touch the same files are sequenced, never parallel.
- Structural decision taken → an entry in `docs/DECISIONS.md`, in the same PR.

## Tests

Written in a **separate session** from the implementation, with `/write-tests <n>`,
from the issue's acceptance criteria — never from the code.

Tests written right after the code check the code, not the requirement:
they always pass and prove nothing.

## Closing

```bash
git push -u origin <branch>
```

PR with `Closes #<n>` in the description. Merging requires green CI and one approval.

After the merge:

```bash
git checkout main && git pull && git branch -d <branch>
```
