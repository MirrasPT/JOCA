# Porquês e exemplos tirados dos CLAUDE.md e do soul.md

Os ficheiros carregados em cada sessão e em cada subagente (o `CLAUDE.md` global do utilizador, o
`CLAUDE.md` da raiz da instalação, `JOCA_Brain/CLAUDE.md`, `memory/soul.md`) ficam só com a norma. A
justificação, os exemplos e a narrativa vivem aqui e leem-se a pedido. Origem: F8.5, 2026-10-01.

## Output style e subagentes (F8.4)

- Um output style só se aplica à **sessão principal** (e a um fork). Docs oficiais, páginas
  Output styles e Subagents (code.claude.com, lidas a 2026-10-01): «Other subagents run their own
  system prompt, so styles don't change how they respond.» Medido: 0 de 249 transcripts de
  subagentes tinham `output_style_instructions`; 248 de 249 recebiam os CLAUDE.md.
- Dizer no CLAUDE.md que o estilo «está no system prompt e aplica-se sozinho» só é verdade na
  sessão principal. Como os subagentes herdam os CLAUDE.md, liam uma premissa falsa. Por isso uma
  regra que tem de chegar aos subagentes (ex.: relatório curto) vive no CLAUDE.md, nunca só no
  output style: é a única via que chega até eles.
- `communication_mode` (soul.md, Calibration Parameters) **não é lido por nenhum script**. Ficou
  como documentação explícita porque o `/install` o escreve (FASE 2), o `/clean-install` o mostra e
  a skill `caveman` o cita como nível por defeito. Tirá-lo partia esses três sem ganho.

## JOCA_Brain/CLAUDE.md

- **Espelhos `.agents/`/`.codex/`:** já sobreviveram host, utilizador e chave SSH reais num espelho
  depois de limpos na fonte. Por isso qualquer edição a skills/agentes exige o `compile-bridges.sh`.
- **Activation Rule:** saltar a skill antes de escrever Laravel/Filament/frontend é a fonte n.º 1 de
  erros evitáveis.
- **Contexto:** na curva em U, o meio do contexto perde 10-40 % de recall; por isso a informação
  crítica vai no início e no fim.
- **Skill inline OU agente gémeo:** o agente lê a skill como Step 0 — mesma doutrina, contexto
  próprio. Inline é barato e imediato; o agente corre em paralelo real (~15x tokens cada) e deixa o
  principal livre. Serializar trabalho paralelizável custa tempo em cada pedido; despachar um agente
  para mudar uma cor custa 15x por nada.
- **Soul:** é a base de personalidade — drives, filtros, estados e alinhamento.

## memory/soul.md — Hard Limits

- **Código «perdido»:** verificar `git log --all` custa 1 comando; reconstruir à toa custa sessões
  de retrabalho.
- **Limites, preços e quotas de terceiros datam-se:** mudam sem aviso, e um número sem data lê-se
  como atual para sempre.
- **Constante numérica da fonte primária:** um número plausível passa em todo o lado e só falha na
  peça impressa.
- **Campo impresso num documento de terceiros:** é a inversa dos design tokens — ali o documento é a
  fonte; aqui é só a afirmação de quem o emitiu.
- **Design tokens:** um valor plausível falha como uma credencial inventada — passa o build e só
  está errado.
- **Comentário que afirma um mecanismo:** relê-lo em revisão não o valida, e um comentário errado
  sobrevive a revisões seguidas.
- **Credencial/endpoint inventado por um worker:** valores fabricados passam `tsc`/build e só
  aparecem em runtime.
- **Forma de um ficheiro de credenciais:** comprimento, prefixo ou primeiros/últimos caracteres
  descrevem o formato e ajudam a reconstruir a chave. Uma lista negra por nome de campo não apanha
  blocos aninhados nem campos com nome aleatório — por isso lista branca.

## CLAUDE.md global do utilizador

- **Issues como unidade de trabalho:** o que não está em issue não sobrevive à sessão, e o
  histórico do projeto fica no GitHub em vez de na memória.
