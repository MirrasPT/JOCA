# Skill/Agent Chaining — encadeamento automático

Como uma skill/agente passa o trabalho à **próxima** sem o user pedir. Carregado em todas as sessões. Terso por design.

Princípio: **o user diz uma coisa, o JOCA conduz a sequência inteira** — classifica a via
(task-intake), corre o passo, encadeia para o seguinte, pára só em irreversível.

## A convenção `chain:`

Duas formas complementares: frontmatter `chain: design-review, tester-ui-ux` (lista dos próximos
prováveis, machine-readable) + secção `## Próximo passo (chain)` no corpo (a condição e o gate). É um
**mapa de sugestão**, não execução cega — quem executa é o **main loop** (ou command/orchestrator).

---

## Regra de Encadeamento (main loop)

Ao terminar um passo (skill executada / agente devolvido):
1. Lê o `chain:`/`## Próximo passo` do passo que acabou.
2. Para cada próximo candidato, avalia a **condição** (ex.: "se houve código frontend → tester-ui-ux"; "se há violações WCAG → a11y-fixer").
3. **Reversível** (a esmagadora maioria: review, teste, lint, design-review, recall) → **dispara sem perguntar**. Notifica `[chain → <próximo>]`.
4. **Irreversível** (deploy/push/migration/delete/payment/auth) → 1 linha de confirmação antes.
5. **Travão anti-loop:** o mesmo par (passo→próximo) não dispara 2x na mesma tarefa sem progresso novo; máx. profundidade = `loop_max_iterations` (soul.md, default 4). 3x sem progresso → parar e reportar.

O encadeamento **não** inventa scope novo (steward, não initiator — ver `orchestration-patterns.md`): só segue chains declaradas ou pipelines nomeadas (`rules/pipelines.md`).

---

## Continuidade — um empurrão por turno, não um loop

Mecanismo: `.joca/loop.json` (passos + `produtor` + `verificador` + `estado`), lido pelo `Stop` hook
`stop-continuar.js`, que bloqueia o fim do turno quando há passo `pendente` ou `feito` por verificar.

⚠ **Bloqueia UMA vez por turno**, não em ciclo: o guarda `stop_hook_active` (obrigatório no contrato
de hooks do Claude Code) cala o hook no bloco seguinte — subir o limite é `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`.
Logo os travões `iteracao > max_iteracoes` e `sem_progresso >= 3` são rede de segurança, não o
mecanismo normal de paragem: **levar o contrato até `verificado` é do modelo, não do hook**.

| Situação | Acção |
|---|---|
| Via C/D ou pipeline | escrever o contrato antes de começar; actualizar a cada passo |
| Passo fechado | `estado: feito` + `produtor` preenchido — nunca `verificado` pelo próprio |
| Gate irreversível ou pergunta ao user | `"aguarda_utilizador": true` → o turno termina; o hook não insiste |
| Bloqueio real | apagar o contrato ou `touch .joca/loop-off.flag`, e reportar |

Travões inalterados: `loop_max_iterations` · 3x-sem-progresso · expiração 6 h · `stop_hook_active`.
Continuar ≠ inventar: o contrato tem os passos que existiam quando foi escrito (steward).

## Verificação: quem produz não assina

O verificador é **sempre outro agente** que não o produtor — inclusive quando o produtor foi o main
loop. Vale para código, design, dados e conteúdo, não só testes. O `stop-continuar.js` recusa passos
com `verificador === produtor`.

## Subagentes são skill-aware (garantido)

Um agente despachado via `Agent()` **não herda** `soul.md` nem as skills — só o brief. Logo:
- **Step 0 obrigatório no brief**: `Read()` das skills relevantes ANTES de agir (o campo `skills:` do frontmatter NÃO carrega a skill).
- Quem despacha inclui no brief as skills a ler + o `chain:` do agente.
- O agente devolve no relatório o próximo passo sugerido; o **caller** decide e dispara. Agentes não fazem spawn de agentes (`orchestration-patterns.md`).

---

## Exemplos canónicos (chains já cabladas)

| Passo | Encadeia para | Condição |
|---|---|---|
| `frontend` | `design-review` → `tester-ui-ux` | sempre após UI nova |
| `design-review` | `a11y-fixer` | se há violações WCAG |
| `laravel-specialist` | `tester-code` → `tester-api` | após feature; api se houve endpoints |
| `rest-api` (`api-design`) | `tester-api` | após desenhar endpoints |
| `plan` | skill/agente do domínio | implementar o plano |
| `novo-issue` | `preparar-design` · `planear-ondas` | ecrã novo · ≥3 issues sem plano |
| `preparar-design` | `validar-design` | sempre — o mockup não vai a código sem porteiro |
| implementação de um issue | `escrever-testes` (**sessão nova**) → `tester-code` | sempre; nunca na sessão que implementou |
| `log-debugger` | `query-debugger` | se a causa é SQL |
| `security` (skill) | `security-review` (agente) | review profundo |
| `freeze`/`careful`/`guard` | `unfreeze` | desligar no fim |
| `/learn` | `/retro` | retrospectiva da janela |

Pipelines multi-passo nomeadas (cross-stack) vivem em `rules/pipelines.md` e correm pelo auto-runner.

---

## Anti-patterns

| Errado | Correcto |
|---|---|
| Terminar a skill e esperar o user pedir o próximo passo óbvio | Encadear automaticamente (reversível) + notificar `[chain → x]` |
| Encadear um passo irreversível sem confirmar | 1 linha de confirmação primeiro |
| Agente despachado sem Step 0 (skills) no brief | Brief carrega sempre `Read()` das skills |
| Encadear em loop infinito "a ajudar" | Travão: profundidade `loop_max_iterations`, 3x-nada → parar |
| Inventar próximos passos fora do scope | Só chains declaradas / pipelines nomeadas (steward) |
| Encadear a partir do **relatório** de um passo que produziu output visual/binário (imagem, PDF, vector, build) | Verificar o **artefacto**: abrir/rasterizar e comparar com a referência antes de aceitar. Um agente pode reportar sucesso e descrever mal o que produziu; um build sem erros pode ter 3 bugs visuais |
| Terminar o turno com passos do contrato por fechar | `.joca/loop.json` manda: continuar até `verificado`, ou marcar `aguarda_utilizador`/apagar o contrato |
| O mesmo agente que escreveu a assinar a verificação | Verificador ≠ produtor, sempre — inclusive quando o produtor foi o main loop |
