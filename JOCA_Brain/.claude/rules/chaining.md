# Skill/Agent Chaining — encadeamento automático

Chains cabladas, casos do contrato e porquês: `reference/chaining-casos.md`.

## A convenção `chain:`

Frontmatter `chain: design-review, tester-ui-ux` (próximos prováveis, machine-readable) + secção `## Próximo passo (chain)`
no corpo (condição e gate). **Mapa de sugestão**, não execução cega — executa o **main loop** (ou command/orchestrator).

## Regra de Encadeamento (main loop)

Ao terminar um passo (skill executada / agente devolvido):
1. Lê o `chain:`/`## Próximo passo` do passo que acabou.
2. Avalia a **condição** de cada candidato (ex.: "houve código frontend → tester-ui-ux"; "violações WCAG → a11y-fixer").
3. **Reversível** (review, teste, lint, design-review, recall) → **dispara sem perguntar**, notifica `[chain → <próximo>]`.
4. **Irreversível** → gate `AskUserQuestion` antes. Travão e steward: `task-intake.md` §Segurança.
5. Passo com output visual/binário (imagem, PDF, vector, build) → verificar o **artefacto** (abrir/rasterizar vs referência) antes de encadear, nunca o relatório.

## Continuidade — um empurrão por turno, não um loop

**`.joca/loop/<session_id>.json`** (um por sessão; id na linha `[sessao]` do arranque; `passos` + `produtor` + `verificador` +
`estado` + `sessao`), escrito ANTES de começar em via C/D ou pipeline e actualizado a cada passo. O `Stop` hook
`stop-continuar.js` bloqueia o fim do turno com passo `pendente` ou `feito` por verificar.
Contrato de **outra sessão** (ou `.joca/loop.json` legado sem `sessao`) → **não lhe toques**. Detalhe: `reference/sessoes-paralelas.md`.

⚠ O hook bloqueia **UMA vez por turno**: **levar o contrato até `verificado` é do modelo, não do hook**.

| Situação | Acção |
|---|---|
| Passo fechado | `estado: feito` + `produtor` — nunca `verificado` pelo próprio |
| Agente de fundo no passo | `estado: em_curso` + `agente: <id>` → o hook não insiste; a notificação reacorda |
| Gate/workflow acaba vermelho | um passo `pendente` por falha, antes de reportar |
| Gate irreversível ou pergunta ao user | `"aguarda_utilizador": true` → o turno termina |
| Bloqueio real | apagar o contrato **desta sessão** ou `touch .joca/loop-off.flag`, e reportar |

Travões: `loop_max_iterations` · 3x-sem-progresso · expiração 6 h · `stop_hook_active`. O contrato tem só os passos que existiam quando foi escrito. Campos `depende_de` · `verificacao` · fecho · mecânica do hook: `reference/chaining-casos.md`.

## Verificação: quem produz não assina

Verificador = **sempre outro agente**, inclusive quando o produtor foi o main loop; vale para código, design, dados e conteúdo.
O `stop-continuar.js` recusa `verificador === produtor`. Verificador acha defeito do caller → caller corrige e re-despacha só o teste ao mesmo verificador: **só um `aprovado: true` dele fecha o ciclo**. Tecto 5 voltas → pára e reporta.

## Subagentes são skill-aware (garantido)

`Agent()` **herda os `CLAUDE.md`** (e o `soul.md`, por `@import`), salvo `omitClaudeMd: true` no frontmatter do agente; **não herda skills**. **Step 0 obrigatório**: `Read()` das skills relevantes (o campo `skills:`
do frontmatter NÃO as carrega) + o `chain:` do agente. **`ls` a cada caminho do Step 0 antes de despachar**: sem skill gémea, aponta ao próprio `.claude/agents/<x>.md`; agente que não encontre a skill do Step 0 **pára e reporta**, não improvisa. O agente devolve o próximo passo sugerido; o **caller** decide e dispara.
