# SKILL.md Template — Canonical Format

Reference this before drafting any skill. Every field is explained below.

---

## Minimal skill (reference/knowledge)

```yaml
---
name: skill-name
description: What this skill does and when Claude should use it. Front-load the primary use case. Include trigger phrases. Max 1,536 chars combined with when_to_use.
---

# Skill Title

Instructions Claude follows when this skill is active.

- Be specific and actionable
- Every sentence should change behaviour concretely
- No vague guidelines ("handle errors" → "if X fails, do Y")
```

---

## Full skill (all optional fields)

```yaml
---
name: skill-name
description: Primary use case. Trigger phrases. Front-loaded. [max ~800 chars here]
when_to_use: Additional trigger patterns, edge cases, related requests. [counts toward 1,536 cap]
argument-hint: "[arg1] [arg2]"
arguments: [arg1, arg2]
disable-model-invocation: true    # true = user-only, false = Claude can auto-invoke
user-invocable: true              # false = hide from / menu (Claude-only background knowledge)
allowed-tools: Read Write Edit Bash Glob Grep WebSearch
model: sonnet                     # or: opus, haiku, inherit
effort: high                      # low, medium, high, xhigh, max
context: fork                     # run in isolated subagent
agent: Explore                    # which subagent: Explore, Plan, general-purpose, or custom
paths: "src/**/*.ts,**/*.tsx"     # only activate for these file patterns
---
```

---

## Frontmatter rules

| Field | Rule |
|-------|------|
| `name` | Lowercase, hyphens only, max 64 chars. Becomes the `/slash-command`. |
| `description` | **Most important field.** Front-load the key use case. Include 3-5 natural trigger phrases. Combined with `when_to_use`, capped at 1,536 chars in skill listing. |
| `when_to_use` | Additional triggers. Appended to description in listing. |
| `disable-model-invocation` | `true` for side-effect skills (deploy, send, commit). `false` for knowledge/assistance skills. |
| `allowed-tools` | Only tools this skill needs. Do not list everything — be specific. |
| `context: fork` | For isolated research/analysis tasks. The skill content becomes the subagent's prompt. |

---

## Instruction quality rules

1. **Specific > Generic**: "If the API returns 429, wait 2s and retry once" > "handle rate limits"
2. **Imperative mood**: "Return only JSON" not "you should return JSON"
3. **Cover failure cases**: What to do when things go wrong
4. **One idea per line/section**: Don't bundle multiple instructions in one sentence
5. **Max 500 lines**: Move reference material to supporting files, link from SKILL.md
6. **No padding**: Every sentence changes behaviour. Remove anything that doesn't.

---

## Description optimization

The description is the **trigger mechanism**. Claude reads it to decide when to invoke the skill.

**Pattern:** `[Primary use case]. Use when [trigger phrases]. [What the output looks like].`

**Example (good):**
```
Generate Pest/PHPUnit tests for Laravel features. Use when writing unit tests, integration tests, or feature tests; adding test coverage to existing code; creating factories and mocks; or when asked to "test this", "write tests", "add coverage". Returns structured test files following Laravel testing conventions.
```

**Example (bad):**
```
A skill for testing PHP code in Laravel applications using the Pest testing framework and PHPUnit with various testing patterns and best practices.
```

The bad example has no trigger phrases, is verbose, and doesn't tell Claude when to use it.

---

## Supporting files pattern

```
my-skill/
├── SKILL.md           ← main instructions + references to other files
├── reference.md       ← detailed API docs, loaded when needed
├── examples/
│   └── output.md      ← example outputs
└── scripts/
    └── helper.py      ← executable scripts
```

Reference from SKILL.md:
```markdown
For complete API reference, see [reference.md](reference.md).
For example outputs, see [examples/output.md](examples/output.md).
```

---

## Shell injection (dynamic context)

Run commands before Claude sees the content:

```markdown
## Current state
!`git status --short`
!`cat package.json | grep '"version"'`
```

Use for: current branch, env info, file counts, recent changes.
