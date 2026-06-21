# /know — Ingerir na Knowledge Base

Guarda conteúdo no segundo cérebro pessoal. `/know <url|ficheiro|texto>`.

Atalho para o agente `knowledge-ingest` (FUTUROS Fase 5).

## Fluxo

1. Receber a fonte: URL (artigo/YouTube/Instagram), caminho de ficheiro (PDF/Office/imagem/áudio), ou texto livre.
2. Detectar acções irreversíveis: nenhuma (só escreve em `memory/knowledge/`) → prosseguir sem confirmação.
3. `Agent(subagent_type="knowledge-ingest")` com a fonte no brief.
4. O agente: converte para Markdown via **markitdown** → gera resumo → atribui tags hierárquicas → escreve nota wiki em `memory/knowledge/` (raw imutável + nota `.md` com wikilinks + index).
5. Reportar: título, tags atribuídas, e caminho da nota.

## Pesquisar

Linguagem natural (não é preciso saber as tags): "tenho truques sobre X?", "o que guardei sobre AI esta semana?".
O agente lê o index + notas de `memory/knowledge/` e devolve a fonte.

## Setup (uma vez)

markitdown: `python -m pip install 'markitdown[all]'` (Windows: `python`, não `python3`).
Opcional: registar `markitdown-mcp` como MCP global. Ver skill `knowledge-ingest`.
