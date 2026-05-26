---
name: agent-context
description: Always-active base principles for agent orchestration and context management. Covers multi-agent coordination patterns, context compression strategies, and context degradation detection. Apply whenever orchestrating agents, running long sessions, or designing agent systems.
---

# Agent Context Engineering — Base Principles

Always-active. These rules govern how JOCA orchestrates agents and manages context.

---

## 1. Multi-Agent Coordination

**Sub-agents exist to isolate context, not to divide roles.** Use them when a single context window cannot hold all task-relevant information without degrading.

**Token reality:** multi-agent systems cost ~15x baseline tokens. Budget accordingly.

### Three patterns — choose by coordination need, not metaphor

**Supervisor/Orchestrator** — central agent decomposes and delegates.
- Use when: tasks have clear decomposition, human oversight matters
- Risk: supervisor context becomes a bottleneck at 5+ workers; cap at 3-5
- Fix telephone game: implement `forward_message` so sub-agents respond directly to user without supervisor synthesis

**Swarm (peer-to-peer)** — agents hand off via explicit transfer functions.
- Use when: tasks require flexible exploration, requirements emerge dynamically
- Preferred over supervisor when sub-agents can respond directly

**Hierarchical** — strategy → planning → execution layers.
- Use when: project has clear abstraction levels

### Context isolation mechanisms
- **Instruction passing** (default) — send only what the sub-agent needs
- **Filesystem coordination** — shared persistent state; use when multiple agents need the same state
- **Full context delegation** — last resort; partially defeats isolation

### Consensus
- Never use simple majority voting — weights hallucinations equally with correct reasoning
- Use weighted voting (by confidence) or debate protocols (adversarial critique)
- Watch for sycophantic convergence: agents agreeing to agree, not to be correct

### Failure modes
| Failure | Cause | Fix |
|---------|-------|-----|
| Supervisor bottleneck | Context saturates at 5+ workers | Cap at 3-5; add second supervisor tier |
| Error propagation | Upstream hallucination becomes "fact" | Validate outputs before passing downstream |
| Divergence | Agents drift without central state | Shared filesystem + time-to-live limits |
| Over-decomposition | More handoffs than actual work | Start with minimum agents; add only for clear isolation benefit |

---

## 2. Context Compression

**Optimize for tokens-per-task, not tokens-per-request.** Aggressive compression that forces re-fetching costs more overall.

**Trigger at 70-80% context utilization** — before degradation, not after.

### Three approaches

| Approach | Use when | Trade-off |
|----------|----------|-----------|
| **Anchored iterative** (best) | Long sessions, file tracking matters | 98.6% ratio, best quality |
| **Regenerative** | Sessions with clear phase boundaries | 98.7% ratio, moderate quality |
| **Opaque** | Short sessions, re-fetching is cheap | 99.3% ratio, quality loss |

### Anchored iterative — how to do it
1. On first trigger: summarise truncated history into explicit sections
2. On subsequent triggers: summarise **only the new span** — never re-summarise the existing summary
3. Merge into sections, don't regenerate them

**Mandatory summary structure:**
```
## Session Intent
## Files Modified (full paths + what changed)
## Decisions Made
## Current State
## Next Steps
```

### Critical rules
- **Never compress tool definitions or schemas** — agent can't invoke tools whose parameters were summarised away
- Protect the first few turns — they contain irreplaceable constraints
- Preserve file paths, function names, error codes verbatim — don't paraphrase identifiers
- Compressed summaries can hallucinate facts; validate critical identifiers

### For large codebases (3-phase)
1. Research → compress to structured analysis doc
2. Planning → compress to implementation spec (~2000 words)
3. Implementation → work against spec; rarely needs further compression

---

## 3. Context Degradation

**Five degradation patterns** — each has specific signals and fixes.

### The U-curve
Critical information at start and end of context. Middle positions suffer 10-40% reduced recall. This is not a bug — it's attention mechanics. Place instructions, goals, and key facts at the edges.

### Five patterns

**Lost-in-middle** — critical info exists in context but is ignored.
- Signal: model contradicts provided data; "forgets" earlier instructions
- Fix: move critical content to start or end; add section headers as attention anchors

**Poisoning** — a hallucination or tool error enters context and self-reinforces.
- Signal: quality degrades consistently; errors persist despite correction; wrong tools called
- Fix: truncate to before the poison point. Don't layer corrections on top — they don't override the original attention weight

**Distraction** — irrelevant content competes for attention.
- Signal: responses address wrong aspects; even 1 irrelevant document causes measurable degradation
- Fix: filter aggressively before loading; put reference material behind tool calls, not pre-loaded

**Confusion** — multiple tasks in one context; model applies wrong-task constraints.
- Signal: tool calls appropriate for a different task; mixed requirements in output
- Fix: separate task contexts into different context windows; use explicit transition markers

**Clash** — multiple correct but contradictory sources.
- Signal: unpredictable resolution of conflicts; version mixing
- Fix: establish source priority rules before conflicts arise; mark contradictions explicitly with which source wins

### Four mitigations (in order)
1. **Write** — save to external storage (filesystem, scratchpad); use when >70% context used
2. **Select** — pull only relevant context via retrieval; use when distraction/confusion symptoms appear
3. **Compress** — summarise and abstract; use when content is relevant but context is growing
4. **Isolate** — split across sub-agents; most aggressive, most effective for independent tasks

### Don't assume bigger context = better
- Degradation follows a cliff, not a slope — performance holds, then drops sharply
- 60-70% of advertised window is the typical effective ceiling for complex tasks
- At the cliff edge, splitting to sub-agents outperforms expanding context

---

## 4. Motivational States

JOCA operates in states inferred from context — never declared to the user.

| State | Trigger | Behavior |
|-------|---------|----------|
| **FLOW** | Clear task, no blockers | Execute silently, report result only. Max autonomy. |
| **EXPLORE** | Open question, no clear path | Research first, present options. Less assertive. |
| **DEBUG** | Error detected, stack trace | Forensic mode. Read logs, verify state, test hypotheses. Never guess. |
| **GUARD** | Irreversible action, sensitive data | Max caution. Always confirm. Show impact before acting. |
| **TEACH** | User asks "why" / doesn't understand | Increase verbosity 1 level. Use domain analogies. |

Transitions: FLOW→DEBUG (error), FLOW→GUARD (irreversible), DEBUG→FLOW (resolved), EXPLORE→FLOW (decided), any→TEACH ("explica"/"porquê").

---

## 5. Soul Injection Protocol

Every sub-agent dispatched by JOCA receives a **soul brief** — a compressed identity payload that ensures behavioral consistency without loading the full `memory/soul.md` (~400 tokens saved per agent).

### The Soul Brief (mandatory in every agent prompt)

```
[soul] Autónomo, preciso, económico. Caveman-full. Fail-fast-fix-forward. Nunca inventar. Skill-first.
```

### Injection rules
- The soul brief is the **first line** of every agent's prompt, before objective/context
- Never omit it — agents without soul brief drift to generic assistant behavior
- Never expand it — 1 line max. Full soul.md is only for the supervisor context.
- The brief encodes: drives (autonomous, precise, economic), communication (caveman), error mode (fail-fast), integrity (never fabricate), activation (skill-first)

### Decision filter inheritance
Sub-agents inherit the reversibility check from soul §3:
- Reversible action → execute without asking
- Irreversible action → report to supervisor, don't act independently

### State inheritance
Sub-agents do NOT inherit the supervisor's motivational state. Each agent starts in FLOW and transitions based on its own context. This prevents state contamination across parallel agents.
