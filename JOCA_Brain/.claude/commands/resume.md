# /resume — Carregar contexto da sessão

Corre no início de cada sessão de trabalho num projecto.

## Passos

### 1. Identificar projecto actual
Verificar em que pasta estamos. Procurar entrada correspondente em `JOCA/memory/projects/`.

Se não existir entrada: sugerir correr `/init-project` primeiro.

### 1b. Arg opcional: `<git-remote-url>`

Se o comando for invocado com um 2º argumento (URL de remote GitHub/GitLab):
1. Verificar se o repo local tem esse remote: `git remote -v`
2. Se não tiver: `git remote add origin <url>` → `git fetch origin` → comparar working tree vs `origin/<branch-default>`
3. Reportar divergência de forma **não-destrutiva** (nunca `reset --hard` sem confirmação explícita)
4. Se tiver mas apontar para URL diferente: reportar conflito, não alterar automaticamente

### 2. Ler contexto do projecto
Ler `JOCA/memory/projects/<nome>.md` — estado actual, decisões tomadas, pendentes.

#### 2b. Detectar drift memória vs git

Após ler a memória do projecto, comparar com o estado real do git:
```bash
git log --oneline -5  # últimos 5 commits reais
```
- Extrair a data da secção **"Última sessão"** da memória
- Se o commit mais recente for **>14 dias depois** da data de memória: alertar com `⚠ MEMÓRIA DESACTUALIZADA — último commit é X dias mais recente que a memória`
- Se houver commits com mensagens que contradizem o "Estado actual" (ex.: memória diz "backend pendente" mas há commits "feat: complete backend"): alertar e re-inferir estado a partir do git

Nunca confiar cegamente na memória se o git divergir. Ler ficheiros-chave (ex.: `CLAUDE.md` do projecto, `package.json`) para confirmar stack/estado real.

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
- `/sync-questionnaires` — realinha questionários/contadores (`/install`, `/init-project`, `README`, `INDEX`) com o inventário real de skills/agents
- `/upgrade-joca` — processa feedback acumulado em `memory/feedback/`
- Nota Windows: o JOCA_UI é desenvolvido em macOS; em Windows a skill `joca-ui-windows` adapta/testa/corrige o UI.

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
