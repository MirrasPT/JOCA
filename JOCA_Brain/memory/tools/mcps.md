# MCPs e ferramentas externas

MCP servers ligados (user scope, sempre disponíveis):

| MCP | Comando | Uso |
|---|---|---|
| `markitdown` | `uvx markitdown-mcp` (stdio; Mac) / `python -m markitdown_mcp` (Windows) | Converte ficheiro/URL (PDF/Office/imagem/áudio/HTML/YouTube) → Markdown. Motor do `/know` (skill `knowledge-ingest`). No Mac o pip de sistema é externally-managed (PEP 668) → usar `uvx`. |
| `playwright` | `npx -y @playwright/mcp@latest` | Browser automation. ⚠ O pacote antigo `@anthropic-ai/mcp-server-playwright` é um **404 fantasma** (nunca existiu no registry) — era essa a causa do "falha a ligar". Oficial = `@playwright/mcp` (Microsoft). Ver skill `browser-automate`. |
| `plugin:comfy:comfyui` / `civitai` | plugin comfy | Geração de media local (ComfyUI). |

## markitdown — setup

```bash
python -m pip install markitdown-mcp        # MCP server + core markitdown
python -m pip install 'markitdown[all]'     # opcional: todos os parsers (OCR, audio, etc.)
claude mcp add markitdown --scope user -- python -m markitdown_mcp

# Mac (homebrew python é externally-managed, PEP 668 bloqueia pip de sistema):
claude mcp add markitdown --scope user -- uvx markitdown-mcp    # uvx corre em env efémero, sem instalar
```

Windows: `python`, **não** `python3` (stub vazio da Microsoft Store). Validar o `.md` de saída contra 1 ficheiro real por tipo antes de declarar pronto (regra `api-design.md`: ficheiro existir ≠ pronto). Versão testada: markitdown 0.1.6 (HTML→md verificado end-to-end).
