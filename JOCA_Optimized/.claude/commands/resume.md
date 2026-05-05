# /resume — Carregar contexto da sessão

Corre no início de cada sessão de trabalho num projecto.

## Passos

### 1. Identificar projecto actual
Verificar em que pasta estamos. Procurar entrada correspondente em `JOCA/memory/projects/`.

Se não existir entrada: sugerir correr `/init-project` primeiro.

### 2. Ler contexto do projecto
Ler `JOCA/memory/projects/<nome>.md` — estado actual, decisões tomadas, pendentes.

### 3. Verificar knowledge graphs

**Graph do projecto:**
- Se não existir `graphify-out/graph.json` e houver código: sugerir `graphify .`
- Se existir mas for antigo (>7 dias): sugerir `graphify . --update`
- Se existir: ler `graphify-out/GRAPH_REPORT.md`

**Graph do JOCA:**
- Se existir `<caminho JOCA>/graphify-out/GRAPH_REPORT.md`: ler para contexto de agentes e skills disponíveis
- Se não existir: sugerir `cd <caminho JOCA> && graphify .` para gerar

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
