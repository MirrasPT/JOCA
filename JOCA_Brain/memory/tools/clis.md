# External CLIs — installation inventory

Record of the CLIs JOCA knows how to use. `/install` walks this list and installs the ones you
choose — none is mandatory: each one is only needed when the skill/agent that uses it comes
into play. **Auth is always interactive (the user's own login) — keys and tokens never come
in the repository, nor should they be invented.**

## Core (recommended)

| CLI | Function | Installation (macOS) | Installation (Windows) | Auth |
|---|---|---|---|---|
| `gh` | GitHub (repos/PRs, `/ship`, `pr-repair`) | `brew install gh` | `winget install GitHub.cli` | `gh auth login` |
| `ffmpeg` | video/audio (skills `video`, `remotion`; agent `watch`). Brings `ffprobe`, used to inspect streams | `brew install ffmpeg` | `winget install Gyan.FFmpeg` | — |
| `yt-dlp` | video download (agent watch, last30days) | `brew install yt-dlp` | `pip install yt-dlp` | — |
| `markitdown` | file/URL → Markdown (engine of `/know`) | `brew install markitdown` | `pip install "markitdown[all]"` | — |
| `codex` | OpenAI Codex — adversarial review (`codex-review`), img-gen (`img-gen-openai`) | `npm i -g @openai/codex` | same | ChatGPT Plus or `OPENAI_API_KEY` |
| `agy` | Antigravity — multimodal Gemini, img/video gen (`img-gen-google`, `gemini-brain`) | its own installer (Antigravity CLI) | same | its own (login) |
| `gemini` | Gemini CLI | `npm i -g @google/gemini-cli` | same | its own (login) |

## Browser / automation

| CLI | Function | Installation | Auth |
|---|---|---|---|
| `browser-use` | browser automation (skill `browser-automate`, default) | `uv tool install browser-use` | key of the chosen model |
| `playwright-cli` | browser control (fallback; the `@playwright/mcp` MCP is the main path — see `tools/mcps.md`) | `npm i -g playwright-cli` | — |

## Google / cloud

| CLI | Function | Installation (macOS) | Installation (Windows) | Auth |
|---|---|---|---|---|
| `gcloud` | Google Cloud SDK (prereq of gws) | `brew install --cask google-cloud-sdk` | official Google installer | `gcloud auth login` |
| `gws` | Google Workspace (Gmail/Calendar/Drive/Sheets — agent `personal-comms`, automations) | `npm i -g @googleworkspace/cli` | same | `gws auth setup --login` (requires gcloud; explicit `--scopes`; publish the OAuth app or the token expires in ~7 days) |
| `aws` | S3/R2 (skill `file-storage`) | `brew install awscli` | `winget install Amazon.AWSCLI` | `aws configure` |

## Platforms / e-commerce

| CLI | Function | Installation (macOS) | Installation (Windows) | Auth |
|---|---|---|---|---|
| `wp` (wp-cli) | WordPress/WooCommerce (skills `wordpress-router`, `wp-*`, `woocommerce-elementor`) | `brew install wp-cli` | official phar + `.bat` wrapper | — (per site) |
| `shopify` | Shopify (skills `shopify-app`, `shopify-theme`, `shopify-router`) | `npm i -g @shopify/cli` | same | `shopify auth` |
| `wix` | Wix/Velo (skill wix-cli) | `npm i -g @wix/cli` | same | browser login |
| `stripe` | webhooks/payment tests (agent payment-integration) | `brew install stripe/stripe-cli/stripe` | `scoop install stripe` | `stripe login` |
| `ntn` | Notion (skill notion) — Node ≥ 22 | `npm i -g ntn` | `winget install Notion.ntn` | `ntn login` |

## Dev / data

| CLI | Function | Installation | Auth |
|---|---|---|---|
| `hf` (huggingface_hub) | HF models/datasets | `uv tool install huggingface_hub` | `hf auth login` |
| `sentry-cli` | error tracking (skills `error-tracking-dev`/`error-tracking-prod`) | `npm i -g @sentry/cli` | `SENTRY_AUTH_TOKEN` |
| `cli-printing-press` | generate CLIs/MCP from APIs | `go install github.com/mvanhorn/cli-printing-press/v4/cmd/cli-printing-press@latest` (Go 1.26+; PATH += `~/go/bin`) | — |
| `graphify` | **MANDATORY.** Code/knowledge map (`/map-joca`, `/resume`, `/save`, `/clean-install`) — project memory that is cheaper to consult than opening giant `.md` files hunting for something. | `uv tool install graphifyy` (the real package is called `graphifyy`, the entrypoint installs as `graphify`; without `uv`: `pipx install graphifyy`). After installing/updating, always run `bash .claude/scripts/graphify-patch.sh` (it reapplies the patches: expanded DOC_EXTENSIONS, includes dotdirs such as `.claude/`). | — |
| `zmail` | Zoho Mail (Java jar + `zmail` wrapper; requires Java 11+) | official Zoho jar + wrapper in `~/.local/bin/zmail` | `zmail` → `login [--dc <tld>]` (interactive) |
| `supabase` | Supabase | `brew install supabase/tap/supabase` / `scoop install supabase` | `supabase login` |
| `railway` | Railway deploy | `npm i -g @railway/cli` | `railway login` |
| `deno` / `bun` | alternative JS runtimes | `brew install deno` / bun.sh | — |
| `whisperx` | local STT + forced alignment (skill `lyric-align`) — heavy (torch), dedicated venv | `uv venv` + `pip install whisperx` | — |
| `poppler` (`pdftoppm`, `pdfinfo`) | check generated PDFs (skill `html-to-pdf`): page count and render for visual re-reading | `brew install poppler` / `winget install oschwartz10612.Poppler` | — |
| `pdftk` | alternative to `pdfinfo` for counting pages (`dump_data`) — optional | `brew install pdftk-java` | — |

## MCP servers
See `tools/mcps.md` — `markitdown` (`uvx markitdown-mcp` on the Mac / `python -m markitdown_mcp` on Windows) and `playwright` (`npx -y @playwright/mcp@latest`).

## Claude Code plugins (`claude plugin install`)
- `last30days@last30days-skill` — `claude plugin marketplace add mvanhorn/last30days-skill` + install. Social signal from the last 30 days (Reddit/X/YouTube/TikTok/HN/Polymarket/GitHub). Config in `~/.config/last30days/` (ScrapeCreators/X keys optional).
- `cloudflare@cloudflare` — cache/DNS purge (skill deploy-vps) via API; the user's token in `~/.cloudflare/` (outside git).
- `comfy` / `civitai` — local media generation; requires ComfyUI installed.

## PATH
Make sure the shell profile has: `~/go/bin` (cli-printing-press), `~/.local/bin` (uv tools, zmail), the npm globals, and the Java bin if `zmail` is used. On Windows, `winget`/`npm`/`pip` handle the PATH on their own in most cases.
