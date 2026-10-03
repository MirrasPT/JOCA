# Doutrina de projecto — detalhe (on-demand)

Versão comprimida (auto-carregada) em `.claude/rules/pipelines.md` §Doutrina de projecto. Este ficheiro guarda a tabela completa e os porquês. `Read()` quando arrancas/adoptas um projecto ou quando a versão curta não chega.

## Conteúdo

- Doutrina de projecto — vale SEMPRE, com ou sem `/start`
- Acrescentos de 2026-09-15 (saíram de `rules/pipelines.md` ou vieram do feedback)
  - Recon antes de autorar — casos
  - `escrever-testes` em sessão separada — porquê
- Texto retirado de `rules/pipelines.md` — corte de tokens (2026-09-15)
  - Doutrina de projecto (linhas da tabela, forma longa)
  - Gates (forma longa)
  - Auto-runner e princípios (forma longa)
  - Ligações que estavam na rule

## Doutrina de projecto — vale SEMPRE, com ou sem `/start`

A forma de trabalho do `/start`/`executar-projeto` é o **modo por omissão de qualquer projecto** —
novo, herdado ou a meio. O `/start` é a porta que a instala de raiz; a ausência dele não a dispensa.

Unidade de trabalho = **issue**. Gate = **GitHub Actions**. Estado partilhado = **`PROGRESSO.md`**.

| Momento | Acção |
|---|---|
| **1ª sessão num projecto sem `PROGRESSO.md`** | Levantamento do disco (`pwd`/`ls`/git/manifestos/`memory/projects/`) → cria `PROGRESSO.md` (formato: `.claude/reference/start/progresso-formato.md`) com o estado **observado** + memória do Brain. Não abras a entrevista completa por tua iniciativa — isso é o `/start`; aqui é uma pergunta só: "o que fazemos a seguir?" |
| Trabalho novo (ideia, bug, ecrã) | `novo-issue` **antes** de código; nada de implementar direto do chat. Sem "Ficheiros prováveis" o issue não está pronto — é o que decide o paralelismo |
| Ecrã/UI que ainda não existe | `preparar-design` (Artifact) → `validar-design` (porteiro) → só então implementar. Desenhar durante a implementação é o que produz o ecrã que destoa |
| ≥3 issues abertos sem plano | `planear-ondas` (milestones + `blocked-by` + `docs/ONDAS.md`) |
| ≥2 issues a implementar | **loop de onda**: implementar (agentes de domínio, paralelo só com "Ficheiros prováveis" disjuntos) → `escrever-testes` **noutra sessão** → `tester-code` → PR `Closes #N` → varredura transversal → gate de runtime → portão humano |
| Decisão técnica tomada (stack, schema, fora-da-casa) | 1 entrada em `docs/DECISIONS.md` — cria o ficheiro se não existir. Decisão sem registo repete-se |
| Gates (lint · testes · build) | correm em **Actions** (skill `github`); à mão só como pré-verificação local |
| Repo sem `.github/workflows/` | criar o CI (`github`) antes de fechar a onda seguinte — gate por convenção não é gate |
| Fecho | `/ship` → PR; o issue fecha pelo PR (`Closes #N`), não à mão |
| Fim de sessão | `PROGRESSO.md` actualizado e **commitado** com o trabalho (`/save` faz o resto) |

**O que NÃO se globaliza:** a entrevista das Fases 1-5, a página de direcções de design, o scaffold
E1 (criar repo/CI/hooks/templates) e o ponto de situação E3 são de **arranque** — só correm no
`/start`/`executar-projeto`. Num projecto a meio, o que já existe **não se recria**: adopta-se.

**⚠ Não inventar documentos.** `docs/PRD.md` só se cria a pedido ou pelo `/start`. `PROGRESSO.md` e
`docs/DECISIONS.md` criam-se quando o trabalho os exige (acima) — os restantes, não.

Projecto novo já traz isto na E1 do `executar-projeto` (passos 7-10). CI verde **não** substitui o
gate de runtime abaixo: prova que compila e que os testes passam, não que funciona.

---

## Acrescentos de 2026-09-15 (saíram de `rules/pipelines.md` ou vieram do feedback)

| Situação | Acção |
|---|---|
| **Backlog com mais de uma sessão de idade** a entrar numa vaga | **medir o estado real como 1.ª fase** do próprio workflow, com critério de prova: só conta como feito quem mostrar **quem chama a peça**, enumerado em runtime — nunca por `grep` de definições. Oito issues «por começar» estavam feitos (projecto interno, 2026-08-25) |
| Issue com **números medidos** (px, %, contagens, tempos) | é perecível: **remedir antes de implementar**. No `novo-issue`, cada número entra com a data e o comando que o produziu. Um issue diz onde olhar, não o que é verdade hoje — o #12 de um projecto de cliente pedia esconder uma barra que já desaparecia (150px medidos → 54px um dia depois) |
| **Repo de terceiro** (o `PROGRESSO.md` é do dono) | não se toca; o estado do trabalho vive no **corpo do PR**, o canal que o dono lê |
| **Documento de estado** (`PROGRESSO.md`, `✅ CORRIGIDO`, pré-requisitos) | actualiza-se no **fim da vaga**, com o artefacto já no sítio — um `✅` escrito a meio descreve intenção, não estado. Afirmação obsoleta encontrada → `git log -S"<frase>" -- <ficheiro>` diz em que commit morreu |
| **Projecto sem repo** | o plano vive em `docs/` na pasta do projecto; o **1.º item** do plano é criar o repo |

### Recon antes de autorar — casos

- Varredura que ignora um `directorio*` declarado na ficha do projecto é palpite, não inventário (saído da rule, F8.3).
- Dois workflows foram autorados sobre premissa errada («implementar ifthenpay e Moloni» quando
  `IfthenpayService`/`MoloniService` já existiam); 3 greps desfizeram-na. A fase de recon paga-se em
  agentes, o grep custa 3 chamadas.
- Recon vale também antes de **implementar uma funcionalidade pedida**, não só antes de autorar um
  workflow: uma acção de ajuste de stock foi construída do zero quando já existia
  (`ManualStockAdjustmentAction`, com testes) — o único rasto estava num teste. Uma capacidade que já
  existe costuma deixar rasto primeiro em `tests/` (projecto de cliente, 2026-08-25).
- Num monorepo, o recon de dependências olhou 3 de N `package.json`: enumerar primeiro com
  `find . -name package.json -not -path '*/node_modules/*'`, depois ler cada um.
- **Pergunta de acesso/existência** («tens acesso/ligação a X?», «tens o repo?») → ler
  `memory/projects/<x>/index.md` (`directorio*` + «Última sessão») **antes** de qualquer sonda; sondas de
  existência = um `test -e "<caminho>"` por linha, nunca globs juntos (no zsh um glob sem match aborta a
  linha inteira). Duas afirmações falsas ao utilizador saíram de um `ls` com glob, com a resposta já na
  ficha (projecto de cliente, 2026-09-25).

### `escrever-testes` em sessão separada — porquê

Testes escritos a seguir ao código verificam o código, não o requisito: passam sempre e não provam
nada. Se a mesma sessão fizer as duas coisas, a rede de segurança é uma ilusão e o CI verde confirma-a.

**Mudanças triviais pedidas a meio** (renomear um rótulo, um texto de resumo) não têm via curta para a
sessão separada, e o teste ficava esquecido para a revisão seguinte (2026-09-27). Regra: acumulam-se
numa lista, e o **verificador da entrega seguinte escreve os testes das mudanças triviais acumuladas** —
dito explicitamente no brief dele, com a lista. Continua a não ser a sessão que implementou.

---

## Texto retirado de `rules/pipelines.md` — corte de tokens (2026-09-15)

### Doutrina de projecto (linhas da tabela, forma longa)
- A doutrina é o modo por omissão de **qualquer** projecto; o `/start` instala-a, a ausência dele não a dispensa.
- **Plano com N passos** (qualquer plano: auditoria, refactor, onda, correcção) → N issues no GitHub, agrupados por milestone. O plano vive no repo, não no chat — o que fica só na conversa morre com a sessão.
- **Problema encontrado** (bug, dívida, achado de auditoria, TODO deixado) → abre issue na hora, mesmo que não se corrija agora. Relatar sem abrir issue é perder o achado.

### Gates (forma longa)
- `tsc`/`npm run build`/`php -l` verdes provam que compila, não que funciona: uma app inteira foi dada como feita com os dois verdes quando o `next dev` nem sequer hidratava.
- Quem escreve o código não assina o gate — se o produtor foi o main loop, a verificação delega-se. Ledger em `.joca/loop/<session_id>.json`, imposto pelo `stop-continuar.js`.
- Vários PRs sem CI: a verificação seguinte parte da main nova.
- O eslint não é opcional em JS/TS: é o único que apanha componente indefinido em JSX (`jsx-no-undef`).
- Runtime: navegação/overlay/modal = `document.elementFromPoint` **no centro**, em carga limpa — auditar `href` não é testar o clique · mobile: `hidden|clip` é corte silencioso, é o defeito — e por isso `scrollWidth-clientWidth` dá **0 falso** · auth: login end-to-end, não o 200 da página de login — `--login <f.json>` no gate · despublicado: pedir os ficheiros — imagens/PDFs — por URL directo e sem sessão; a página fora do índice não prova nada · media: reproduzir e observar.
- `gate-runtime.mjs` mede contraste sobre o pixel pintado, `elementFromPoint`, sangramento com filtro de scrollers, nome acessível, erros de consola e HTTP >=400. Sem `--clicar` mede só o repouso — overlays e modais exigem accionar o gatilho. Opcionais: `--medir barra,icones,transbordo,canvas` · `--classes diff` (classe escrita que não existe no CSS).
- Índice do `gates-runtime.md` que estava na rule: tabela de evidência mínima por categoria (~20: página nova, imagem reutilizada, navegação/overlay, hover, mobile, auth, painel admin, percepção, media, preço, BD com motor diferente, correcção de classe, estado externo, recorte, porte para app viva, rota removida, calendário, alvos de toque, fabrico, deploy), as flags do `gate-runtime.mjs`, e os casos — «Silêncio não é aprovação» · «um gate que nunca falhou é um gate por testar» · «POR VERIFICAR é estado» · «verde não prova que a coisa foi feita» · «build verde não prova que nada se perdeu» · «suite vermelha depois de um fix» · «workflow falhado ≠ nada aconteceu» · diagnóstico com ficheiro:linha · resolver conflitos é código · guarda antes da operação destrutiva.

### Auto-runner e princípios (forma longa)
- Passo 3: auto-decide as intermédias reversíveis (soul.md autonomy 0.95); irreversível (deploy/push/migration/delete/payment/auth) → gate de 1 linha, em `AskUserQuestion` (formato de qualquer decisão avançar/não-avançar).
- Passo 4: travão = profundidade ≤ `loop_max_iterations` (4); 3x sem progresso → parar e reportar. O runner é **steward, não initiator** (`orchestration-patterns.md`).
- Perguntar "queres que eu corra a pipeline X?" gasta a decisão do utilizador numa coisa já decidida pela regra.
- Princípios: 1. decisão activa do Brain — se já foi decidido, segue · 2. convenção do projecto (CLAUDE.md do projecto, código existente, padrões à volta) · 3. default da skill do passo (a skill especializada manda).
- Catálogo: cada pipeline = sequência de passos + gates.

### Ligações que estavam na rule
- `rules/task-intake.md` — classifica a via; via D dispara o runner. `rules/chaining.md` — encadeamento passo-a-passo (`chain:`). `rules/orchestration-patterns.md` — fan-out, cap 3-5, agentes-escrevem-disco, steward.
- `.claude/reference/gates-runtime.md` · `.claude/reference/orquestracao-casos.md` · `.claude/reference/doutrina-projecto.md` (on-demand).
- `.claude/reference/master-orchestrator.md` — playbook de fan-out do runner. `.claude/commands/autoplan.md`, `/goal`, `/one-shot` — entradas que correm pipelines.
