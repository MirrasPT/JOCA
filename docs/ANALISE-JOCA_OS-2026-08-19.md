# Análise JOCA_OS — 2026-08-19

Âmbito: `JOCA_OS/` do repo público (`MirrasPT/JOCA@main`, HEAD `6f7bf52`), instância de dev em
`:7591/7592`. Não cobre `JOCA_Brain/` (a decorrer noutra sessão) nem a produção.

Tudo o que está aqui foi **medido** — os comandos e os números estão em cada secção. Nada foi
alterado a partir desta análise: é diagnóstico, não trabalho aplicado.

---

## 1. Alvos de toque encolhem para 21px quando há 4 acções ⚠ regressão desta sessão

**Onde:** `frontend/src/App.css:1289`

```css
@media (hover:none) { .project-group-actions { opacity:1; max-width:100px; } }
```

O contentor revela as acções do projecto em ecrãs sem hover com um tecto de 100px. Com 3 botões a
conta fechava exactamente: `3×28 + 2×6 = 96px`. O botão **Remover projecto** acrescentado hoje faz
4 num projecto **dentro de um grupo** (que mostra também "retirar do grupo"): `4×28 + 3×6 = 130px`.
Não são cortados — o flex esmaga-os.

**Medido** (Playwright, `devices['iPhone 13']`, `hover:none` confirmado a `true`): os 4 botões
ficam a **21×28px** cada, contra os 28×28 de antes. Não há corte (todos dentro do limite direito do
contentor), há degradação do alvo.

**Correcção proposta** (uma linha e meia):
```css
@media (hover:none) { .project-group-actions { opacity:1; max-width:140px; } }
.project-group-action { flex-shrink:0; }
```

Nota de contexto: mesmo os 28px estão abaixo dos 44px recomendados, e o CSS já o assume por
escrito (`App.css:1301` — "28px visual (não 44px — 3 acções coladas, o alvo-cheio exigiria
overflow-menu, fora de escopo agora)"). O ponto aqui não é atingir 44, é não **piorar** 28 → 21.

---

## 2. Não há eslint — e é o único gate que apanha esta classe de erro 🔴 maior retorno

**Verificado:** sem `eslint.config.*` / `.eslintrc*` e sem script `lint` no `package.json`, nem no
frontend nem no backend. O gate estático do projecto é só `tsc --noEmit` + `vite build`.

Nem o `tsc` nem o Vite reprovam um identificador indefinido dentro de JSX ou de um `.mjs`. Caso
real encontrado nesta sessão: `cli/joca.mjs` chamava `rel(c.ts)` na saída do comando `task`, e
`rel` **não estava definido em lado nenhum do ficheiro** — `joca task <id>` rebentava com
`ReferenceError` sempre que a tarefa tivesse notas, com build verde e zero avisos. As regras
`no-undef` e `react/jsx-no-undef` fecham exactamente isto.

O código estava publicado assim; só desapareceu porque o comando foi removido por outro motivo.

---

## 3. Cobertura de testes assimétrica

| | Valor |
|---|---|
| Endpoints HTTP | 54 |
| Ficheiros de teste que exercitam rotas | **0** (nenhum supertest) |
| Testes no frontend | **0** |
| Testes existentes | 38, unitários puros |

Os 38 (`backend/src/__tests__/`) cobrem cron, chunking de escrita no PTY, perfis de CLI,
notificações e segurança de paths — bom material, mas não tocam na camada HTTP nem no
`session-manager`, que é onde vivem o `node-pty` e o acesso ao disco.

Maior risco por euro: testes de contrato em `/projects` e `/sessions`.

---

## 4. Dois monólitos

| Ficheiro | Linhas |
|---|---|
| `frontend/src/App.css` | 7361 |
| `frontend/src/components/SessionSidebar.tsx` | 1441 |
| `frontend/src/App.tsx` | 973 (87 hooks; 30 props passadas só à sidebar) |

A convenção de CSS por componente **já existe** — há 9 ficheiros ao lado dos componentes
(`project-modal.css`, `DashboardView.css`, `agents-view.css`, …). Só não foi levada até ao fim.
Migrar secção a secção à medida que se lhes toca é barato; um big-bang não se paga.

---

## 5. CSS morto: 180 classes

Critério apertado — nem o nome nem o prefixo de dois segmentos aparecem em qualquer `.ts`/`.tsx`
(um critério mais frouxo dava 276, com falsos positivos de nomes montados por template literal).
Verificado por amostragem manual.

| Ficheiro | Classes |
|---|---|
| `App.css` | 158 |
| `components/DashboardView.css` | 15 |
| `components/TerminalView.css` | 4 |
| `components/agents-view.css` | 3 |

Exemplos: `action-picker-*`, `create-skill-modal`, `builder-card`, `automation-trigger`,
`av-status-*`. São restos de funcionalidades removidas — a mesma espécie da
`.project-group-action--remove`, que estava órfã desde que o botão de remover saiu da barra e foi
reaproveitada hoje quando ele voltou.

---

## 6. Bundle num só chunk

`607 kB` de JS (167 kB gzip) + `204 kB` de CSS, um único chunk, com aviso do Vite a cada build.
Candidatos naturais a `import()` dinâmico: o xterm.js e o modal de projecto.

---

## O que está bem (medido, não presumido)

- **0 vulnerabilidades** — `npm audit --omit=dev` nos dois lados
- **0 botões sem nome acessível** em 29 no dashboard. Raro, e não por acaso: o código traz um
  comentário sobre `htmlFor` não nomear elementos que rendem `<button>`
- `(hover:none)` e `(pointer:coarse)` tratados de propósito, com o raciocínio escrito no CSS
  (`App.css:7098` explica porque é `pointer:coarse` e não largura)
- Apenas **4** TODO/FIXME em ~24 500 linhas de código
- Os comentários registam **porquê**, muitos com a regressão datada que os motivou. É o que
  permitiu remover o sistema de Tarefas sem partir as automações: a fronteira estava escrita.

---

## Ordem sugerida

1. **A regressão dos 21px** (§1) — é de um minuto e foi introduzida hoje
2. **eslint** (§2) — o gate que falta, e há prova de um bug real que ele teria apanhado
3. **Testes de rota** (§3) — 54 endpoints sem rede de segurança

§4-§6 são higiene: fazem-se ao de leve, à medida que se toca em cada zona.

---

## Como reproduzir

```bash
# tamanhos
find backend/src frontend/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' | xargs wc -l | sort -rn | head

# eslint (ausência)
ls frontend/eslint.config.* backend/eslint.config.* 2>/dev/null; grep '"lint"' */package.json

# endpoints vs testes de rota
grep -rhoE "r\.(get|post|put|patch|delete)\('[^']+'" backend/src/http/*.ts | wc -l
grep -rl "supertest\|request(app)" backend/src/__tests__/ | wc -l

# vulnerabilidades
(cd frontend && npm audit --omit=dev); (cd backend && npm audit --omit=dev)
```

Os alvos de toque e o contraste foram medidos ao vivo com Playwright contra `:7592` — medir no que
é **pintado** (`getBoundingClientRect`, `getComputedStyle`), nunca no token declarado.
