# Gates de runtime — detalhe (on-demand)

Versão comprimida (auto-carregada) em `.claude/rules/pipelines.md` §Gates. Este ficheiro guarda a tabela de evidência por categoria e os casos reais. `Read()` antes de assinar um gate de fase.

## Gates: estático ≠ runtime

`tsc`/`npm run build`/`php -l` verdes provam que **compila**, não que **funciona**. Dois exemplos
reais: um `<Check>` (lucide) usado em JSX sem import passou o build do Vite e só rebentou quando o
utilizador abriu o modal; e uma app inteira foi dada como feita com `tsc`+`build` verdes quando o
`next dev` nem sequer hidratava — nada interactivo, e nenhum gate estático o apanharia.

**Quem escreve o código não assina o gate.** O verificador é outro agente que não o produtor — se o produtor foi o main loop, a verificação delega-se. Ledger em `.joca/loop.json` (`produtor`/`verificador`), imposto pelo `stop-continuar.js`.

**Gate estático (mínimo, sempre):** `tsc --noEmit` · `npm run build` · `php -l` · **`eslint`**.
O eslint não é opcional em projectos JS/TS: `react/jsx-no-undef` e `no-undef` são a única coisa que
apanha identificadores de componente indefinidos, que o Vite deixa passar.

**Gate de runtime (obrigatório, não recomendado)** — nenhuma fase que toque nestas categorias fecha
sem evidência ao vivo:

| Categoria | Evidência mínima |
|---|---|
| Navegação · header · overlay · modal | `document.elementFromPoint(cx,cy)` no centro de cada link/botão, em carga limpa (`goto` fresco). Auditar `href` **não é** testar o clique — este bug chegou ao utilizador em duas sessões seguidas |
| Mobile / responsivo | sangramento horizontal medido por `getBoundingClientRect().right` vs `innerWidth` por elemento de texto. `scrollWidth - clientWidth` dá **0 falso** com `overflow-x:clip\|hidden` num ancestral — escondeu um defeito real durante 5 auditorias |
| Auth · sessão | login completo end-to-end, não só o 200 da página de login (uma BD com 0 users devolve `/admin/login → 200` na mesma) |
| Playback · media · streaming | reproduzir e observar; o ciclo de vida de streams não se prova a compilar |
| Deploy | dependências derivadas do **HTML publicado**, não da lista do que foi enviado (ver pipeline Deploy) |

## O gate como artefacto — `gate-runtime.mjs`

A regra acima existia há meses sem código: cada projecto frontend reescrevia ~250 linhas do zero, e cada reescrita perdia uma das armadilhas. Numa sessão, `tsc`+`eslint`+`build` estavam verdes enquanto 9 controlos não tinham nome acessível, 3 rotas rolavam na horizontal e a paginação empurrava a página para fora do ecrã.

```bash
node .claude/scripts/gate-runtime.mjs --base http://localhost:3000 --rotas /,/precos,/sobre
node .claude/scripts/gate-runtime.mjs --config gate-runtime.json --clicar "header button,[data-testid=menu]"
```

| Flag | Efeito |
|---|---|
| `--base <url>` | obrigatório (ou `base` no `--config`) |
| `--rotas a,b,c` | default `/` |
| `--temas a,b` | escreve `data-theme` no `<html>` e repete a matriz |
| `--viewports WxH,…` | default `1440x900,390x844` |
| `--clicar <seletor>` | clica em cada elemento que casa e conta erros novos |
| `--out <pasta>` | default `./.joca/gate-runtime` (relatório JSON + screenshots) |
| `--esperar <ms>` | espera após carga, antes de medir (default 500) |

Mede: contraste do texto contra o pixel **pintado** (alpha composto sobre os ancestrais; fundo com gradiente/imagem é assinalado como *não medível*, não adivinhado) · `document.elementFromPoint` no centro de cada alvo interactivo · sangramento por `getBoundingClientRect().right` **descartando** ancestrais com `overflow-x: auto|scroll|hidden|clip` · alvos <24 px · botões sem nome acessível (`label[for]` **não** nomeia um `<button>` — armadilha transversal a Radix/shadcn/Headless) · erros de consola e `pageerror` · HTTP >= 400. Sai com 1 se alguma combinação tiver problema.

⚠ **Sem `--clicar` mede o estado de REPOUSO.** Um gate que nunca interage é um gate de layout: quatro sobreposições publicadas não abriam e matavam a árvore React da página, e o gate dava a rota como limpa. Alvos cujo centro cai fora do viewport não são medidos — o resumo di-lo em vez de os dar por bons.

Playwright: resolvido em runtime (dependência do projecto → `npm root -g` → `PLAYWRIGHT_PATH`), e se não houver binário descarregado usa o Chrome instalado (`CHROME_BIN`). Nunca um caminho cravado — um gate que não arranca é um gate que não existe.

**Diagnóstico é um passo com gate próprio:** um passo que afirma "X está partido" só produz output
**depois de ler o código de X**, com citação de ficheiro:linha por afirmação. Comparar nomes e
tamanhos de ficheiros não é ler. Um `WORKFLOW.md` commitado antes da leitura trouxe 2 de 3
"regressões" mal diagnosticadas (o failover existia e funcionava; o leak tinha sweeper por TTL) e
mandou o trabalho seguinte para o sítio errado.

**Resolver conflitos é código, não texto:** depois de qualquer merge/porte/`git apply --3way`,
**correr o artefacto**. Um `build-skill-index.py` saiu de um 3-way sem marcadores e sintacticamente
plausível, e rebentava à primeira execução (`match` fora de escopo, constantes perdidas porque hunks
vizinhos foram resolvidos para lados diferentes). Foram precisas 3 execuções para o pôr de pé.
