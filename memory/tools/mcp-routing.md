# MCP Routing — Quando Usar Cada Ferramenta

Guia de decisão para os MCPs configurados no JOCA. Sem este documento os MCPs aparecem como nós isolados no knowledge graph — estão disponíveis mas sem contexto de activação.

---

## GitHub MCP (`GITHUB_PERSONAL_ACCESS_TOKEN`)

**Quando usar:**
- Criar/fechar issues e PRs sem sair do Claude
- Ler código de repositórios privados sem fazer clone local
- Rever PR diffs e comentar inline
- Sincronizar estado de projecto (branches, releases, milestones)

**Não usar para:**
- Commits — usa Git local (menos fricção, mais controlo)
- CI/CD management — usa `devops-engineer` skill + GitHub Actions YAML

**Trigger words:** "cria issue", "abre PR", "lê o repo", "que branches existem", "comenta no PR"

---

## Mermaid MCP

**Quando usar:**
- Diagramas de arquitectura (flowchart, sequência, ER, classe)
- Mapas de dependências entre módulos
- Workflows e pipelines visuais
- Documentar decisões técnicas com diagrama embebido em MD

**Não usar para:**
- Wireframes ou mockups UI → usa `frontend-design` skill
- Diagramas de slides — gerar SVG inline no HTML é mais portátil

**Trigger words:** "faz um diagrama", "esquema de arquitectura", "sequência de chamadas", "fluxo de dados", "ER diagram"

---

## Blender MCP

**Activo apenas em:** projectos com `.mcp.json` que declare o servidor blender.

**Quando usar:**
- Modelação 3D directamente do Claude (via Python API Blender)
- Renderizar assets 3D para integrar em design ou vídeo
- Automatizar cenas repetitivas (product shots, cenários)
- Importar assets do PolyHaven (HDRI, texturas, modelos)

**Não usar para:**
- Rigging complexo — requer UI do Blender
- Animação de personagens — HeyGen ou Runway são mais rápidos

**Skill associada:** `dev/blender` — documenta comandos Python, assets e workflows

**Trigger words:** "cria um modelo 3D", "renderiza", "asset 3D", "product shot 3D", "cena Blender"

---

## HuggingFace MCP (`HF_TOKEN`)

**Quando usar:**
- Descarregar e inferir modelos open-source localmente
- Explorar datasets HF para treino ou análise
- Usar Inference API sem escrever código (prototyping rápido)
- Pesquisar modelos por task (image classification, NER, etc.)

**Não usar para:**
- Geração de imagens → `img-gen-openai` / `img-gen-google` agents (mais simples)
- LLMs de conversação → Claude local já está disponível

**Trigger words:** "modelo HuggingFace", "inferência local", "dataset HF", "fine-tuning", "embeddings open-source"

---

## Playwright MCP

**Quando usar:**
- Testes E2E de aplicações web durante desenvolvimento
- Screenshot de páginas para validação visual
- Automação de fluxos web repetitivos (form fill, scraping autorizado)
- Debug de comportamento de UI em browser real

**Skill associada:** `dev/webapp-testing` — padrões avançados, console logging, element discovery

**Não usar para:**
- Web scraping de larga escala → usa Firecrawl
- Testes em iOS/Android → usa `flutter` skill (Appium/integration tests)

**Trigger words:** "testa no browser", "screenshot da página", "automatiza o formulário", "E2E test", "playwright"

---

## Firecrawl MCP (localhost:3002, requer Docker)

**Quando usar:**
- Scraping de sites com JS rendering (SPAs, React, Next.js)
- Crawl de domínio completo para research ou indexação
- Extracção estruturada de dados (produtos, preços, artigos)
- Feed de conteúdo para `deep-research` agent

**Não usar para:**
- Sites simples HTML estático → `WebFetch` é suficiente e mais rápido
- APIs com documentação pública → lê directamente

**Trigger words:** "faz scrape de", "crawla o site", "extrai os preços de", "indexa o domínio"

---

## Google Native Connectors (Gmail / Calendar / Drive)

**Activos via:** claude.ai/settings → OAuth

**Gmail:**
- Rascunhar e enviar emails a partir de contexto de projecto
- Pesquisar threads relevantes ("encontra emails sobre o projecto X")
- Categorizar e labeling em batch

**Calendar:**
- Criar eventos com base em decisões de projecto
- Verificar disponibilidade antes de propor timelines
- Sincronizar deadlines de projecto com eventos

**Drive:**
- Ler Google Docs/Sheets sem exportar
- Criar docs estruturados a partir de output do Claude
- Partilhar assets com colaboradores

**Trigger words:** Gmail → "envia email", "rascunha"; Calendar → "cria evento", "verifica agenda"; Drive → "lê o doc", "cria no Drive"

---

## Lunar Docs MCP (`lunar-docs`)

**Contexto:** MCP especializado para documentação do Lunar PHP (e-commerce headless para Laravel).

**Quando usar:**
- Qualquer trabalho com `laravel-specialist` skill em projecto com Lunar
- Queries específicas à API Lunar (catalogues, orders, customers, pricing)
- Verificar versões de métodos antes de implementar

**Skill associada:** `dev/laravel-specialist` — workflows completos Laravel + Filament + Lunar

**Trigger words:** só activo em projectos Laravel com Lunar configurado

---

## WordPress MCP (`wordpress/mcp-adapter`, WP 6.8+)

**Quando usar:**
- Ler/escrever posts, pages, custom post types via REST API
- Gerir media library
- Queries à base de dados WP sem acesso directo ao servidor

**Skill associada:** Skills `wordpress/*` — o router detecta o tipo de projecto

**Trigger words:** activo automaticamente quando `wordpress-router` skill está activa

---

## Scraping web — cadeia de fallback

Usar **sempre nesta ordem**. Cada passo só se o anterior falhar.

```
1. mcp__firecrawl__firecrawl_scrape
   └─ primeira tentativa; lida com JS rendering e SPAs
   └─ falha: bloqueado por anti-bot, timeout, 403/429

2. mcp__browser-use__browser_navigate
   └─ quando Firecrawl falha/bloqueia
   └─ falha: timeout >30s, browser_use não responde

3. mcp__playwright__playwright_navigate
   └─ quando browser-use timeout
   └─ ⚠ VERIFICAR PRIMEIRO: npx playwright install (obrigatório na 1ª vez)
   └─ falha: browsers não instalados, MCP não conectado

4. curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" <url>
   └─ fallback universal — funciona sempre para HTML estático
   └─ não executa JS; para SPAs este step pode não ter conteúdo útil
```

**Notas:**
- `WebFetch` não é para scraping — é para URLs simples sem bloqueio anti-bot
- Playwright MCP requer `npx playwright install` na primeira utilização na máquina
- curl com User-Agent real bypassa a maioria dos anti-bot básicos

---

## Decisão rápida

| Preciso de...               | Usar                          |
|-----------------------------|-------------------------------|
| Gerir repo/issues/PRs       | GitHub MCP                    |
| Diagrama técnico            | Mermaid MCP                   |
| Asset 3D / renderizar       | Blender MCP + `blender` skill |
| Modelo ML open-source       | HuggingFace MCP               |
| Testar UI no browser        | Playwright MCP + `webapp-testing` |
| Scrape site (qualquer)      | Ver cadeia de fallback acima  |
| Email/calendário/docs       | Google Connectors             |
| Docs Lunar/Laravel          | Lunar Docs MCP                |
| Gerir conteúdo WP           | WordPress MCP                 |
