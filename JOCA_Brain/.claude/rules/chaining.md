# Skill/Agent Chaining — encadeamento automático

Como uma skill/agente passa o trabalho à **próxima** sem o user pedir. Carregado em todas as sessões. Terso por design.

Adaptado do gstack (`autoplan` lê os SKILL.md filhos e corre-os a fundo; pipelines encadeiam por ficheiro). Princípio central do JOCA autónomo: **o user diz uma coisa, o JOCA conduz a sequência inteira** — classifica a via (task-intake), corre o passo, e **encadeia para o passo seguinte** parando só em decisões irreversíveis.

---

## A convenção `chain:`

Skills e agentes declaram o(s) próximo(s) passo(s) de duas formas (complementares):

1. **Frontmatter `chain:`** — lista curta dos próximos skills/agentes prováveis (machine-readable):
   ```yaml
   chain: design-review, tester-ui-ux
   ```
2. **Secção `## Próximo passo (chain)`** no corpo — a regra humana: *quando* disparar cada próximo, e qual o **gate** (se irreversível).

O `chain:` é um **mapa de sugestão**, não execução automática cega. Quem executa é o **main loop** (ou o command/orchestrator), seguindo a Regra de Encadeamento abaixo.

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

## Subagentes são skill-aware (garantido)

Um agente despachado via `Agent()` **não herda** `soul.md` nem as skills — só o brief. Por isso:
- **Step 0 obrigatório no brief** de cada agente: `Read()` das skills relevantes ANTES de agir (o campo `skills:` no frontmatter NÃO carrega a skill — a garantia é o Read no corpo/brief).
- Quem despacha (main loop / `master-orchestrator`) inclui no brief: as skills a ler + o `chain:` do agente (o que ele deve sugerir ao devolver).
- Um agente, ao terminar, **devolve no relatório** o próximo passo sugerido (ex.: "recomendo re-correr `tester-ui-ux`") — o caller decide e dispara. Agentes não fazem spawn de agentes (regra crítica `orchestration-patterns.md`).

---

## Exemplos canónicos (chains já cabladas)

| Passo | Encadeia para | Condição |
|---|---|---|
| `frontend` | `design-review` → `tester-ui-ux` | sempre após UI nova |
| `design-review` | `a11y-fixer` | se há violações WCAG |
| `laravel-specialist` | `tester-code` → `tester-api` | após feature; api se houve endpoints |
| `rest-api` (`api-design`) | `tester-api` | após desenhar endpoints |
| `plan` | skill/agente do domínio | implementar o plano |
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
