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

## Fases
| Fase | Estado | Prova |
|---|---|---|
| S1 Produto (PRD inicial)        | ✅ 2026-08-19 | docs/PRD.md |
| S2 Fluxos e capacidades         | ✅ 2026-08-19 | PRD §Fluxos |
| S3 Stack                        | ✅ 2026-08-19 | PRD §Stack + docs/DECISIONS.md |
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

## Regras

- **Estado marca-se com prova**, nunca so com ✅ — o caminho/comando que o confirma. A retoma do
  `/start` verifica a prova, nao o simbolo.
- O **Diario** e append-only, 1 linha por sessao de trabalho. Nao e changelog de codigo (isso e o
  git) — e o "quem fez o que e onde ficou".
- Nada de segredos, tokens ou paths de maquina pessoal — o ficheiro e publico dentro do repo.
