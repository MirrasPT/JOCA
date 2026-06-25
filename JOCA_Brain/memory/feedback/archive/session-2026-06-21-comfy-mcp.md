---
processed: true
processed_date: 2026-06-23
type: feedback-joca
source: auto-extracted-by-save
session_date: 2026-06-21
project: comfyui
---
processed: true
processed_date: 2026-06-23

**Categoria:** tool-reliability | **Severidade:** high | **Descrição:** O MCP `comfyui` (plugin `comfy@comfyui-mcp`) — `get_workflow`/`analyze_workflow` em formato `api` — achata subgrafos **incorrectamente**. Um `JsonExtractString` cujo `json_string` é um widget literal (dict de presets) e cujo `key` vem de um link (`CustomCombo`) é colapsado para `json_string:"Default", key:"Default"` literais, perdendo o dict. O grafo achatado resultante rebenta em runtime (`ComfyNumberConvert`: "Cannot convert empty string to number"). | **Componente afectado:** plugin `comfy@comfyui-mcp` → `get_workflow`/`analyze_workflow` (flattener de subgrafos) | **Fix sugerido:** ao reconstruir/correr workflows a partir do output `api` do MCP, NÃO confiar no flatten de nós com widget-input simultaneamente ligado; preferir o ficheiro UI-format real (preservar subgrafos) e deixar o frontend do ComfyUI achatar. Documentar no `memory/projects/comfyui.md` (já feito). Custou um diagnóstico errado + 1 geração falhada.

**Categoria:** tool-reliability | **Severidade:** medium | **Descrição:** MCP `comfyui` `enqueue_workflow` devolveu "ComfyUI is not running. Use start_comfyui to start it first." apesar de `/system_stats` responder 200 e `validate_workflow` (mesmo MCP) funcionar no mesmo instante. Readiness-check do enqueue é mais estrito/buggy que os outros tools. | **Componente afectado:** plugin `comfy@comfyui-mcp` → `enqueue_workflow` (readiness gate) | **Fix sugerido:** contornar com POST directo a `/api/prompt` (envelope `{"prompt":{...}}`) — fiável. Para skills/agentes que disparem workflows ComfyUI, preferir o POST HTTP em vez do `enqueue_workflow` do MCP.

**Categoria:** tool-reliability | **Severidade:** low | **Descrição:** `start_comfyui` do MCP não arranca um servidor que esteja parado sem info de processo prévia ("No previous process info and could not find ComfyUI Desktop app") — só serve para reiniciar um que ele próprio parou. | **Componente afectado:** plugin `comfy@comfyui-mcp` → `start_comfyui` | **Fix sugerido:** arranque cold via `Start-Process python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build` (já em `memory/projects/comfyui.md`).
