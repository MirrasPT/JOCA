---
name: shopify-admin-browser
description: "Operate the Shopify admin through claude-in-chrome browser control when there is no Admin API token or the action only exists on-screen — native setter for web-component selects, the Save bar, CSV import rules, metafield probing via ?view=, and the browser_batch-after-navigate pitfall. MUST invoke when the user says: admin Shopify pelo browser, configurar loja Shopify sem API, importar CSV Shopify, sonda de metafields Shopify, mudar plano/definição no admin Shopify pelo browser. SHOULD also invoke when: s-internal-select não responde, select não regista no admin Shopify, shopify-store-fixer sem token disponível, moeda/plano/localização da loja só muda no ecrã."
triggers: admin Shopify pelo browser, configurar loja Shopify pelo browser, importar CSV Shopify, csv de import Shopify, sonda de metafields Shopify, metafields por ?view=, s-internal-select, setter nativo Shopify, save da barra de alteracoes Shopify, browser_batch Shopify, claude-in-chrome Shopify, shopify sem token de API, plano da dev store Shopify, moeda da loja Shopify
origin: local
chain: shopify-store-fixer, shopify-theme
---

# Shopify Admin (browser)

## Quando usar

- Não há Admin API token nem CLI autenticado, ou a acção só existe no ecrã (plano da loja, algumas definições de checkout/apps do marketplace).
- Selects/toggles de web component (`s-internal-select` e afins) que `form_input` e teclado não conseguem preencher.
- Import de catálogo por CSV, e leitura de metafields que `/products/<handle>.json` não expõe.

**Prior-art — não usar se houver via mais barata:** com **Admin API token** (`SHOPIFY_ADMIN_API_TOKEN`) ou CLI autenticado (`shopify store auth`), a via é `shopify-store-fixer` (GraphQL) — sem os gotchas de browser abaixo. Antes de concluir "só dá pelo browser", confirmar a superfície do CLI já instalado (`shopify --help`, `shopify store --help`): `store auth` + `store execute` fazem mutações sem guardar credencial em disco (mutações trancadas até `--allow-mutations`).

## Setter nativo + Save

Selects modernos do admin são web components (`s-internal-select` e afins) sobre um `<select>` nativo dentro de shadow root. Clique directo, teclado e `form_input` **não registam** — o componente não propaga a mudança. Via `javascript_tool`, com o setter nativo do prototype (técnica padrão para inputs controlados por framework):

```js
const el = document.querySelector('select');   // dentro do shadow root do componente
const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
setter.call(el, novoValor);
el.dispatchEvent(new Event('change', { bubbles: true }));
```

Depois de qualquer mudança: **Save da barra de alterações** — passo à parte, fácil de esquecer. Sinal de que ficou por gravar: o browser bloqueia a navegação com "Leave site?".

**Verificar sempre por efeito no que a loja serve, nunca pelo ecrã do admin.** Ex.: moeda → `Shopify.currency` no HTML da montra, não o valor que o select mostra; tema activo → `Shopify.theme` no preview real.

## Regras do CSV de import

- `Title` obrigatório; colunas de opção + **uma linha por variante** — falta disso e a Shopify recusa, ou aceita e preenche com defaults (Vendor vira o nome da loja, `Body (HTML)` fica vazio).
- CSV **parcial** (ex.: só Handle + Tags + metafield) é recusado, e mesmo quando aceite **não preserva o que falta** — reescreve com o default.
- **Omitir as colunas de imagem de propósito, quando as imagens já vivem noutro CDN.** Evita que a Shopify tente re-descarregar todas as imagens do handle. O preview confirma ("0 images") — conferir antes de importar.
- **Metafield-lista: criar a definição ANTES do import.** Se `custom.<campo>` não existir como `list.*` quando o CSV chega, a Shopify cria-o como texto simples na primeira linha, e os valores multi-valor das linhas seguintes ficam concatenados numa string em vez de lista.

## Sonda de metafields — `?view=`

`/products/<handle>.json` **não expõe metafields**. Ler por Liquid: template/secção com `?view=<nome>` que imprime o metafield no HTML, e confirmar com **controlo positivo** — um handle que se sabe ter valor. Uma sonda pública pode estar cega e devolver o mesmo vazio no baseline e no alvo, o que parece confirmar ausência sem confirmar nada. **Apagar o template de sonda depois de ler o valor** — não fica no tema.

**O `updated_at` do `/products.json` público não prova edição.** Devolveu a hora do próprio pedido para todos os produtos e quase levou a concluir que alguém tinha mudado preços «agora» (loja de cliente, 2026-09-29). Data de última edição lê-se no admin (`product.updatedAt` por GraphQL) ou compara-se com uma recolha antiga guardada.

## Escrita no tema em produção

Ler checksums ou publicar ficheiros (`themeFilesUpsert`) na loja de produção → **gate `AskUserQuestion` ANTES da 1.ª leitura/escrita**, e a resposta citada no comentário do script. Um «avança» em texto solto não chegou: o classificador do Claude Code bloqueou as duas operações e só deixou passar depois do `AskUserQuestion` explícito citado no código (2026-09-29).

## claude-in-chrome no admin Shopify — gotchas medidos

Somam-se aos genéricos já em `.claude/reference/workflows-and-tooling.md` §"claude-in-chrome — armadilhas" (`form_input` em web components, validação inline desloca o layout, `file_upload`/iframe, `file://` recusado — não repetidos aqui):

**Step 0 — a janela do Chrome está visível?** Antes de navegar no admin, ler `document.visibilityState` por `javascript_tool`. Se vier `hidden`, pedir **uma vez** ao utilizador que ponha a janela do Chrome visível, e só depois começar. Com o separador escondido, o vídeo não carrega, o admin e o editor de temas não desenham, as apps embebidas (Search & Discovery, editor de temas) congelam, e os métodos que dependem de `requestAnimationFrame` penduram — um `v.play()` bloqueou o CDP 45 s (2026-09-22 e 2026-09-28). O agente não consegue trazer a janela para a frente sozinho.

| Sintoma | Causa | Em vez disso |
|---|---|---|
| Cliques sem efeito, `find` não vê a árvore, screenshot congela — em páginas do admin servidas em iframe (editor de temas, Search & Discovery, Online Store → Preferences) | a página vive num iframe que o MCP não alcança; com o Chrome atrás os cliques nem chegam (2026-09-29 e 2026-10-01) | coordenadas **não** resolvem dentro destes iframes. À **1.ª** falha, pedir ao utilizador o Chrome à frente; se persistir, devolver o passo com **instruções manuais numeradas** — sem 3 tentativas (mesma regra de `workflows-and-tooling.md` §"claude-in-chrome — armadilhas") |
| Download por `a.click()` (mesmo com gesto real) não aparece em `~/Downloads`; `fetch` a `localhost` e `window.open` sem gesto bloqueados | o ficheiro aterrou horas depois noutra pasta (a do projecto); a CSP do `admin.shopify.com` bloqueia `fetch` a `localhost` (2026-09-28) | backup de tema sem CLI = **duplicar o tema no admin** + ler os ficheiros por GraphQL Admin (confirmar o nome do campo/consulta de ficheiros de tema na versão da API em uso). Download que «falhou» → procurar o ficheiro **por nome** em todo o disco (`mdfind -name <ficheiro>` no Mac; `find ~ -name '<ficheiro>'` no Git Bash) antes de dar por falhado |
| `browser_batch` falha inteiro depois de um `navigate`, mesmo com 10s de espera | admin pesado, iframes de apps embebidas | não encadear `browser_batch` logo a seguir a `navigate`; um passo de cada vez |
| Campo recebe foco mas não texto — o 1º `type` perde-se quase sempre | escrita intermitente em admins pesados | ler o valor de volta depois de cada `type`, antes de prosseguir |
| Escrita dispara atalho global do admin (ex.: navega para "Add blog") e perde trabalho a meio | tecla sintética capturada pelo admin, não pelo campo | parar ao 1º sinal de navegação inesperada; não insistir a escrever |

**Limiar de N tentativas:** ao fim de repetidas falhas num formulário, propor ao utilizador que o faça à mão em vez de insistir — insistir além do limiar já custou uma sessão inteira noutro projecto.

## Verificação

Nunca aceitar o ecrã do admin como prova de que uma mudança ficou gravada. Verificar por efeito no storefront/preview: `Shopify.currency`, `Shopify.theme`, contagem de produtos/colecções servida, preview com cookie (`?preview_theme_id=<id>`) — sempre com controlo positivo (um valor que se sabe existir, não só a ausência do antigo).

## Related

- `shopify-store-fixer` — via API/GraphQL; preferível quando há token ou CLI autenticado.
- `shopify-theme`, `shopify-router` — porte de tema e classificação do tipo de projecto Shopify.
- `.claude/reference/workflows-and-tooling.md` §"claude-in-chrome — armadilhas" — gotchas genéricos do MCP, não específicos de Shopify.
