# Chaining — exemplos e casos (on-demand)

Versão comprimida (auto-carregada) em `.claude/rules/chaining.md`. Este ficheiro guarda a tabela das
chains já cabladas e os incidentes por trás das regras do contrato de continuidade. `Read()` quando
fores encadear um passo cujo `chain:` não conheces, ou quando uma regra do contrato precisar do porquê.

## Índice
Exemplos canónicos · Casos do contrato de continuidade · Texto retirado da rule (2026-09-15 e F8.3)

⚠ **As regras vivem na rule, não aqui.** Excepção: a tabela «Exemplos canónicos» saiu da rule por
orçamento (upgrade 2026-09-15) — a rule aponta para ela.

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
| `/start` (router) | `executar-projeto` · **Website** · **Identidade/branding** · `/marketeer` | pelo tipo da 1.0; ⏸ «Avanço para o próximo workflow: <nome>?» |
| `design-shotgun` (W2) | `design-review` | sempre — escolhe a variante; ⏸ do dono depois |
| `frontend` (W4) | `design-review` → `tester-ui-ux` → `a11y-fixer` | W5; a11y se houver violações WCAG |
| `deploy-executor` (W7) | `auditoria-site-live` | sempre após publicar; o 200 sozinho não prova |
| Website concluído (W7) · sem Website, Aplicação concluída (E4) | `/marketeer` | só em multi-tipo com Marketing — ⏸ gate de passagem |
| B3 logótipo | `raster-para-vector` · `img-gen` → `icon-design` · ficheiro do designer | gate de pergunta caso a caso |
| `brand-guidelines` (B4) | `design-system` | tokens a partir da direção aprovada |
| `graphic-design` (B5/B6) | `design-review` · `html-to-pdf` | verificador ≠ produtor · manual de normas em PDF |
| Branding concluído (B4) | **Website** · `executar-projeto` | multi-tipo — consomem os tokens; ⏸ gate de passagem |

Pipelines multi-passo nomeadas (cross-stack) vivem em `reference/pipelines-catalogo.md` e correm pelo auto-runner.

---

## Casos do contrato de continuidade

### Campos — espera, verificação conjunta, fecho (`stop-continuar.js`)

| Situação | Contrato |
|---|---|
| Passo à espera de outro | `"depende_de": ["<id-passo>"]` — nunca `em_curso` com agente fictício |
| Verificação conjunta · pós-push · impossível | no passo `feito`: `"verificacao": "<id-passo>"` · `"diferida:<condição>"` · `"bloqueada:<motivo>"` (reportar) |
| Todos `verificado` | o hook **apaga** o contrato; pedido novo na sessão → contrato novo de raiz (Write, não update) |

Expiração: 6 h **sem escrita** do modelo (mtime/`actualizado`), não desde `criado`.
Contrato expirado **com passos `em_curso` não se apaga** (o agente de fundo pode estar vivo): o hook deixa de insistir e manda fechá-lo à mão quando o agente acabar.
Cada remoção pelo hook (expiração, legado sem dono expirado, todos `verificado`) fica numa linha de `.joca/loop/_apagados.log`: data · sessão · ficheiro · motivo · `id:estado` dos passos.

### Passo `em_curso` — agentes de fundo a trabalhar

> Real (2026-08-29, 2026-09-05, 2026-09-08, 2026-09-10 e 09-11, em quatro projectos diferentes):
> o `stop-continuar.js` bloqueou o fim do turno por passos «feitos mas por verificar» cujos
> verificadores **já estavam despachados e a correr**, e pediu continuação enquanto dois agentes
> escreviam nos ficheiros em causa. O turno TEM de terminar para os agentes trabalharem; a mensagem só
> oferecia «decisão do utilizador» ou «apagar o contrato», e nenhuma descreve «estou à espera de
> trabalho que eu próprio despachei». Contornou-se com `aguarda_utilizador: true`, que é mentira.

Contrato: `"estado": "em_curso"` + `"agente": "<id do agente>"`. O hook:
- só passos `em_curso` por fechar → não bloqueia e **não conta iteração** (não queima o travão);
- `em_curso` misturado com `pendente`/`feito` → bloqueia só pelos outros, e lista os em curso; turno sem mudança de estados e com agente em curso conta como **espera** e não sobe a iteração;
- ⚠ mas o contador `sem_progresso` sobe na mesma nessa espera: 4 turnos seguidos sem mudar nenhum estado disparam o travão «3 iterações sem progresso» com o agente ainda vivo. Espera longa no caso misto → `"aguarda_utilizador": true` não serve (é mentira); fechar ou marcar os outros passos (`depende_de`, `verificacao`) para que só fiquem os `em_curso`;
- a recusa de `verificador === produtor` vale na mesma; a expiração de 6 h deixa de insistir mas não apaga (ver acima).
Quando a notificação de conclusão chega: `feito` (com `produtor`) → verificador → `verificado`.

### Gate vermelho escreve contrato

> Real (2026-08-25, projecto de cliente): workflow terminou com gate vermelho e nada o registou no
> contrato; o turno fechou como se o trabalho estivesse entregue.

Workflow/gate que acaba vermelho → **um passo `pendente` por falha** no contrato da sessão, antes de
reportar. O relatório descreve; só o contrato obriga o turno seguinte a pegar-lhe.

### Verificador acha defeito no código do caller

> Real (2026-08-23, projecto interno): o agente de testes apanhou um risco introduzido pelo main loop (lista
> de exclusão partilhada por referência, esvaziável com `.pop()`). Resolveu-se ad hoc: o caller
> corrigiu e mandou-o escrever o teste que tinha retirado.

Procedimento: o **caller** corrige → re-despacha ao **mesmo** verificador só o teste que prova a
correcção (ainda a correr ou já devolveu → `SendMessage`, que retoma o agente com o contexto intacto
— 2026-09-22: um verificador concluído retomou e re-verificou em 87 s; só se não responder → agente novo
do mesmo tipo com o brief dele; scope novo nunca vai por `SendMessage`) → o passo não fecha sem esse teste verde. Continua a valer «quem produz não assina»: o
caller corrigiu, logo o caller não verifica a correcção.

---

## Texto retirado da rule — corte de tokens (2026-09-15)

- Encadear a partir do **relatório** de um passo com output visual/binário é o erro: um agente pode reportar sucesso e descrever mal o que produziu; um build sem erros pode ter 3 bugs visuais.
- O guarda `stop_hook_active` é obrigatório no contrato de hooks do Claude Code.
- Tabela de anti-patterns que estava na rule — cada linha tem a regra positiva em `rules/chaining.md` ou `rules/task-intake.md` §Segurança:

| Errado | Correcto |
|---|---|
| Terminar a skill e esperar o user pedir o próximo passo óbvio | Encadear automaticamente (reversível) + notificar `[chain → x]` |
| Encadear um passo irreversível sem confirmar | 1 linha de confirmação primeiro |
| Agente despachado sem Step 0 (skills) no brief | Brief carrega sempre `Read()` das skills |
| Encadear em loop infinito "a ajudar" | Travão: profundidade `loop_max_iterations`, 3x-nada → parar |
| Inventar próximos passos fora do scope | Só chains declaradas / pipelines nomeadas (steward) |
| Encadear a partir do relatório de output visual/binário | Verificar o artefacto: abrir/rasterizar e comparar com a referência |
| Terminar o turno com passos do contrato por fechar | `.joca/loop/<session_id>.json` manda: continuar até `verificado`, ou `aguarda_utilizador`/apagar o contrato |
| O mesmo agente que escreveu a assinar a verificação | Verificador ≠ produtor, sempre — inclusive quando o produtor foi o main loop |

## Texto retirado da rule — F8.3 (2026-10-01)
- Resumo que abria a rule: um passo passa o trabalho ao seguinte sem o user pedir — classifica a via (task-intake), corre, encadeia, pára só em irreversível. · Mecânica do hook: `stop_hook_active` cala o `stop-continuar.js` no bloco seguinte (limite: `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`); `iteracao > max_iteracoes` e `sem_progresso >= 3` são rede de segurança, não o que fecha o contrato. · Verificação: cada volta do verificador costuma achar defeito novo — aceitar o 1.º `aprovado: false` e dar o ciclo por fechado é o erro.
