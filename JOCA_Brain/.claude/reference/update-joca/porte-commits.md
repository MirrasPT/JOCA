# /update-joca — portar um intervalo de commits (forma B)

### Shape B, variant: porting a *range of commits* between the two repos

Selective checkout brings a snapshot. When what you want is a specific range of work that landed in
the other repo (this has been done twice), the path is a patch, not a merge:

```
git -C <other-repo> format-patch <from>..<to> --stdout > /tmp/port.patch
git apply --3way --stat /tmp/port.patch     # dry look first
git apply --3way /tmp/port.patch
```

⚠ **`git apply` is atomic, but its output lies.** It prints `Applied patch to X` for every file that
landed *before* it aborts — so `git apply ... | head -40` shows a wall of successes and hides the
fatal error in the tail. **Verify by effect, never by report:** `git status` must show the expected
number of modified files (214, not 1). One port looked like it had landed and had reverted everything.

⚠ **A resolved conflict in code is not a resolved conflict until the artifact runs.** A
`build-skill-index.py` came out of a 3-way with no markers, syntactically plausible, and blew up on
first execution — `match` out of scope, two constants lost because neighbouring hunks were resolved to
opposite sides and the halves never met. Run every script/build you touched.
