---
processed: true
processed_date: 2026-06-23
type: feedback-joca
source: auto-extracted-by-save
session_date: 2026-06-23
project: comfyui
---
processed: true
processed_date: 2026-06-23

# Sessão TRELLIS 2 — gotchas Windows reutilizáveis (ML node install)

Instalação de um custom node ComfyUI (TRELLIS 2) com extensões CUDA numa portable Windows. Vários bloqueadores são genéricos (qualquer install ML em python embedded), não só deste projecto → candidatos a `rules/workflows-and-tooling.md` (secção "Ambiente local Windows-first").

**Categoria:** doc-gap | **Severidade:** medium | **Descrição:** `robocopy /XD <nome>` exclui pastas por nome em QUALQUER nível. Copiar um `python_embeded` com `/XD models output` apagou `pip/_internal/models/` → pip partido (`No module named 'pip._internal.models'`). | **Componente afectado:** `rules/workflows-and-tooling.md` | **Fix sugerido:** documentar — ao excluir no robocopy, usar SEMPRE caminho absoluto (`/XD "<src>\sub\models"`), nunca o nome nu.

**Categoria:** doc-gap | **Severidade:** medium | **Descrição:** ComfyUI portable (python embeddable) NÃO traz `libs/python313.lib` nem `Include/`. Qualquer JIT que compile C (triton tcc, alguns custom CUDA nodes) falha (`returned non-zero exit status 1`). | **Componente afectado:** `rules/workflows-and-tooling.md` | **Fix sugerido:** documentar fix — descarregar nuget `python` da versão exacta (`api.nuget.org/v3-flatcontainer/python/<ver>/python.<ver>.nupkg`), copiar `tools/libs/python313.lib`→`python_embeded/libs/` e `tools/include/*`→`python_embeded/Include/`.

**Categoria:** doc-gap | **Severidade:** low | **Descrição:** nós ML que assumem `flash_attn` rebentam no Windows (não há wheel/build prático). Muitos têm fallback `sdpa` (torch nativo) na dropdown de backend. | **Componente afectado:** `rules/workflows-and-tooling.md` ou skill `comfy:troubleshooting` | **Fix sugerido:** regra — no Windows preferir backend `sdpa`; `xformers` só se houver wheel para o torch exacto.

**Categoria:** discovery-gap | **Severidade:** low | **Descrição:** modelo HF gated (DINOv3/Meta) pode ficar PENDING (aprovação manual, não instantânea) → bloqueia o pipeline. Existem mirrors não-gated com os mesmos pesos (ex.: `camenduru/*`, 390k downloads) que o node aceita (só verifica o ficheiro no path). | **Componente afectado:** doc de install de modelos / `comfy:model-registry` | **Fix sugerido:** quando um gate fica PENDING, oferecer mirror não-gated reputado como atalho (validar `gated:false` + lista de ficheiros via HF API antes).
