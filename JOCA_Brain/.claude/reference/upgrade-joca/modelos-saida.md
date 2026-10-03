# /upgrade-joca — modelos de saída (plano e relatório)

Lido a partir de `.claude/commands/upgrade-joca.md` §3.1 (tabela do plano), §6.1 (resumo final) e §6.4 (próximos passos).

## Plano (Phase 3.1)

```
JOCA UPGRADE PLAN
-----------------

 #  Type          Component    Description                                     Impact   Effort
--- ------------- ------------ ----------------------------------------------- -------- --------
 1  NEW_SKILL     skill        next-auth — Next.js authentication patterns     HIGH     SMALL
                               Research: OAuth 2.1 PKCE, NextAuth.js v5 API
 2  IMPROVE_SKILL skill        frontend — add Tailwind v4 utilities        MEDIUM   SMALL
                               Research: Tailwind v4 migration guide patterns
 3  FIX_TRIGGER   skill        laravel-specialist — false positive on "artisan" HIGH     TRIVIAL
                               in non-Laravel contexts
 4  IMPROVE_CMD   command      save — missing error handling on checkpoint fail MEDIUM   SMALL
 5  FIX_WORKFLOW  workflow     create-skill pipeline — evaluator timeout        LOW      MEDIUM
                               not handled
 6  NEW_AGENT     agent        perf-monitor — continuous performance tracking   LOW      LARGE
 7  IMPROVE_AGENT agent        deep-research — add firecrawl_extract fallback  MEDIUM   TRIVIAL

-----------------
7 improvements planned (2 HIGH, 3 MEDIUM, 2 LOW)

Sources:
  #1: session-meu-projecto-2026-05-20.md > Issue 3
  #2: auto-2026-05-22.md > Issue 1, joca-patterns.md > "Tailwind v4"
  ...
```

## Relatório (Phase 6.1)

```
JOCA UPGRADE COMPLETE
---------------------

Applied: N
  [1] NEW_SKILL    next-auth               score 8.5/10 (iter 2)
  [3] FIX_TRIGGER  laravel-specialist       applied
  [4] IMPROVE_CMD  save                     applied

Already resolved on disk: J (estado JA_RESOLVIDO -- not re-applied)
  [2] IMPROVE_SKILL frontend                already at .claude/skills/frontend.md:88

Uncertain: I (estado INCERTO -- needs the user to arbitrate)
  [8] FIX_WORKFLOW  hook dispatch            target ambiguous, nothing applied

Skipped: M (user choice)
  [6] NEW_AGENT    perf-monitor             skipped by user

Failed: K
  [5] FIX_WORKFLOW create-skill pipeline    failed -- codex review found regression
  [7] IMPROVE_CMD  install                  failed -- verification (4b check 2: 20 lines deleted)

---------------------
Files modified:
  .claude/skills/<nova-skill>.md      (NEW, ex.: next-auth)
  .claude/skills/laravel-specialist.md (trigger fix)
  .claude/commands/save.md             (improved)

Validation:
  Phase 4b: N/N files verified on disk (0 reverted)
  SKILL_INDEX.json regenerated
  Bridges recompiled
  joca-doctor: baseline 20 ✓ · 1 ⚠ · 1 ✗  →  depois 21 ✓ · 1 ⚠ · 0 ✗
    novos desta corrida: 0        (qualquer ⚠/✗ novo é defeito desta corrida)
    pré-existentes:      1 ⚠ (soul.md por preencher)
  [Codex review: 0 issues / not available]

Entrada vs saída (desde <data da última corrida>):
  ficheiros de feedback novos: N     processados nesta corrida: M
  → saldo: +/-K        (se a entrada ganhar de forma consistente, dizê-lo em voz alta)
  banda coberta: [critical, high]    adiado: X issues medium/low

---------------------
```

## Próximos passos (Phase 6.4)

```
Next steps:
  - Run /update-joca if upstream changes are available
  - Realign the derived inventory if skills/agents/commands changed (step 5.6)
  - Run /save in your next session to auto-capture new feedback patterns
  - Review failed items manually: <list of failed items>
```
