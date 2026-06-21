---
name: knowledge-ingest
description: "Ingest URL/file into the personal Knowledge Base — convert to Markdown via markitdown, summarize, assign hierarchical tags, save raw+wiki+index. Backs the /know flow (FUTUROS Fase 5). MUST be invoked when the user says: /know, guardar isto, knowledge base, segundo cérebro, ingerir link, ingerir PDF, transcrever YouTube, guardar reel, markitdown, catalogar isto, pesquisar o que guardei."
metadata:
  version: 1.0.0
  origin: local
---

# Knowledge Ingest

Motor do `/know` (FUTUROS Fase 5). Pega numa fonte (URL ou ficheiro), converte para Markdown, resume, atribui tags hierárquicas, e arquiva na Knowledge Base pesquisável em linguagem natural. Segundo cérebro pessoal estilo Obsidian.

## Princípio Base

Fonte heterogénea (PDF/Office/YouTube/Instagram/artigo/imagem/áudio) → **um formato único**: Markdown. Toda a inteligência (resumo, tags, pesquisa) opera sobre o `.md`, nunca sobre o formato original. Conversão é o passo 1 obrigatório.

Pipeline:
```
fonte ──→ markitdown ──→ raw .md ──→ resumo + tags ──→ wiki .md ──→ index.json
```

---

## Estrutura de Pastas

Tudo vive em `C:/Users/renat/Desktop/JOCA_FINAL/JOCA_Brain/memory/knowledge/`. A pasta **não existe ainda** — criar na primeira ingestão.

```
memory/knowledge/
├── index.json            # índice global pesquisável (uma entrada por item)
├── tags.md               # árvore de tags hierárquica (tipo Obsidian)
├── raw/                  # output bruto do markitdown, intocado
│   └── 2026-06-21--reel-fraldas.md
└── wiki/                 # nota curada: resumo + tags + frontmatter + link p/ raw
    └── 2026-06-21--reel-fraldas.md
```

Regras:
- **`raw/`** — saída literal do markitdown. Nunca editar à mão. É a fonte de verdade do conteúdo.
- **`wiki/`** — a nota que o utilizador lê/edita. Resumo + metadados. Aponta para o `raw/` correspondente.
- **Nome de ficheiro** — `YYYY-MM-DD--slug.md`. Slug = kebab-case derivado do título/tema. Mesmo nome em `raw/` e `wiki/`.
- `raw/` e `wiki/` partilham o nome → emparelhamento trivial.

---

## Setup — markitdown (Windows)

Conversor: [microsoft/markitdown](https://github.com/microsoft/markitdown). Suporta PDF, Office (docx/pptx/xlsx), HTML, imagens (OCR/descrição), áudio (transcrição), e mais.

**Windows usa `python`, NUNCA `python3`** (o `python3` é o stub vazio da Microsoft Store → `ModuleNotFoundError`).

```bash
# instalar com todos os extras (PDF, áudio, OCR, etc.)
python -m pip install 'markitdown[all]'

# verificar
python -m markitdown --help
```

Detecção robusta do interpretador certo:
```bash
for PY in python python3; do
  command -v "$PY" >/dev/null 2>&1 && "$PY" -c "import markitdown" 2>/dev/null && { MD="$PY"; break; }
done
# usar "$MD -m markitdown ..." daqui em diante
```

**Alternativa MCP** — se o servidor `markitdown-mcp` estiver registado no ambiente, usar a tool MCP em vez do CLI. NÃO assumir que está registado: verificar a lista de MCPs disponíveis primeiro. Sem CLI nem MCP → instalar o CLI (acima) antes de prosseguir.

### Converter

```bash
# ficheiro local → stdout
python -m markitdown "C:/path/to/doc.pdf" > raw/2026-06-21--doc.md

# ou via flag de output
python -m markitdown "C:/path/to/slides.pptx" -o raw/2026-06-21--slides.md
```

Para **URLs** (artigo/YouTube/Instagram): markitdown aceita alguns URIs directamente; quando não, descarregar primeiro e converter o ficheiro local. Confirmar o comportamento real por tipo (ver validação abaixo) — não inferir.

---

## Credenciais e fontes que precisam de auth

Algumas fontes precisam de chave/login (ex.: transcrição de áudio via API, certos endpoints de YouTube/Instagram, plugins de imagem do markitdown que chamam um LLM).

- Preferir sempre a via **sem auth** (markitdown local extrai legendas/transcrição já presentes; OCR local).
- Credencial em falta → **NÃO inventar key/endpoint**. Deixar `TODO: credencial em falta — <fonte>` na nota wiki, marcar o item `status: incomplete` no índice, e reportar ao utilizador. (Hard limit do soul.md.)
- Link morto / post apagado / privado → registar `status: dead-link`, guardar o que foi possível extrair, e dizer-lo. Nunca fabricar conteúdo.

---

## Passos do /know

1. **Receber fonte** — URL ou path de ficheiro (texto livre = guardar directo, salta markitdown).
2. **Converter** — `markitdown` → `raw/YYYY-MM-DD--slug.md`. Se a conversão falhar/vazia → reportar, não inventar.
3. **Resumir** — ler o `raw/`, escrever resumo curto (3-6 linhas) + bullets de pontos-chave.
4. **Tags hierárquicas** — atribuir 2-4 tags da árvore (ver abaixo). Reusar tags existentes de `tags.md` antes de criar novas. Tags novas → acrescentar à árvore.
5. **Escrever wiki** — `wiki/YYYY-MM-DD--slug.md` com frontmatter (ver formato).
6. **Indexar** — acrescentar/actualizar entrada em `index.json`.
7. **Actualizar `tags.md`** — se surgiram tags novas.
8. **Confirmar** — uma linha: `[know] <título> → #tag1 #tag2 (wiki/…md)`.

---

## Tags Hierárquicas (tipo Obsidian)

Árvore sugerida pelo JOCA, editável pelo utilizador. Cresce com os interesses. Notação `#pai/filho`.

`tags.md` (exemplo — gerar/expandir conforme o uso real):
```markdown
# Tag Tree

- #trabalho
  - #trabalho/design
  - #trabalho/programação
  - #trabalho/produtividade
- #pessoal
  - #pessoal/parentalidade
    - #pessoal/parentalidade/truques
  - #pessoal/saúde
  - #pessoal/finanças
- #aprendizagem
  - #aprendizagem/ai
  - #aprendizagem/ferramentas
  - #aprendizagem/tutoriais
```

Regra: **reusar antes de criar**. Antes de inventar uma tag, procurar uma equivalente na árvore. Manter a árvore enxuta.

---

## Formato da Nota Wiki

`wiki/YYYY-MM-DD--slug.md`:
```markdown
---
title: "Truque para mudar fraldas sem chorar"
source: "https://instagram.com/reel/xyz"
source_type: instagram
date_saved: 2026-06-21
tags: [pessoal/parentalidade/truques]
raw: raw/2026-06-21--reel-fraldas.md
status: ok          # ok | incomplete | dead-link
---

## Resumo
Reel mostra técnica de distracção (brinquedo na mão) que reduz agitação
durante a muda. Demora ~30s. Funciona até aos ~18 meses.

## Pontos-chave
- Dar objecto novo/inesperado segura a atenção
- Superfície à altura da cintura evita lesões nas costas
- Preparar tudo antes de começar

## Notas
(espaço para o utilizador anotar)
```

`source_type` controlado: `pdf | office | youtube | instagram | article | image | audio | text`.

---

## Formato do Índice

`index.json` — uma entrada por item. É o que a pesquisa percorre.

```json
{
  "version": 1,
  "items": [
    {
      "id": "2026-06-21--reel-fraldas",
      "title": "Truque para mudar fraldas sem chorar",
      "source": "https://instagram.com/reel/xyz",
      "source_type": "instagram",
      "date_saved": "2026-06-21",
      "tags": ["pessoal/parentalidade/truques"],
      "summary": "Técnica de distracção que reduz agitação na muda.",
      "wiki": "wiki/2026-06-21--reel-fraldas.md",
      "raw": "raw/2026-06-21--reel-fraldas.md",
      "status": "ok"
    }
  ]
}
```

`summary` no índice = uma frase (para matching rápido). O resumo completo fica no wiki.

---

## Pesquisa em Linguagem Natural

O utilizador NÃO precisa de saber as tags exactas. Pergunta natural → o JOCA mapeia para tags + termos e devolve os itens.

Exemplos:
- "Tenho truques sobre fraldas?" → procurar `#pessoal/parentalidade/truques` + termo "fralda" em `title/summary`.
- "O que guardei sobre AI esta semana?" → filtrar `tags ~ #aprendizagem/ai` + `date_saved` na última semana.
- "Aquele artigo de produtividade do mês passado" → `source_type=article` + `tags ~ produtividade` + janela de data.
- "Tudo sobre design" → `tags ~ design`.

Estratégia de matching (sobre `index.json`):
1. Inferir tags candidatas a partir da pergunta (mapear sinónimos → árvore de `tags.md`).
2. Filtrar `items` por tag E/OU por termo em `title`/`summary`.
3. Aplicar filtros de data quando a pergunta os refere ("esta semana", "mês passado").
4. Devolver título + resumo + link wiki + source. Vários resultados → lista ordenada por `date_saved` desc.

Sem hits → dizê-lo claramente e sugerir tags próximas existentes. Não inventar resultados.

---

## Gestão

- **Navegar** — por tags via `tags.md` / vista árvore no JOCA_UI.
- **Editar** — corrigir tags/resumo no `wiki/` e reflectir no `index.json` (manter os dois em sync).
- **Apagar** — remover `wiki/` + `raw/` + entrada do `index.json`.
- **Exportar** — copiar a pasta `knowledge/` (markdown puro = portável p/ Obsidian).

---

## Validação Antes de Declarar Pronto

markitdown comporta-se diferente por tipo de fonte. **Validar o `.md` produzido contra 1 ficheiro REAL por tipo** antes de dar o fluxo como funcional (regra anti-fabricação + verificar parser contra output real):

1. Correr 1 conversão real por `source_type` que se pretende suportar (pdf, office, youtube, instagram, article, image, audio).
2. Abrir o `raw/*.md` e confirmar que tem conteúdo substantivo — não vazio, não só metadados, não erro silencioso.
3. Campos críticos: transcrição de YouTube/áudio não pode vir vazia se existe; OCR de imagem com texto tem de o conter.
4. Só depois marcar o tipo como suportado. Tipo que falha → documentar como não suportado / `TODO`, não fingir que funciona.

Ficheiro existir ≠ ficheiro pronto. Amostrar o conteúdo, não confiar no nome.

---

## Anti-patterns

| Errado | Correcto |
|--------|----------|
| `python3 -m markitdown` no Windows | `python -m markitdown` (python3 = stub da Store) |
| Inferir que markitdown suporta um tipo | 1 conversão real + inspeccionar o `.md` |
| Inventar key/endpoint p/ fonte com auth | No-auth source ou `TODO: credencial em falta` + reportar |
| Resumir sem ler o `raw/` | Ler o `.md` convertido, depois resumir |
| Criar tag nova sem ver as existentes | Reusar `tags.md`; criar só se não houver equivalente |
| Editar `wiki/` e esquecer `index.json` | Manter wiki + índice em sync |
| Editar o `raw/` à mão | `raw/` é imutável; notas vão para `wiki/` |
| Declarar pronto por o ficheiro existir | Amostrar conteúdo (transcrição/OCR não-vazios) |
| Fabricar conteúdo p/ link morto | `status: dead-link` + guardar o extraído + dizê-lo |

---

## Related

- **browser-automate** — quando uma fonte precisa de driving de browser para extrair (post dinâmico).
- **agent-context** — convenções de memória/INDEX onde a Knowledge Base se encaixa.
- FUTUROS.md Fase 5 — visão e decisões pendentes (storage final, embeddings p/ pesquisa vectorial).
