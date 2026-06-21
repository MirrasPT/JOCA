---
name: comfyui
description: ComfyUI portable — experimentação pessoal de geração de media (imagem/vídeo/upscale/inpaint/3D)
type: project
directorio: D:\_Comfyui
---

**Stack:** ComfyUI (embedded Python) + Node 24 (MCP via npx)
**Objectivo:** Experimentação de workflows e modelos de geração AI — imagem, vídeo, upscale, inpaint, 3D.
**Directório:** `D:\_Comfyui`
**Iniciado:** 2026-06-18
**PRD:** não gerado
**Why:** Sandbox pessoal para explorar modelos/workflows locais de geração AI.
**How to apply:** Usar o MCP `comfyui` (88 tools) para autorar/correr workflows direto da sessão. ComfyUI tem de estar a correr em http://127.0.0.1:8188. Para prompt-craft, complementar com skills `img-gen`/`graphic-design`/`video`/`anima`.

## Setup
- ComfyUI portable: `ComfyUI_windows_portable\run_nvidia_gpu.bat`, UI/API em :8188. (NÃO uso `--lowvram` — 12 GB chega com offload normal.)
- MCP `comfyui`: vem do **plugin** `comfy@comfyui-mcp` (user scope). SEM `.mcp.json` no projecto (evitar duplicado). Node ≥22.
- Plugin instalado: `claude plugin install comfy@comfyui-mcp` (33 skills `/comfy:*`, MCPs comfyui+civitai). Activa na próxima sessão após instalar.
- ComfyUI-Manager V3.41 em `custom_nodes\comfyui-manager` (botão "Manager" na UI).
- Checkpoints: `ComfyUI\models\checkpoints` (vazio). Modelo Ideogram 4.0 em diffusion_models/text_encoders/vae (ver Estado actual).

## Estado actual
**Instalado** (2026-06-18). ComfyUI portable NVIDIA extraído para `D:\_Comfyui\ComfyUI_windows_portable\` (download release `comfyanonymous/ComfyUI` → `ComfyUI_windows_portable_nvidia.7z` 1.9 GB, extract 7-Zip). Boot test passou: Python 3.13.12 embedded, **PyTorch 2.12.0+cu130**, RTX 4070 SUPER 12 GB, servidor em http://127.0.0.1:8188. Arquivo .7z removido após extract. `D:\_Comfyui\Git\` (Git-for-Windows) coexiste no mesmo dir.
Arrancar: `ComfyUI_windows_portable\run_nvidia_gpu.bat`. Checkpoints vazios — adicionar modelos a `ComfyUI\models\checkpoints`.
**Plugin instalado** (2026-06-18): `comfy@comfyui-mcp` via `claude plugin install comfy@comfyui-mcp` (marketplace `artokun/comfyui-mcp` add via `claude plugin marketplace add`). **User scope** = carrega em TODAS as sessões (~2531 tok always-on, não só em D:\_Comfyui). Traz 33 skills `/comfy:*` (gen, flux/qwen/wan/ltxv, civitai, viz…), 4 agents, 2 hooks, **2 MCP servers `comfyui`+`civitai`** (auto-detect :8188, `comfyui-mcp@0.14.0`, Node ≥22, boot OK "running on stdio").
**`.mcp.json` REMOVIDO** de D:\_Comfyui — o MCP `comfyui` vem do plugin (evitar server duplicado). Ter ComfyUI a correr para o MCP ligar.
Tokens opcionais de modelos: `CIVITAI_API_TOKEN`/`HUGGINGFACE_TOKEN`. Gerir plugin: `claude plugin list/disable/uninstall`.
**ComfyUI-Manager V3.41 instalado** (2026-06-18): git clone `Comfy-Org/ComfyUI-Manager` → `ComfyUI\custom_nodes\comfyui-manager`. Carrega no arranque (import 10.8s 1ª vez, deps auto). UI: botão "Manager" para instalar custom nodes/modelos.
Arrancar server background (sem janela): `Start-Process "$base\python_embeded\python.exe" -ArgumentList '-s','ComfyUI\main.py','--windows-standalone-build' -WorkingDirectory $base -RedirectStandardOutput server.log -RedirectStandardError server.err.log -WindowStyle Hidden` (`$base=D:\_Comfyui\ComfyUI_windows_portable`). Ou `run_nvidia_gpu.bat`.
GOTCHA detecção de processo: filtrar `Name='python.exe'` + `CommandLine -like '*main.py*'`. NÃO usar `*ComfyUI*main.py*` no filtro Win32_Process — dá match na própria pwsh que corre a query (falsos positivos de "PIDs a mudar").

**Modelo Ideogram 4.0 instalado** (2026-06-18, 35.9 GB, fp8): segue doc.comfy.org/tutorials/image/ideogram/ideogram-v4. Ficheiros (tamanhos verificados ao byte):
- `models/diffusion_models/ideogram4_fp8_scaled.safetensors` (8.64 GB) + `ideogram4_unconditional_fp8_scaled.safetensors` (8.64 GB) — repo HF `Comfy-Org/Ideogram-4`.
- `models/text_encoders/qwen3vl_8b_fp8_scaled.safetensors` (9.86 GB, `Comfy-Org/Qwen3-VL`) + `gemma4_e4b_it_fp8_scaled.safetensors` (8.43 GB, `Comfy-Org/gemma-4`).
- `models/vae/flux2-vae.safetensors` (336 MB, `Comfy-Org/flux2-dev`).
Usar via Template do Ideogram V4 na UI (Workflow → Browse Templates / Ctrl+K). Gravado também em `ComfyUI\user\default\workflows\Ideogram4_t2i.json` (aparece no menu Workflows). VRAM 12 GB é apertado para 2 diffusion models + qwen3vl-8B → corre com offload p/ RAM (lento).
**TESTE END-TO-END OK** (2026-06-18): 0.25.1 estável JÁ tem todos os nós (Ideogram4Scheduler/DualModelGuider/EmptyFlux2LatentImage/ResolutionSelector etc.) — **NÃO precisa de nightly** apesar de a doc sugerir. 1ª geração 9:16 portrait: success em **293.8s** (~5 min, inclui load 35 GB com offload cuda+cpu). Output `ComfyUI\output\Ideogram_4.0_00001_.png`. Texto renderizado nítido (forte do Ideogram).
COMO DISPARAR via script (MCP do plugin não activo em sessões fora de D:\_Comfyui): Playwright headless (`npm i playwright@1.60 --save`, `channel:'chrome'`, sem download chromium) → `page.evaluate`: `fetch('/templates/image_ideogram4_t2i.json')` → `app.loadGraphData(tpl)` → `app.graphToPrompt()` → POST `/api/prompt`. Template servido em HTTP `/templates/<nome>.json`. Driver em `%TEMP%\comfy-driver\` (drive.js dispara, open.js abre janela visível e mantém aberta).

## TRELLIS.2 (image-to-3D) — instância dedicada
Instalado a 2026-06-18 numa **ComfyUI portable separada** em `D:\_Comfyui_Trellis\` (NÃO toca no `D:\_Comfyui` principal). Motivo: ComfyUI-Trellis2 (visualbruno) só tem wheels CUDA pré-compiladas para um combo específico, e o único set Windows COMPLETO (inclui `nvdiffrec_render` + `natten`) é **cp313 + torch 2.10 + CUDA 13.1**.
- **Stack desta instância:** Python 3.13.12, **torch 2.10.0+cu130** (downgrade do 2.12 que vinha no portable v0.25.0 — wheels são ABI-locked ao torch minor), CUDA 13.0. GPU RTX 4070 SUPER 12GB.
- **Node:** `ComfyUI/custom_nodes/ComfyUI-Trellis2` (git clone depth-1). 71 nodes registados, carregam sem erro (31s import). Servidor de teste correu em :8199.
- **Wheels instaladas** (de `wheels/Windows/Torch2100/CUDA 13.1/`, cp313): cumesh, flex_gemm, o_voxel, nvdiffrast, nvdiffrec_render, natten. Todas importam contra torch 2.10. `custom_rasterizer` está nas wheels mas o node NUNCA o importa → ignorado.
- **requirements.txt:** instaladas todas excepto **`open3d` (sem wheel cp313)** — só usado num `import open3d` local (linha ~1001, node de limpeza de mesh). Core image→3D funciona sem ele; só esse node falha.
- **Modelos:** `microsoft/TRELLIS.2-4B` (auto-download via snapshot_download, aberto) + `microsoft/TRELLIS-image-large` decoder ss_dec (auto, aberto) + ReconViaGen `Stable-X/trellis-vggt-v0-2` (auto, opcional). **DINOv3 `facebook/dinov3-vitl16-pretrain-lvd1689m` é GATED + obrigatório** → `ComfyUI/models/facebook/dinov3-vitl16-pretrain-lvd1689m/model.safetensors` (node lança excepção se faltar). Precisa de token HF + aceitar licença Meta.
- **VRAM 12GB:** `Trellis2LoadModel.low_vram` default=True. Se 4B fizer OOM, usar modelo `visualbruno/TRELLIS.2-4B-FP8`.
- **Workflows exemplo:** `custom_nodes/ComfyUI-Trellis2/example_workflows/` (MeshOnly.json = mais simples; MeshWithTexturing.json = mesh+textura).
- **hf CLI:** `D:\_Comfyui_Trellis\ComfyUI_windows_portable\python_embeded\Scripts\hf.exe` (huggingface_hub 1.17).

## Decisões tomadas
- Escolhido `artokun/comfyui-mcp` (edição de grafo local) sobre o `comfy-cloud-mcp` oficial (foco cloud).
- Sem PRD (experimentação pessoal).
- 2026-06-18: instalado via plugin (`comfy@comfyui-mcp`) em vez de `.mcp.json` manual — o plugin já traz os MCPs comfyui+civitai (user scope). `.mcp.json` do projecto removido para não duplicar o server `comfyui`.
- 2026-06-18: NÃO usar `--lowvram` (offload normal chega nos 12 GB). Ideogram 4.0 corre em 0.25.1 estável sem nightly.
- 2026-06-18: para disparar workflows sem MCP activo → Playwright headless + `app.graphToPrompt` + POST `/api/prompt` (driver em `%TEMP%\comfy-driver\`).

## Pendente
- Arrancar o servidor ComfyUI antes de gerar (não fica a correr entre sessões): `run_nvidia_gpu.bat` ou MCP `start_comfyui`. MCP `comfyui` só liga ao server quando este está up.
- Tokens opcionais CivitAI / HuggingFace (config do plugin / env) se precisar de downloads autenticados.
- Adicionar checkpoints genéricos (Flux/SDXL/SD1.5) a `models\checkpoints` se quiser além do Ideogram.

## Última sessão
2026-06-19 — `/resume`. Confirmado: plugin `comfy@comfyui-mcp` activo (MCPs `comfyui`+`civitai` ligados, 88 tools + 33 skills `/comfy:*`). Servidor ComfyUI estava parado — arrancar manualmente antes de gerar.
