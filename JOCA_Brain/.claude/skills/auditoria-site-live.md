---
name: auditoria-site-live
description: "Auditar por fora um site JÁ publicado quando o status code sozinho pode estar a mentir. MUST be invoked when the user says: audita o site em produção, o site parece bem mas está partido, o curl diz 200 mas falha no browser, verifica se isto está mesmo a funcionar ao vivo, confirma com e sem Origin. SHOULD also invoke when: suspeita de fallback de SPA (toda a rota responde 200), API que só falha dentro do browser (CORS), ou é preciso ver o XHR real em vez de o replicar por curl."
triggers: auditoria site publicado, SPA fallback, curl da 200 mas esta partido, XHR real, com Origin sem Origin, 404 real vs fallback, site parece bem mas nao esta, auditar site ao vivo
chain: log-debugger
origin: local
---

# Auditoria de site live

Site **já publicado** (dias/meses no ar), suspeita de que o status code sozinho não prova nada — não
confundir com o passo de deploy nem com QA visual do DOM (ver "Quando usar" abaixo).

## Quando usar isto e não outra skill

| Situação | Skill |
|---|---|
| Acabaste de publicar e queres confirmar o que foi enviado | `deploy-executor` |
| Queres um screenshot/QA visual do DOM | `site-capture` |
| O site está no ar há tempo e não sabes SE/ONDE está partido | **esta** |

## Ordem obrigatória (mesma disciplina de `gates-runtime.md` "Ordem obrigatória")

### 1. Controlo de fallback ANTES de confiar em qualquer status

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/rota-inventada-$(date +%s)"
```

200 + corpo igual à homepage → fallback de SPA/router, nenhum status seguinte prova nada; a partir
daqui o veredicto vem do `content-type` (`.claude/reference/gates-runtime.md` linha "Rota · endpoint
· subsistema REMOVIDO"). **Delta desta auditoria:** a rota de controlo é sempre nova (timestamp),
nunca uma fixa reutilizada — um fallback com allowlist de excepções esconde-se de uma rota já testada.

### 2. Matriz de rotas × conteúdo, não só status

Testar as rotas reais do site por status **e** corpo em separado — mesma disciplina de "Recurso
máquina-a-máquina" em `.claude/reference/gates-runtime.md`. **Delta desta auditoria:** correr sempre
a rota-controlo do passo 1 na mesma matriz das rotas reais, para comparar `content-type` (viva vs
fallback) no mesmo output em vez de duas corridas separadas.

### 3. XHR real — não replicar por curl

Cabeçalhos de sessão, `fetch` com `credentials`, preflight CORS e service workers não se reproduzem
fielmente com `curl`. Abrir num browser real e capturar a rede (receita de arranque do Playwright já
validada — ler de `site-capture.md` §1, não reinventar):

```js
page.on('response', (res) => console.log(res.status(), res.request().method(), res.url()));
await page.goto(url, { waitUntil: 'networkidle' });
```

### 4. Com/sem `Origin` — não reinventar a receita

Receita completa (curl com/sem `Origin`, o que cada resposta significa) já existe em
`.claude/reference/resume/live.md` §Endereços live (ponteiro em `.claude/commands/resume.md` §2f) — ler dali, não copiar aqui. Sem `Origin` a API responde 200 e
parece resolvida; o browser real do utilizador manda `Origin` sempre.

### 4b. Domínio atrás de login, WAF ou desafio Cloudflare — quando a sonda falha antes de começar

`curl` sem sessão devolve a página de challenge/login, não o site real: 200/403 que não provam nada
(mesmo caso do "Ecrã atrás de login" em `.claude/reference/gates-runtime.md` §Pré-condição de UI).
Sinal típico (confirmar caso a caso — não medido nas fontes): corpo com `cf-chl`/`__cf_chl_`, ou título de login onde se esperava a rota-alvo. Fuga:
1. Repetir a sonda no **browser real** (passo 3) — resolve challenges JS simples e leva cookies que o
   `curl` não tem.
2. Sessão exigida → `--estado`/`--login` do `gate-runtime.mjs` (flags documentadas em
   `.claude/reference/gates-runtime.md`), nunca aceitar a página de login como se fosse o conteúdo.
3. Challenge que nem o browser passa → pedir captura ao utilizador e marcar a auditoria **PARCIAL**;
   nunca reportar "sem defeitos" sobre um corpo que nunca se viu.

### 5. Achado — confirmado, ou por método, nunca fundido

| Curl/matriz (1-2) | Browser (3) | Reportar como |
|---|---|---|
| mostra | mostra | **confirmado** — 2 vias independentes |
| mostra | não mostra | defeito **server-side / sem sessão** — dizê-lo, não generalizar ao browser |
| não mostra | mostra | defeito **client-side / CORS / JS** — o curl não o vê por design, não é ausência |
| não mostra | não mostra | sem achado nesta rota |

Nomear a via **antes** de encadear — `chain: log-debugger` precisa de saber se procura no servidor ou
no cliente.

## O que NÃO reinventar aqui (ponteiros, não cópias)

- Health-check pós-deploy em 4 partes → `deploy-executor.md` Step 4.
- Pipeline de captura/QA visual + fallback de ferramentas Playwright → `site-capture.md` §1.
- Tabela completa de gates por categoria (auth, despublicado, deploy, recurso máquina-a-máquina) →
  `.claude/reference/gates-runtime.md`.
- Receita `com/sem Origin` e hash/símbolo vs `content-length` para "está deployado?" →
  `.claude/reference/resume/live.md` §Endereços live e §Paridade live ↔ repo (`/resume` §2f e §2c).

## Caso-fonte

Um `.com.br` respondia 200 a tudo (fallback de SPA); só a combinação rota-inventada-como-controlo +
inspecção do corpo + browser real revelou um 500 de produção que `curl -sI` dava por saudável
(projecto de cliente, 2026-08-25).

## Related Skills

- **deploy-executor** — health-check logo depois de um deploy (evento único, não auditoria periódica).
- **site-capture** — QA visual do DOM, screenshots; paradigma diferente (pixel, não rede/status).
- **log-debugger** — diagnóstico da causa-raiz de um defeito já confirmado por esta auditoria.
