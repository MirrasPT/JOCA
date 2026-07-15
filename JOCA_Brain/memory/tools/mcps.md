# MCPs e ferramentas externas

MCP servers ligados (user scope, sempre disponíveis):

| MCP | Comando | Uso |
|---|---|---|
| `markitdown` | `python -m markitdown_mcp` (stdio) | Converte ficheiro/URL (PDF/Office/imagem/áudio/HTML/YouTube) → Markdown. Motor do `/know` (skill `knowledge-ingest`). |
| `playwright` | `npx -y @anthropic-ai/mcp-server-playwright` | Browser automation (pode falhar a ligar; ver skill `browser-automate`). |
| `plugin:comfy:comfyui` / `civitai` | plugin comfy | Geração de media local (ComfyUI). |

## markitdown — setup

```bash
python -m pip install markitdown-mcp        # MCP server + core markitdown
python -m pip install 'markitdown[all]'     # opcional: todos os parsers (OCR, audio, etc.)
claude mcp add markitdown --scope user -- python -m markitdown_mcp
```

Windows: `python`, **não** `python3` (stub vazio da Microsoft Store). Validar o `.md` de saída contra 1 ficheiro real por tipo antes de declarar pronto (regra `api-design.md`: ficheiro existir ≠ pronto). Versão testada: markitdown 0.1.6 (HTML→md verificado end-to-end).
