# MCPs e ferramentas externas

MCP servers ligados (user scope, sempre disponíveis):

| MCP | Comando | Uso |
|---|---|---|
| `markitdown` | `uvx markitdown-mcp` (stdio; Mac) / `python -m markitdown_mcp` (Windows) | Converte ficheiro/URL (PDF/Office/imagem/áudio/HTML/YouTube) → Markdown. Motor do `/know` (skill `knowledge-ingest`). No Mac o pip de sistema é externally-managed (PEP 668) → usar `uvx`. |
| `plugin:comfy:comfyui` / `civitai` | plugin comfy | Geração de media local (ComfyUI). |

⚠ **Playwright MCP removido de vez (2026-08-05, decisão explícita do dono) — nunca reinstalar
`@playwright/mcp`.** Browser automation passa a ser: extensão **Claude no Chrome**
(`mcp__claude-in-chrome__*`) para verificação ad-hoc, **Playwright CLI** (`@playwright/cli`) para
scripts/automação repetível. Se a máquina não tiver o Playwright CLI, pede para o instalar — nunca
uses MCP como alternativa. Ver `tools/clis.md`.

## markitdown — setup

```bash
python -m pip install markitdown-mcp        # MCP server + core markitdown
python -m pip install 'markitdown[all]'     # opcional: todos os parsers (OCR, audio, etc.)
claude mcp add markitdown --scope user -- python -m markitdown_mcp

# Mac (homebrew python é externally-managed, PEP 668 bloqueia pip de sistema):
claude mcp add markitdown --scope user -- uvx markitdown-mcp    # uvx corre em env efémero, sem instalar
```

Windows: `python`, **não** `python3` (stub vazio da Microsoft Store). Validar o `.md` de saída contra 1 ficheiro real por tipo antes de declarar pronto (regra `api-design.md`: ficheiro existir ≠ pronto). Versão testada: markitdown 0.1.6 (HTML→md verificado end-to-end).
