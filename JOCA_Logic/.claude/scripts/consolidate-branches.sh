#!/usr/bin/env bash
# consolidate-branches.sh — JOCA branch consolidation workflow
#
# Goal: single `master`, everything else merged or archived, then removed.
# Strategy (decided 2026-05-31):
#   - feat/frontend-design-skills, joca_ui_windows  -> already in master, delete
#   - claude/ana-lisa-project-14qz0                  -> merge FUTUROS.md, delete
#   - v1-legacy, claude/analyze-project-BBnm8        -> divergent old structures,
#                                                       ARCHIVE as tags, then delete
#
# SAFETY: dry-run by default. Nothing destructive runs unless RUN=1.
#   Preview:  bash .claude/scripts/consolidate-branches.sh
#   Execute:  RUN=1 bash .claude/scripts/consolidate-branches.sh
#
# Idempotent: re-running after partial completion skips done steps.
set -euo pipefail

RUN="${RUN:-0}"
REMOTE="origin"
run() {
  echo "  \$ $*"
  if [ "$RUN" = "1" ]; then "$@"; fi
}
say() { echo ""; echo "== $* =="; }

# Must run from repo root (where .git lives)
cd "$(git rev-parse --show-toplevel)"

if [ "$RUN" != "1" ]; then
  echo "########## DRY RUN — set RUN=1 to execute ##########"
fi

# ---------------------------------------------------------------------------
say "Phase 0 — preconditions"
git fetch "$REMOTE" --prune --tags
cur="$(git rev-parse --abbrev-ref HEAD)"
echo "current branch: $cur"
if [ "$cur" != "master" ]; then
  echo "!! not on master — checkout master first"; run git checkout master
fi
echo "snapshot of branches BEFORE:"
git for-each-ref --format='  %(refname:short) %(objectname:short)' refs/heads refs/remotes/$REMOTE

# ---------------------------------------------------------------------------
say "Phase 1 — archive divergent branches as tags (recoverable)"
archive_tag() { # <tag> <ref>
  local tag="$1" ref="$2"
  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    echo "  tag $tag already exists — skip"
  else
    run git tag "$tag" "$ref"
  fi
}
archive_tag "archive/v1-legacy"        "$REMOTE/v1-legacy"
archive_tag "archive/analyze-project"  "$REMOTE/claude/analyze-project-BBnm8"
run git push "$REMOTE" "archive/v1-legacy" "archive/analyze-project"

# ---------------------------------------------------------------------------
say "Phase 2 — merge FUTUROS.md from ana-lisa into master"
if git cat-file -e "$REMOTE/claude/ana-lisa-project-14qz0:FUTUROS.md" 2>/dev/null; then
  if [ -f FUTUROS.md ] && git diff --quiet "$REMOTE/claude/ana-lisa-project-14qz0" -- FUTUROS.md; then
    echo "  FUTUROS.md already present and identical — skip"
  else
    run git checkout "$REMOTE/claude/ana-lisa-project-14qz0" -- FUTUROS.md
    run git add FUTUROS.md
    run git commit -m "docs: add FUTUROS.md strategic roadmap (from ana-lisa branch)"
  fi
else
  echo "  ana-lisa branch/file not found — skip"
fi

# ---------------------------------------------------------------------------
say "Phase 3 — push master"
run git push "$REMOTE" master

# ---------------------------------------------------------------------------
say "Phase 4 — delete branches"
# local (-d = safe; refuses if not merged)
for b in feat/frontend-design-skills joca_ui_windows; do
  if git show-ref -q --verify "refs/heads/$b"; then run git branch -d "$b"; fi
done
# remote
for b in feat/frontend-design-skills joca_ui_windows \
         claude/ana-lisa-project-14qz0 claude/analyze-project-BBnm8 v1-legacy; do
  if git show-ref -q --verify "refs/remotes/$REMOTE/$b"; then
    run git push "$REMOTE" --delete "$b"
  fi
done

# ---------------------------------------------------------------------------
say "Phase 5 — verify end state"
git fetch "$REMOTE" --prune --tags
echo "branches (expect only master):"
git for-each-ref --format='  %(refname:short)' refs/heads refs/remotes/$REMOTE
echo "archive tags:"
git tag -l 'archive/*'
echo ""
echo "Done. End state: single master + archive/* tags."
