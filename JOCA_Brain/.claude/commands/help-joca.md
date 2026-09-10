# /help-joca — JOCA quick reference

Presents every JOCA command, agent and skill with a short description.

## Steps

1. Read `memory/INDEX.md` to get the up-to-date list of commands and agents.
2. Read `memory/SKILL_INDEX.json` to get the up-to-date list of skills (name + description).
3. Present the output below — replacing the Agents and Skills sections with the real content (INDEX.md for agents, SKILL_INDEX.json for skills), summarized to ~10 words per item.

---

## Output to present

```
JOCA — Quick reference
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SESSION
/resume              Loads project context and knowledge graph
/save                Saves session state and updates memory
/start               Starts a new project or connects an existing one to JOCA
/install             JOCA setup or reconfiguration
/migrate             v1-legacy → v2.0 migration

WORKFLOW
/plan                Activates Plan Mode for architecture and decisions
/autoplan            Full self-reviewed plan (product → design → eng)
/goal                Auto-orchestration from an NL task → master-orchestrator loop
/one-shot            Autonomous end-to-end development from a PRD
/build-plan          Supervised phased build with a test gate
/debug               Error triage with the detected stack's skill
/review-code         Code review via tester-code + optional adversarial Codex
/review-design       UI/UX and accessibility review in parallel
/ship                Take code to PR: sync → tests → gate → push → PR
/create-skill [desc] Creates a new skill via a self-improving pipeline
/create-skill --upgrade [name]  Improves an existing skill

KNOWLEDGE
/know                Ingests content into the Knowledge Base (markitdown → wiki note)
/learn               The Brain's institutional memory (decisions + learnings)
/retro               Retrospective: learnings from the window → actions
/map-joca            Interactive knowledge map (graph.html via graphify)

FEEDBACK & MAINTENANCE
(project + JOCA feedback is auto-captured by /save)
/upgrade-joca        Reads accumulated feedback → implements improvements to JOCA
/update-joca         Checks and applies updates from the official GitHub repository
/status              Shows rate limits, model and current context

WORDPRESS
/wp-perf             Quick WordPress triage — critical issues (fast)
/wp-perf-review      Full WP code review: Critical / Warning / Info

/help-joca           This page

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AGENTS
[read from memory/INDEX.md — the ## Agents section — and present grouped by category]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SKILLS
[read from memory/SKILL_INDEX.json — present grouped by domain]
Note: Shopify and WordPress skills are only active in their respective projects.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Formatting rules

- Descriptions: maximum ~10 words, no articles where possible
- Agents grouped by category just as in INDEX.md; skills grouped by domain
- No heavy markdown — plain text with `━` as the separator
- Large skill families (GSAP, ComfyUI, WordPress, hyperframes): group as a block "GSAP (8)" etc. with the note "(see SKILL_INDEX.json for the full list)"
- If the user passes an argument (e.g.: `/help-joca design`): filter and show only that category
