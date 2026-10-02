# Pipelines — auto-runner de sequências nomeadas

Porquês e formas longas: `reference/doutrina-projecto.md` · `reference/gates-runtime.md`.

## O Auto-Runner (como uma pipeline corre)

Tarefa via **D** OU que casa uma pipeline abaixo → o **main loop** (ou `/goal`/playbook `master-orchestrator`):
1. **Selecciona** a pipeline pelo objectivo (domínio/triggers).
2. **Cada passo a fundo:** `Read()` a skill / despacha o agente — nunca superficial.
3. **Auto-decide** as intermédias **reversíveis** (princípios abaixo); irreversível → gate `AskUserQuestion` (`task-intake.md` §Segurança).
4. **Encadeia** via `chain:` (`chaining.md`); travão e steward em `task-intake.md` §Segurança — só passos da pipeline declarada.
5. **Final gate:** decisões de "taste"/ambíguas acumulam-se e levantam-se de uma vez no fim.

**Casar uma pipeline nomeada é ordem de execução**: não se pergunta "queres que corra X?" nem se anuncia à espera de "sim"; o único gate é o irreversível.

**Recon antes de autorar:** ficheiros do utilizador ou caminhos de um projecto → `memory/projects/<slug>/index.md` (campos `directorio*`) **antes** de varrer o disco. Depois, `grep`/`ls` ao domínio no projecto-alvo, **incluindo `tests/`** e, em monorepo, **todos** os manifestos (`find . -name package.json -not -path '*/node_modules/*'`) — passo inline, não 1.ª fase do workflow. Casos: `reference/doutrina-projecto.md`.

## Doutrina de projecto — vale SEMPRE, com ou sem `/start`

Qualquer projecto (novo, herdado, a meio). Unidade = **issue** · gate = **GitHub Actions** · estado = **`PROGRESSO.md`** · porquês = **`docs/DECISIONS.md`**.

| Momento | Acção |
|---|---|
| 1ª sessão sem `PROGRESSO.md` | levantamento do disco → `PROGRESSO.md` com o estado **observado** (`reference/start/progresso-formato.md`); uma pergunta só: "o que fazemos a seguir?" |
| Trabalho novo (ideia, bug, ecrã) | `novo-issue` **antes** de código; sem "Ficheiros prováveis" não está pronto |
| Ecrã/UI que não existe | `preparar-design` → `validar-design` (porteiro) → implementar |
| ≥3 issues sem plano | `planear-ondas` (milestones + `blocked-by` + `docs/ONDAS.md`) |
| ≥2 issues a implementar | onda: implementar (paralelo só com ficheiros disjuntos) → `escrever-testes` **noutra sessão** → `tester-code` → PR `Closes #N` → varredura transversal → gate de runtime → portão humano |
| **Plano com N passos** (auditoria, refactor, onda, correcção) | **N issues no GitHub** por milestone |
| **Problema encontrado** (bug, dívida, achado, TODO) | **issue na hora**, mesmo sem corrigir agora |
| Decisão técnica (stack, schema, fora-da-casa) | 1 entrada em `docs/DECISIONS.md` |
| Repo sem `.github/workflows/` | criar o CI (`github`) antes de fechar a onda seguinte |
| Fecho · fim de sessão | `/ship` → PR (`Closes #N`); `PROGRESSO.md` actualizado e commitado |

⚠ Não inventar documentos · o arranque não se globaliza · repo de terceiro · projecto sem repo · quando se escreve o estado · issue perecível → `reference/doutrina-projecto.md`.

## Gates: estático ≠ runtime

Build/`tsc` verdes provam que **compila**, não que **funciona**. **Quem escreve não assina o gate** (`chaining.md` §Verificação).
- **Pré-condição de UI: «consigo ver este ecrã?»** antes da 1.ª linha — atrás de login, resolver o acesso primeiro (o Chrome MCP não herda a sessão).
- **Vários PRs sem CI:** cada merge = rebase sobre a main actual + gates completos nessa árvore.
- **Estático (sempre):** `tsc --noEmit` · `npm run build` · `php -l` · **`eslint`** (único que apanha `jsx-no-undef`).
- **Runtime (obrigatório), evidência ao vivo:** clique = `elementFromPoint` em carga limpa · mobile = `getBoundingClientRect().right` vs `innerWidth`, descartando só ancestrais `overflow-x: auto|scroll` · auth = login end-to-end · despublicado = pedir os **ficheiros** por URL directo sem sessão · media = reproduzir · deploy = dependências do **HTML publicado** · config de app externa = caminho derivado da config da app + efeito observado, nunca `ls` ao ficheiro escrito.
- **Não reescrever o gate:** `node .claude/scripts/gate-runtime.mjs --base <url> [--rotas /,/precos] [--clicar "<seletor>"] [--login <f.json>] [--medir …] [--classes diff]`; sem `--clicar` mede só o repouso.

⚠ **Antes de assinar um gate de fase ou escrever um gate novo → `Read(".claude/reference/gates-runtime.md")`** (evidência mínima por ~20 categorias, flags, casos).

## Princípios de auto-decisão (intermédias reversíveis)

Por ordem: 1. **decisão activa do Brain** (`joca-brain active`) · 2. **convenção do projecto** · 3. **default da skill** do passo · 4. **menor superfície** (`skills/yagni.md`) · 5. sem base + irreversível → gate; sem base + reversível → escolhe e regista (`joca-brain decide --source agent`).

## Catálogo de pipelines

Nomes: autoplan · PRD → prod · Design (variantes → produção) · UI nova · Frontend produção · Feature Laravel · Admin Filament · API design · Hardening backend · E-commerce full-stack · Debug · QA loop · Ship · Segurança CSO · Deploy · Auditoria → correcção · Reparar PR · Retro · Marketing de marca · Produto novo (0 → produção) · Website · Identidade/branding · Projeto multi-tipo · Ecrã novo em projecto existente · Produto físico novo · Backlog → plano · Knowledge ingest · Research de mercado/recência · Self-improvement.

⚠ **Tarefa casa uma destas → `Read(".claude/reference/pipelines-catalogo.md")`** antes do 1.º passo (sequência + gates ⛔). `escrever-testes` corre sempre em sessão separada da que implementou.
