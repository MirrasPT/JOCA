---
type: feedback-joca
source: auto-extracted-by-save
session_date: 2026-06-28
project: tcg
---

**Categoria:** tool-reliability | **Severidade:** medium | **Descrição:** O tool `mcp__plugin_comfy_comfyui__enqueue_workflow` devolveu repetidamente `"ComfyUI is not running. Use start_comfyui to start it first."` mesmo com o servidor 100% vivo e acessível — confirmado por `health_check` (devolveu versão/GPU/queue) E por `curl http://127.0.0.1:8188/system_stats` (200, queue reachable, listener PID na 8188). O `start_comfyui` também confirmava "already running PID 2684". Ou seja: o caminho de leitura do MCP funciona mas o `enqueue` tem um pre-check de readiness que dá falso-negativo. | **Componente afectado:** plugin `comfy@comfyui` — `enqueue_workflow` (e provavelmente `generate_image`). | **Fix sugerido:** (1) workaround validado e robusto = conduzir o ComfyUI pela **API HTTP directa** (`POST /prompt` com o workflow em api-format + poll `GET /history/<id>` + download `GET /view`) via script PowerShell — bypassa o MCP por completo e é melhor para batches grandes (43+20 imagens geradas assim sem falha). Gerador reutilizável guardado no scratchpad da sessão (`anima_gen.ps1`). (2) Documentar este fallback na skill `comfy-mcp-workarounds` (já existe para o bug do enqueue/crash via MCP — adicionar o sintoma "not running com servidor vivo" + o padrão POST /prompt).
