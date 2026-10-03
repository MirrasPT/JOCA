# /update-joca — formatos dos resumos

## Phase 3 -- Present summary

```
UPDATE AVAILABLE -- JOCA
------------------------

N new commits:
  abc1234 <message>
  def5678 <message>

Core files to update (safe):
  M  .claude/skills/create-skill.md
  A  .claude/commands/novo-comando.md
  M  CLAUDE.md

UI files to update (will trigger rebuild):
  M  JOCA_OS/backend/src/server.ts

Protected files (will NOT be touched):
  memory/projects/ (pastas <slug>/ e fichas *.md)
  memory/feedback/*.md
  memory/soul.md
  JOCA_OS/data/projects.json
  JOCA_OS/data/project-memory.json
  JOCA_OS/data/session-snapshots.json
  JOCA_OS/data/ui-settings.json

Local-origin files protected:
  .claude/skills/created-skills/minha-skill/SKILL.md
  .claude/agents/meu-agente.md

Merge-only (new keys added, your config preserved):
  .claude/settings.json

Potential conflicts (modified locally + changed upstream):
  ! .claude/commands/resume.md  -- you have local changes

------------------------
Apply update? [Y/n]
```

## Phase 6 -- Final summary

```
JOCA UPDATED
------------------------

Commits applied: N
  abc1234 <message>
  def5678 <message>

Files updated: X
  M  .claude/skills/...
  A  .claude/commands/...

Files protected (not touched): Y
  memory/projects/ (user data)
  memory/soul.md (calibration)
  JOCA_OS/data/ (all user data files)
  origin:local files (Z files)

Post-update actions:
  [done] Backend rebuilt (npm install + npm run build)
  [done] Frontend deps installed
  [done] statusline-command.js copied to ~/.claude/
  [done] Hooks verified (.js paths confirmed)
  [done] SKILL_INDEX.json regenerated
  [done] Modelos dos agentes: N escolhas reaplicadas · M novas (aplicadas | mantidas | saltadas)
  [info] 2 new skills, 1 updated skill

Local version: <hash> -- <latest commit message>

Next:
  Review changes: git diff HEAD~N HEAD
  If JOCA_OS was rebuilt: restart the UI (start.bat / start.sh)
```
