---
name: yagni
description: "Decision ladder de 6 degraus para minimizar codigo e dependencias antes de escrever qualquer coisa. Formaliza os principios de simplicidade do soul.md/CLAUDE.md numa skill activavel. MUST be invoked when the user says: yagni, mais simples, minimo codigo, evitar dependencia, precisas mesmo disto, over-engineering, nao complicar, menos abstraccao. SHOULD also invoke when: adicionar dependencia nova, criar abstraccao, util/helper generico, scaffolding antecipado, feature especulativa."
triggers: yagni, you arent gonna need it, mais simples, simplificar, minimo codigo, menos codigo, evitar dependencia, nova dependencia, npm install, composer require, precisas mesmo, over-engineering, sobre-engenharia, nao complicar, menos abstraccao, abstraccao prematura, helper generico, util generico, feature especulativa, scaffolding antecipado, refactor preventivo
---
# YAGNI — Decision Ladder de Simplicidade

Adoptada de DietrichGebert/ponytail. Formaliza simplicidade do `soul.md`/`CLAUDE.md` numa skill activavel.

Premissa caveman: **codigo que nao escreves nao tem bugs.** Dependencia que nao adicionas nao tem CVEs nem breaking changes. Abstraccao que nao crias nao confunde ninguem.

Bias: **YAGNI > stdlib > nativo da framework > dep ja presente > one-liner > codigo novo minimo.** Sempre nesta ordem. Para no primeiro degrau que resolve.

---

## A escada (6 degraus, sequencial)

Antes de escrever codigo ou adicionar dep, subir a escada **de cima para baixo**. Para no primeiro que serve.

| # | Degrau | Pergunta | Acao |
|---|--------|----------|------|
| 1 | **YAGNI** | Precisas mesmo disto? Agora? | Requisito real e presente? Nao → nao fazer. |
| 2 | **Stdlib** | A linguagem ja faz isto? | `Array.map`, `URL`, `crypto`, `str_*`, `Collection`. |
| 3 | **Nativo framework** | A framework ja faz isto? | Laravel: `Str`, `validator`, `Cache`, policies. React: `useState`, Context, `useId`. |
| 4 | **Dep ja no projecto** | Algo no `package.json`/`composer.json` ja resolve? | Reusar antes de instalar nova. |
| 5 | **One-liner / util pequeno** | Resolve-se com util curto inline? | Helper de 3-5 linhas no projecto > dep de 50KB. |
| 6 | **Codigo novo minimo** | So aqui escreves codigo novo. | O minimo. Sem generalizar para casos hipoteticos. |

**Regra:** subir degrau (dep nova, abstraccao) so quando os anteriores comprovadamente nao chegam. Justificar 1 linha porque o degrau acima falha.

---

## GUARD-RAILS (NUNCA se simplificam/cortam)

Estes **nao** estao sujeitos a escada. Cortar aqui nao e simplicidade — e bug ou dano. Inviolaveis:

- **Seguranca** — auth, autorizacao, escaping, secrets, CSRF, rate limit. Nunca "depois meto".
- **Validacao de input** — todo input externo validado. "Confio no caller" nao e YAGNI, e furo.
- **Prevencao de perda de dados** — transaccoes, confirmacao em accoes irreversiveis, backups, migracoes reversiveis.
- **Acessibilidade** — semantica, labels, foco, contraste, teclado. Nao e feature opcional.

YAGNI corta features especulativas e abstraccao prematura — **nunca** estes quatro. Em duvida se algo e guard-rail → tratar como guard-rail.

---

## Exemplos

```js
// Degrau 1 — YAGNI: pediram listar 3 utilizadores
// ❌ sistema de paginacao + filtros + cache "porque um dia"
// ✅ users.slice(0, 3)
```

```js
// Degrau 2 — stdlib em vez de dep
// ❌ npm install lodash.groupby
// ✅ Object.groupBy(items, x => x.cat)   // ou reduce de 4 linhas
```

```php
// Degrau 3 — nativo da framework em vez de helper proprio
// ❌ class SlugMaker { public function make(...) {...} }
// ✅ Str::slug($title);
```

```js
// Degrau 5 — one-liner em vez de dep
// ❌ npm install is-empty
// ✅ const isEmpty = v => v == null || v.length === 0;
```

```php
// GUARD-RAIL — NAO cortar mesmo sob "simplifica"
// ❌ "validacao depois, primeiro faz funcionar" → input vai cru pra query
// ✅ $request->validate([...]);  // sempre, nao negociavel
```

---

## Anti-patterns

| Errado | Correcto |
|--------|----------|
| Adicionar dep para uma funcao de 3 linhas | Degrau 5: util inline |
| Abstrair antes do 3o uso | Inline ate o padrao repetir 3x |
| Scaffolding "para o futuro" (config, plugins, hooks) | Construir quando o requisito existir |
| Generalizar funcao para casos hipoteticos | Resolver o caso real de agora |
| Wrapper proprio sobre algo da stdlib/framework | Usar o nativo directo |
| Cortar validacao/auth "para simplificar" | Guard-rail: nunca cortar |
| Camada de abstraccao de uso unico | Codigo directo |
| Instalar dep sem subir a escada primeiro | Justificar porque degraus 1-5 falham |

---

## Interaccao com outras skills

- Reforca `caveman`/`soul.md`: simplicidade cirurgica, zero codigo desperdicado.
- Invocar antes de `laravel-specialist`/`frontend` quando o instinto e adicionar dep ou abstraccao.
- `react-composition` resolve o degrau 6 do lado da API de componentes (composicao > config).

## Quando ignorar
Guard-rails ganham sempre. Se simplificar toca seguranca/validacao/dados/a11y → parar, nao simplificar, sinalizar.
