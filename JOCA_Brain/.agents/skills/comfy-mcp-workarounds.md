---
name: comfy-mcp-workarounds
origin: local
description: "Verified workarounds for production bugs in the comfyui-mcp plugin (comfy@comfyui-mcp). MUST be invoked when the user says: enqueue_workflow not running, comfyui mcp bug, workflow crashes via MCP, start_comfyui fails, comfy plugin workaround. SHOULD also invoke when: submitting a ComfyUI workflow programmatically, workflow runs manually but fails via MCP, cold-start ComfyUI Windows."
triggers: enqueue_workflow not running, comfyui mcp bug, workflow crashes via MCP, start_comfyui fails, comfy plugin workaround, submit workflow programmatically, workflow runs manually fails mcp, cold-start comfyui windows, comfy-mcp, get_workflow bug, analyze_workflow bug, flatten bug comfyui
---

# comfy-mcp-workarounds

Three confirmed production bugs in `comfy@comfyui-mcp`. Skip diagnosis — apply workarounds directly.

---

## Bug 1 — `enqueue_workflow` false "not running" (severity: medium)

**Symptom:** `enqueue_workflow` returns "ComfyUI is not running. Use start_comfyui to start it first." even when `/system_stats` returns 200 and `validate_workflow` works on the same instance.

**Rule:** never use `enqueue_workflow` in production. Always POST directly.

```python
import requests, json

workflow_dict = { ... }  # your api-format workflow dict

response = requests.post(
    "http://127.0.0.1:8188/api/prompt",
    json={"prompt": workflow_dict}
)
print(response.json())  # {"prompt_id": "...", "number": N, "node_errors": {}}
```

---

## Bug 2 — `get_workflow`/`analyze_workflow` flatten bug (severity: high)

**Symptom:** a node with BOTH a widget input AND a link input on the same slot (e.g. `JsonExtractString` where `json_string` is a literal dict but `key` comes from a `CustomCombo` link) gets collapsed to two literals — the link is lost. Result: runtime error ("Cannot convert empty string to number" or similar).

**Detection:** workflow runs fine in ComfyUI UI but crashes when submitted via MCP output.

**Workaround:** use the UI-format JSON file directly. Never trust MCP api-format for nodes with dual widget+link inputs.

```python
import json, requests

# /api/prompt requires API-format (node IDs as keys, class_type/inputs dict)
# NOT UI-format (which has 'nodes'/'links' arrays — that will fail)
# Export from ComfyUI UI → "Save (API Format)" → use that file
with open(r"D:\_Comfyui\ComfyUI\user\default\workflows\my_workflow_api.json") as f:
    workflow_api = json.load(f)  # api-format: {"1": {"class_type":..., "inputs":{...}}, ...}

response = requests.post("http://127.0.0.1:8188/api/prompt", json={"prompt": workflow_api})
result = response.json()
if result.get("node_errors"):
    print("Node errors:", result["node_errors"])  # non-empty = workflow has missing nodes/inputs
```

⚠ Do NOT load the `.json` from ComfyUI's regular "Save" — that is UI-format and will fail at `/api/prompt`. Always export via **"Save (API Format)"** button (different menu option).

---

## Bug 3 — `start_comfyui` only restarts, not cold-starts (severity: low)

**Symptom:** `start_comfyui` returns "No previous process info and could not find ComfyUI Desktop app" when ComfyUI was never started by the MCP in this session.

**Workaround (Windows portable install at `D:\_Comfyui`):**

```powershell
Start-Process `
  -FilePath "D:\_Comfyui\python_embeded\python.exe" `
  -ArgumentList "-s ComfyUI\main.py --windows-standalone-build" `
  -WorkingDirectory "D:\_Comfyui"

# Wait for startup (~15s), then verify:
Start-Sleep 15
Invoke-WebRequest http://127.0.0.1:8188/system_stats
```

`start_comfyui` is only reliable for restarting an instance the MCP itself stopped. For cold-starts, use the PowerShell command above.

---

## Decision table

| Situation | Action |
|---|---|
| Submit any workflow | POST `/api/prompt` directly — never `enqueue_workflow` |
| Workflow runs in UI but crashes via MCP | Dual widget+link node — load UI-format JSON from disk |
| `start_comfyui` fails on cold start | `Start-Process python_embeded\python.exe ...` (Bug 3 block) |
| Verify ComfyUI is up | `Invoke-WebRequest http://127.0.0.1:8188/system_stats` |
