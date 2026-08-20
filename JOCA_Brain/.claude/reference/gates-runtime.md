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

**Diagnóstico é um passo com gate próprio:** um passo que afirma "X está partido" só produz output
**depois de ler o código de X**, com citação de ficheiro:linha por afirmação. Comparar nomes e
tamanhos de ficheiros não é ler. Um `WORKFLOW.md` commitado antes da leitura trouxe 2 de 3
"regressões" mal diagnosticadas (o failover existia e funcionava; o leak tinha sweeper por TTL) e
mandou o trabalho seguinte para o sítio errado.

**Resolver conflitos é código, não texto:** depois de qualquer merge/porte/`git apply --3way`,
**correr o artefacto**. Um `build-skill-index.py` saiu de um 3-way sem marcadores e sintacticamente
plausível, e rebentava à primeira execução (`match` fora de escopo, constantes perdidas porque hunks
vizinhos foram resolvidos para lados diferentes). Foram precisas 3 execuções para o pôr de pé.
