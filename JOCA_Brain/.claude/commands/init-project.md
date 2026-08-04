# /init-project — Ligar um projecto ao JOCA

Corre a partir da pasta do projecto.

**A regra que manda neste comando:** *uma pergunta que o disco já responde é uma pergunta que não se
faz.* Primeiro olha-se para a pasta; só o que sobrar é conversa. Um projecto Laravel com `CLAUDE.md`,
git e um `composer.json` não precisa que lhe perguntem se é "dev ou marketing".

> Isto substitui o questionário fixo que este comando era. Um formulário com ramos e sub-ramos
> obrigava a mantê-lo alinhado com o inventário de skills (era esse o trabalho do antigo
> `/sync-questionnaires`, agora removido) e, pior, perguntava ao utilizador coisas que estavam
> escritas no `package.json` a dois metros de distância.

---

## FASE 0 — Levantamento (zero perguntas)

Corre tudo isto **antes** de abrir a boca. É barato e responde à maioria das perguntas antigas.

```bash
node --version >/dev/null 2>&1 || echo "AVISO: sem Node.js — necessário, parar aqui"

ls -A                                     # a pasta está vazia?
cat CLAUDE.md 2>/dev/null || cat claude.md 2>/dev/null || echo "SEM_CLAUDE_MD"
cat README.md 2>/dev/null | head -40
git rev-parse --is-inside-work-tree 2>/dev/null && git remote -v && git log --oneline -5
ls package.json composer.json requirements.txt pyproject.toml go.mod Cargo.toml Gemfile \
   wp-config.json .shopify 2>/dev/null
```

E, se existir memória para esta pasta no Brain, **lê-a antes de perguntar seja o que for**:

```bash
grep -rl "$(pwd)" <JOCA_ROOT>/JOCA_Brain/memory/projects/ 2>/dev/null
```

### O que o levantamento decide sozinho

| Sinal encontrado | Conclusão — não perguntar |
|---|---|
| `package.json` / `composer.json` / `pyproject.toml` / `go.mod` … | stack e gestor de dependências |
| `artisan`+`composer.json` · `next.config.*` · `vite.config.*` · `wp-config.php` · `.shopify` | framework/plataforma |
| `git remote -v` | repositório, se é privado/público, o dono |
| `git log` | se está vivo, há quanto tempo, quem lá mexe |
| `CLAUDE.md` já existente | nome, objectivo, convenções — o projecto **já foi inicializado** (ver abaixo) |
| entrada em `memory/projects/*.md` com este `directorio:` | já está ligado ao JOCA; isto é uma **re-inicialização** |
| pasta vazia (ou só `.git`) | projecto novo — é o único caso em que quase tudo tem de ser perguntado |

### Os três estados possíveis

1. **Pasta vazia** → projecto novo. Passa à FASE 1 com as perguntas todas (são poucas).
2. **Pasta com projecto, sem `CLAUDE.md` nem memória** → o caso normal. Infere tudo o que puderes e
   pergunta **só** o que não se lê no disco (ver FASE 1).
3. **Pasta já inicializada** (`CLAUDE.md` e/ou entrada de memória) → **não recomeçar**. Mostra o que
   já existe, confirma o que mudou desde então, e trata isto como actualização. Nunca sobrescrever
   um `CLAUDE.md` existente — acrescentar secções em falta.

---

## FASE 1 — Só as lacunas

Faz **apenas** as perguntas cuja resposta não saiu da FASE 0. Uma de cada vez, esperando resposta.
≤4 opções exclusivas → `AskUserQuestion`; mais do que isso ou multi-select → lista numerada.

O que o disco tipicamente **não** diz, por ordem de importância:

1. **Para que serve** — o objectivo em 1-2 frases. Um `README` pode dá-lo; se der, confirma em vez de perguntar.
2. **O que queres do JOCA aqui** — construir features · manter/corrigir · rever/auditar · conteúdo e SEO · design · investigação. Determina as skills e os agentes que fazem sentido.
3. **Onde está publicado**, se estiver — produção/staging, e como se faz deploy. Só se houver sinal de deploy (Dockerfile, `.github/workflows`, scripts de deploy).
4. **Restrições que não se vêem no código** — prazos, decisões fechadas, o que não se pode tocar.

Para **pasta vazia**, acrescenta: nome, tipo de projecto e stack pretendida.

**Não perguntar:** que skills usar (deduz-se do stack pelo Trigger Map do `CLAUDE.md`), nem que CLIs
instalar (deduz-se da plataforma — `wp-cli` para WordPress, `shopify` para Shopify, etc.). Propõe-se
na FASE 2 e o utilizador corrige se quiser. Perguntar item a item é o que tornava isto um formulário.

---

## FASE 2 — Proposta e gate único

Apresenta o que percebeste e o que vais fazer. **Um só ponto de confirmação** em todo o comando.

```
PROJECTO: <nome> — <tipo>
Stack:     <detectado no disco>            ← detectado, não declarado
Objectivo: <1 linha>
Git:       <remote> · <N commits> · <branch>

SKILLS QUE VOU ACTIVAR:  <lista deduzida do stack>
CLIs QUE FALTAM:         <lista> (instalo? cada um com o comando)
PRD:                     <gerar agora | não aplicável | já existe>

VOU CRIAR/ACTUALIZAR
  CLAUDE.md                            ← navegação de código + secção Projecto
  PRD.md                               ← só se pedido
  <JOCA_ROOT>/JOCA_Brain/memory/projects/<nome>.md
  <JOCA_ROOT>/JOCA_Brain/memory/INDEX.md   ← uma linha
  ~/CLAUDE.md                          ← tabela de projectos activos
```

`AskUserQuestion`: "Confirmas?" → *Sim, aplicar* · *Deixa-me corrigir*.

---

## EXECUÇÃO

### 1. graphify (só projectos com código)

Saltar em conteúdo/marketing, design, e em plataformas sem código local (Wix editor, Shopify sem tema local).

```bash
# Windows: `python` (o `python3` é o stub vazio da Store); macOS/Linux: `python3`.
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" -c "import graphify" 2>/dev/null && break; done
"$PY" -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))" 2>/dev/null || echo "graphify indisponível — a saltar knowledge graph"
```

WordPress, se `wp-cli` existir: `wp core version` · `wp plugin list --status=active --format=csv`.

### 2. `CLAUDE.md` do projecto

Se **não** existir, criar. Se existir, **acrescentar só as secções em falta** — nunca reescrever.
Projectos sem código: omitir "Navegação de Código".

```markdown
## Navegação de Código

1. Consultar `graphify-out/GRAPH_REPORT.md` — god nodes, comunidades, perguntas sugeridas
2. Consultar `graphify-out/graph.json` para estrutura e dependências detalhadas
3. Ler ficheiros raw só quando necessário para editar ou o graph não tiver a resposta
4. Actualizar: `python -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"` (Windows: `python`; macOS/Linux: `python3`)

## Projecto
**Nome:** <nome>
**Stack:** <stack>
**Objectivo:** <descrição>
**Directório:** <caminho absoluto>
```

### 3. CLIs (se confirmados na FASE 2)

Instalar e **verificar cada um** (`wp --info`, `shopify version`, `stripe --version`…).
O que falhar vai para o relatório como PENDENTE, com o comando para o utilizador correr à mão.

### 4. Entrada de memória

> **Estado real vs PLANEADO (obrigatório).** A memória só pode afirmar "instalado/inicializado/
> configurado" depois de **verificar no disco**. O que ainda não foi feito marca-se `PLANEADO` /
> `POR VERIFICAR`. Contadores vêm de contagem real, nunca de estimativa. Registar setup
> aspiracional como concluído é a forma mais rápida de tornar a memória inútil.

`<JOCA_ROOT>/JOCA_Brain/memory/projects/<nome>.md`:

```markdown
---
name: <nome>
description: <stack e objectivo>
type: project
directorio: <caminho absoluto>
---

**Stack:** <stack>
**Objectivo:** <descrição>
**Directório:** `<caminho absoluto>`
**Iniciado:** <data>
**PRD:** <PRD.md existe | não gerado>
**Why:** <razão de existir>
**How to apply:** <como o JOCA deve ajudar aqui — skills e agentes a preferir>

## Estado actual
A iniciar.

## Decisões tomadas
<!-- preenchido por /save -->

## Pendente
<!-- preenchido por /save -->
```

`directorio:` é **obrigatório** — é por ele que o `graphify-global.py` inclui o projecto no grafo global.

> Se trabalhas a mesma pasta em **mais do que uma máquina** (caminhos diferentes para o mesmo
> projecto), acrescenta `directorio_win:` / `directorio_mac:` além do `directorio:`. Sem isso, cada
> máquina reescreve o campo da outra e a memória passa a apontar para um caminho que ali não existe.

Depois, uma linha em `memory/INDEX.md`, secção `## Projects`:
```markdown
- [<nome>.md](projects/<nome>.md) — <descrição curta>
```

### 5. `~/CLAUDE.md`
Acrescentar à tabela de projectos activos, se ainda lá não estiver.

### 6. `/create-skill` — só se a FASE 2 tiver identificado um gap real e o utilizador o aprovar.

### 7. Relatório

```
✓ CLAUDE.md do projecto criado/actualizado
✓ PRD.md gerado — se pedido
✓ CLIs instalados — <lista> (ou PENDENTE com o comando manual)
✓ Memória: <nome>.md criado (directorio: <caminho>)
✓ INDEX.md + ~/CLAUDE.md actualizados
[✓/○] graphify actualizado — se disponível

Pronto.
→ /resume no início de cada sessão
→ /save no fim, para guardar estado e memória
```

---

## Regras

- **Levantamento antes de pergunta.** Se a resposta está no disco, lê-a; não a peças.
- **Um gate só** (FASE 2). Confirmar passo a passo é o formulário outra vez.
- **Nunca sobrescrever** `CLAUDE.md`, `PRD.md` ou memória existentes — acrescentar o que falta.
- **Pasta já inicializada = actualização,** não recomeço.
- Skills e CLIs são **propostos** a partir do stack, nunca perguntados um a um.
