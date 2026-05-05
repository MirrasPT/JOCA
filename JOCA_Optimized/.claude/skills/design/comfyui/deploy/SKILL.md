---
name: comfyui-deploy
description: ComfyUI advanced nodes, packaging, and V1 to V3 migration. Use when building complex dynamic nodes, packaging for distribution, or migrating legacy V1 nodes to the V3 API.
---


---

## Advanced

# ComfyUI Advanced Node Patterns (V3)

V3 provides advanced input patterns for dynamic, type-safe, and flexible node designs.

## MatchType - Generic Type Connections

`MatchType` ensures that inputs and outputs sharing a template have the same type at connection time. Like generics in typed languages.

```python
class PassThrough(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        # Template(template_id, allowed_types=AnyType) - optional type constraint
        template = io.MatchType.Template("T")
        return io.Schema(
            node_id="PassThrough",
            display_name="Pass Through",
            category="utils",
            inputs=[
                io.MatchType.Input("value", template=template),
            ],
            outputs=[
                io.MatchType.Output(template=template, display_name="output"),
            ],
        )

    @classmethod
    def execute(cls, value):
        return io.NodeOutput(value)
```

When the user connects an IMAGE to the input, the output automatically becomes IMAGE type.

### Switch Node Pattern

```python
class Switch(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        template = io.MatchType.Template("switch")
        return io.Schema(
            node_id="Switch",
            display_name="Switch",
            category="logic",
            inputs=[
                io.Boolean.Input("switch"),
                io.MatchType.Input("on_false", template=template, lazy=True),
                io.MatchType.Input("on_true", template=template, lazy=True),
            ],
            outputs=[
                io.MatchType.Output(template=template, display_name="output"),
            ],
        )

    @classmethod
    def check_lazy_status(cls, switch, on_false=None, on_true=None):
        if switch and on_true is None:
            return ["on_true"]
        if not switch and on_false is None:
            return ["on_false"]

    @classmethod
    def execute(cls, switch, on_true, on_false):
        return io.NodeOutput(on_true if switch else on_false)
```

## MultiType - Accept Multiple Types

A single input that accepts several different types:

```python
io.MultiType.Input("data",
    types=[io.Image, io.Mask, io.Latent],
    optional=True,
)
```

## Autogrow - Dynamic Growing Inputs

Inputs that automatically add more slots as the user connects to them. Two template modes:

### TemplatePrefix (numbered slots)

```python
class ConcatImages(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ConcatImages",
            display_name="Concat Images",
            category="image",
            inputs=[
                io.Autogrow.Input("images",
                    template=io.Autogrow.TemplatePrefix(
                        input=io.Image.Input("img"),  # template for each slot
                        prefix="image_",              # slot names: image_0, image_1, ...
                        min=2,                        # minimum visible slots (default 1)
                        max=16,                       # maximum slots (default 10, hard limit 100)
                    ),
                ),
            ],
            outputs=[io.Image.Output("IMAGE")],
        )

    @classmethod
    def execute(cls, images: io.Autogrow.Type):
        # images is a dict: {"image_0": tensor, "image_1": tensor, ...}
        tensors = [v for v in images.values() if v is not None]
        return io.NodeOutput(torch.cat(tensors, dim=0))
```

### TemplateNames (named slots)

```python
io.Autogrow.Input("inputs",
    template=io.Autogrow.TemplateNames(
        input=io.Float.Input("val"),
        names=["red", "green", "blue", "alpha"],  # specific slot names
        min=3,  # first 3 are required
    ),
)
# Creates slots: "red" (required), "green" (required), "blue" (required), "alpha" (optional)
```

**Key behaviors**:
- Widget inputs in template are forced to connection-only (`force_input=True`)
- Slots below `min` are required; above `min` are optional
- Maximum 100 names total

## DynamicCombo - Conditional Inputs

A combo dropdown where each option reveals different sub-inputs:

```python
class ProcessNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ProcessNode",
            display_name="Process Node",
            category="processing",
            is_output_node=True,
            inputs=[
                io.DynamicCombo.Input("mode", options=[
                    io.DynamicCombo.Option("resize", [
                        io.Int.Input("width", default=512, min=1, max=8192),
                        io.Int.Input("height", default=512, min=1, max=8192),
                    ]),
                    io.DynamicCombo.Option("blur", [
                        io.Float.Input("radius", default=5.0, min=0.1, max=100.0),
                    ]),
                    io.DynamicCombo.Option("sharpen", [
                        io.Float.Input("amount", default=1.0, min=0.0, max=10.0),
                    ]),
                ]),
                io.Image.Input("image"),
            ],
            outputs=[io.Image.Output("IMAGE")],
        )

    @classmethod
    def execute(cls, mode: io.DynamicCombo.Type, image, **kwargs):
        # mode is a dict with the combo value + sub-inputs
        # key for selected option matches the DynamicCombo input ID
        if mode["mode"] == "resize":
            width = mode["width"]
            height = mode["height"]
            # ... resize logic
        return io.NodeOutput(image)
```

**Nested DynamicCombo**:
```python
io.DynamicCombo.Input("outer", options=[
    io.DynamicCombo.Option("option1", [
        io.DynamicCombo.Input("inner", options=[
            io.DynamicCombo.Option("sub1", [io.Float.Input("val")]),
            io.DynamicCombo.Option("sub2", [io.Int.Input("count")]),
        ])
    ]),
])
```

## Node Expansion - Subgraph Injection

Nodes can return a subgraph that replaces themselves during execution:

```python
from comfy_execution.graph_utils import GraphBuilder

class RepeatNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="RepeatNode",
            display_name="Repeat KSampler",
            category="sampling",
            enable_expand=True,
            inputs=[
                io.Model.Input("model"),
                io.Int.Input("repeat_count", default=2, min=1, max=10),
                io.Latent.Input("latent"),
            ],
            outputs=[io.Latent.Output("LATENT")],
        )

    @classmethod
    def execute(cls, model, repeat_count, latent):
        graph = GraphBuilder()
        current_latent = latent
        for i in range(repeat_count):
            sampler = graph.node("KSampler",
                model=model,
                latent_image=current_latent,
                # ... other params
            )
            current_latent = sampler.out(0)
        return io.NodeOutput(current_latent, expand=graph.finalize())
```

**Key rules for node expansion**:
- Set `enable_expand=True` in Schema
- Use `GraphBuilder` to construct subgraphs safely
- Return `io.NodeOutput(output_ref, expand=graph.finalize())`
- Node IDs in subgraph must be deterministic and unique
- Each subnode is cached separately

## Accept All Inputs

Accept arbitrary inputs not defined in the schema:

```python
class FlexibleNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="FlexibleNode",
            display_name="Flexible Node",
            category="utils",
            accept_all_inputs=True,
            inputs=[io.Combo.Input("mode", options=["a", "b"])],
            outputs=[io.String.Output()],
        )

    @classmethod
    def validate_inputs(cls, mode, **kwargs):
        return True  # skip validation for dynamic inputs

    @classmethod
    def execute(cls, mode, **kwargs):
        # kwargs contains all dynamic inputs
        return io.NodeOutput(str(kwargs))
```

## Execution Blocking

Prevent downstream execution conditionally:

```python
class GateNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="GateNode",
            display_name="Gate",
            category="logic",
            inputs=[
                io.Boolean.Input("allow"),
                io.Image.Input("image"),
            ],
            outputs=[io.Image.Output("IMAGE")],
        )

    @classmethod
    def execute(cls, allow, image):
        if not allow:
            return io.NodeOutput(block_execution="Gate is closed")
        return io.NodeOutput(image)
```

## Async Execute

V3 natively supports async execution:

```python
class AsyncNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="AsyncNode",
            display_name="Async Node",
            category="utils",
            inputs=[io.String.Input("url")],
            outputs=[io.String.Output()],
        )

    @classmethod
    async def execute(cls, url):
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                text = await response.text()
        return io.NodeOutput(text)
```

## Progress Reporting

Report progress during long operations:

```python
from comfy_api.latest import ComfyAPISync  # sync version; use ComfyAPI + await for async execute

class SlowNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="SlowNode",
            display_name="Slow Node",
            category="utils",
            inputs=[io.Int.Input("steps", default=100)],
            outputs=[io.String.Output()],
        )

    @classmethod
    def execute(cls, steps):
        api = ComfyAPISync()
        for i in range(steps):
            # ... do work ...
            api.execution.set_progress(i + 1, steps)
        return io.NodeOutput("done")
```

## NodeReplace - Migration Between Nodes

Register replacements so old workflows auto-migrate to new nodes:

```python
from typing_extensions import override
from comfy_api.latest import ComfyAPI, ComfyExtension, io

class MyExtension(ComfyExtension):
    @override
    async def on_load(self):
        api = ComfyAPI()
        await api.node_replacement.register(io.NodeReplace(
            new_node_id="MyNewNode_v2",
            old_node_id="MyOldNode",
            old_widget_ids=["width", "height", "mode"],  # positional widget order
            input_mapping=[
                {"new_id": "image_in", "old_id": "image"},     # rename input
                {"new_id": "size", "set_value": 512},           # set fixed value
            ],
            output_mapping=[
                {"new_idx": 0, "old_idx": 0},       # index-based, not name-based
            ],
        ))

    @override
    async def get_node_list(self):
        return [MyNewNodeV2]
```

**InputMap types**:
- `InputMapOldId`: `{"new_id": str, "old_id": str}` — map old input to new
- `InputMapSetValue`: `{"new_id": str, "set_value": Any}` — set fixed value on new
- Dot notation for autogrow inputs: `{"new_id": "images.image0", "old_id": "image1"}`

**OutputMap** (index-based, not name-based):
- `{"new_idx": int, "old_idx": int}` — map old output index to new

**old_widget_ids**: Required because workflow JSON stores widget values by position, not by ID. This list maps positional indexes to input IDs for correct migration.

## ComfyAPI - Runtime API

```python
from comfy_api.latest import ComfyAPI, ComfyAPISync

# In sync execute(): use ComfyAPISync (no await)
api = ComfyAPISync()
api.execution.set_progress(value=50, max_value=100)
api.execution.set_progress(
    value=50, max_value=100,
    node_id=None,                   # optional: defaults to current node
    preview_image=pil_image,        # PIL Image or ImageInput tensor
    ignore_size_limit=False,
)

# In async execute(): use ComfyAPI (with await)
api = ComfyAPI()
await api.execution.set_progress(value=50, max_value=100)

# Node replacement registration (in async on_load)
await api.node_replacement.register(io.NodeReplace(...))
```

## See Also

- `comfyui-node-basics` - Node fundamentals
- `comfyui-node-inputs` - Basic input types
- `comfyui-node-lifecycle` - Execution lifecycle and caching
- `comfyui-node-outputs` - Output types and UI helpers

---

## Packaging

# ComfyUI Custom Node Packaging

How to structure, register, and publish a custom node package.

## Project Structure

```
ComfyUI/custom_nodes/
  my_custom_nodes/
    __init__.py            # Entry point (required)
    nodes.py               # Node class definitions
    requirements.txt       # Python dependencies
    pyproject.toml         # Package metadata
    README.md              # Documentation
    js/                    # Frontend extensions (optional)
    │   └── my_extension.js
    docs/                  # Help pages (optional)
    │   └── MyNode.md
    locales/               # i18n translations (optional)
        └── zh/
            └── main.json
```

## Entry Point: __init__.py

### V3 Registration (Recommended)

```python
# __init__.py
from typing_extensions import override
from comfy_api.latest import ComfyExtension, io

from .nodes import MyNode1, MyNode2, MyNode3

WEB_DIRECTORY = "./js"  # optional: frontend JS extensions

class MyNodesExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [MyNode1, MyNode2, MyNode3]

    @override
    async def on_load(self):
        # Optional: run initialization logic when extension loads
        pass

async def comfy_entrypoint() -> MyNodesExtension:
    return MyNodesExtension()
```

### V1 Registration (Legacy)

```python
# __init__.py
from .nodes import MyNode1, MyNode2

NODE_CLASS_MAPPINGS = {
    "MyNode1": MyNode1,
    "MyNode2": MyNode2,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MyNode1": "My Node 1",
    "MyNode2": "My Node 2",
}

WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
```

## Node Definitions File

```python
# nodes.py
import torch
from comfy_api.latest import io

class MyNode1(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MyNode1_UniqueID",   # globally unique
            display_name="My Node 1",
            category="my_nodes",
            description="Does something useful",
            inputs=[
                io.Image.Input("image"),
                io.Float.Input("value", default=1.0, min=0.0, max=10.0),
            ],
            outputs=[io.Image.Output("IMAGE")],
        )

    @classmethod
    def execute(cls, image, value):
        return io.NodeOutput(image * value)
```

## Dependencies: requirements.txt

```
# requirements.txt
opencv-python>=4.8.0
requests>=2.28.0
```

**Important**: Only list dependencies not already included with ComfyUI. ComfyUI ships with: `torch`, `torchvision`, `torchaudio`, `numpy`, `PIL/Pillow`, `scipy`, `safetensors`, `transformers`, `accelerate`.

## pyproject.toml

```toml
[project]
name = "comfyui-my-nodes"
version = "1.0.0"
description = "My custom nodes for ComfyUI"
license = "MIT"
requires-python = ">=3.10"

[project.urls]
Repository = "https://github.com/username/comfyui-my-nodes"
```

## Frontend Extensions (JavaScript)

Place `.js` files in the `WEB_DIRECTORY`:

```
my_custom_nodes/
  js/
    my_widgets.js      # Custom widget implementations
    my_extension.js    # Extension hooks
```

```python
# __init__.py
WEB_DIRECTORY = "./js"
```

All `.js` files in this directory are loaded by the frontend automatically. CSS and other resources can be accessed at `extensions/my_custom_nodes/filename.css`.

## Help Pages

Create markdown documentation per node:

```
my_custom_nodes/
  docs/
    MyNode1.md         # filename matches node_id
```

```markdown
<!-- docs/MyNode1.md -->
# My Node 1

Processes images with adjustable value.

## Inputs
- **image**: The input image
- **value**: Processing strength (0.0 - 10.0)

## Outputs
- **IMAGE**: The processed image
```

## Internationalization (i18n)

```
my_custom_nodes/
  locales/
    zh/
      main.json
      nodeDefs.json    # node definition translations
```

```json
// locales/zh/nodeDefs.json
{
    "MyNode1_UniqueID": {
        "display_name": "我的节点1",
        "description": "处理图像",
        "inputs": {
            "image": { "display_name": "图像" },
            "value": { "display_name": "数值", "tooltip": "处理强度" }
        }
    }
}
```

## Single-File Node

For very simple nodes, everything can be in one file:

```python
# ComfyUI/custom_nodes/my_simple_node.py
import torch
from comfy_api.latest import ComfyExtension, io
from typing_extensions import override

class InvertImage(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="SimpleInvert",
            display_name="Simple Invert",
            category="image",
            inputs=[io.Image.Input("image")],
            outputs=[io.Image.Output("IMAGE")],
        )

    @classmethod
    def execute(cls, image):
        return io.NodeOutput(1.0 - image)


class SimpleExtension(ComfyExtension):
    @override
    async def get_node_list(self):
        return [InvertImage]

async def comfy_entrypoint():
    return SimpleExtension()
```

## Key Imports

```python
# V3 API core
from comfy_api.latest import ComfyExtension, io, ui
from comfy_api.latest import ComfyAPI          # async runtime API (use with await)
from comfy_api.latest import ComfyAPISync      # sync runtime API (use in sync execute)
from comfy_api.latest import Input             # Input.Image, Input.Audio, Input.Mask, Input.Latent, Input.Video
from comfy_api.latest import InputImpl         # InputImpl.VideoFromFile, InputImpl.VideoFromComponents
from comfy_api.latest import Types             # Types.MESH, Types.VOXEL, Types.File3D, Types.VideoCodec
from typing_extensions import override

# Common utilities
import folder_paths                            # directory management
from server import PromptServer                # server-to-client messaging
from comfy_execution.graph_utils import GraphBuilder  # node expansion
```

## Using folder_paths

ComfyUI provides `folder_paths` for accessing standard directories:

```python
import folder_paths

# Standard directories
input_dir = folder_paths.get_input_directory()
output_dir = folder_paths.get_output_directory()
temp_dir = folder_paths.get_temp_directory()

# Model directories
checkpoint_paths = folder_paths.get_folder_paths("checkpoints")
lora_paths = folder_paths.get_folder_paths("loras")

# Register custom model folder
folder_paths.add_model_folder_path("my_models", "/path/to/models")

# Get model file list
models = folder_paths.get_filename_list("checkpoints")
```

## Publishing to ComfyUI Registry

### 1. Create `pyproject.toml`

```toml
[project]
name = "comfyui-my-nodes"
version = "1.0.0"
description = "My custom nodes"
license = "MIT"

[tool.comfy]
PublisherId = "your-publisher-id"
```

### 2. Publish

```bash
comfy node publish
```

### CI/CD with GitHub Actions

```yaml
# .github/workflows/publish.yml
name: Publish to ComfyUI Registry
on:
  push:
    tags:
      - 'v*'
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install comfy-cli
      - run: comfy node publish
        env:
          COMFY_API_KEY: ${{ secrets.COMFY_API_KEY }}
```

## Scaffolding with comfy-cli

```bash
# Install comfy-cli
pip install comfy-cli

# Create new custom node project
cd ComfyUI/custom_nodes
comfy node scaffold
```

This generates the boilerplate structure with all necessary files.

## Node ID Best Practices

- Use a **globally unique** prefix: `"MyProject_NodeName"` or `"username.NodeName"`
- Never change `node_id` after release (breaks saved workflows)
- Use `display_name` for user-facing name changes
- Use `search_aliases` for discoverability: `search_aliases=["alias1", "alias2"]`

## Common Patterns

### Organizing Multiple Node Files

```python
# __init__.py
from typing_extensions import override
from comfy_api.latest import ComfyExtension, io

from .image_nodes import BlurNode, SharpenNode, ResizeNode
from .text_nodes import ConcatNode, FormatNode
from .util_nodes import SwitchNode, DebugNode

class MyExtension(ComfyExtension):
    @override
    async def get_node_list(self):
        return [
            BlurNode, SharpenNode, ResizeNode,
            ConcatNode, FormatNode,
            SwitchNode, DebugNode,
        ]

async def comfy_entrypoint():
    return MyExtension()
```

### Conditional Node Loading

```python
class MyExtension(ComfyExtension):
    @override
    async def get_node_list(self):
        nodes = [BasicNode]
        try:
            import cv2
            from .opencv_nodes import OpenCVNode
            nodes.append(OpenCVNode)
        except ImportError:
            pass
        return nodes
```

## See Also

- `comfyui-node-basics` - Node class structure
- `comfyui-node-frontend` - JavaScript extension details
- `comfyui-node-migration` - V1 to V3 migration

---

## Migration

# ComfyUI V1 → V3 Migration Guide

Migrate existing V1 nodes to the modern V3 API. V3 uses classmethods, typed inputs/outputs, and `ComfyExtension` registration.

## Migration Checklist

1. Change base class to `io.ComfyNode`
2. Replace `INPUT_TYPES()` with `define_schema()` returning `io.Schema`
3. Rename execution function to `execute` and make it a `@classmethod`
4. Replace return tuples with `io.NodeOutput(...)`
5. Replace `IS_CHANGED` with `fingerprint_inputs`
6. Replace `VALIDATE_INPUTS` with `validate_inputs`
7. Convert `check_lazy_status` to `@classmethod`
8. Replace `NODE_CLASS_MAPPINGS` with `ComfyExtension` + `comfy_entrypoint()`
9. Access hidden inputs via `cls.hidden` instead of kwargs
10. Remove `__init__` methods (no instance state in V3)

## Side-by-Side Comparison

### V1 (Before)

```python
import torch

class ImageInvertV1:
    CATEGORY = "image"
    FUNCTION = "invert"
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    OUTPUT_TOOLTIPS = ("The inverted image",)
    DESCRIPTION = "Inverts image colors"

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
                "strength": ("FLOAT", {
                    "default": 1.0,
                    "min": 0.0,
                    "max": 1.0,
                    "step": 0.01,
                }),
            },
            "optional": {
                "mask": ("MASK",),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    @classmethod
    def IS_CHANGED(s, image, strength, mask=None, unique_id=None):
        return strength

    @classmethod
    def VALIDATE_INPUTS(s, image, strength, mask=None, unique_id=None):
        if strength < 0:
            return "Strength must be non-negative"
        return True

    def invert(self, image, strength, mask=None, unique_id=None):
        inverted = 1.0 - image
        result = image * (1 - strength) + inverted * strength
        if mask is not None:
            result = image * (1 - mask.unsqueeze(-1)) + result * mask.unsqueeze(-1)
        return (result,)

NODE_CLASS_MAPPINGS = {"ImageInvertV1": ImageInvertV1}
NODE_DISPLAY_NAME_MAPPINGS = {"ImageInvertV1": "Invert Image"}
```

### V3 (After)

```python
import torch
from typing_extensions import override
from comfy_api.latest import ComfyExtension, io

class ImageInvertV3(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ImageInvertV3",
            display_name="Invert Image",
            description="Inverts image colors",
            category="image",
            inputs=[
                io.Image.Input("image"),
                io.Float.Input("strength", default=1.0, min=0.0, max=1.0, step=0.01),
                io.Mask.Input("mask", optional=True),
            ],
            outputs=[
                io.Image.Output("IMAGE", tooltip="The inverted image"),
            ],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def fingerprint_inputs(cls, image, strength, mask=None):
        return strength

    @classmethod
    def validate_inputs(cls, image, strength, mask=None):
        if strength < 0:
            return "Strength must be non-negative"
        return True

    @classmethod
    def execute(cls, image, strength, mask=None):
        node_id = cls.hidden.unique_id  # access hidden via cls.hidden

        inverted = 1.0 - image
        result = image * (1 - strength) + inverted * strength
        if mask is not None:
            result = image * (1 - mask.unsqueeze(-1)) + result * mask.unsqueeze(-1)
        return io.NodeOutput(result)


class MyExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [ImageInvertV3]

async def comfy_entrypoint() -> MyExtension:
    return MyExtension()
```

## Property Mapping

| V1 Property | V3 Equivalent |
|---|---|
| `CATEGORY = "image"` | `io.Schema(category="image")` |
| `FUNCTION = "my_func"` | Always `execute` (fixed name) |
| `RETURN_TYPES = ("IMAGE",)` | `outputs=[io.Image.Output()]` |
| `RETURN_NAMES = ("image",)` | `outputs=[io.Image.Output(display_name="image")]` |
| `OUTPUT_TOOLTIPS = ("tip",)` | `outputs=[io.Image.Output(tooltip="tip")]` |
| `OUTPUT_NODE = True` | `io.Schema(is_output_node=True)` |
| `DEPRECATED = True` | `io.Schema(is_deprecated=True)` |
| `EXPERIMENTAL = True` | `io.Schema(is_experimental=True)` |
| `API_NODE = True` | `io.Schema(is_api_node=True)` |
| `NOT_IDEMPOTENT = True` | `io.Schema(not_idempotent=True)` |
| `DESCRIPTION = "..."` | `io.Schema(description="...")` |
| `SEARCH_ALIASES = [...]` | `io.Schema(search_aliases=[...])` |
| `INPUT_IS_LIST = True` | `io.Schema(is_input_list=True)` |
| `OUTPUT_IS_LIST = (True,)` | `io.Image.Output(is_output_list=True)` |
| `DEV_ONLY = True` | `io.Schema(is_dev_only=True)` |
| `ESSENTIALS_CATEGORY = "Basic"` | `io.Schema(essentials_category="Basic")` |

## Input Type Mapping

| V1 Input | V3 Input |
|---|---|
| `("IMAGE",)` | `io.Image.Input("id")` |
| `("MASK",)` | `io.Mask.Input("id")` |
| `("LATENT",)` | `io.Latent.Input("id")` |
| `("MODEL",)` | `io.Model.Input("id")` |
| `("CLIP",)` | `io.Clip.Input("id")` |
| `("VAE",)` | `io.Vae.Input("id")` |
| `("CONDITIONING",)` | `io.Conditioning.Input("id")` |
| `("INT", {"default": 0, ...})` | `io.Int.Input("id", default=0, ...)` |
| `("FLOAT", {"default": 1.0, ...})` | `io.Float.Input("id", default=1.0, ...)` |
| `("STRING", {"multiline": True})` | `io.String.Input("id", multiline=True)` |
| `("BOOLEAN", {"default": True})` | `io.Boolean.Input("id", default=True)` |
| `(["opt1", "opt2"],)` | `io.Combo.Input("id", options=["opt1", "opt2"])` |
| `("CONTROL_NET",)` | `io.ControlNet.Input("id")` |
| `("CLIP_VISION",)` | `io.ClipVision.Input("id")` |
| `("CLIP_VISION_OUTPUT",)` | `io.ClipVisionOutput.Input("id")` |
| `("STYLE_MODEL",)` | `io.StyleModel.Input("id")` |
| `("GLIGEN",)` | `io.Gligen.Input("id")` |
| `("UPSCALE_MODEL",)` | `io.UpscaleModel.Input("id")` |
| `("AUDIO",)` | `io.Audio.Input("id")` |
| `("VIDEO",)` | `io.Video.Input("id")` |
| `("SAMPLER",)` | `io.Sampler.Input("id")` |
| `("SIGMAS",)` | `io.Sigmas.Input("id")` |
| `("NOISE",)` | `io.Noise.Input("id")` |
| `("GUIDER",)` | `io.Guider.Input("id")` |
| `("HOOKS",)` | `io.Hooks.Input("id")` |
| `("LORA_MODEL",)` | `io.LoraModel.Input("id")` |
| `("MESH",)` | `io.Mesh.Input("id")` |
| `("VOXEL",)` | `io.Voxel.Input("id")` |
| `("FILE_3D",)` | `io.File3DAny.Input("id")` |
| `("FILE_3D_GLB",)` | `io.File3DGLB.Input("id")` |
| `("SVG",)` | `io.SVG.Input("id")` |
| `("COLOR",)` | `io.Color.Input("id")` |
| `("BOUNDING_BOX",)` | `io.BoundingBox.Input("id")` |
| `("CURVE",)` | `io.Curve.Input("id")` |
| `("LATENT_UPSCALE_MODEL",)` | `io.LatentUpscaleModel.Input("id")` |
| `("MODEL_PATCH",)` | `io.ModelPatch.Input("id")` |
| `("HOOK_KEYFRAMES",)` | `io.HookKeyframes.Input("id")` |
| `("AUDIO_ENCODER",)` | `io.AudioEncoder.Input("id")` |
| `("AUDIO_ENCODER_OUTPUT",)` | `io.AudioEncoderOutput.Input("id")` |
| `("TRACKS",)` | `io.Tracks.Input("id")` |
| `("LOSS_MAP",)` | `io.LossMap.Input("id")` |
| `("TIMESTEPS_RANGE",)` | `io.TimestepsRange.Input("id")` |
| `("LATENT_OPERATION",)` | `io.LatentOperation.Input("id")` |
| `("WEBCAM",)` | `io.Webcam.Input("id")` |
| `("PHOTOMAKER",)` | `io.Photomaker.Input("id")` |
| `("WAN_CAMERA_EMBEDDING",)` | `io.WanCameraEmbedding.Input("id")` |
| `("LOAD_3D",)` | `io.Load3D.Input("id")` |
| `("LOAD_3D_ANIMATION",)` | `io.Load3DAnimation.Input("id")` |
| `("LOAD3D_CAMERA",)` | `io.Load3DCamera.Input("id")` |
| `("FILE_3D_GLTF",)` | `io.File3DGLTF.Input("id")` |
| `("FILE_3D_FBX",)` | `io.File3DFBX.Input("id")` |
| `("FILE_3D_OBJ",)` | `io.File3DOBJ.Input("id")` |
| `("FILE_3D_STL",)` | `io.File3DSTL.Input("id")` |
| `("FILE_3D_USDZ",)` | `io.File3DUSDZ.Input("id")` |
| `("POINT",)` | `io.Point.Input("id")` |
| `("FACE_ANALYSIS",)` | `io.FaceAnalysis.Input("id")` |
| `("BBOX",)` | `io.BBOX.Input("id")` |
| `("SEGS",)` | `io.SEGS.Input("id")` |
| `("IMAGECOMPARE",)` | `io.ImageCompare.Input("id")` |
| `("*",)` | `io.AnyType.Input("id")` or `io.MultiType.Input("id", types=[...])` |

## Method Migration

### Execute Method

```python
# V1: instance method with custom name
class V1Node:
    FUNCTION = "process"
    def process(self, image, value):
        return (result,)

# V3: classmethod named "execute", returns NodeOutput
class V3Node(io.ComfyNode):
    @classmethod
    def execute(cls, image, value):
        return io.NodeOutput(result)
```

### IS_CHANGED → fingerprint_inputs

```python
# V1
@classmethod
def IS_CHANGED(s, **kwargs):
    return float("NaN")  # always re-execute

# V3
@classmethod
def fingerprint_inputs(cls, **kwargs):
    import time
    return time.time()  # always re-execute
```

### VALIDATE_INPUTS → validate_inputs

```python
# V1
@classmethod
def VALIDATE_INPUTS(s, input_types=None, **kwargs):
    return True

# V3
@classmethod
def validate_inputs(cls, input_types=None, **kwargs):
    return True
```

### check_lazy_status

```python
# V1: instance method
def check_lazy_status(self, **kwargs):
    return ["input_name"]

# V3: classmethod
@classmethod
def check_lazy_status(cls, **kwargs):
    return ["input_name"]
```

### Hidden Inputs

```python
# V1: received as kwargs
def execute(self, image, unique_id=None, prompt=None):
    node_id = unique_id

# V3: accessed via cls.hidden
@classmethod
def execute(cls, image):
    node_id = cls.hidden.unique_id
    prompt = cls.hidden.prompt
```

## Registration Migration

```python
# V1
NODE_CLASS_MAPPINGS = {
    "Node1": Node1Class,
    "Node2": Node2Class,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "Node1": "Node One",
    "Node2": "Node Two",
}
WEB_DIRECTORY = "./js"

# V3
from typing_extensions import override
from comfy_api.latest import ComfyExtension, io

class MyExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [Node1Class, Node2Class]

    @override
    async def on_load(self):
        # Optional: initialization logic
        pass

async def comfy_entrypoint() -> MyExtension:
    return MyExtension()

# WEB_DIRECTORY still works the same way for JS extensions
WEB_DIRECTORY = "./js"
```

## Output Node Migration

```python
# V1
class V1SaveNode:
    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "save"

    def save(self, images, prefix):
        # ... save logic ...
        return {"ui": {"images": results}}

# V3
from comfy_api.latest import io, ui

class V3SaveNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="V3SaveNode",
            display_name="Save",
            category="image",
            is_output_node=True,
            inputs=[
                io.Image.Input("images"),
                io.String.Input("prefix", default="output"),
            ],
            outputs=[],
            hidden=[io.Hidden.prompt, io.Hidden.extra_pnginfo],
        )

    @classmethod
    def execute(cls, images, prefix):
        saved = ui.ImageSaveHelper.get_save_images_ui(images, prefix, cls=cls)
        return io.NodeOutput(ui=saved)
```

## Key Gotchas

1. **No instance state**: V3 execute is a classmethod. Don't store state on `self`. Use external storage if needed.
2. **Fixed method name**: Always `execute`, never custom names.
3. **Hidden access changed**: Use `cls.hidden.prompt` not function parameters.
4. **Return type changed**: `io.NodeOutput(val)` not `(val,)`.
5. **Optional inputs**: Use `=None` default in execute params, not separate `"optional"` dict.
6. **Async support**: V3 execute can be `async def execute(cls, ...)`.

## See Also

- `comfyui-node-basics` - V3 node fundamentals
- `comfyui-node-packaging` - Project structure
- `comfyui-node-lifecycle` - Execution lifecycle differences