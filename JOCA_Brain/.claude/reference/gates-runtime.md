# Gates de runtime — detalhe (on-demand)

Versão comprimida (auto-carregada) em `.claude/rules/pipelines.md` §Gates. Este ficheiro guarda a tabela de evidência por categoria e os casos reais. `Read()` antes de assinar um gate de fase.

## Conteúdo

- Gates: estático ≠ runtime
- Pré-condição de UI: «consigo ver este ecrã?»
- Tabela de evidência por categoria
- O gate como artefacto — `gate-runtime.mjs`
- Casos e princípios

## Gates: estático ≠ runtime

`tsc`/`npm run build`/`php -l` verdes provam que **compila**, não que **funciona**. Dois exemplos
reais: um `<Check>` (lucide) usado em JSX sem import passou o build do Vite e só rebentou quando o
utilizador abriu o modal; e uma app inteira foi dada como feita com `tsc`+`build` verdes quando o
`next dev` nem sequer hidratava — nada interactivo, e nenhum gate estático o apanharia.

**Quem escreve o código não assina o gate.** O verificador é outro agente que não o produtor — se o produtor foi o main loop, a verificação delega-se. Ledger em `.joca/loop/<session_id>.json` (`produtor`/`verificador`; o id é anunciado no arranque pela linha `[sessao]`), imposto pelo `stop-continuar.js`.

**Gate estático (mínimo, sempre):** `tsc --noEmit` · `npm run build` · `php -l` · **`eslint`**.
O eslint não é opcional em projectos JS/TS: `react/jsx-no-undef` e `no-undef` são a única coisa que
apanha identificadores de componente indefinidos, que o Vite deixa passar.
**O verde só cobre o que o config inclui:** ler `include`/`exclude` do `tsconfig` e `ignorePatterns`
do eslint antes de acreditar nele — um `tsconfig` sem `tests/` deu verde sobre testes que nunca foram
verificados. **Byte NUL num ficheiro de código** passa `tsc`/`eslint`/CI e cega o `grep -r` (que o
trata como binário e salta): `file -b` aos ficheiros staged; `data` em vez de `… text` = parar.

## Pré-condição de UI: «consigo ver este ecrã?»

**Pré-condição bloqueante, não passo final: antes da 1.ª linha de UI (redesenho, correcção visual,
variantes), responder «consigo ver este ecrã a correr?».** Se não:

| Obstáculo | Primeira tarefa da vaga |
|---|---|
| Ecrã atrás de login | resolver a observação **antes** de escrever: o utilizador entra e a sessão passa ao gate (`--estado` / `--login`), ou constrói-se o ecrã num sítio sem auth (showcase do design system, mockup HTML servido localmente) |
| Chrome MCP (`claude-in-chrome`) | **não herda a sessão** do browser do utilizador: o separador que controla redirige para `/login` (testado 2026-09-05). «O utilizador tem sessão aberta» não dá acesso ao modelo |
| Sem via nenhuma | pedir uma captura ao utilizador **antes** da 1.ª ronda, e dizê-lo — nunca escrever componentes com a promessa de verificar depois |

Caso: um dia de UI de um painel atrás de login foi produzido sem ninguém ver o produto, rejeitado três
vezes e **apagado** (22 commits + um PR). A captura que o utilizador mandou a meio resolveu em segundos
o que três rondas de suposição não resolveram; o showcase sem login (`:3100`) foi onde se mediu o
desalinhamento real de 4 px.

### Gate atrás de autenticação — o «como» do acesso

A `pipelines.md` §Gates manda resolver o acesso **antes** da 1.ª linha; isto é o procedimento.

1. **Conta ou perfil temporário para o gate**, nunca o perfil do utilizador: os perfis reais trazem PIN,
   2FA e estado que o gate altera sem querer (numa sessão, os dois perfis de produção tinham PIN e a
   app pedia ainda palavra-passe global — o procedimento estava na ficha do servidor, não onde se
   decide correr o gate). Criar um utilizador só para a corrida, com o papel mínimo, e nomeá-lo no
   relatório.
2. **A credencial entra por variável de ambiente, nunca literal no comando nem no chat.** Transporte,
   inspecção por lista branca e rotação têm doutrina própria em
   `.claude/skills/credential-handling.md` — o valor não passa pelo modelo e não se repete, nem em
   relatório de agente. O ficheiro que o `--login` consome gera-se a partir do ambiente, com o valor
   **fora do `argv`** (o `ps` lê argumentos; `--arg` expõe-nos, `$ENV.<NOME>` não):

   ```bash
   mkdir -p .joca/gate-runtime            # a pasta só nasce quando o gate corre
   jq -n --arg u "$APP_USER" \
     '{url:"/login",campos:{"#email":$u,"#password":$ENV.APP_PASSWORD},submeter:"button[type=submit]"}' \
     > .joca/gate-runtime/login.json
   node .claude/scripts/gate-runtime.mjs --base <url> --login .joca/gate-runtime/login.json
   ```

   Confirmar que o destino não entra no git antes de escrever lá: `git check-ignore -v <ficheiro>` tem
   de acertar (o `--out` default vive em `.joca/`, já ignorado).
3. **Limpeza obrigatória no fim, mesmo com o gate vermelho:** `rm -f` do ficheiro de `--login` **e** do
   `estado-login.json` que o gate grava na pasta `--out`, conta temporária apagada, variável fora do
   ambiente. Uma sessão fabricada em ficheiro é uma credencial viva; deixá-la no disco é o mesmo que
   deixar a password num `.env` por commitar.
4. **Correr sempre contra uma CÓPIA da base de dados**, salvo quando o alvo é mesmo produção (deploy,
   despublicado, health-check do que está no ar). Um gate autenticado **escreve**: sessões, últimos
   acessos, contadores, e-mails de notificação. Quando tem de ser produção, diz-se no relatório e
   limita-se a leituras.

O acesso prova-se pelo **URL final** depois do login, não pelo status (ver «Auth · sessão»): um
`--estado` caducado devolve a página de login com 200, e é por isso que o gate compara o URL final
em vez do status — acusa `SESSÃO PERDIDA: --estado levou a <url>` (`gate-runtime.mjs:1118`, relatado
em `:1268`). A armadilha é ler o 200 à mão, ou usar um gate próprio que não faça esta comparação.

## Tabela de evidência por categoria

**Gate de runtime (obrigatório, não recomendado)** — nenhuma fase que toque nestas categorias fecha
sem evidência ao vivo:

| Categoria | Evidência mínima |
|---|---|
| Página · vista nova | screenshot renderizado + contraste texto/fundo medido **contra o que é PINTADO, não contra o token** — gradiente exige as duas pontas (pior caso), alpha exige compor sobre o fundo real. HTTP 200, texto no DOM e `node --check` não provam legibilidade — duas páginas passaram tudo isso com texto creme sobre fundo branco e tags HTML em cru. **O screenshot só vale com o separador ACTIVO** (`document.visibilityState === 'visible'`): num separador em segundo plano o browser suspende `requestAnimationFrame` e as animações ficam no estado inicial — elementos que entram com `opacity: 0` são capturados invisíveis e lêem-se como defeito de render que não existe |
| Imagem · asset reutilizado em contexto novo | olhar para o **pixel** (Read/screenshot): marcas de terceiros, texto embutido, paleta. O ficheiro existir não é prova. **Comparar duas imagens de tamanhos diferentes a olho não é medição:** estimar a transformação entre elas (pontos-chave SIFT/ORB + RANSAC, `cv2.estimateAffinePartial2D`) e ler escala/rotação/translação — «parece o mesmo enquadramento» esconde um crop ou um reescalamento de 8%. **Cliente com histórico:** abrir as entregas já publicadas (`_ref_*/`, `_Final/` de meses anteriores) e confirmar que o asset não repete uma entrega. **Consumidor conhecido:** rácio, resolução e formato derivam-se do **código que renderiza** (`aspect-[4/5]` + `object-cover` num card), não do que a fonte tem — um 3:4 passa todos os gates e o browser corta onde calhar |
| Alteração global a um pipeline de imagens (build, achatar RGBA, compressão, recorte) | re-verificar **cada classe de imagem** que o passo toca, não a página inteira: o **logótipo** (PNG transparente) recortado e a **2x** (`--force-device-scale-factor=2`) — achatar RGBA sobre a cor mediana aplicado a todas as imagens transformou um logo em blocos de cor, e o screenshot da página a 1x não o mostrava |
| Ícone · favicon · app icon | rasterizar e olhar no **tamanho de consumo** (16 e 32 px; ícone de app no tamanho do launcher), não só no tamanho de produção — detalhe que se lê a 512 px é mancha a 16 |
| Tipografia própria (`@font-face` · webfont) | `document.fonts` com a família em `status === 'loaded'` (e `document.fonts.check('16px "<família>"')`), nunca largura do texto vs fallback nem «parece a fonte certa» num screenshot |
| Navegação · header · overlay · modal | `document.elementFromPoint(cx,cy)` no centro de cada link/botão, em carga limpa (`goto` fresco). Auditar `href` **não é** testar o clique — este bug chegou ao utilizador em duas sessões seguidas. **Dispensar o overlay de consentimento ANTES de medir** — uma loja que vende na UE carrega com o banner por cima e dá 18 alvos "tapados" que não têm defeito nenhum. Nunca pelo primeiro botão, que num CMP costuma ser «gerir preferências» e abre um SEGUNDO overlay; se não se conseguir fechar, reportar `bloqueado por <seletor>` — um overlay por dispensar é **um** defeito, não N. **Simular o consentimento por storage/cookie só com a chave REAL:** `grep` à chave no JS de cookies do projecto antes de a escrever — uma chave inventada (`st_consent` em vez de `st_cookies`) deixou o banner em todas as capturas e propagou-se a scripts copiados por agentes (projecto de cliente, 2026-09-29) |
| Texto tapado por sobreposição | **linha a linha** (`TreeWalker` sobre os nós de texto + `Range.getClientRects()`, 3 pontos à meia altura de cada linha), nunca pelo rect do bloco: o centro de um parágrafo de 3 linhas cai **entre** linhas e uma sobreposição de 42 px escapa-lhe. Só conta occluder **posicionado** (`absolute\|fixed\|sticky`), senão irmãos na mesma linha dão ruído. Três exclusões obrigatórias — sem elas o check passa o controlo negativo e não vale nada: invisível (`checkVisibility` — um carrossel devolve rects para os slides inactivos), só-para-leitor-de-ecrã (rect ≤2 px, o padrão `1×1 + clip-path`) e o overlay de dev do Next (`nextjs-portal`), que não existe em produção |
| Hover · transform · zoom por coordenadas | `document.elementFromPoint` no ponto exacto **depois do último reload**, antes de ler qualquer estilo calculado — o layout reordena e um `transform: none` medido 13px ao lado do ícone prova o contrário do que parece. Mesmo modo de falha da linha acima, sem ser um clique. **`:hover` num elemento escondido ou fora de alcance:** forçar o estado por CDP (`CSS.forcePseudoState`), não por interacção — o Playwright recusa alvos escondidos e a medição silencia-se em vez de falhar (verificado 2026-09-03) |
| Mobile / responsivo | sangramento horizontal medido por `getBoundingClientRect().right` vs `innerWidth` por elemento de texto, descartando **só** os que têm ancestral com `overflow-x: auto\|scroll` — carris que o utilizador arrasta (tabs mobile, tabelas), e sem esse filtro deram 15 rotas "com problemas" que não estavam. **`hidden\|clip` NÃO se descarta:** não há barra de scroll, mas o conteúdo está a ser cortado em silêncio, que é o defeito. Descartar os quatro parece prudente e cega o gate por inteiro — num CSS com `main{overflow-x:clip}` (comum) descarta a **página toda** e o gate devolve 0 sempre, o que se lê como aprovação. Pela mesma razão `scrollWidth - clientWidth` dá **0 falso** e não é prova de nada. Antes de aceitar um zero: **controlo negativo** — injectar um elemento a sangrar *dentro de um ancestral com `overflow-x: clip`* e confirmar que o gate o acusa. **O viewport prova-se, não se pede:** o `resize_window` do Chrome MCP reporta sucesso e **não encolhe abaixo de ~1200 px** — viewport mobile só com Playwright (`--viewports`) ou um `iframe` de largura fixa, e a sonda **imprime `innerWidth`** antes de medir. **Banner fixo (cookies, avisos): medir overflow/scroll nos DOIS estados, visível e fechado** — um gate «sem scroll» deu verde porque recusava os cookies antes de medir; ao vivo, com o banner visível (`padding-bottom` no `body`), havia scroll (projecto interno, 2026-09-25) |
| Despublicado · retirado | a página sair do índice não prova nada: os **ficheiros** (imagens, PDFs, anexos) continuam servidos por URL directo. Pedir cada um por URL, **sem sessão** (`curl -sI` de uma janela sem cookies) — 200 = continua publicado |
| Auth · sessão | login completo end-to-end, não só o 200 da página de login (uma BD com 0 users devolve `/admin/login → 200` na mesma). Sessão pré-fabricada (`storageState`) **caduca**: a prova de que ainda vale é o **URL final** depois da navegação, não o status — um `--estado` morto devolve a página de login com 200. O `gate-runtime.mjs` faz essa comparação e acusa `SESSÃO PERDIDA`; um gate escrito à mão que olhe só para o status dá o login por página limpa. **Login local que falha com credenciais certas:** provar a credencial por `curl` à API de login antes de suspeitar do servidor — era o gestor de passwords a preencher outra password, e perdeu-se um ciclo a diagnosticar o servidor (projecto de cliente, 2026-10-01) |
| App com viewport 3D / WebGL / canvas | pode **não ser capturável**: o screenshot sai preto ou com o canvas por pintar, e um preto lê-se como "não renderizou". Nesse caso o gate mede por **parsing** (contar os nós/objectos que deviam existir, ler o estado da cena) e o gate visual **entrega-se ao utilizador com o número esperado** («devias ver 7 peças») — sem o número, "parece bem" não é verificação. Canvas **animado**: (1) `visibilityState` antes de qualquer captura; (2) expor um helper que corre passo + câmara + `renderer.render` **síncrono** e só depois capturar; (3) **nunca `await` de um `requestAnimationFrame` no `javascript_tool`** — com o separador em segundo plano nunca resolve e rebenta o CDP ao fim de 45 s; (4) faixa por pintar → medir `gl.getParameter(gl.VIEWPORT)` contra `drawingBufferWidth/Height` antes de culpar o render. **Texto por cima do canvas:** a cor computada do fundo mente (o gate dava verde sobre partículas) → `--medir canvas` |
| Propriedade com `transition` (cor · anel de foco · opacidade) | medir **depois de a transição acabar**: ver `transition-property`/`transition-duration` do elemento e esperar, ou ler com `transition: none`. Um anel de foco medido no instante zero de `transition-colors` (que inclui `outline-color`) produziu um diagnóstico errado de cascata CSS e uma regra de substituição inútil — até o controlo positivo (cor inline) enganou, porque reiniciou a transição |
| Visibilidade · conteúdo dentro de `<details>` fechado · carrossel | `checkVisibility()` + `elementFromPoint`, **nunca** `getBoundingClientRect` sozinho: o rect de um filho de `<details>` fechado e de um slide inactivo existe e lê-se como visível |
| Classe utilitária nova (Tailwind v4 · tokens · classes de design system) | provar que a classe **existe no CSS gerado**: `--classes diff` (ou a lista). Medir a **string exacta** do código — o v4 só gera o que encontra escrito, e `border-warning-ink` em vez de `border-warning-ink/30` dá falso veredicto. Antes de concluir «inerte», `grep style="` no alvo: o inline ganha à classe e faz **tudo** parecer inerte. Controlo negativo com a forma do alvo (classe inventada tem de dar inerte). Caso: `text-3xs` em 12 ficheiros, renderizava a 14 px, passou `tsc`+`eslint`+`next build`, e reincidiu no mesmo repo |
| Processos filhos · CLIs externos (spawn · node-pty · agentes) | só se dá por feito com **1 arranque real por CLI por plataforma suportada**. Adaptadores/CLIs falsos provam o contrato, não o arranque: ~260 testes verdes não viram que nenhum agente arrancava no Windows (diálogo de confiança, binário errado em `node_modules/.bin`, winpty sem bracketed paste) |
| Painel de admin (Filament · Livewire · Nova) | submeter o login e confirmar que `window.Livewire` inicializa; renderizar o formulário **não** é prova. Pós-deploy, verificar o `content-type` dos assets JS servidos, não só o status — um painel esteve inutilizável um dia inteiro com 200 + screenshot do formulário. **O `src` do script deriva-se do HTML servido** (`/admin/login`), nunca se assume: sondar `/livewire/livewire.min.js` quando produção serve outro caminho dá falso negativo |
| Percepção · tempo até visível | medir `opacity`/visibilidade dos itens de uma lista N s após carga limpa, com N realista (2 s) — um smoke-test que espera pelo fim das animações passa sempre (grelha com stagger 0.07 × 140 demorava 9,75 s a revelar). **Quem escreve o código não assina o gate de runtime** |
| Playback · media · streaming | reproduzir e observar; o ciclo de vida de streams não se prova a compilar. **Resolução temporal:** sintoma de aparecer-e-desaparecer amostra-se a **≤250 ms** — amostras de 2 em 2 s deram «nunca abriu» a um leitor que montou aos 612 ms e fechou antes da 1.ª amostra |
| Vídeo renderizado (MP4 · export de composição) | extrair fotogramas **à volta de cada corte e de cada acento** e medir a luminância — um pico ou vale isolado é defeito, não estilo. O contact sheet amostra pontos, não fronteiras: não mostra cena a entrar vazia nem mergulho de luz no corte |
| Voz · TTS · narração gerada | transcrever o áudio e comparar **com o guião**, palavra a palavra, **antes** de o usar a jusante; duração ÷ nº de palavras fora de 130-170 wpm é sinal de que o modelo leu o que não devia — um TTS saiu com 14 s de instrução dita em voz alta e só se apanhou por a duração não bater com a contagem |
| Preço · checkout · facturação · documento fiscal | ler o valor **no ecrã** e compará-lo com o que a API devolve e com o que o texto ao lado promete; um preço certo com rótulo errado é defeito (campanha de 3 meses descontou 12 num pagamento anual, com `tsc`+eslint+build+973 testes verdes). **Documento fiscal** (factura, recibo, nota de crédito) confere-se **ao cêntimo** num rascunho real emitido pelo sistema — base, IVA, total e arredondamentos linha a linha —, não pelo cálculo no código. **Antes de uma compra de teste, checklist de pré-condições:** métodos de envio (`shipping_methods`) e de pagamento (`payment_methods`) activos, `MAIL_MAILER` configurado, e as filas que o worker ouve contra o `onQueue` do código — três destas só se descobriram a meio do fluxo em staging (projecto de cliente, 2026-10-01) |
| Ambiente de teste ≠ produção (motor de BD · locale · fuso horário) — antes «BD com motor diferente» | correr contra o que produção tem: migrations+seeders no motor de **produção** antes do deploy; 1053 testes verdes em SQLite não provam nada sobre MySQL (`VARCHAR`, modo estrito, tipos de data, `ONLY_FULL_GROUP_BY` — a seed rebentou com `SQLSTATE[22001]` no servidor). O mesmo para **locale** (formato de número/data, ordenação) e **timezone** (datas à meia-noite, `now()` do servidor): o ambiente de teste em UTC/`en` esconde o que produção em `Europe/Lisbon`/`pt` mostra. Ao corrigir um caso, varrer o schema inteiro pela mesma classe. **Migração que mexe em índices/FK/tipos:** ciclo `up → down → up` contra o motor de produção — o `down` é o que parte (FK que depende do índice que se larga) |
| Mudança de enum · vocabulário de estados | contagem **por valor** num ambiente **com dados** (`SELECT estado, COUNT(*) … GROUP BY estado`) antes e depois; uma BD local vazia valida qualquer mapeamento. Valor antigo com contagem >0 depois da migração = linhas órfãs |
| Correcção de classe — gatilho **estrutural**, não temático (formato · unidade · chave · protocolo · schema partilhado; e também auth · dinheiro · estado) | `grep` pelos **outros** produtores do mesmo efeito e testar cada um. O gatilho é «isto é produzido/consumido em mais do que um sítio?», não «isto é sensível?» — restringir a lista a auth/dinheiro/estado deixa de fora os casos mais comuns (i18n, allowlists, regras de validação, serialização). E correr a **suite INTEIRA**, não só o ficheiro que se sabe afectado: quem escolhe o subconjunto de testes já assumiu onde está o defeito — um bug fechado numa porta costuma estar aberto noutra (um gate deu "PASSA" a um furo explorável: mediu as invariantes do brief e não perguntou que outro endpoint chega ao mesmo estado) |
| Estado externo lido pela UI (privacidade de conta · permissões · quotas) | confirmar na **API/log** que alimenta o widget. Uma UI que degrada em silêncio serve um fallback estático e continua plausível — um dropdown deu uma conta TikTok como pública quando o `laravel.log` tinha o 400 da chamada que o alimentava, e a conclusão errada chegou ao utilizador |
| Filtro de conteúdo · permissões · perfil restrito (próprio ou de API de terceiros) | recolher os **ids realmente renderizados** em todas as rotas com o perfil restrito (e os N primeiros resultados reais de uma API que promete filtrar) e cruzá-los com a regra; repetir num perfil **sem filtro** como controlo positivo. Testes unitários e 3 agentes produtores deram por fechado um filtro com 2 buracos; um filtro adulto de API de terceiros não cobria o que prometia |
| Recorte · crop · remoção de banda | localizar o corte por um **elemento identificável** (botão, ícone, texto de cor única), nunca por limiar de cor — o fundo creme de uma app foi confundido com a faixa a remover e perdeu-se a montagem inteira. Verificar **olhando o frame resultante**, não a aritmética do crop |
| Alteração portada para app auto-hospedada em execução | distinguir o que é servido da **FONTE** (dev server/HMR: vale já) do que é servido de um **BUILD** (`dist/`: só depois de restart), e provar o backend com um **pedido real ao endpoint**, não com o build verde. Restart que mata o próprio terminal do agente = gate para o dono, nunca auto-decidido |
| Rota · endpoint · subsistema REMOVIDO | provar que o caminho antigo **já não responde** — e distinguir 404 real de **fallback da SPA** (que devolve 200 com HTML). O sinal é o `content-type`: `application/json` = rota viva, `text/html` = caiu no fallback. Remover o código e não verificar deixa rota fantasma servida por build antigo (`dist/` não se limpa sozinho: `rm -rf dist` antes do build) |
| Calendário · data recorrente · agendamento | correr contra uma data **real futura**, não a de hoje: fim de mês, ano bissexto, mudança de hora, semana que atravessa meses. Um agendador que funciona a 20 de Agosto pode partir a 31 |
| Alvos de toque · componente em estado ABERTO | medir o alvo com o componente **accionado**, não em repouso — um item de menu com 44 px fechado pode cair para 18 px dentro do overlay aberto |
| Fabrico · impressão 3D · print | ler o **perfil dentro do ficheiro de projecto** (3MF/PDF) e confirmar que o check estava LIGADO antes de ler a ausência de aviso como aprovação (ver «Silêncio não é aprovação»). O gate final é o **objecto na mão**; quando a peça impressa contradiz o modelo (encaixe folga), a resposta é um **provete** que meça a tolerância real da máquina, não um valor novo escolhido a olho. **Relevo · bandas · camadas:** um gate de silhueta não vê profundidade — além da silhueta, verificar a **ordem das bandas** de cada elemento contra a referência e olhar o **render em luz real**: um laço batia a referência ao pixel e lia-se como buraco na barriga por estar na banda errada; nenhum IoU ou contagem de pixéis o apanhava |
| Jogo com movimento · nível | «compila» e testes de colisão verdes ≠ **jogável**: um **jogador automático** (andar em frente + saltar na berma) prova que o nível é **completável** e que **não há atalho** que salte a mecânica central. Um nível passou 8/8 testes de colisão com arco de salto de 9 unidades contra plataformas de 4 — impossível de completar |
| Ordem · momento («X acontece ANTES de Y») | o teste tem de **segurar a resposta pendente** — um duplo/mock que resolve de imediato torna o antes e o depois indistinguíveis e o teste passa nos dois sentidos, incluindo com a ordem invertida. Segurar com uma promessa que só o teste resolve (deferred) e afirmar sobre o estado observado **enquanto** está pendente. Um teste de ordem que passa com o código certo E com o código trocado não é um teste |
| Alteração de CSS sem efeito visível | antes de repetir o ajuste com um valor maior, `grep` por `style="` (o inline vence a folha) e confirmar a ordem da cascata/especificidade sobre o elemento real (`getComputedStyle` + o painel de regras). Subir o valor três vezes esconde que a regra nunca chega a aplicar-se — o sintoma de «não fez nada» é o mesmo de «foi sobreposta» |
| Artefacto derivado de outro artefacto gerado (build · export · render · índice) | provar a **FRESCURA**, não a presença: `mtime` do derivado posterior ao da fonte (`stat -f '%m %N' <f>` no macOS, `stat -c '%Y %n'` no Linux), ou hash/marcador embutido na corrida. Um ficheiro com o nome certo e o conteúdo da corrida anterior lê-se exactamente como sucesso. Ao pedir o asset servido, usar o URL **exacto que o HTML declara** — um caminho sem a barra inicial devolve a página de erro e o `grep` dá 0, que parece build falhado. **Binário escrito por processo externo** (gerador de imagem, render, export): olhar só com `mtime` **e** tamanho iguais em **duas leituras** seguidas — um PNG apareceu no `ls` a 896×1200 e minutos depois o mesmo nome era outra imagem a 1080×1350; a verificação visual tinha sido feita sobre a versão intermédia |
| Derivação por template · replace sobre uma base real | listar **todos os campos com o valor da base** e afirmar que **nenhum sobrevive** no derivado (`grep` de cada valor da base no output = vazio). Texto fixo herdado (uma palavra de rodapé) passou sem assert e chegou ao cliente |
| Excepção por-item num processo recorrente (mensal · por lote) | a chave da excepção é **estável entre ciclos** (nome de ficheiro, id, slug)? Então sobrevive ao ciclo que a justificou e aplica-se em silêncio ao seguinte (`Marca_01_Post.png` existe todos os meses). Reconfirmar a condição no início de cada ciclo, ou derivar a excepção por **medição** (luminância do topo) em vez de a indexar por nome |
| Sincronização de deploy · «o código novo já está servido?» | pedir o asset pelo **URL versionado tirado do HTML servido** (`?v=`/hash): um poll ao URL sem versão lê a cache (Shopify). O marcador de sincronização prova-se **ausente na versão anterior** (`git show HEAD~1:<ficheiro> \| grep <marcador>` vazio) — um `min-height:44px` que já existia serviu de «prova» de que o deploy tinha chegado |
| Edição feita por script (Python · `sed` · regex) antes de correr testes | confirmar com `grep`/`git diff` que a edição **aplicou** — um escape comeu a substituição, o ficheiro ficou igual, e a suite deu um falso verde sobre código que nunca mudou |
| Config · valor alterado (camadas `.env`/default/override · ficheiro de ferramenta de terceiros) | verificar pelo **valor efectivo**, não pelo ficheiro editado: ler em runtime (`php artisan config:show <chave>`, `process.env`, o valor que a app usa) — editar o default não muda nada quando o `.env` o sobrepõe. Ficheiro de terceiros (perfil de slicer, `ini`, JSON de ferramenta) **descarta em silêncio** um valor de tipo errado: imitar o tipo de uma linha existente e **reler o valor no artefacto produzido** (G-code, export), não no ficheiro de entrada |
| Dependência instalada · pacote actualizado | `grep` pela **marca da versão nova** dentro de `node_modules/<pacote>` ou `vendor/<pacote>`, não a mensagem do instalador: com dependência `file:` e a versão igual, o `package-lock.json` fixa o `integrity` antigo e o npm serve a cópia da cache — imprimiu «found 0 vulnerabilities» e resistiu a `rm -rf node_modules/<pacote>` (verificado 2026-09-02) |
| Render · captura · export que sai VAZIO ou uniforme | um output vazio, preto ou de cor única é um **RESULTADO**, não uma avaria da ferramenta. Testar primeiro as hipóteses baratas — enquadramento, objecto fora do clip, camada escondida, alpha a 0, selector que casa 0 elementos — antes de culpar o pipeline e reescrevê-lo |
| Export · relatório descarregado (xlsx/csv de portal, extracto) | contar as **linhas de DADOS**, não o ficheiro: um export só com cabeçalhos e zero linhas descarrega com sucesso e tem o nome certo. E confirmar **período e entidade** dentro do ficheiro (datas da 1.ª e última linha, NIF/conta) contra o que se pediu |
| PDF · afirmar que um texto está (ou não) | `pdftotext \| grep` (mesmo com `-layout`) só prova **presença**: parte as células de uma tabela entre linhas e intercala colunas — «Prestação pretendida» deu 0 estando lá. **Ausência** exige texto achatado (`tr '\n' ' '`) ou, melhor, rasterizar a página (`pdftoppm`) e olhar |
| Texto PT-PT visível (HTML · imagem · cartaz · post) | antes de entregar, extrair o texto **visível** (sem `<style>` nem `data:` URI) e procurar palavras que levam acento escritas sem ele («Nao», «inteligencia», «desperdicar») — o hábito de escrever ASCII em heredocs e scripts tirou os acentos a uma peça, e é reincidência noutro cliente. Nenhum gate de render o acusa |
| Render 3D · enquadramento (bpy · cena importada) | o quadro não prova que há algo na imagem: confirmar que o objecto cai em `clip_start < z < clip_end` da câmara, além de estar dentro do quadro — uma cena em milímetros põe a geometria a milhares de unidades e ela desaparece atrás do `clip_end`. A prova de que a câmara vê alguma coisa é um **render de controlo com emissão pura**: uma cena vazia e uma cena mal iluminada produzem o mesmo preto |
| Config de routing alterada (nginx · Caddy · `.htaccess` · middleware · proxy) | re-exercer o gate de **TODOS** os subsistemas que aquela config encaminha, não só o que motivou a mudança. Uma regra de routing é código partilhado por rotas que nunca se leram: o teste do caminho que se alterou passa e os vizinhos caem |
| Asset local carregado dentro de um gate | `page.goto('file://<caminho absoluto>')`, nunca `page.setContent(html)` — sem base URL os `src`/`href` relativos não resolvem e falham **em silêncio** (sem erro de consola, com a imagem a ocupar o espaço). Confirmar `naturalWidth > 0` em cada `<img>` **antes** de medir seja o que for |
| Custom elements · web components · shadow DOM | um selector de alvos por tag (`a[href], button, input, …`) não vê web components: enumerar as tags registadas (`customElements.get(tag)`) e descer aos `shadowRoot` (`el.shadowRoot?.querySelectorAll(...)`) antes de dar a página por medida. Zero alvos numa página cheia de controlos é sinal de medidor cego, não de página limpa |
| Deploy | dependências derivadas do **HTML publicado**, não da lista do que foi enviado (ver pipeline Deploy). Health-check verifica o **CORPO**, nunca só o status — um fallback de SPA devolve 200 com HTML para um endpoint de API inexistente. Site em subpasta ou com prefixo (multi-idioma, multi-tenant) → correr a matriz completa de URLs contra o **URL publicado**, não contra o local em raiz |
| Recurso máquina-a-máquina (`sitemap.xml` · feed · `robots.txt` · `.well-known`) | medir **status E corpo em separado**: o inverso do fallback da SPA também acontece — corpo certo servido com **404**, que nenhum grep ao conteúdo vê e faz um crawler descartar o recurso (um sitemap servia XML válido com 404). `curl -s -o /dev/null -w '%{http_code} %{content_type}'` + o corpo |
| Ambiente local acabado de arrancar | 200 + HTML válido + título certo não chega: confirmar que o **CSS do tema do projecto** aparece no HTML servido (`curl -s <url> \| grep '<tema-filho>.*\.css?ver='`) e que os plugins próprios carregam — o tema activo por carregar serve 200 na mesma. **404 em todas as rotas** = provavelmente outro projecto na porta: `lsof -a -p $(lsof -nP -iTCP:<porta> -sTCP:LISTEN -t) -d cwd -Fn` dá o cwd do processo que escuta |
| App móvel Android/iOS | só é instalável quando **instala e arranca** no dispositivo/emulador: `adb install -r <apk>` + lançar + `adb logcat` sem `FATAL EXCEPTION` + a activity em primeiro plano (`topResumedActivity` em `adb shell dumpsys activity activities`). Build verde e APK no disco não provam arranque. O resultado do comando lê-se redirigindo para ficheiro e verificando pelo artefacto, nunca através de `\| tail`/`\| head` — o pipe devolve o exit code do último comando e mascara a falha |
| Backup · sincronização · migração de dados | contar **origem e destino por dois caminhos independentes** (ex.: `find … \| wc -l` e o total da própria app/tamanho em disco); o «concluído» da ferramenta não assina — ficheiros como `.nomedia` ficaram de fora em silêncio |
| Restauro · `rsync --delete` · sobreposição de uma árvore (ou de uma BD) por outra | **inventário do que existe SÓ NO DESTINO, produzido e mostrado ANTES de escrever** — é a lista do que vai desaparecer, e é ela que vai ao gate ⛔, não um resumo dela. O **comando de prova entra literalmente** no relatório, com caminhos completos: `rsync -avn --delete --itemize-changes <origem>/ <destino>/ \| grep -i deleting` (**ensaiar com um ficheiro plantado só no destino**: se a corrida a seco não o nomear, o inventário está cego e não se avança — `rsync` não existe em toda a máquina nem em todo o alojamento partilhado — ausente no Windows desta instalação a 2026-09-19, onde o prefixo `*deleting` do `--itemize-changes` ficou por confirmar) · `diff <(ssh <destino> 'ls -1 <dir>') <(ls -1 <dir>)` · plugins/extensões activas nos dois lados (`wp plugin list --status=active --field=name`) · tabelas de dados vivos contadas nos dois lados (encomendas, utilizadores, posts com `post_modified` posterior ao dump). **«A pasta parece igual», o total de ficheiros bater e o «concluído» da ferramenta NÃO contam** — só um `--dry-run`/`--itemize-changes` (ou o `diff` de dois inventários) conta. Inventário vazio é **resultado** e diz-se; inventário não vazio → ⛔ com a lista antes de qualquer escrita. Caso: um restauro por AIO completo quase apagou o plugin Redsys e os checkouts que só existiam no staging, instalados por terceiro — salvou-o o agente ter inventariado primeiro |
| Teste · passo de prova intermitente | dizê-lo **explicitamente** no relatório («intermitente, X de N»), senão lê-se como defeito da peça. N corridas limpas não provam ausência sem a **taxa base**: medir a taxa **nos dois ambientes** antes de atribuir a falha a um deles (3 limpas seguidas com 30-50% de falha acontecem 1 vez em 5), e **limpar processos órfãos entre corridas** — os da anterior inflacionam a seguinte |

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
| `--dispensar <sel>` | botão que fecha o overlay de consentimento. A heurística de CMP corre sempre; isto é o escape para quando falha |
| `--estado <ficheiro>` | `storageState` do Playwright (sessão já autenticada). Sem isto, um site com login mede a página de login e dá-a por limpa. Com isto e a sessão caducada, o gate acusa `SESSÃO PERDIDA` em vez de medir o login. Gera-se com `npx playwright open --save-storage=estado.json <url>` |
| `--login <ficheiro.json>` | JSON `{ url, campos: { "<seletor>": "<valor>" }, submeter, esperar }` — faz o login **uma vez** e usa a sessão resultante em todas as rotas. Alternativa ao `--estado` quando não há sessão pré-fabricada: um `--estado` gerado à mão caduca e ninguém repara. O ficheiro leva credenciais — **mantém-no fora do git**. Se depois do login o URL final ainda for um ecrã de entrada, o gate **aborta** |
| `--out <pasta>` | default `./.joca/gate-runtime` (relatório JSON + screenshots) |
| `--esperar <ms>` | espera após carga, antes de medir (default 500) |
| `--medir <lista>` | medidores **opcionais**, cada um com autoteste (sondas fora do ecrã que têm de acusar → senão `MEDIDOR CEGO`): `barra` (barra de acento à esquerda: `border-left` assimétrica 2-8 px, `box-shadow: inset Npx 0 0`, `::before/::after` fino colado à esquerda) · `icones` (`<svg>` com desenho e caixa <4 px; glifos Unicode no texto — setas, geométricos, dingbats, braille, emoji) · `transbordo` (filho em fluxo que sai da caixa do pai em x/y; pai `auto\|scroll` é carril, `hidden\|clip` nomeia-se) · `canvas` (contraste de texto por cima de `<canvas>` medido nos pixels: capturas sem texto · texto magenta · sem texto; máscara = onde o magenta mudou o pixel; fundo instável em >20% da máscara → *não medível*; falha se o **P10** dos rácios < 4,5/3). Sem a flag nada disto corre |
| `--classes <lista\|diff[:ref]>` | cada classe tem de **existir**: muda o estilo computado de um elemento de teste (ou dos 2 filhos, para `space-y-*`) **ou** tem regra com esse selector numa folha legível. `diff` extrai-as das linhas acrescentadas de `git diff <ref>` (default `HEAD`; só `class=`/`className=` e strings de `cn/clsx/cx/twMerge/cva`). Variantes (`hover:`…) inertes em repouso e `group`/`peer` vão para nota; folhas cross-origin contam-se. 0 classes extraídas → aborta |

Mede: contraste do texto contra o pixel **pintado** — cor **rasterizada** num canvas 1×1, alpha da cor **e `opacity` acumulada dos ancestrais** compostos, fundo com gradiente/imagem assinalado como *não medível* · `document.elementFromPoint` no centro de cada alvo interactivo · **texto tapado, linha a linha** · sangramento por `getBoundingClientRect().right` descartando **só** `overflow-x: auto|scroll` (ver a linha «Mobile / responsivo») · alvos <24 px · botões sem nome acessível (`label[for]` **não** nomeia um `<button>` — armadilha transversal a Radix/shadcn/Headless) · `content-type` dos assets servidos · erros de consola e `pageerror` · HTTP >= 400. Sai com 1 se alguma combinação tiver problema. Com `--medir`/`--classes`, também as famílias pedidas (acima).

**Por implementar:** `--medir largura` (largura do elemento contra o contentor, com a barra lateral aberta **e** fechada). Depende de accionar um estado próprio de cada projecto e não havia caso testável genérico; até lá é sonda manual, com o controlo negativo documentado no relatório.

**Cor mede-se rasterizando, nunca por regex.** `getComputedStyle` devolve `oklab()`/`oklch()`/`lab()` em qualquer stack moderno (Tailwind v4 por omissão) e há duas maneiras de errar, ambas já vividas: aceitar só `rgb` mede **zero** pares e reporta 0, que se lê como aprovação; ler os números com regex transforma `oklab(0.999 0.00004 0.00001)` em quase-preto e inventa falhas de 1,6:1 em texto que está a 7:1. Ler `ctx.fillStyle` de volta **não** normaliza — devolve a string tal como entrou. Só **pintar** resolve:

```js
const cv = document.createElement('canvas'); cv.width = cv.height = 1;
const ctx = cv.getContext('2d', { willReadFrequently: true });
ctx.fillStyle = getComputedStyle(el).color;   // aceita oklch/oklab/lab/color-mix
ctx.fillRect(0, 0, 1, 1);
const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;   // sRGB, sempre
```

E `opacity` **não herda** no computed style (o filho diz sempre 1) mas **multiplica-se** na pintura: sem acumular a opacidade dos ancestrais, texto dentro de um grupo a 0,12 mede-se como se estivesse opaco.

**O que o gate diz quando não consegue medir.** Um zero silencioso é indistinguível de aprovação. Cada rota traz por isso `autoteste` (sondas injectadas na página real que **têm** de acusar — uma delas a sangrar dentro de um `overflow-x: clip`), `corIlegivel` (valores que o browser não soube ler), `paresMedidos` (o denominador) e `documentoVisivel`. Se o medidor esteve cego, a rota **falha** — nunca sai «limpo».

⚠ **Sem `--clicar` mede o estado de REPOUSO.** Um gate que nunca interage é um gate de layout: quatro sobreposições publicadas não abriam e matavam a árvore React da página, e o gate dava a rota como limpa. Alvos cujo centro cai fora do viewport não são medidos — o resumo di-lo em vez de os dar por bons.

⚠ **Correr contra o BUILD DE PRODUÇÃO.** O overlay de dev do Next (`nextjs-portal`) é um elemento posicionado que tapa texto e não existe em produção; e `networkidle` nunca chega com HMR ligado (há fallback para `domcontentloaded`, anunciado no resumo, mas mede uma página que ninguém vê).

⚠ **O HTML servido pode ser a BUILD ANTERIOR.** Depois de agentes editarem ficheiros, o `next dev`
continua a servir o que tem compilado em `.next` (e o Vite o que tem em `dist/`): o gate mede uma
página que já não corresponde ao código, aprova-a, e cada achado que dela sair é **inválido**. Antes
de medir, sempre que houve edições desde o arranque do servidor: **parar o dev server, apagar a pasta
de build (`rm -rf .next`) e arrancar de novo** — ou medir numa build de cópia. E **provar que o HTML
medido é o novo**, não assumi-lo: escolher uma **marca do código acabado de escrever** (uma string
nova, uma classe nova, um `data-*` acabado de acrescentar), confirmar que não existia antes
(`git show HEAD:<ficheiro> | grep <marca>` vazio) e exigi-la no que o servidor devolve
(`curl -s <url> | grep '<marca>'`). Sem essa prova, não há gate — há uma medição de HTML obsoleto.

**Levar o gate ao projecto:** copiar `gate-runtime.mjs` para `scripts/` do projecto e registar `"gate": "node scripts/gate-runtime.mjs --base http://localhost:3000"` no `package.json`. Reescrever o gate por projecto é como as armadilhas se perdem: três sessões reescreveram-no de raiz e nas três esteve cego.

Playwright: resolvido em runtime (dependência do projecto → `npm root -g` → `PLAYWRIGHT_PATH`), e se não houver binário descarregado usa o Chrome instalado (`CHROME_BIN`). Nunca um caminho cravado — um gate que não arranca é um gate que não existe.

## Casos e princípios

**Silêncio não é aprovação.** Uma ferramenta que não avisa pode ter a verificação **desligada** —
antes de ler a ausência de aviso como aprovação, confirmar que o check estava ligado. Um slicer
aceitou uma ponte de 48 mm (o perfil declara `max_bridge_length = 10`) e reportou "0 suportes",
porque tinha `enable_support = 0`; leu-se como peça bem orientada.

**Um gate que nunca falhou não é prova — é um gate por testar.** Isto é **ordem de execução**, não
conselho: antes de reportar qualquer medição como prova, correr o mesmo medidor contra um caso que
**tem** de falhar. Um verificador com o selector errado passa sempre, e lê-se como "está tudo bem".
E um gate que **não separa o caso mau conhecido do caso bom não se afina — descarta-se**, e diz-se
que a verificação ficou manual (um detector de costura deu 7,17 ao defeito e 6,85 a um horizonte
natural: afinar o limiar era dar falsa confiança).

**O gate suspeito é-o nas duas direcções.** Um gate que **passa a falhar tem razão até prova em
contrário**: ler o artefacto que ele produziu, não só o veredicto, **antes** de tocar no gate — um
`check:janela` foi ajustado por «corrida» e a causa real estava no texto que imprimia
(`if (document.hidden) return` prendia o estado). Ajustar o instrumento é a forma mais barata de apagar
um defeito real. E um gate acabado de escrever também dá **falsos negativos**: agente que reporta ter mudado
o **desenho** para passar o gate é sinal de gate errado — verificar o gate antes de aceitar a mudança
(um agente mudou pesos de tipo para contornar uma sonda que só media o peso 700).

**Um gate verifica invariantes, não contagens.** Um gate que crava o número esperado (`D1..D14`) passa
a falhar com a D15, que era o trabalho a decorrer — acusa crescimento normal e treina quem o lê a
ignorá-lo. A forma certa: «a série é contígua de 1 a N, sem repetidos» (apanha buraco e duplicado,
sobrevive ao crescimento). Se um gate tem de ser editado sempre que o artefacto cresce, mede a coisa errada.

**Allowlist deriva-se da mesma fonte que produz os valores**, nunca dos casos que se mediram — uma lista
de origens permitidas corrigida só com os valores vistos numa sessão parte com o primeiro valor novo
que a mesma fonte produz.

**Ao partir um gate de propósito, contar QUANTAS suites acusam — e quais.** Uma só a acusar, quando a
peça tem duplos/mocks noutras, diz onde vive o contrato: o teste do contrato fica na suite que corre a
peça **a sério**, não na que a substitui. E a sabotagem ataca **a peça que SEGURA a invariante**, não a
vizinha: se a sabotagem não fizer o gate falhar, não é robustez — sabotou-se a peça errada; diz-se qual
e tenta-se outra (mover a guarda de um `POST` multi-dia não deixou órfãos porque a transacção fazia
rollback; só removendo a transacção apareceu o 409 com duas linhas órfãs).

**Achado do próprio gate confirma-se antes de ir ao utilizador** — por um **2.º método independente** do
selector que o levantou. Gate novo com **achados em massa** → validar **1 à mão** contra o artefacto
antes de mexer no código — é o simétrico do «gate que nunca falhou».

**Vale igualmente para gates HERDADOS.** Um gate copiado de outra peça chega com o crédito da peça
onde funcionava — e o selector, o caminho ou a unidade que o faziam discriminar lá podem não existir
aqui. Ao levar um gate para uma peça nova, **parti-lo uma vez NESSA peça** antes de aceitar o primeiro
verde: um gate importado que nunca falhou neste sítio está tão por testar como um escrito de raiz.

**Todo o filtro que REDUZ o que um gate acusa entra com um teste negativo plantado.** Exclusões,
allowlists e "descartar o ruído" são a via normal de cegar um gate sem ninguém dar por isso: o número
de achados desce, lê-se como melhoria, e o filtro está a comer os verdadeiros. O filtro só entra
acompanhado de um caso plantado **dentro da condição que ele filtra**, que o gate tem de continuar a
acusar (ver o controlo negativo da linha «Mobile / responsivo»: o elemento a sangrar nasce *dentro* de
um ancestral com `overflow-x: clip`, não no topo do `<body>`).

**Um controlo só vale se DISCRIMINAR.** Antes de ler um resultado como prova, enumerar as causas
alternativas que dariam **o mesmo resultado** — se houver mais do que uma e o controlo não as separar,
não mediu nada, escolheu uma. Um verde que sairia igual com o código certo e com o código partido é
uma coincidência com boa apresentação.

**Uma caixa medida que encosta às fronteiras da zona de busca não é uma medição — é a zona de busca.**
Quando o valor obtido coincide com o limite do intervalo/janela/região onde se procurou (bounding box
no limite do crop, máximo igual ao `max` do parâmetro, contagem igual ao `limit` da query), alargar a
zona e repetir. Só quando o resultado deixar de tocar nas fronteiras é que é o resultado.

**Um verificador que decide por exit code separa erro-de-invocação de achado.** `exit != 0` tanto
significa «encontrei o defeito» como «a ferramenta nem chegou a correr» (flag inexistente, binário em
falta, caminho errado, ficheiro vazio) — e o segundo lê-se como o primeiro, produzindo trabalho de
correcção sobre um defeito que não existe. Distinguir sempre pelo **artefacto**: o gate produziu
relatório/saída estruturada? Houve `stderr` de uso (`usage:`/`unknown option`)? Um exit code sozinho
não é um achado.

E o controlo tem de **descer ao caminho defeituoso**. Uma sonda que sangra no topo do `<body>` passa
na mesma com o filtro de `overflow-x` partido, porque nunca chega a ter um ancestral clipado — o
controlo tem de nascer *dentro* da condição que se está a testar. Um controlo que passa nas duas
versões do código não mede nada; foi assim que a primeira versão do check de texto tapado passou o
controlo negativo sem nenhuma das três exclusões que o tornam útil.

**Ordem obrigatória — verificar que se está a VER antes de contar ausências:**
1. **estado HTTP** — contar zeros numa página que devolve 500 é indistinguível de sucesso;
2. **controlo positivo de conteúdo** — provar que a página tem o que se vai medir (um denominador:
   quantos pares de cor, quantos alvos), senão "0 falhas" e "0 medições" imprimem a mesma linha;
3. **controlo negativo** — injectar o defeito e confirmar que acusa;
4. só então, medir.

Três medições seguidas do mesmo gate estiveram cegas por saltar estes passos: ausências contadas numa
página 500; `documentElement.scrollWidth` numa página com `body{overflow-x:hidden}`, que devolve
sempre a largura da janela; e um `grep` por `href="/products/x"` que dava 0 num filtro que servia 10,
porque o link real leva parâmetros. As três só apareceram por serem partidas de propósito **depois**
de já terem "passado".

**Existência não é identidade.** Um controlo positivo pergunta «este valor é DAQUELE registo?», não
«este valor existe?» — num catálogo grande qualquer valor plausível existe algures, e um auditor de
preços passou verde sobre seis preços inventados porque cada um existia, por coincidência, noutro
produto.

**«POR VERIFICAR» é estado, não nota de rodapé.** O que não foi exercido diz-se na conclusão, com
essas palavras — nunca se omite por o resto ter passado.

**Verde não prova que a coisa foi feita.** Para verificar que N coisas foram tratadas, medir **as N**,
não a soma — total/média/contagem escondem falhas que se cancelam. Um gate de cobertura declara o que
**não** cobre: antes de aceitar 100%, validar o **denominador** contra uma amostra do artefacto real.
Um gate de compilação prova que compilou **alguma coisa** (artefactos/assemblies no disco) — um build
que não produz nada e um build limpo dão o mesmo grep vazio: dois agentes deram "zero erros CS" com o
projecto a não compilar de todo.

**Uma operação de SUBSTITUIÇÃO mede duas coisas: o valor NOVO onde é esperado, e o RESIDUAL do
antigo.** Contar só as ocorrências novas dá verde a uma substituição parcial — o que ficou por
substituir não aparece em lado nenhum do relatório. O gate de qualquer troca (renomear, mudar de
token/cor/URL/chave, migrar de API) é o par: `grep -c "<novo>"` **igual ao esperado** E
`grep -rn "<antigo>"` **vazio**, cada um com o seu caminho completo.

**O gate tem de exercer o caminho real.** O teste exerce o uso **documentado**, não um equivalente — se
a doc diz `<html data-app>`, o teste põe o atributo no `<html>`. E um **componente interactivo**
(overlay, menu, modal, tooltip) verifica-se **accionando o gatilho** e contando erros de página/consola;
medir o estado de repouso não é medir o componente. **O gate é o par (acção, asserção):** accionar o
gatilho sem afirmar o que se espera ver não prova nada — declarar o efeito esperado e medi-lo
(hash/histograma da captura **antes e depois** — iguais = o toggle não fez nada); sem critério, um
screenshot com o estado activo e a foto por mostrar passou.

**Um gate que constrói o seu próprio input não testa o caminho real.** A regra acima é sobre o *uso*
que o teste exerce; esta é sobre o **valor** que o teste fabrica. Um gate que exercita
**autenticação, assinatura ou identidade** obtém esse valor pelo **caminho de produção** — a função
que a app chama, o endpoint que o emite, o ficheiro que ela lê —, nunca por uma reimplementação
local, por mais fiel que pareça: uma reimplementação testa-se a si própria. Um gate de fecho de vaga
assinava tokens com um `serie++` que a aplicação **não tem**, produzindo tokens **distintos** onde a
app produzia tokens **iguais** — e foi exactamente isso que escondeu o defeito real (um token sem
nonce, que matava o `ffmpeg` de outras sessões). O gate esteve **verde a vaga inteira** com o defeito
vivo por baixo.

Corolário, e é a parte útil: **se o gate tiver de construir o input, isso é sinal de que o caminho
real não está exposto — expor primeiro.** Extrair a geração do valor para uma função/endpoint que
produção **e** gate chamam, e só depois escrever o gate. Um gate que precisa de duplicar lógica de
produção está a documentar uma fronteira em falta, não a contorná-la.

**Diagnóstico é um passo com gate próprio:** um passo que afirma "X está partido" só produz output
**depois de ler o código de X**, com citação de ficheiro:linha por afirmação. Comparar nomes e
tamanhos de ficheiros não é ler. Um `WORKFLOW.md` commitado antes da leitura trouxe 2 de 3
"regressões" mal diagnosticadas (o failover existia e funcionava; o leak tinha sweeper por TTL) e
mandou o trabalho seguinte para o sítio errado.

**Resolver conflitos é código, não texto:** depois de qualquer merge/porte/`git apply --3way`,
**correr o artefacto**. Um `build-skill-index.py` saiu de um 3-way sem marcadores e sintacticamente
plausível, e rebentava à primeira execução (`match` fora de escopo, constantes perdidas porque hunks
vizinhos foram resolvidos para lados diferentes). Foram precisas 3 execuções para o pôr de pé.

**Build verde não prova que nada se perdeu.** `git checkout <ref> -- <ficheiro>` e mesmo `git apply
--3way` (a via recomendada acima) já apagaram uma feature local em silêncio — sem marcador de
conflito, sem erro, `tsc`/build limpos — porque a feature era uma inserção local perto de linhas que
o outro lado também tocou. Aconteceu duas vezes na mesma sessão de porte (JOCA 2026-08-12), a segunda
depois de trocar para `--3way` precisamente para evitar a primeira. Antes de aceitar um merge/porte
como bom: `grep` pelo marcador de cada feature local conhecida no ficheiro final, não só correr o
build — o relatório "Applied ... cleanly" da ferramenta não é prova de nada.

**Suite vermelha depois de um fix de segurança/dinheiro → ler o NOME de cada teste falhado antes de
tocar no código.** Nome que descreve o comportamento antigo (`test_sem_gateway_o_anual_ao_mes_activa_directamente`)
é um teste a proteger o defeito → corrige-se o teste, não o fix. "Parti alguma coisa, reverto" repõe o furo.

**Workflow falhado ≠ nada aconteceu.** Um workflow que morre no gate final já escreveu no disco:
8 agentes / 1,4 M tokens deixaram 6 ficheiros de teste, 109 testes e 419 linhas de frontend por
verificar, e a notificação não diz o que aterrou. Primeiro passo depois de uma falha: inventariar
(`ls` + `git diff --stat`) e assumir o papel do gate à mão. Por isso os gates são **cedo e por
fase**, nunca um único gate final — e cada agente de escrita corre o seu gate mínimo antes de devolver.
Padrão mais rápido para saber onde um agente parou: **`mtime` do alvo contra o do backup que o próprio
agente criou** (e a última linha de progresso do relatório de falha, que costuma ser exacta — «Banner
renderizado. Agora o newsletter» deixou o banner no disco e o newsletter não).
Em fan-out multi-fase, **o critério declara-se por fase** no brief — o que essa fase pode fechar sozinha; o
global pertence ao gate final. «Manter o `theme check` no baseline» era inalcançável para a fase 1 que
introduzia as chaves: 5 de 6 agentes gastaram tempo a justificar um erro esperado.

**Número que vai a uma decisão do utilizador mede-se por dois caminhos independentes** (ex.: valor
simulado vs soma do catálogo). Três decisões de balanceamento foram tomadas sobre um número inflado ~50%.

**Um guarda corre ANTES da operação destrutiva.** Um script com `rm -rf`/`DROP`/`truncate` valida tudo
primeiro e só destrói quando nada pode falhar — um guarda de colisões que corria **depois** do `rm -rf`
disparou e deixou o projecto sem a arte que já lá estava.
