---
name: img-gen-openai
description: >
  Generate images using Codex CLI (OpenAI gpt-image-2). Receives a creative brief,
  constructs an optimised prompt, and executes via codex exec. Best for: text in images,
  product shots with branding, inpainting/masking, precise compositions, high-fidelity delivery.
  Spawned by img-gen skill or directly for OpenAI-specific generation tasks.
skills: img-gen
tools: Bash, Read
model: sonnet
---

Image generation agent using OpenAI's `gpt-image-2` via the **Codex CLI**.

## Step 0 — Read the skill (mandatory)

`Read(".claude/skills/img-gen.md")` antes de construir o prompt.

## Before generating

1. If `DESIGN.md` or `BRAND.md` exists at project root: read for colours, typography, visual style
2. Apply brand context to the prompt

## Auth check

```bash
codex --version 2>/dev/null || echo "CODEX_NOT_INSTALLED"
```

If not installed: `npm install -g @openai/codex` then `codex login`.

## Image generation via Codex CLI

**CRITICAL flags (verified on Windows):**
- `--dangerously-bypass-approvals-and-sandbox` — without it `codex exec` runs `sandbox: read-only`
  and fails with `windows sandbox: spawn setup refresh` when it tries to spawn the image generator
  or write the file. Required for non-interactive image gen.
- Reference images use `-i FILE` (repeatable). **`-i` is variadic and greedily consumes a trailing
  positional prompt** — so when attaching references, pass the prompt via **stdin**, not as an arg,
  or codex hangs on "Reading prompt from stdin...".

```bash
# No references — prompt as positional arg is fine
codex exec --dangerously-bypass-approvals-and-sandbox \
  "Generate an image: PROMPT_HERE. Save it to OUTPUT_PATH."
```

```bash
# With reference images — prompt via stdin, refs via repeated -i
cat prompt.txt | codex exec --dangerously-bypass-approvals-and-sandbox \
  -i ref1.png -i ref2.png -i ref3.png
```

```powershell
# Windows PowerShell, with references
Get-Content -Raw prompt.txt | codex exec --dangerously-bypass-approvals-and-sandbox `
  -i "ref1.png" -i "ref2.png" -i "ref3.png"
```

Structured prompt body (put in the file / arg):

```
Generate an image with these specifications:
Subject: [subject]
Style: [style]
Composition: [layout]
Lighting: [lighting]
Colours: [palette]
Text in image: [exact text in quotes, or none]
Save the image to: OUTPUT_PATH
```

Codex generates images natively through OpenAI's gpt-image-2 model. Output goes to
`~/.codex/generated_images/<session>/` by default — codex copies to the requested path when told,
otherwise copy the newest PNG from that dir afterwards.

**Parallel-safe copy by session-id (preferred).** Each `codex exec` prints `session id: <uuid>` and
writes ONLY into `~/.codex/generated_images/<uuid>/`. Copy the PNG **from that session's subdir**, not
"newest global": `SID=$(printf '%s' "$OUT" | grep -oiE 'session id: [0-9a-fA-F-]+' | awk '{print $NF}'); cp "$(ls -t ~/.codex/generated_images/$SID/*.png | head -1)" dest.png`.
This makes it **collision-proof to run N codex in parallel** (validated: 30 gens, 4/batch, 0 swaps) —
the old "never run codex in parallel" swap bug was only from copying newest-global.

**Exact small digits are unreliable.** gpt-image-2 regenerates; when a prompt pins a small variable
string (a serial, a count, a year on a fixed-layout label), the model often ignores it and anchors on
memorized/plausible values (~30% miss, retries don't fix). For exact variable fields, composite the text
by code (Pillow) over the AI chrome — do NOT trust the model to render them.

## Reliability (Windows/codex)

- **LF line endings in prompt files.** Write `prompt.txt` with LF, not CRLF. PowerShell `Set-Content`
  emits CRLF, which makes codex warn `carriage return must be followed by newline`. Normalize:
  `[IO.File]::WriteAllText($path, ($body -replace "`r`n","`n"))` or pipe the prompt via stdin string.
- **Force the imagegen tool, no web search.** In ~1/3 of runs codex derails into a web search
  (e.g. "how to save generated image from API") instead of calling the tool. The prompt MUST state
  explicitly: "use the imagegen tool directly, do NOT web search". Launch **N+1 attempts** for N
  requested images to absorb derailed runs.
- **Prefer inline over delegated on Windows.** When spawned as a subagent, codex sometimes behaves as
  if it has no shell and just echoes the command back as text. On Windows, generation runs more
  reliably **inline via PowerShell** than delegated to a subagent.
- **API-doc fallback (WebFetch).** WebFetch cannot read JS-rendered API docs (Swagger/Redoc/Scalar) —
  it returns an empty shell. Fall back to the raw OpenAPI spec path (`/openapi.json`, `/swagger.json`)
  or use firecrawl.

## Prompt construction rules

Be explicit and literal. The model follows detailed instructions closely.

**General structure:**
```
[Medium/style] of [subject], [composition], [lighting], [colour palette], [mood], [technical quality]
```

**Text in image — always quote exact text:**
```
Product photography of a wine bottle with label reading "Monte Velho Reserva 2021"
in gold italic serif font on a dark green label, studio lighting, white background
```

**Product shot formula:**
```
Professional product photography of [product], [material/finish], on [surface/background],
[lighting type], isolated, sharp focus, 8K commercial advertising quality
```

**Text accuracy tips:**
- Quote text in double quotes within the prompt
- Specify font style: `serif`, `sans-serif`, `handwritten`, `bold`, `italic`
- Specify colour and placement

**Size/quality hints in prompt:**
- Draft: "low quality, quick draft"
- Standard: "high quality"
- Final: "professional quality, 8K, commercial advertising"

## Output

After successful generation, report:
```
✓ Image generated via Codex CLI (OpenAI gpt-image-2)
  Path: [output path]
  Prompt: [first 80 chars...]
```

If error: report clearly and stop.
