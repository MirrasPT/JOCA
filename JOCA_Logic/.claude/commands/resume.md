# /resume — Carregar contexto da sessão

Corre no início de cada sessão de trabalho num projecto.

## Passos

### 1. Identificar projecto actual
Verificar em que pasta estamos. Procurar entrada correspondente em `memory/projects/` (no JOCA_Logic).

Se não existir entrada: sugerir correr `/init-project` primeiro.

**Sessão sem /save?** Se `.joca/last-session.json` for mais recente que a memória do projecto, avisar: "Última sessão terminou sem /save. Ficheiros tocados: [...]".

### 2. Ler contexto do projecto
A **memória curta** (`memory/curta.md`) já foi injectada pelo hook SessionStart — não reler. Ler `memory/projects/<nome>.md` — começar pelo bloco **Retoma** (Next step / Files touched / Open decisions / Verify with), depois estado actual, decisões, pendentes.

**Perguntas sobre o passado** (semana passada, "o que decidimos sobre X"):
```bash
python3 .claude/scripts/memory-search.py <termos>       # resumos (longa) + diário
python3 .claude/scripts/memory-search.py --deep <termos> # com contexto do diário
```
Fluxo: curta (no contexto?) → longa (acha o log) → `Read()` ao diário para detalhe exacto.

**Factos operacionais verificam-se, não se reportam da memória.** Branch, dirty state, portas, servidores → confirmar com comandos reais antes de apresentar:
```bash
git status -sb
lsof -i :7371 -i :7372 2>/dev/null | head -5   # se relevante
```
Conflito entre memória e realidade → a realidade ganha; corrigir a memória no próximo /save.

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

### 4. Verificar feedback pendente

```bash
ls memory/feedback/*.md 2>/dev/null | wc -l
```

Se N > 0: incluir no resumo "Feedback pendente: N items (mais antigo: <data>) → considerar /upgrade-joca".

### 5. Apresentar resumo ao utilizador

```
Projecto: <nome>
Stack: <stack>

Estado: <estado actual>
Next step: <do bloco Retoma>

Última sessão:
- <o que foi feito>

Pendente:
- <item 1>
- <item 2>

Branch: <verificado com git status -sb>
Feedback pendente: N items [→ /upgrade-joca]
Graph projecto: ✓ actualizado em <data>
Graph JOCA:     ✓ disponível
```

Pronto para trabalhar.
