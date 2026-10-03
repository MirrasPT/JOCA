# PROGRESSO.md — formato

**O que e:** a memoria PARTILHADA do projecto. Vive na raiz, **vai no git** — qualquer colaborador
que clone ve o estado sem perguntar a ninguem. Complementa a memoria do Brain do JOCA, que e
individual por utilizador: o Brain guarda o contexto pessoal (gotchas, decisoes finas, historico);
o PROGRESSO.md guarda o **estado publico** do projecto. Apontam um para o outro, nunca duplicam.

**Quem escreve:** o `/start` cria-o · o `executar-projeto` actualiza-o por passo/onda · o `/save`
sincroniza-o no fim de cada sessao. Multiplas pessoas podem escrever — e um ficheiro git normal;
conflitos resolvem-se como qualquer merge.

## Formato

```markdown
# PROGRESSO — <nome do projecto>

> Estado partilhado do projecto. Actualizado pelo JOCA (/start · executar-projeto · /save).
> Contexto pessoal de cada colaborador vive no Brain do proprio JOCA.

## Estado actual
<1-3 linhas: onde o projecto esta AGORA e qual e o proximo passo>

## Workflows
tipo: [branding, website, marketing]
| # | Workflow | Estado | Começa quando | Entrega | Prova |
|---|---|---|---|---|---|
| 1 | branding  | ✅ 2026-08-19 | —           | docs/BRAND.md · docs/DESIGN.md · assets/brand/ | B7 |
| 2 | website   | ⏳ W4         | B4 aprovado | URL publicado · GA4/GTM | — |
| 3 | marketing | ⬜            | W7 feito    | marketeer: slug=<slug> (estado.json) | `estado.mjs ler <slug>` |

## Fases
| Fase | Estado | Prova |
|---|---|---|
| S1 Produto (PRD inicial)        | ✅ 2026-08-19 | docs/PRD.md |
| S2 Fluxos e capacidades         | ✅ 2026-08-19 | PRD §Fluxos |
| S3 Stack + ambiente local       | ✅ 2026-08-19 | PRD §Stack (inclui tabela Ambiente local) + docs/DECISIONS.md |
| S4 Infraestrutura               | ✅ 2026-08-19 | repo <owner>/<nome> · deploy: <alvo> |
| S5 Direccao de design           | ✅ 2026-08-19 | docs/DESIGN.md |
| E1 Fundacao (scaffold+CI+hooks) | ⏳ em curso | — |
| E2 Design (via: <directo|claude-design>) | ⬜ | — |
| E3 Ponto de situacao            | ⬜ | — |
| E4 Desenvolvimento (ondas)      | ⬜ | — |
| Producao                        | ⬜ | — |

## Ondas (preenchido na E4)
| Onda | Issues | Estado | Portao |
|---|---|---|---|

## Diario (mais recente primeiro)
- 2026-08-19 · <quem/maquina> · <o que aconteceu em 1 linha>
```

## Workflows — vários fluxos encadeados

Um projecto pode juntar vários tipos de trabalho (ex.: branding → website → marketing). A secção
`## Workflows` fica **antes** de `## Fases` e guarda o estado entre sessões; o `.joca/loop` só guarda
o workflow activo e expira em 6 h, por isso não serve para isto.

- **Uma linha por workflow**, pela ordem em que correm (`#`). Um só tipo = uma linha.
- **Prefixos de fase** em `## Fases`: **S** (entrevista do `/start`) e **E** (aplicação, `executar-projeto`) ·
  **W** (website, W1–W7) · **B** (branding, B1–B7). As fases de cada workflow vão para `## Fases` com o seu prefixo.
- **«Começa quando»** é uma fase com prova (`B4 aprovado`, `W7 feito`) ou `—` (começa já). Marketing começa com `W7 feito` se houver website, senão com `E4 feito` da aplicação.
- **Marketing não se espelha:** o estado vive no `estado.json` do pack do `/marketeer`. Aqui entra só o
  slug na coluna Entrega e o comando de prova (`estado.mjs ler <slug>`); a coluna Estado fica `⬜` até
  arrancar e depois `▶ estado.json`. O caminho da RAIZ do marketeer vai para o frontmatter de
  `memory/projects/<nome>/index.md` (`marketeer_raiz`/`marketeer_slug`), nunca para este ficheiro.
- O que cada workflow entrega ao seguinte → contrato «Entrega → Recebe» (o `/start` aponta-o na Fase 6.3).

**Regra de retoma:** percorrer as linhas por ordem de `#` e entrar no **1.º workflow por fazer cujo
«Começa quando» esteja cumprido**.
1. «Por fazer» = Estado diferente de ✅, **ou** ✅ cuja prova não se confirma (a prova manda, não o símbolo).
   `⏳` conta como por fazer — retoma-se na fase indicada.
2. «Cumprido» = `—`, ou a fase citada está ✅ em `## Fases` com a prova confirmada.
3. Workflow de marketing escolhido → passa ao `/marketeer <slug>`, que retoma pelo seu `estado.json`.
4. Nenhuma linha elegível → reportar o que bloqueia cada uma (a fase que falta) e não arrancar nada.
5. Passar de um workflow ao seguinte = 1 gate Sim/Não; dentro do workflow, as fases encadeiam sozinhas.

Sem secção `## Workflows` (PROGRESSO antigo) → a retoma segue só `## Fases`, como até aqui.

## Regras

- **Estado marca-se com prova**, nunca so com ✅ — o caminho/comando que o confirma. A retoma do
  `/start` verifica a prova, nao o simbolo.
- O **Diario** e append-only, 1 linha por sessao de trabalho. Nao e changelog de codigo (isso e o
  git) — e o "quem fez o que e onde ficou".
- **Uma so seccao de Diario**, entrada nova **no topo** dela: `grep -cE '^## Di[aá]rio' PROGRESSO.md` = 1. Uma segunda
  seccao criada no fim enterra as entradas novas por baixo das antigas; havendo duas, fundem-se (mais recente primeiro).
- Nada de segredos, tokens ou paths de maquina pessoal — o ficheiro e publico dentro do repo. O
  **ambiente local** (Herd · Laragon · Sail · nativo) vive em `.ai/guidelines/00-projeto.md` — aqui
  entra so a prova de que a fase fechou.
