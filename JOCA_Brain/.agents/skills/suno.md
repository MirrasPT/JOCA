---
name: suno
description: "Gerar música no Suno (suno.com) a partir de uma sessão real de browser do utilizador — preencher letra/estilo por clipboard, escolher a Voice/Persona, clicar Criar, e confirmar cada lançamento pela API em vez de confiar na UI. MUST be invoked when the user says: gerar música no Suno, criar no Suno, lançar no Suno, o Criar falhou em silêncio, Suno hCaptcha, Suno pediu captcha, quantos takes tem esta faixa, a Voice resetou no Suno. SHOULD also invoke when: escrever letra em formato Suno v6, colar letra longa no Suno, o separador do Suno travou, automatizar suno.com."
triggers: gerar musica no suno, suno.com, criar no suno, suno hcaptcha, suno captcha, o criar falhou em silencio, voice resetou suno, persona suno, formato suno v6, contar takes suno, suno travou separador, clipboard suno, colar letra suno, Something went wrong suno, feed/v2 suno
chain: lyric-align
origin: local
metadata:
  version: 1.0.0
---

# Suno

Automação de geração musical em `suno.com/create` via browser real (sessão logada do utilizador,
extensão `claude-in-chrome`). Consolida um método reinventado 3× na mesma sessão (66 lançamentos
num projecto musical, 2026-09-13/14) — não repetir tentativa-erro, seguir esta receita.

**Não é uma API oficial.** É automação de DOM/clipboard sobre a UI web do Suno; qualquer secção
abaixo pode partir se o Suno mudar o frontend. Ao primeiro sinal de comportamento diferente do
descrito, verificar pelo DOM/API antes de assumir que a receita ainda vale.

---

## Pré-requisitos

- Separador Chrome autenticado em `suno.com/create`, extensão `claude-in-chrome` ligada.
- Letra já escrita no formato Suno v6 (ver secção abaixo) — não escrever a letra inline no browser.
- Se o projecto usa uma Voice/Persona guardada (ex.: clone de voz do artista), saber o nome exacto
  como aparece no picker "+ Voice".

---

## O problema central: o hCaptcha silencioso

**Ao fim de ~20 gerações seguidas** (medido 2026-09-13), o clique em "Criar" passa a
falhar em silêncio: aparece "Something went wrong" e **nada** entra na biblioteca — sem erro visível
no botão, sem indicação de que é um CAPTCHA. Só a contagem pela API revelou a causa.

Noutra sessão do mesmo projecto (2026-09-14) chegaram-se a **40 lançamentos seguidos sem CAPTCHA**
com a mesma Voice. **O limite não é fixo** — tratar ~20 como o ponto a partir do qual vigiar, não
como garantia de que passam 40.

### Mitigação obrigatória

1. Antes do primeiro "Criar", contar os takes existentes na faixa/sessão via API (ver secção
   seguinte) → `esperado_N`.
2. A cada lançamento, `esperado_N += 2` (Suno gera **2 takes por clique em "Criar"** — confirmado).
3. **A cada ~10 lançamentos**, reconsultar a API e comparar a contagem real com `esperado_N`.
4. **Ao primeiro lançamento em que a contagem real fica abaixo do esperado → PARAR.** Não repetir o
   clique, não tentar contornar. Reportar ao utilizador que o Suno está a pedir hCaptcha e que só ele
   o consegue resolver (widget visível na página); esperar confirmação antes de continuar.
5. Depois de o utilizador resolver o CAPTCHA, confirmar pela API que o take em falta apareceu antes
   de retomar o ritmo normal.

**Nunca clicar "Criar" 2× "para garantir"** sem confirmar os links devolvidos — 2 cliques sem
confirmação geram 4 takes de uma letra que só devia ter 2 (aconteceu num caso real).

---

## Confirmar pela API, nunca só pela UI

A UI do Suno pode reportar sucesso sem nada ter sido criado (hCaptcha silencioso) e pode fazer
fallback a um estado estático sem avisar (o mesmo padrão de "UI que falha em silêncio para um
fallback" já causou um diagnóstico errado noutro projecto, numa integração com o TikTok). A fonte de
verdade é sempre a API.

- Endpoint usado: `studio-api.prod.suno.com/api/feed/v2` (medido numa sessão real,
  2026-09-14).
- Autenticação: token obtido em runtime dentro da página já logada via `Clerk.session.getToken()`
  (chamado por JS injectado no separador, nunca extraído para fora do browser). **Não imprimir nem
  guardar o valor do token** — só usar dentro da chamada JS no mesmo contexto de página
  (`credential-handling.md`).
- Verificações que a API permite fazer: contagem de clips desde o último lançamento, `persona_id` de
  cada clip (para confirmar que a Voice certa foi usada), timestamps de criação.
- TODO: por medir — parâmetros exactos de paginação/filtro do `feed/v2`, rate limit da API, e se
  existe endpoint dedicado a "contagem" mais barato que puxar o feed inteiro.

---

## Gotchas de preenchimento (DOM/clipboard)

| Sintoma | Causa | Correcção |
|---|---|---|
| Separador congela a colar a letra | `type`/tecla-a-tecla trava com >2000 car. | Colar sempre por **clipboard real**: `Set-Clipboard` (PowerShell, Windows) + `ctrl+v` no campo. Nunca `type` para Lyrics/Style. Mac: TODO: por medir o equivalente (`pbcopy` via `osascript`, não confirmado nestas sessões) |
| Campo aparece com um `"a"` a mais no início | Resíduo da combinação `ctrl+a`+`ctrl+v` usada para seleccionar-tudo-e-colar | Ler o valor do campo por JS **depois** de colar; se sujo, limpar e colar de novo — nunca assumir que o paste ficou limpo |
| A Voice/Persona escolhida "desaparece" numa geração seguinte | **A Voice reseta** ao voltar a `/create` ou logo a seguir a um "Criar" | Antes de CADA lançamento: verificar a Voice activa (texto da página ou `persona_id` no clip devolvido pela API) — nunca confiar que ficou seleccionada da vez anterior |
| Diálogo "Sobrescrever estilos?" ao escolher a Voice | Comportamento normal do picker | Responder sempre **"Manter atual"** (o motivo — sobrescrever apagaria o Style já escrito — é inferido, não medido) |
| Clique em "Criar" não regista | Clique perdido pela UI | Um 2º clique só depois de confirmar (pelos links/API) que o 1º não gerou nada — nunca clicar 2× a preceito |
| `javascript_tool` devolve texto cortado | Output trunca a ~1000 caracteres | Para textos longos, ler via DOM + `get_page_text`, não pelo valor de retorno do JS |
| `fetch` para `127.0.0.1` a partir da página https do Suno pendura | Bloqueio de permissão de rede local do browser | Não usar `fetch` local a partir do contexto da página; correr a verificação fora do browser se precisar de `127.0.0.1` |
| Separador fica preso (`CDP sendCommand timed out`, ~45s) | Timeout do CDP; a extensão por vezes desliga | **Não insistir** com `navigate`/`wait` repetidos no mesmo separador — abrir um novo já (`tabs_create_mcp`) e continuar lá |

---

## Formato de letra — Suno v6

v6 lançado 2026-09-09; limites medidos: **Lyrics 5000 car. · Style 1000 car.** (medido 2026-09-13).
Um ficheiro `NN <Título>_SUNO-v6.txt` por música, com blocos `TITLE` · `STYLE` ·
`EXCLUDE` · `DEFINIÇÕES` · `LYRICS`.

Regras dentro de `LYRICS`:
- **Um só cabeçalho por secção**, com a direcção em pipe: `[Verse 1 | slow storytelling flow, calm]`
  — nunca pilhas de 3 tags.
- Parênteses só para ecos de 1-3 palavras; uma frase inteira entre parênteses é cantada como coro.
- Falas/rádio → `[Spoken Word | …]`.
- **Negativos vão no `EXCLUDE`, nunca no `STYLE`** — no Style, um negativo lê-se como pedido
  (ex.: "sem autotune" no Style tende a produzir autotune).
- `pra`, não `p'ra`.
- Letra-alvo ~3000 caracteres (folga sob o limite de 5000).
- Fechar sempre com `[End]`.
- Nenhum nome de artista no `STYLE`.

Estrutura de referência: `<Album>/Material/01 <Título>_SUNO-v6.txt` (um ficheiro por faixa).

---

## Sequência de um lançamento

1. Confirmar Voice activa (se o projecto usa uma) → se não bater, reseleccionar + "Manter atual".
2. Colar Title/Style/Exclude/Lyrics por clipboard, um campo de cada vez; ler cada campo de volta por
   JS para confirmar que ficou limpo.
3. Clicar "Criar" **uma vez**.
4. Esperar os 2 links de take aparecerem (biblioteca ou resposta da API) antes de qualquer acção
   seguinte.
5. Actualizar o contador de lançamentos (passo do hCaptcha, acima); a cada ~10, reconsultar a API.
6. Registar os `suno.com/song/<uuid>` gerados na memória do projecto (não só reportar ao
   utilizador) — é o que torna a sessão seguinte recuperável sem re-perguntar.

---

## Anti-patterns

| Errado | Correcto |
|---|---|
| Escrever a letra tecla a tecla no campo | Clipboard real (`Set-Clipboard`+`ctrl+v`); nunca `type` em Lyrics/Style |
| Assumir que a Voice escolhida fica escolhida na próxima geração | Verificar antes de CADA "Criar" — reseta sozinha |
| Confiar que "Criar" resultou porque não deu erro visível | Confirmar pela API (`feed/v2`); "Something went wrong" pode nem aparecer |
| Clicar "Criar" 2× para garantir | 1 clique, confirmar, só repetir se confirmado que falhou |
| Insistir a `navigate`/`wait` num separador preso | Abrir separador novo de imediato |
| Continuar a lançar depois de a contagem da API ficar abaixo do esperado | Parar, avisar o utilizador do hCaptcha, esperar confirmação |
| Extrair/imprimir o token do `Clerk.session.getToken()` | Usar só dentro da chamada JS no mesmo separador; nunca sai do contexto da página |

---

## Próximo passo (chain)

Take escolhido e exportado → **`lyric-align`** (forced alignment WhisperX) se o destino for lyric
video. Composição e timing do vídeo → skill `video` (HyperFrames).

---

## TODOs (por confirmar antes de usar em produção)

- Equivalente macOS do `Set-Clipboard` para colar letra/estilo (não medido nestas sessões — todas as
  automações Suno documentadas correram em Windows/PowerShell).
- Parâmetros de paginação/filtro e rate limit do endpoint `studio-api.prod.suno.com/api/feed/v2`.
- Se existe uma forma mais barata de contar takes do que puxar o `feed/v2` inteiro.
- Confirmar se o limiar do hCaptcha depende de algo mensurável (conta, plano, IP) — as duas medições
  (20 e 40) vieram do mesmo projecto/conta em dias diferentes.
