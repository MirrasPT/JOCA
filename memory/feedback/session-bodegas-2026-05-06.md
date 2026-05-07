---
name: Feedback sessão Bodegas do Campo (2026-05-06)
description: O que correu mal e o que melhorar no workflow JOCA — scraping, graphify, design iteration
type: feedback
session: bodegas-do-campo / HTML prototyping + graphify setup
---

# Feedback de Sessão — JOCA Workflow

## 1. Cadeia de fallback para scraping web não existe

**Problema:** Ao tentar raspar bodegasdocampo.com, o workflow falhou em cascata:
- Firecrawl → bloqueado por anti-bot
- browser-use → timeout aos 30s
- Playwright MCP → browsers não instalados (`npx playwright install` nunca foi feito)
- Solução final: `curl` com `User-Agent` de browser real

**Por que importa:** Perdeu-se tempo a tentar cada ferramenta sem saber qual devia vir a seguir.

**Fix:** Documentar no `memory/tools/mcp-routing.md` a cadeia de fallback explícita:
```
Scraping web:
1. mcp__firecrawl__firecrawl_scrape (primeira tentativa, sites públicos normais)
2. mcp__browser-use__browser_navigate (se Firecrawl falhar/bloquear)
3. mcp__playwright__playwright_navigate (se browser-use timeout — verificar se browsers instalados: npx playwright install)
4. curl -s -A "Mozilla/5.0..." (fallback universal, sempre funciona)
```

Adicionar nota: Playwright MCP requer `npx playwright install` na primeira vez — verificar antes de tentar.

---

## 2. graphify não funciona out-of-the-box em projectos design/markup

**Problema:** `graphify . --update` documentado em `tools/graphify.md` e em CLAUDE.md do projecto como o comando de update — não funciona em projectos sem código Python/JS. Resultado: "No code files found", grafo vazio.

**O que foi necessário:**
1. Patch manual de `extract.py` no package instalado (`uv tool upgrade` vai apagar o patch)
2. Script custom `graphify-deps.py` para relações pasta→ficheiro→asset
3. Pipeline de 3 passos via Python API directa (não CLI)

**Fix 1:** `tools/graphify.md` precisa de uma secção separada **"Projectos design/markup (HTML/CSS/assets)"** com o pipeline correcto:
```bash
# Para projectos HTML/CSS/design — NÃO usar `graphify . --update`
python3 - << 'EOF'
from pathlib import Path
from graphify.detect import detect; from graphify.extract import extract; import json
# ... Python API
EOF
python3 graphify-deps.py
graphify cluster-only .
```

**Fix 2:** `graphify . --update` no INDEX.md/CLAUDE.md deve ser marcado como "apenas para projectos com código AST (Python/JS/PHP)".

---

## 3. graphify-deps.py é um utilitário reutilizável preso num projecto

**Problema:** Criámos `graphify-deps.py` — um script que constrói o grafo de dependências ficheiro-sistema (pasta→ficheiro→asset, refs HTML src/href, links Markdown). Está em `/bodegas_do_campo/graphify-deps.py`. Cada projecto novo vai precisar disto.

**Fix:** Mover para JOCA como utilitário partilhado:
```
JOCA/.claude/scripts/graphify-deps.py  ← script genérico
```
Documentar em `tools/graphify.md` como "Script de dependências para projectos não-código".
O script já é genérico (usa `ROOT = Path(__file__).parent.resolve()`) — só precisa de ser copiado.

---

## 4. Iteração de design: 3 versões completas antes de chegar ao certo

**Problema:** Fizemos 3 homepages HTML completas (V1 → V2 → V3) antes de chegar ao design que o utilizador queria. V2 foi rejeitada em segundos.

**Root cause:** Nenhuma pergunta de discovery antes de começar. O utilizador disse "copia o design do Soalheiro" e eu implementei — mas ele queria apenas um elemento do Soalheiro (hero full-bleed), não o design todo.

**Fix:** A skill `huashu-design` ou `frontend-design` devia ter um checklist mínimo de discovery antes de qualquer protótipo HTML:

```
Antes de começar qualquer HTML hi-fi — confirmar:
□ Hero: split-screen / full-bleed / outro?
□ Fundo: branco / parchment / escuro / misto?
□ Referência visual: qual elemento copiar? (tudo? só layout? só cores?)
□ Nº de colunas no grid de produtos?
□ Vídeo ou imagem em secções CTA?
```

2 perguntas antes = 1 iteração em vez de 3.

---

## 5. CSS de prototype com erros básicos detectados tarde

**Problema:** O botão na secção About stretchia para 100% da largura (flex child num flex-column container). Foi apanhado tarde — só depois de screenshot do utilizador.

**Por que importa:** São erros óbvios num browser. Estávamos a trabalhar num ficheiro sem abrir o browser a cada iteração.

**Fix:** No workflow de prototipagem HTML, abrir o ficheiro no browser (via `open` ou servidor local) antes de reportar "feito". A regra já existe no CLAUDE.md global ("For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete") — foi simplesmente ignorada porque era um ficheiro estático local.

Lembrar: `open homepage-v3.html` é suficiente para ficheiros estáticos. Sem desculpas.

---

## 6. Patch directo ao package instalado é frágil

**Problema:** Patchámos `extract.py` dentro do `graphifyy` instalado via `uv tool`. Se `uv tool upgrade graphifyy` for corrido, o patch perde-se silenciosamente.

**`tools/graphify.md` já documenta isto** — mas não há nenhum mecanismo automático de re-aplicação.

**Fix sugerido:** Criar um script de re-patch em JOCA:
```
JOCA/.claude/scripts/graphify-patch.sh
```
Que reaplicar os patches conhecidos. Correr após `uv tool upgrade graphifyy`.

Alternativa melhor: submeter PR upstream para o graphifyy com as extensões em falta.

---

## Resumo de acções

| # | Acção | Ficheiro a actualizar |
|---|-------|----------------------|
| 1 | Documentar cadeia de fallback scraping | `memory/tools/mcp-routing.md` |
| 2 | Secção graphify para projectos design/markup | `memory/tools/graphify.md` |
| 3 | Mover graphify-deps.py para JOCA | `.claude/scripts/graphify-deps.py` |
| 4 | Checklist discovery em huashu-design | `.claude/skills/design/huashu-design.md` |
| 5 | Lembrar regra browser antes de "feito" | — (já está no CLAUDE.md global) |
| 6 | Script re-patch graphify | `.claude/scripts/graphify-patch.sh` |
