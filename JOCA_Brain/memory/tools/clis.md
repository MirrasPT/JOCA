# CLIs externos — inventário definitivo

Registo canónico dos CLIs que o setup do Renato usa. Fonte de verdade para migrações de máquina (o `CLAUDE.md` "CLIs externos" e o `install.md` estavam **incompletos** — faltavam ntn, wix, wp-cli, stripe, aws, gcloud, huggingface, zmail, last30days). Actualizar aqui sempre que se instala/remove um CLI.

Última reconciliação: **2026-07-08** (migração Windows → Mac `/Users/renatoferreira`). Instalar via install command; **auth é interactiva (login do Renato), nunca migra** — não inventar chaves.

## Instalados e verificados (Mac)

| CLI | Instalação (Mac) | Auth | Usado por |
|---|---|---|---|
| `gh` | `brew install gh` | `gh auth login` | GitHub (repos/PRs) |
| `gws` (@googleworkspace/cli) | `npm i -g @googleworkspace/cli` | `gws auth setup --login` (requer gcloud; `--scopes` explícito; publicar app senão token expira ~7d) | Gmail/Calendar/Drive/Sheets; automações |
| `gcloud` | `brew install --cask google-cloud-sdk` | `gcloud auth login` | prereq do gws |
| `aws` (awscli) | `brew install awscli` | `aws configure` | S3/R2, skill file-storage |
| `agy` (Antigravity) | (Antigravity CLI) | própria | Gemini multimodal, img/video gen |
| `codex` | `npm i -g @openai/codex` | ChatGPT Plus / `OPENAI_API_KEY` | review adversarial, img gen |
| `gemini` | (Gemini CLI) | própria | Gemini |
| `huggingface-cli` / `hf` | `uv tool install huggingface_hub` | `hf auth login` | modelos/datasets HF |
| `graphify` | (pip/local) | — | mapa de código/conhecimento |
| `sentry-cli` | `brew install getsentry/tools/sentry-cli` | `SENTRY_AUTH_TOKEN` | error tracking |
| `stripe` | `brew install stripe/stripe-cli/stripe` | `stripe login` | webhooks/testes de pagamento |
| `cli-printing-press` | `go install github.com/mvanhorn/cli-printing-press/v4/cmd/cli-printing-press@latest` (Go 1.26+; `~/go/bin`) | — | gera CLIs/MCP de APIs |
| `ffmpeg` | `brew install ffmpeg` | — | vídeo/áudio |
| `yt-dlp` | `brew install yt-dlp` | — | download vídeo (agent watch, last30days) |
| `markitdown` | `brew install markitdown` (+ MCP `uvx markitdown-mcp`) | — | ficheiro/URL → Markdown (/know) |
| `browser-use` | `uv tool install browser-use` | key do modelo | automação browser (default) |
| `playwright-cli` | `npm i -g playwright-cli` | — | browser control (fallback) |
| `ntn` (Notion) v0.18+ | `npm i -g ntn` (Node≥22) | `ntn login` (keychain) | Notion clientes (Luís Gonçalo) |
| `wix` (@wix/cli) | `npm i -g @wix/cli` | login browser / key | Wix/Velo (Bracaris) |
| `wp` (wp-cli) | `brew install wp-cli` | — (por site) | WordPress/WooCommerce (Bodegas) |
| `shopify` | `npm i -g @shopify/cli` | `shopify auth` | Shopify |
| `supabase` | `brew install supabase/tap/supabase` | `supabase login` | Supabase |
| `railway` | `brew install railway` | `railway login` | deploy Railway |
| `zmail` (zmail-cli, Java) | jar Zoho + wrapper `~/.local/bin/zmail` (requer Java 11+; `brew install openjdk`) | `zmail` → `login [--dc <tld>]` | Zoho Mail |
| `deno` / `bun` | `brew install deno` / bun.sh | — | runtimes JS |

## MCP servers (`claude mcp add --scope user`)
Ver `tools/mcps.md`. Ligados: `markitdown` (`uvx markitdown-mcp`), `playwright` (`npx -y @playwright/mcp@latest`).

## Plugins Claude Code (`claude plugin install`)
- `last30days@last30days-skill` — `claude plugin marketplace add mvanhorn/last30days-skill` + install. Sinal social 30d (Reddit/X/YT/TikTok/HN/Polymarket/GitHub). `.env` em `~/.config/last30days/` + keys ScrapeCreators/X opcionais. (O "Digg CLI" da memória era dependência Go deste motor.)

## Por reinstalar quando necessário (não urgentes no Mac)
- `whisperx` — STT local forced-align (só Simão Sina; pesado, torch; venv dedicado). Instalar quando o projecto vier p/ o Mac.
- Plugins `cloudflare@cloudflare` (purga cache/DNS deploy-vps via API + token `~/.cloudflare/*.json`) e `comfy`/`civitai` (media local; requer ComfyUI). Não reinstalados nesta migração.

## PATH (`~/.zshrc`)
`~/go/bin` (cli-printing-press), `/opt/homebrew/opt/openjdk/bin` (Java p/ zmail), `~/.local/bin` + `~/.npm-global/bin` (uv/npm globals). Terminais novos apanham; sessão actual via export.
