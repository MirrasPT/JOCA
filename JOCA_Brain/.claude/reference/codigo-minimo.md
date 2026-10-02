# Código mínimo — escada, guard-rails e checklist (on-demand)

Ler **antes de escrever código** (não no arranque). Norma única para skills e agentes de desenvolvimento;
os consumidores apontam para aqui e nunca copiam o texto. Concretiza o `CLAUDE.md` §Code (Simplicity +
Surgical) — não o substitui. Gatilhos explícitos («yagni», «mais simples», «npm install»…) → skill `yagni`.

## Conteúdo
1. Premissa
2. Perceber antes de simplificar
3. A escada (7 degraus)
4. Regras
5. Guard-rails — nunca se cortam
6. Teto conhecido e verificação mínima
7. Forma de saída
8. Anti-padrões
9. Exemplos curtos
10. Checklist antes de escrever código
11. Créditos

## 1. Premissa
Código que não se escreve não tem bugs; dependência que não se acrescenta não tem CVE nem breaking change.
Preguiça = eficiência, não descuido. Fica sempre no nível «full»: sem modos lite/ultra (o tom é do output style).

## 2. Perceber antes de simplificar
- A escada encurta a **solução**, nunca a **leitura**. Primeiro: ler a tarefa e o código que ela toca,
  seguir o fluxo real de ponta a ponta. Só depois subir a escada.
- **Bug = causa raiz, não sintoma.** Antes de editar uma função, `grep` a todos os chamadores.
  Uma guarda na função partilhada é um diff menor do que uma por chamador — e corrige os irmãos.
- O diff mais curto no sítio errado não é mínimo: é um segundo bug.
- Pedido com duas leituras possíveis → apresentá-las e perguntar (`CLAUDE.md` §Code, Think first;
  na sessão principal por `AskUserQuestion` — um subagente não pergunta: reporta a dúvida ao caller).
- O que foi pedido explicitamente faz-se inteiro (§5); a escada encurta o COMO, nunca o âmbito pedido.

## 3. A escada (7 degraus)
Subir de cima para baixo; parar no **primeiro** que resolve. Dois servem → o mais alto.

| # | Pergunta | Se sim |
|---|---|---|
| 1 | **Precisa mesmo de existir, agora?** (YAGNI) | Não → não fazer; dizer numa linha |
| 2 | **Já existe neste código?** (helper, util, tipo, padrão) | Reutilizar — reimplementar o que está a 3 ficheiros é o erro mais comum |
| 3 | **A stdlib faz?** | Usar (`Array`, `URL`, `crypto`, `str_*`) |
| 4 | **A plataforma/framework faz?** | `<input type="date">`, CSS antes de JS, constraint de BD antes de código, `Str`/`Cache`/policies, `useId` |
| 5 | **Uma dependência já instalada resolve?** | Usar. Nunca instalar nova para o que meia dúzia de linhas faz |
| 6 | **Cabe numa linha / util de 3-5 linhas?** | Inline no projecto |
| 7 | **Só agora:** código novo | O mínimo que funciona, sem generalizar para casos hipotéticos |

Descer para dependência nova ou abstração → 1 linha a dizer porque o degrau acima falha.

## 4. Regras
- Sem abstração de uso único: nada de interface com 1 implementação, factory de 1 produto, config para valor fixo.
- Sem scaffolding «para depois» (config, plugins, hooks) — constrói-se quando o requisito existir.
- Abstrair só quando o padrão se repetir (regra prática: 3.º uso).
- Apagar antes de acrescentar — **dentro do âmbito da alteração**. Código morto alheio → mencionar, não apagar (§Surgical).
- Menos ficheiros; diff mais curto **depois** de perceber; seguir o estilo existente.
- Aborrecido > engenhoso. Duas opções do mesmo tamanho → a que acerta nos casos-limite.
- Sem tratamento de erros para cenários impossíveis.
- Teste: «um engenheiro sénior chamaria a isto complicado?» Sim → simplificar (200 linhas onde 50 chegam → reescrever).
- Imports/variáveis que a **tua** alteração deixou sem uso → remover; os que já lá estavam, não.

## 5. Guard-rails — nunca se cortam
Fora da escada. Cortar aqui não é simplicidade, é bug ou dano:
- **Segurança** — auth, autorização, escaping, segredos, CSRF, rate limit.
- **Validação de input** nas fronteiras de confiança.
- **Perda de dados** — transações, confirmação em irreversíveis, migrações reversíveis, erros que evitam perda.
- **Acessibilidade** — semântica, labels, foco, contraste, teclado.
- **O que foi pedido explicitamente** — o utilizador insiste na versão completa → constrói-se, sem rediscutir.

Dúvida se é guard-rail → tratar como guard-rail. Simplificar tocaria num destes → parar e sinalizar.

## 6. Teto conhecido e verificação mínima
- Simplificação deliberada com teto real (lock global, scan O(n²), heurística ingénua) → comentário
  `// minimo: <teto>, <quando subir>` (ex.: `# minimo: lock global; locks por conta se o throughput importar`).
- Lógica não trivial (ramo, ciclo, parser, dinheiro, segurança) deixa **uma** verificação executável — a
  mais pequena que falha se a lógica partir (teste ao estilo do projecto, ou `assert` num self-check).
  One-liner trivial não leva teste: YAGNI vale para testes. Suite completa = `escrever-testes`, noutra sessão.
- Tarefa → objetivo verificável: «corrige o bug» = teste que reproduz e passa; «refatoriza» = verde antes e depois.
- Hardware/mundo físico: deixar o botão de calibração — o real nunca é o ideal do papel.

## 7. Forma de saída
No relatório ao caller (subagente): o diff/caminhos e no máximo 3 linhas `feito X; saltei Y, acrescentar quando Z`.
Ao utilizador vale o output style da sessão (dizer o QUE mudou, não o COMO — `soul.md`/output style); esta forma não o substitui.
Explicação mais longa do que o código → cortar a explicação (parágrafo a defender uma simplificação é
complexidade a voltar como prosa). Relatório pedido explicitamente não é dívida — dá-se completo.

## 8. Anti-padrões
| Errado | Certo |
|---|---|
| Dependência para uma função de 3 linhas | Degrau 6: util inline |
| Reimplementar helper que já existe no repo | Degrau 2: `grep` antes de escrever |
| Wrapper próprio sobre stdlib/framework | Usar o nativo direto |
| Generalizar para casos hipotéticos | Resolver o caso real de agora |
| Corrigir só o caminho do ticket | Causa raiz na função partilhada |
| Diff mínimo sem ter lido o fluxo | Ler primeiro, simplificar depois |
| Cortar validação/auth «para simplificar» | Guard-rail: nunca |
| «Melhorar» código adjacente pelo caminho | Só o que o pedido toca |

## 9. Exemplos curtos
- Pediram 3 utilizadores → `users.slice(0, 3)`, não paginação + filtros + cache.
- `npm install lodash.groupby` → `Object.groupBy(items, x => x.cat)`.
- `class SlugMaker {…}` → `Str::slug($title)`.
- «Validação depois» → `$request->validate([...])` sempre (guard-rail).

## 10. Checklist antes de escrever código
- [ ] Li a tarefa e o código que ela toca; segui o fluxo real (bug → todos os chamadores).
- [ ] Subi a escada e parei no 1.º degrau que resolve; dependência/abstração nova tem 1 linha de porquê.
- [ ] Nenhum guard-rail cortado (segurança, input, dados, a11y, pedido explícito).
- [ ] Cada linha alterada liga-se ao pedido; nada adjacente «melhorado».
- [ ] Simplificação com teto marcada `minimo:`; lógica não trivial tem 1 verificação executável.
- [ ] Saída (relatório ao caller): `feito X; saltei Y, acrescentar quando Z`.

## 11. Créditos
Escada, regras e guard-rails adaptados de **Ponytail** — [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), licença MIT.
Testes de disciplina de código adaptados de [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills), MIT.
