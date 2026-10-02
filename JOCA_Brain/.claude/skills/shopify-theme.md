---
name: shopify-theme
description: "Building or customising a Shopify theme: Liquid templating, theme architecture (layout/templates/sections/blocks/snippets), theme.json settings, Dawn-based development, Theme Check. MUST be invoked when the user mentions: Shopify, Liquid, Dawn, Theme Check, CLI."
compatibility: "Shopify CLI 3.x+. Online Store 2.0 (sections everywhere). Node.js 20.10+."
---

# Shopify Theme

Antes de escrever código: `Read(".claude/reference/codigo-minimo.md")` — escada + guard-rails.

## When to use

- Building a custom theme from scratch or forking Dawn
- Adding/modifying sections, blocks, templates, snippets
- Customising `settings_schema.json` / `config/settings_data.json`
- Theme Check linting and fixing Liquid issues
- Pushing, pulling, publishing themes via CLI

## Inputs required

- Working directory (theme root with `layout/theme.liquid`).
- Dev store domain or theme ID for push/pull operations.
- Target Shopify version context (Online Store 2.0 assumed).

## Setup

```bash
npm install -g @shopify/cli@latest

# Clone Dawn as starting point (optional)
shopify theme init --clone-url https://github.com/Shopify/dawn
```

## Core workflow

1. **Init** — clone or scaffold theme
2. **Dev** — preview on store with hot reload
3. **Build** — implement sections/blocks/Liquid
4. **Lint** — Theme Check
5. **Push / publish** — deploy to store

## Constraints

### MUST DO
- Use Online Store 2.0 architecture (sections everywhere, blocks)
- Namespace section settings to avoid conflicts (`shopify__` prefix for app-injected)
- Use `{% render %}` over `{% include %}` (scoped, no variable leakage)
- Lazy-load images with `loading="lazy"` and provide `width`/`height`
- Run `shopify theme check` before every push
- Test in multiple browsers and on mobile viewport

### MUST NOT
- Use `{% include %}` in new code (deprecated, leaks variables)
- Inline CSS/JS when `{% stylesheet %}` / `{% javascript %}` tags are available
- Hardcode store-specific URLs or product handles
- **Dev store ≠ loja do cliente:** tudo o que dependa de dados da loja (colecção, produto, handle) tem de degradar com o recurso **ausente** — prova com um handle inexistente. Uma chave de tradução ligada ao handle da colecção deixou tiles sem nome, porque 5 das 8 colecções não existiam na loja do cliente (projecto de cliente, 2026-09-22). Brief de agente de tema com 2 lojas leva esta linha.
- Skip `alt` attributes on images (accessibility + SEO)
- Modify files under `assets/` that are compiled outputs (edit source, not output)

## Portar um design existente para o Dawn (3 armadilhas, pelo sintoma)

Nenhuma aparece no `theme check` nem no build — reconhecem-se pelo que se vê (loja de cliente, Dawn 16, 2026-08-26):

| Sintoma observável | Causa | Correcção |
|---|---|---|
| Design inteiro sai **encolhido** em silêncio (h2 a 38px em vez de 60,8px) | Dawn põe `html{font-size:62.5%}` — raiz de 10px; cada `rem` desenhado contra 16px vale 62,5% | Multiplicar os `rem` do CSS portado por 1,6 (mantém a escala da preferência de letra do utilizador); CSS novo portado depois converte-se também |
| Secção em **preto liso** com o HTML correcto; div de teste injectado desaparece | `base.css` do Dawn tem `div:empty{display:none}` — come qualquer `div` vazio usado como camada de pintura (fundo full-bleed, scrim) | Dar conteúdo/pseudo-elemento à camada ou regra mais específica com `display:block`; um gate que injecta um `div` vazio mede o vazio |
| Blocos declarados no `index.json` **sem imagem** | `image_picker` só vê a biblioteca de media da **loja**, nunca `assets/` do tema | Imagem por omissão via `select` de assets do tema (ex.: `default_image`), `image_picker` só como override |

## Entregar um tema numa loja de cliente (handover)

Escrever Liquid é a outra metade; esta é a da entrega (loja de cliente, 2026-09-07):
- **Fronteira ficheiros do tema vs dados da loja** — colecções, menus, metafields, locales publicados vivem na loja, não no repo. Lista explícita do que o cliente configura no admin.
- **Integração GitHub: empurrar é publicar.** Um `git push` à branch ligada actualiza o tema na loja do cliente, e as edições dele no editor de temas voltam como **commit** ao repo. Push = gate irreversível. Nunca ligar a `main` se ela for o Dawn upstream (punha o Dawn cru na loja). Verificar por efeito no preview (`Shopify.theme` → `id`, `schema_version`, `role`), não pelo relatório do admin.
- **O valor gravado em `templates/*.json` ganha sempre ao default do schema** — mudar o default no `.liquid` não muda uma secção já gravada; a tradução só entra depois de a string sair do JSON.
- **`MatchingTranslations` desligado no `.theme-check.yml` → o `theme check` verifica só o inglês.** Verde não prova tradução.
- **Chaves de locale acrescentadas depois de o tema existir não apareceram nos idiomas não-primários** (57 chaves `sp.*` em inglês em `/pt/ /fr/ /de/`, com as do Dawn traduzidas — ⏳ verificado 2026-09-07; causa por provar: hipótese de semeadura na criação do tema). Testar cada idioma por URL, não pelo ficheiro.
- Chaves load-bearing (que alimentam `?q=` contra tags, ou usam `|` como separador) **não se traduzem**.
- **`"default": ""` num setting de schema faz a Shopify recusar o ficheiro inteiro** — pela integração GitHub a recusa é silenciosa (custou 15 dias de uma hipótese errada sobre traduções — 2026-09-22). Controlo antes de cada push: `grep -rn '"default": ""' sections/ blocks/` → 0 hits. «O push não teve efeito» → correr `shopify theme dev` e ler o ecrã «Upload Errors» antes de qualquer outra hipótese.
- **Defeito visual reportado pelo utilizador → 1.º passo é ler `Shopify.theme.id` e `Shopify.theme.role` no browser DELE**, antes de diagnosticar. Um defeito do seletor de idioma era do tema ANTIGO: o Chrome partilhado tinha um `preview_theme_id` preso no cookie (2026-10-01). Tema diferente do publicado → o defeito é da preview, não do tema actual.

## Filtros Search & Discovery por metafield — indexação

Filtro novo de metafield pode ficar **horas** «reconhecido mas a devolver 0»: a montra aceita o parâmetro, mas os valores ainda não foram indexados (>1 h com `single_line` e depois com `list` — 2026-09-28/29). Sem saber isto, gasta-se tempo a depurar tema e dados.

Controlo que separa os dois casos, na montra:
- `?filter.p.m.custom.<key>=<valor>` com o metafield **verdadeiro** → devolve 0 produtos = parâmetro **reconhecido**, indexação pendente.
- O mesmo com uma chave **inventada** → o parâmetro é **ignorado** (lista completa) = não reconhecido; aí o problema é de configuração do filtro, não de indexação.

Reconhecido + 0 durante horas → não mexer no tema; esperar e repetir o teste. Se persistir, escalar ao suporte da Shopify com os dois resultados do controlo como prova.

## Remover uma colecção — checklist

Remover uma categoria/colecção tem efeitos em cadeia que só apareceram em 3 rondas de verificação (2026-09-30). Antes de dar por feito:
- `grep -rn` ao **handle** e ao **rótulo** (em todos os idiomas) em `templates/`, `sections/`, `blocks/`, `snippets/`, `locales/` e `docs/`.
- Rever menu, página 404, sugestões/pesquisa e textos de reserva que a citem.
- Rever a **composição da grelha** onde ela estava (número de tiles, linha incompleta).

## Verification

```bash
shopify theme check                          # lint Liquid
shopify theme dev --store=mystore.myshopify.com   # preview
shopify theme push --unpublished             # upload without publishing
shopify theme publish --theme-id=<id>       # publish when ready
```
