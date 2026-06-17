# /resume — Carregar contexto da sessão

Corre no início de cada sessão de trabalho num projecto.

## Passos

### 1. Identificar projecto actual
Verificar em que pasta estamos. Procurar entrada correspondente em `JOCA/memory/projects/`.

Se não existir entrada: sugerir correr `/init-project` primeiro.

### 2. Ler contexto do projecto
Ler `JOCA/memory/projects/<nome>.md` — estado actual, decisões tomadas, pendentes.

Se o projecto envolver geração de imagens: verificar se `Branding.md` ou a entrada de memória define `default_model`. Se sim, incluir no resumo final para evitar usar modelo errado.

### 3. Verificar knowledge graphs

⚠ **Nota:** `graphify update .` e `graphify . --update` não funcionam (bug CLI). Usar sempre a Python API:
```bash
python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('<path>'))"
```

**Graph do projecto:**
- Se não existir `graphify-out/graph.json`:
  - Projecto com código (Python/JS/PHP): correr Python API acima
  - Projecto HTML/design/docs: correr `python3 JOCA/.claude/scripts/graphify-deps.py <path>` + `graphify cluster-only <path>`
- Se existir mas for antigo (>7 dias): correr Python API para actualizar
- Se existir: ler `graphify-out/GRAPH_REPORT.md`

**Graph do JOCA:**
- Se existir `<caminho JOCA>/graphify-out/GRAPH_REPORT.md`: ler para contexto de agentes e skills disponíveis
- Se não existir: correr Python API com path do JOCA

### 3b. Se o projecto actual É o toolkit JOCA

Quando a pasta de trabalho é o próprio repo JOCA (contém `JOCA_Logic/CLAUDE.md`), surgir no resumo as workflows de manutenção disponíveis:
- `/sync-questionnaires` — realinha questionários/contadores (`/install`, `/init-project`, `README`, `INDEX`) com o inventário real de skills/agents
- `/upgrade-joca` — processa feedback acumulado em `memory/feedback/`
- Nota Windows: o JOCA_UI é desenvolvido em macOS; em Windows a skill `joca-ui-windows` adapta/testa/corrige o UI.

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
