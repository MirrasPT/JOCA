---
name: html-review
description: "Converting markdown documentation to visual HTML format for review or presentation. MUST be invoked when the user says: gerar html, review html, html do prd, html review, visualizar documento, preview do plano, exportar html, documento para revisao. SHOULD also invoke when: html bonito, render markdown, mostrar documento."
triggers: gerar html, review html, html do prd, html review, visualizar documento, preview do plano, exportar html, documento para revisao, html bonito, render markdown, mostrar documento
---
# HTML Review Generator

Converte documentos `.md` do planning num `.html` visual para revisao humana.

**Input:** qualquer `.md` gerado pelo planning (PRD, TECH_SPEC, ADR, RFC, TASKS, C4 diagrams)
**Output:** `docs/review/<nome>.html` — ficheiro self-contained, sem dependencias externas

---

## Quando activar

- Final da pipeline de planning (apos gerar qualquer documento)
- Pedido explicito de review/visualizacao
- Antes de partilhar documento com stakeholders

---

## Processo

### 1. Identificar documentos

Procurar na raiz do projecto e em `docs/`:
- `PRD.md`
- `TECH_SPEC.md`
- `TASKS.md`
- `docs/adr/*.md`
- `docs/rfcs/*.md`
- `docs/architecture/*.md`

Se o utilizador especificar um ficheiro, converter so esse. Se nao, perguntar:
```
Qual documento queres em HTML?
1. PRD
2. Tech Spec
3. Tasks
4. Todos os documentos (bundle)
```

### 2. Converter markdown para HTML

Usar script bash com ferramentas disponiveis:

```bash
# Opcao A: pandoc (se disponivel)
pandoc "$INPUT" -f markdown -t html5 --standalone --metadata title="$TITLE" -o "$OUTPUT"

# Opcao B: python-markdown (se disponivel)
python3 -c "
import markdown, sys
with open(sys.argv[1]) as f:
    md = f.read()
html = markdown.markdown(md, extensions=['tables', 'fenced_code', 'toc', 'meta'])
print(html)
" "$INPUT" > "$OUTPUT_BODY"

# Opcao C: fallback manual (sempre disponivel)
# Ler o .md, gerar HTML directamente com Write tool
```

### 3. Aplicar template HTML

O HTML final DEVE ser self-contained. Template:

```html
<!DOCTYPE html>
<html lang="pt" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}} — Review</title>
  <style>
    :root {
      --bg: #ffffff;
      --bg-secondary: #f8f9fa;
      --text: #1a1a2e;
      --text-muted: #6c757d;
      --accent: #2563eb;
      --accent-light: #dbeafe;
      --border: #e2e8f0;
      --code-bg: #1e1e2e;
      --code-fg: #cdd6f4;
      --success: #16a34a;
      --warning: #d97706;
      --error: #dc2626;
      --radius: 8px;
      --shadow: 0 1px 3px rgba(0,0,0,0.08);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      line-height: 1.7;
      color: var(--text);
      background: var(--bg-secondary);
      padding: 2rem;
    }

    .container {
      max-width: 860px;
      margin: 0 auto;
      background: var(--bg);
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      padding: 3rem;
    }

    .header {
      border-bottom: 2px solid var(--accent);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }

    .header h1 { font-size: 2rem; font-weight: 700; }
    .header .meta { color: var(--text-muted); font-size: 0.875rem; margin-top: 0.5rem; }
    .header .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-prd { background: var(--accent-light); color: var(--accent); }
    .badge-spec { background: #fef3c7; color: var(--warning); }
    .badge-adr { background: #dcfce7; color: var(--success); }
    .badge-rfc { background: #fce7f3; color: #db2777; }

    nav.toc {
      background: var(--bg-secondary);
      border-radius: var(--radius);
      padding: 1.25rem 1.5rem;
      margin-bottom: 2rem;
    }
    nav.toc h2 { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: 0.75rem; }
    nav.toc ul { list-style: none; }
    nav.toc li { padding: 0.25rem 0; }
    nav.toc a { color: var(--accent); text-decoration: none; font-size: 0.9rem; }
    nav.toc a:hover { text-decoration: underline; }

    h1 { font-size: 1.75rem; margin-top: 2.5rem; margin-bottom: 0.75rem; }
    h2 { font-size: 1.4rem; margin-top: 2rem; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
    h3 { font-size: 1.15rem; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    p { margin-bottom: 1rem; }
    ul, ol { margin-bottom: 1rem; padding-left: 1.5rem; }
    li { margin-bottom: 0.25rem; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0 1.5rem;
      font-size: 0.9rem;
    }
    th {
      background: var(--bg-secondary);
      font-weight: 600;
      text-align: left;
      padding: 0.75rem 1rem;
      border-bottom: 2px solid var(--border);
    }
    td { padding: 0.6rem 1rem; border-bottom: 1px solid var(--border); }
    tr:hover td { background: var(--bg-secondary); }

    pre {
      background: var(--code-bg);
      color: var(--code-fg);
      border-radius: var(--radius);
      padding: 1.25rem;
      overflow-x: auto;
      margin: 1rem 0 1.5rem;
      font-size: 0.85rem;
      line-height: 1.6;
    }
    code {
      font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
      font-size: 0.85em;
    }
    :not(pre) > code {
      background: var(--bg-secondary);
      padding: 0.15em 0.4em;
      border-radius: 4px;
      color: var(--accent);
    }

    blockquote {
      border-left: 3px solid var(--accent);
      background: var(--accent-light);
      padding: 1rem 1.25rem;
      margin: 1rem 0 1.5rem;
      border-radius: 0 var(--radius) var(--radius) 0;
    }
    blockquote p:last-child { margin-bottom: 0; }

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .status-done { background: #dcfce7; color: var(--success); }
    .status-pending { background: #fef3c7; color: var(--warning); }
    .status-blocked { background: #fee2e2; color: var(--error); }

    .footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 0.8rem;
      text-align: center;
    }

    .mermaid {
      background: var(--bg);
      padding: 1rem;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      margin: 1rem 0;
      text-align: center;
    }

    @media (max-width: 640px) {
      body { padding: 1rem; }
      .container { padding: 1.5rem; }
    }

    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; padding: 0; }
    }
  </style>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
  </script>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge badge-{{TYPE}}">{{TYPE}}</span>
      <h1>{{TITLE}}</h1>
      <div class="meta">Gerado em {{DATE}} &middot; Fonte: <code>{{SOURCE_FILE}}</code></div>
    </div>
    <nav class="toc">
      <h2>Indice</h2>
      {{TOC}}
    </nav>
    <main>
      {{CONTENT}}
    </main>
    <div class="footer">
      Documento de revisao gerado por JOCA &middot; Fonte de verdade: <code>{{SOURCE_FILE}}</code>
    </div>
  </div>
</body>
</html>
```

### 4. Conversao de Mermaid

Se o `.md` contem blocos ` ```mermaid `:
- Envolver em `<div class="mermaid">...</div>` (renderiza client-side via CDN)

### 5. Conversao de status/checkboxes

- `- [x]` → `<span class="status-badge status-done">Done</span>`
- `- [ ]` → `<span class="status-badge status-pending">Pending</span>`

---

## Output

Guardar em `docs/review/<nome>.html`:
- `PRD.md` → `docs/review/prd.html`
- `TECH_SPEC.md` → `docs/review/tech-spec.html`
- `TASKS.md` → `docs/review/tasks.html`
- `docs/adr/0001-*.md` → `docs/review/adr-0001.html`
- `docs/rfcs/RFC-001.md` → `docs/review/rfc-001.html`

Bundle mode: `docs/review/planning-bundle.html` — todos num so ficheiro com tabs/navegacao.

Abrir automaticamente:
```bash
open "docs/review/<nome>.html"
```

---

## Regras

1. O `.html` e read-only — NUNCA editar o HTML; editar o `.md` e re-gerar
2. O `.md` e a fonte de verdade para Claude Code
3. O `.html` e para revisao humana e partilha com stakeholders
4. Self-contained: zero dependencias externas alem do Mermaid CDN
5. Nao commitar os `.html` por defeito — adicionar a `.gitignore` se nao pedido

---

## Pipeline integration

Etapa final do planning. Apos qualquer skill do planning gerar/actualizar um `.md`:

```
prd → prd-reviewer → tech-spec → c4-diagram → task-breakdown → plan → html-review
```

Notificar: "Documento gerado. Queres HTML para review?"
