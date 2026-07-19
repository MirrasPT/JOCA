# CLIs externos — inventário de instalação

Registo dos CLIs que o JOCA sabe usar. O `/install` percorre esta lista e instala os que
escolheres — nenhum é obrigatório: cada um só é preciso quando a skill/agente que o usa entra
em jogo. **Auth é sempre interactiva (login do próprio utilizador) — chaves e tokens nunca vêm
no repositório nem devem ser inventados.**

## Núcleo (recomendados)

| CLI | Função | Instalação (macOS) | Instalação (Windows) | Auth |
|---|---|---|---|---|
| `gh` | GitHub (repos/PRs, `/ship`, `pr-repair`) | `brew install gh` | `winget install GitHub.cli` | `gh auth login` |
| `ffmpeg` | vídeo/áudio (skills video, watch) | `brew install ffmpeg` | `winget install Gyan.FFmpeg` | — |
| `yt-dlp` | download de vídeo (agente watch, last30days) | `brew install yt-dlp` | `pip install yt-dlp` | — |
| `markitdown` | ficheiro/URL → Markdown (motor do `/know`) | `brew install markitdown` | `pip install "markitdown[all]"` | — |
| `codex` | OpenAI Codex — review adversarial (`codex-review`), img-gen (`img-gen-openai`) | `npm i -g @openai/codex` | idem | ChatGPT Plus ou `OPENAI_API_KEY` |
| `agy` | Antigravity — Gemini multimodal, img/video gen (`img-gen-google`, `gemini-brain`) | instalador próprio (Antigravity CLI) | idem | própria (login) |
| `gemini` | Gemini CLI | `npm i -g @google/gemini-cli` | idem | própria (login) |

## Browser / automação

| CLI | Função | Instalação | Auth |
|---|---|---|---|
| `browser-use` | automação de browser (skill `browser-use`, default) | `uv tool install browser-use` | key do modelo escolhido |
| `playwright-cli` | controlo de browser (fallback; MCP `@playwright/mcp` é o caminho principal — ver `tools/mcps.md`) | `npm i -g playwright-cli` | — |

## Google / cloud

| CLI | Função | Instalação (macOS) | Instalação (Windows) | Auth |
|---|---|---|---|---|
| `gcloud` | Google Cloud SDK (prereq do gws) | `brew install --cask google-cloud-sdk` | instalador oficial Google | `gcloud auth login` |
| `gws` | Google Workspace (Gmail/Calendar/Drive/Sheets — agente `personal-comms`, automações) | `npm i -g @googleworkspace/cli` | idem | `gws auth setup --login` (requer gcloud; `--scopes` explícito; publicar a app OAuth senão o token expira ~7 dias) |
| `aws` | S3/R2 (skill `file-storage`) | `brew install awscli` | `winget install Amazon.AWSCLI` | `aws configure` |

## Plataformas / e-commerce

| CLI | Função | Instalação (macOS) | Instalação (Windows) | Auth |
|---|---|---|---|---|
| `wp` (wp-cli) | WordPress/WooCommerce (skills wordpress, woocommerce-elementor) | `brew install wp-cli` | phar oficial + wrapper `.bat` | — (por site) |
| `shopify` | Shopify (skill shopify-router) | `npm i -g @shopify/cli` | idem | `shopify auth` |
| `wix` | Wix/Velo (skill wix-cli) | `npm i -g @wix/cli` | idem | login browser |
| `stripe` | webhooks/testes de pagamento (agente payment-integration) | `brew install stripe/stripe-cli/stripe` | `scoop install stripe` | `stripe login` |
| `ntn` | Notion (skill notion) — Node ≥ 22 | `npm i -g ntn` | `winget install Notion.ntn` | `ntn login` |

## Dev / dados

| CLI | Função | Instalação | Auth |
|---|---|---|---|
| `hf` (huggingface_hub) | modelos/datasets HF | `uv tool install huggingface_hub` | `hf auth login` |
| `sentry-cli` | error tracking (skill sentry) | `npm i -g @sentry/cli` | `SENTRY_AUTH_TOKEN` |
| `cli-printing-press` | gerar CLIs/MCP a partir de APIs | `go install github.com/mvanhorn/cli-printing-press/v4/cmd/cli-printing-press@latest` (Go 1.26+; PATH += `~/go/bin`) | — |
| `graphify` | mapa de código/conhecimento (`/map-joca`, `/resume`) | pacote Python local (instalar no Python de sistema: `pip install <path-do-pacote>`) | — |
| `zmail` | Zoho Mail (jar Java + wrapper `zmail`; requer Java 11+) | jar oficial Zoho + wrapper em `~/.local/bin/zmail` | `zmail` → `login [--dc <tld>]` (interactivo) |
| `supabase` | Supabase | `brew install supabase/tap/supabase` / `scoop install supabase` | `supabase login` |
| `railway` | deploy Railway | `npm i -g @railway/cli` | `railway login` |
| `deno` / `bun` | runtimes JS alternativos | `brew install deno` / bun.sh | — |
| `whisperx` | STT local + forced alignment (skill lyric-align) — pesado (torch), venv dedicado | `uv venv` + `pip install whisperx` | — |

## MCP servers
Ver `tools/mcps.md` — `markitdown` (`uvx markitdown-mcp` no Mac / `python -m markitdown_mcp` no Windows) e `playwright` (`npx -y @playwright/mcp@latest`).

## Plugins Claude Code (`claude plugin install`)
- `last30days@last30days-skill` — `claude plugin marketplace add mvanhorn/last30days-skill` + install. Sinal social dos últimos 30 dias (Reddit/X/YouTube/TikTok/HN/Polymarket/GitHub). Config em `~/.config/last30days/` (keys ScrapeCreators/X opcionais).
- `cloudflare@cloudflare` — purga de cache/DNS (skill deploy-vps) via API; token do utilizador em `~/.cloudflare/` (fora do git).
- `comfy` / `civitai` — geração de media local; requer ComfyUI instalado.

## PATH
Garantir no shell profile: `~/go/bin` (cli-printing-press), `~/.local/bin` (uv tools, zmail), globals do npm, e o bin do Java se o `zmail` for usado. No Windows, `winget`/`npm`/`pip` tratam do PATH sozinhos na maioria dos casos.
