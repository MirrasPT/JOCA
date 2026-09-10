# MCPs and external tools

Connected MCP servers (user scope, always available):

| MCP | Command | Use |
|---|---|---|
| `markitdown` | `uvx markitdown-mcp` (stdio; Mac) / `python -m markitdown_mcp` (Windows) | Converts file/URL (PDF/Office/image/audio/HTML/YouTube) → Markdown. Engine of `/know` (skill `knowledge-ingest`). On the Mac the system pip is externally-managed (PEP 668) → use `uvx`. |
| `plugin:comfy:comfyui` / `civitai` | comfy plugin | Local media generation (ComfyUI). |

⚠ **Playwright MCP removed for good (2026-08-05, an explicit decision by the owner) — never reinstall
`@playwright/mcp`.** Browser automation becomes: the **Claude in Chrome** extension
(`mcp__claude-in-chrome__*`) for ad-hoc checking, **Playwright CLI** (`@playwright/cli`) for
repeatable scripts/automation. If the machine does not have the Playwright CLI, ask for it to be installed — never
use MCP as an alternative. See `tools/clis.md`.

## markitdown — setup

```bash
python -m pip install markitdown-mcp        # MCP server + core markitdown
python -m pip install 'markitdown[all]'     # optional: all the parsers (OCR, audio, etc.)
claude mcp add markitdown --scope user -- python -m markitdown_mcp

# Mac (homebrew python is externally-managed, PEP 668 blocks the system pip):
claude mcp add markitdown --scope user -- uvx markitdown-mcp    # uvx runs in an ephemeral env, without installing
```

Windows: `python`, **not** `python3` (empty Microsoft Store stub). Validate the output `.md` against 1 real file per type before declaring it ready (`api-design.md` rule: a file existing ≠ ready). Tested version: markitdown 0.1.6 (HTML→md verified end-to-end).
