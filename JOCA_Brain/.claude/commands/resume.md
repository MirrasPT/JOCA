# /resume — Carregar contexto da sessão

Corre no início de cada sessão de trabalho num projecto.

## Passos

### 1. Identificar projecto actual
Determinar o **path-alvo**: o 1º argumento se dado (ex.: `/resume <YOUR_PROJECTS_DIR>\MeuProjecto`), senão o CWD.

**Resolver PRIMEIRO por caminho (`directorio:` do frontmatter), e só se o caminho não casar é que se cai para match por nome.** Uma pasta-mãe e um subdir podem ter entradas separadas (umbrella vs sub-projecto); casar pelo nome primeiro carrega a errada.

**Prioridade 1 — por CAMINHO** (`directorio:` == path-alvo):
```bash
grep -rIl "^directorio: *<path-alvo>$" memory/projects/*.md   # match EXACTO do path
```
1. **Match exacto** (`directorio:` == path-alvo) → é essa a entrada. Carregar essa.
2. **Múltiplos matches exactos** (ex.: `<nome>.md` + `<nome>-geral.md` ambos com o mesmo `directorio`) → carregar a **umbrella** primeiro (a que tem `-geral` no nome, ou a de descrição mais abrangente) e listar as irmãs.
3. **Path-alvo é pasta-MÃE de entradas** (nenhum match exacto, mas há entradas cujo `directorio` começa por `<path-alvo>`) → listar todas e apresentar a umbrella se existir, não uma só sub-entrada.
4. **Path-alvo é SUBDIR de uma entrada** → carregar essa entrada-mãe.

**`directorio:` aceita LISTA.** Um projecto pode viver legitimamente em mais do que um path — este
utilizador alterna entre 2 máquinas (macOS + Windows) e vários projectos existem nas duas. O
frontmatter suporta as duas formas:

```yaml
directorio: /Users/<user>/Projectos/meu-projecto                  # 1 path
directorio: [/Users/<user>/Projectos/meu-projecto, C:\Users\<user>\Projetos\meu-projecto]
```

A Prioridade 1 casa contra **qualquer** elemento da lista. Só se nenhum casar é que se desce ao
fallback por nome — e é aí que o aviso faz sentido.

**Prioridade 2 — por NOME** (fallback, só se a Prioridade 1 não deu nada — ex.: o `directorio:` na memória está desactualizado/movido, ou a pasta não bate certo com nenhum `directorio`): fazer match do **basename do path-alvo** (normalizado: minúsculas, `_`/espaços→`-`) contra o `name:`/ficheiro das entradas em `memory/projects/`. Se casar, carregar essa entrada **e avisar** que se resolveu por nome porque o `directorio:` não bateu.
⚠ **O conselho de correcção depende do caso:** se o path-alvo é uma *segunda máquina* legítima →
**acrescentar** o path à lista `directorio:`, nunca substituir (substituir parte a resolução na
outra máquina). Só sugerir substituição quando o path antigo já não existe.

> Exemplo (por caminho): `/resume <YOUR_PROJECTS_DIR>\MeuProjecto` → umbrella `meu-projecto-geral.md` (`directorio` == pasta-mãe). `/resume <YOUR_PROJECTS_DIR>\MeuProjecto\2026_Nova_Plataforma` → `meu-projecto.md` (`directorio` == subdir da plataforma). Nunca o inverso.

**Nenhuma relação nem por caminho nem por nome** → sugerir correr `/init-project` primeiro.

### 1b. Arg opcional: `<git-remote-url>`

Se o comando for invocado com um 2º argumento (URL de remote GitHub/GitLab):
1. Verificar se o repo local tem esse remote: `git remote -v`
2. Se não tiver: `git remote add origin <url>` → `git fetch origin` → comparar working tree vs `origin/<branch-default>`
3. Reportar divergência de forma **não-destrutiva** (nunca `reset --hard` sem confirmação explícita)
4. Se tiver mas apontar para URL diferente: reportar conflito, não alterar automaticamente

### 2. Ler contexto do projecto
Ler a **entrada resolvida no passo 1** — estado actual, decisões tomadas, pendentes. Se for uma umbrella, seguir os `[[links]]` para as sub-entradas relevantes ao que o utilizador for fazer (não despejar todas de uma vez).

#### 2a. Restaurar checkpoint + Brain (machine-readable)

Antes da prosa, carregar o estado estruturado (adaptado de gstack context-restore):
```bash
node .claude/scripts/joca-checkpoint.mjs latest --slug <projecto>  # snapshot: decisões/restante/próxima acção
node .claude/scripts/joca-brain.mjs active                          # decisões activas (event-sourced)
```
⚠ **`--slug <projecto>` é obrigatório, com o nome resolvido no passo 1.** Sem ele o script deriva o
slug do **repo do cwd**, e duas sessões concorrentes escrevem na mesma pasta: já aconteceu o `latest`
devolver o checkpoint de outro projecto (guardei o do rate-it-plus às 20:54, outra sessão gravou às
21:29, e a minha "próxima acção" ficou invisível ao `/resume`). O ficheiro não se perde — deixa é de
ser encontrado pelo caminho que o `/resume` usa.
- O checkpoint dá a **próxima acção** exacta da sessão anterior (restauro cross-branch).
- As decisões activas do Brain são a fonte de verdade atómica (sobre a prosa, em caso de conflito).
- Nota: o hook `session-intake` já injecta o recall (decisões+aprendizagens) no arranque; este passo é o restauro explícito + próxima-acção dentro do `/resume`.

#### 2b. Detectar drift memória vs git

Após ler a memória do projecto, comparar com o estado real do git:
```bash
git log --oneline -5       # últimos 5 commits reais (branch actual)
git branch -a | head -20   # TODAS as branches (locais + remotas)
git log --oneline --all | head -10  # histórico de TODAS as branches
```
- **Antes de declarar trabalho "perdido/nunca committado": correr `git log --all` + `git branch -a` é Step 0 obrigatório.** Branches `backup/*`, `stash/*`, ou outra branch que não a actual escondem trabalho real após um switch de remote. Se detectar `backup/*` → `⚠ Existe branch de backup — verificar antes de reconstruir trabalho`. (Caso real: um backoffice completo estava em `backup/local-pre-dev` e foi declarado perdido.)
- Extrair a data da secção **"Última sessão"** da memória
- Se o commit mais recente for **>14 dias depois** da data de memória: alertar com `⚠ MEMÓRIA DESACTUALIZADA — último commit é X dias mais recente que a memória`
- Se houver commits com mensagens que contradizem o "Estado actual" (ex.: memória diz "backend pendente" mas há commits "feat: complete backend"): alertar e re-inferir estado a partir do git

Nunca confiar cegamente na memória se o git divergir. Ler ficheiros-chave (ex.: `CLAUDE.md` do projecto, `package.json`) para confirmar stack/estado real.

#### 2c. Afirmações perecíveis — a memória é pista, não facto

O drift do 2b compara memória ↔ **git**. Não cobre memória ↔ **estado vivo** (BD, infra, contas), que
apodrece em silêncio e é onde mora o risco real:

- A memória dizia "prod tem 2 users (id2 Mirras, id14 Joana)". Realidade: **4 users, com IDs
  diferentes**, um deles pessoa real registada depois do go-live. Copiar dados staging→prod por
  `user_id` a partir dessa nota teria escrito por cima de um utilizador real.
- A memória e dois docs anunciavam há meses um admin do Bigorna que **não existia**: a BD tinha 0
  users/0 roles. O `curl /admin/login → 200` reforçava a ilusão — a porta estava lá, faltava a chave.
- Uma receita de FTP documentada como *a* solução tinha sido validada **uma vez, com um ficheiro**.
  Falhou nos 2 maiores e partiu o site.

Marcar como **perecível** qualquer afirmação sobre estado vivo (contagens, IDs, credenciais, infra,
receitas de comando) — datada e com as condições em que foi validada ("validado 1×, ficheiro de
600 MB"). No `/resume`, listá-las como *a revalidar*, não como facto.

**Regra dura: antes de qualquer escrita em produção derivada da memória, revalidar contra a fonte.**

#### 2d. Pasta local vazia — o projecto vive noutra máquina

Se o path-alvo existe mas está **vazio ou sem `.git`**, e a memória tem o projecto com repo remoto:
não é um projecto novo, é esta máquina que ainda não o tem. Fluxo (repetível — 2 máquinas alternadas):

1. `gh repo clone <owner>/<repo> <path>` — para repos **privados** usar o `gh`; o `git clone https`
   pendura à espera de credenciais.
2. Listar o que é **gitignored e portanto não veio**: `.env`, base de dados, `uploads/`, `storage/`.
   Ir buscá-los à origem real (VPS/cPanel/backup) — a memória do projecto diz onde.
3. Instalar dependências (`npm install` / `composer install`).
4. **Verificar coerência BD ↔ disco**: registos que apontem para ficheiros que não existem localmente.
5. Só depois arrancar. Portas: respeitar as hard rules do projecto.

Se o projecto envolver geração de imagens: verificar se `Branding.md` ou a entrada de memória define `default_model`. Se sim, incluir no resumo final para evitar usar modelo errado.

### 3. Verificar knowledge graphs

⚠ **Nota:** `graphify update .` e `graphify . --update` não funcionam (bug CLI). Usar sempre a Python API:
```bash
python -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('<path>'))"
```

⚠ **Interpretador (Windows):** usar `python`, **não** `python3` — neste ambiente `python3` é o stub vazio da Microsoft Store (`ModuleNotFoundError: No module named 'graphify'`) e o passo falha silenciosamente. macOS/Linux usam `python3`. Detectar o que tem graphify:
```bash
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" -c "import graphify" 2>/dev/null && break; done
```

⚠ **Exclusões:** em projectos PHP/JS, o scan recursivo apanha `vendor/`, `node_modules/`, `storage/`, `bootstrap/cache/`, `out/`, `public/` → dezenas de milhar de nós de ruído (>5000 = HTML saltado). Garantir que estes patterns ficam excluídos antes de reconstruir (o `graphify-deps.py` já os ignora por omissão).

**Graph do projecto:**
- Se não existir `graphify-out/graph.json`:
  - Projecto com código (Python/JS/PHP): correr Python API acima
  - Projecto HTML/design/docs: correr `python JOCA/.claude/scripts/graphify-deps.py <path>` + `graphify cluster-only <path>`
- Se existir mas for antigo (>7 dias): correr Python API para actualizar
- Se existir: ler `graphify-out/GRAPH_REPORT.md`

**Graph do JOCA:**
- Se existir `<caminho JOCA>/graphify-out/GRAPH_REPORT.md`: ler para contexto de agentes e skills disponíveis
- Se não existir: correr Python API com path do JOCA

### 3b. Se o projecto actual É o toolkit JOCA

Quando a pasta de trabalho é o próprio repo JOCA (contém `JOCA_Brain/CLAUDE.md`), surgir no resumo as workflows de manutenção disponíveis:
- `/upgrade-joca` — processa feedback acumulado em `memory/feedback/`
- Nota Windows: o JOCA_OS é desenvolvido em macOS; em Windows a skill `joca-os-windows` adapta/testa/corrige o UI.

### 3c. Para projectos com código existente — propor iteration flow

Se o projecto já tem código (detectável por existência de `package.json`, `composer.json`, `src/`, `app/`):
- **Não** apresentar apenas o contexto passivamente
- Propor o flow de iteração adequado ao estado:

| Estado detectado | Flow sugerido |
|-----------------|---------------|
| Tem pendentes de bug/fix | → `[/debug]` ou fix directo |
| Tem pendentes de feature | → `[/plan]` → implement |
| Estado: "completo" mas sem deploy | → `[/deploy-executor]` ou checklist de deploy |
| Sem pendentes claros | → "O que queres fazer? (review, feature, fix, deploy)" |

Indicar o flow em 1 linha no resumo, não como pergunta — o utilizador redirige se quiser outra coisa.

**Projectos com `composer.json` (Laravel/PHP) em Windows:** verificar `php -v 2>&1` no arranque. Se falhar (PHP não está no PATH), alertar com o path do binário PHP local — `<YOUR_PHP_PATH>` — e sugerir add ao PATH ou usar `& <YOUR_PHP_PATH> artisan ...`. Sem isto, qualquer operação artisan/composer falha silenciosamente e acaba-se a usar Python/sqlite directamente para a BD.

### 4. Apresentar resumo ao utilizador

```
Projecto: <nome>
Stack: <stack>

Estado: <estado actual>

Última sessão:
- <o que foi feito>

Pendente:
- <item 1>
- <item 2>

Graph projecto: ✓ actualizado em <data>
Graph JOCA:     ✓ disponível
```

Pronto para trabalhar.
