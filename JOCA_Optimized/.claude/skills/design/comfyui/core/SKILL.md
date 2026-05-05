---
name: comfyui-core
description: ComfyUI custom node development — node structure, data types (IMAGE/LATENT/MASK/tensors), and execution lifecycle. Use when creating ComfyUI nodes, working with tensor data, or managing node caching and IS_CHANGED.
---


---

## Node Basics

# ComfyUI Custom Node Basics (V3 API)

ComfyUI uses Python classes to define nodes. The **V3 API** is the current recommended approach. Nodes inherit from `io.ComfyNode` and define a schema + execute method.

## Quick Start

```python
from comfy_api.latest import ComfyExtension, io

class MyNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MyNode",
            display_name="My Custom Node",
            category="my_category",
            inputs=[
                io.Image.Input("image"),
                io.Float.Input("strength", default=1.0, min=0.0, max=1.0, step=0.01),
            ],
            outputs=[
                io.Image.Output("IMAGE"),
            ],
        )

    @classmethod
    def execute(cls, image, strength):
        result = image * strength
        return io.NodeOutput(result)
```

## V3 Node Class Structure

Every V3 node requires:

1. **Inherit from `io.ComfyNode`**
2. **`define_schema(cls)`** - classmethod returning `io.Schema`
3. **`execute(cls, ...)`** - classmethod performing the computation

```python
from typing_extensions import override
from comfy_api.latest import ComfyExtension, io

class ImageBrighten(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ImageBrighten",          # unique identifier
            display_name="Brighten Image",     # shown in UI
            category="image/adjust",           # menu path
            description="Adjusts image brightness",
            inputs=[
                io.Image.Input("image"),
                io.Float.Input("factor", default=1.2, min=0.0, max=3.0, step=0.1),
            ],
            outputs=[
                io.Image.Output("IMAGE"),
            ],
        )

    @classmethod
    def execute(cls, image, factor):
        result = torch.clamp(image * factor, 0.0, 1.0)
        return io.NodeOutput(result)
```

## io.Schema Fields

```python
io.Schema(
    node_id="UniqueNodeID",            # required: unique string ID
    display_name="Display Name",        # optional: shown in UI menus
    category="category/subcategory",    # menu hierarchy (default "sd")
    description="Node description",     # optional: tooltip text
    inputs=[...],                       # list of Input objects
    outputs=[...],                      # list of Output objects
    hidden=[...],                       # list of Hidden enum values
    is_output_node=False,               # True for nodes with side effects (save, preview)
    is_experimental=False,              # marks as experimental
    is_deprecated=False,                # marks as deprecated
    is_dev_only=False,                  # hidden unless dev mode enabled
    is_api_node=False,                  # marks as API-only node
    is_input_list=False,                # receive full lists instead of individual items
    not_idempotent=False,               # prevents caching
    accept_all_inputs=False,            # accept arbitrary inputs via **kwargs
    enable_expand=False,                # allow node expansion (subgraphs)
    search_aliases=["alias1", "alias2"],# alternative search terms
    essentials_category="Basic",        # optional: Essentials tab category
    price_badge=None,                   # optional: PriceBadge for API nodes
    has_intermediate_output=False,      # True for nodes with interactive UI that produce intermediate outputs
)
```

## V3 Node Registration

V3 nodes are registered via `ComfyExtension` and `comfy_entrypoint()`:

```python
from typing_extensions import override
from comfy_api.latest import ComfyExtension, io

class MyNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MyNode",
            display_name="My Node",
            category="my_nodes",
            inputs=[io.String.Input("text", multiline=True)],
            outputs=[io.String.Output()],
        )

    @classmethod
    def execute(cls, text):
        return io.NodeOutput(text.upper())


class MyExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [MyNode]


async def comfy_entrypoint() -> MyExtension:
    return MyExtension()
```

The `comfy_entrypoint()` function must be defined at the module level (in the file directly imported by ComfyUI).

## V1 Node Structure (Legacy Reference)

V1 nodes use class attributes and `NODE_CLASS_MAPPINGS`:

```python
class MyNodeV1:
    CATEGORY = "my_category"
    FUNCTION = "execute"
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
                "strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0}),
            }
        }

    def execute(self, image, strength):
        return (image * strength,)

NODE_CLASS_MAPPINGS = {"MyNodeV1": MyNodeV1}
NODE_DISPLAY_NAME_MAPPINGS = {"MyNodeV1": "My Node V1"}
```

## Key Differences: V3 vs V1

| Aspect | V3 | V1 |
|---|---|---|
| Base class | `io.ComfyNode` | Plain class |
| Execute method | `execute` classmethod (fixed name) | Instance method (custom name via `FUNCTION`) |
| Inputs | `io.Schema(inputs=[...])` | `INPUT_TYPES()` dict |
| Outputs | `io.Schema(outputs=[...])` | `RETURN_TYPES` tuple |
| Return value | `io.NodeOutput(...)` | Plain tuple |
| Registration | `ComfyExtension` + `comfy_entrypoint()` | `NODE_CLASS_MAPPINGS` dict |
| State | No instance state (classmethods) | Instance state allowed |
| Hidden inputs | `cls.hidden.prompt`, etc. | kwargs from `"hidden"` dict |

## Important Rules

- `node_id` must be globally unique across all nodes
- `execute()` parameters must match input IDs exactly
- All methods are `@classmethod` in V3 (no instance state)
- Return `io.NodeOutput(val1, val2, ...)` matching output count
- Category uses `/` separator for hierarchy: `"image/transform"`
- Prefix category with `_` to hide from menus: `"_for_testing"`

## See Also

- `comfyui-node-datatypes` - Data types (IMAGE, LATENT, MASK, etc.)
- `comfyui-node-inputs` - Input configuration details
- `comfyui-node-outputs` - Output types and UI outputs
- `comfyui-node-packaging` - Project structure and packaging
- `comfyui-node-lifecycle` - Execution lifecycle and caching

---

## Data Types

# ComfyUI Data Types

ComfyUI uses specific data types for node inputs and outputs. Understanding tensor shapes and data formats is essential.

## Complete Type Reference

### Tensor/Data Types

| Type | V3 Class | Format | Description |
|---|---|---|---|
| IMAGE | `io.Image` | `torch.Tensor [B,H,W,C]` float32 0-1 | Batch of RGB images |
| MASK | `io.Mask` | `torch.Tensor [H,W]` or `[B,H,W]` float32 0-1 | Grayscale masks |
| LATENT | `io.Latent` | `{"samples": Tensor[B,C,H,W] or [B,C,T,H,W], "noise_mask"?: Tensor, "batch_index"?: list[int], "type"?: str}` | Latent space (4D image / 5D video) |
| CONDITIONING | `io.Conditioning` | `list[tuple[Tensor, PooledDict]]` | Text conditioning with pooled outputs |
| AUDIO | `io.Audio` | `{"waveform": Tensor[B,C,T], "sample_rate": int}` | Audio data |
| VIDEO | `io.Video` | `VideoInput` ABC | Video data (abstract base class) |
| SIGMAS | `io.Sigmas` | `torch.Tensor` 1D, length steps+1 | Noise schedule |
| NOISE | `io.Noise` | Object with `generate_noise()` | Noise generator |
| LORA_MODEL | `io.LoraModel` | `dict[str, torch.Tensor]` | LoRA weight deltas |
| LOSS_MAP | `io.LossMap` | `{"loss": list[torch.Tensor]}` | Loss map |
| TRACKS | `io.Tracks` | `{"track_path": Tensor, "track_visibility": Tensor}` | Motion tracking data |
| WAN_CAMERA_EMBEDDING | `io.WanCameraEmbedding` | `torch.Tensor` | WAN camera embeddings |
| LATENT_OPERATION | `io.LatentOperation` | `Callable[[Tensor], Tensor]` | Latent transform function |
| TIMESTEPS_RANGE | `io.TimestepsRange` | `tuple[int, int]` | Range 0.0-1.0 |

### Model Types (opaque, typically pass-through)

| Type | V3 Class | Python Type |
|---|---|---|
| MODEL | `io.Model` | `ModelPatcher` |
| CLIP | `io.Clip` | `CLIP` |
| VAE | `io.Vae` | `VAE` |
| CONTROL_NET | `io.ControlNet` | `ControlNet` |
| CLIP_VISION | `io.ClipVision` | `ClipVisionModel` |
| CLIP_VISION_OUTPUT | `io.ClipVisionOutput` | `ClipVisionOutput` |
| STYLE_MODEL | `io.StyleModel` | `StyleModel` |
| GLIGEN | `io.Gligen` | `ModelPatcher` (wrapping Gligen) |
| UPSCALE_MODEL | `io.UpscaleModel` | `ImageModelDescriptor` |
| LATENT_UPSCALE_MODEL | `io.LatentUpscaleModel` | Any |
| SAMPLER | `io.Sampler` | `Sampler` |
| GUIDER | `io.Guider` | `CFGGuider` |
| HOOKS | `io.Hooks` | `HookGroup` |
| HOOK_KEYFRAMES | `io.HookKeyframes` | `HookKeyframeGroup` |
| MODEL_PATCH | `io.ModelPatch` | Any |
| AUDIO_ENCODER | `io.AudioEncoder` | Any |
| AUDIO_ENCODER_OUTPUT | `io.AudioEncoderOutput` | Any |
| PHOTOMAKER | `io.Photomaker` | Any |
| POINT | `io.Point` | Any |
| FACE_ANALYSIS | `io.FaceAnalysis` | Any |
| BBOX | `io.BBOX` | Any |
| SEGS | `io.SEGS` | Any |

### 3D Types

| Type | V3 Class | Python Type | Description |
|---|---|---|---|
| MESH | `io.Mesh` | `MESH(vertices, faces)` | 3D mesh with vertices + faces tensors |
| VOXEL | `io.Voxel` | `VOXEL(data)` | Voxel data tensor |
| FILE_3D | `io.File3DAny` | `File3D` | Any supported 3D format |
| FILE_3D_GLB | `io.File3DGLB` | `File3D` | Binary glTF |
| FILE_3D_GLTF | `io.File3DGLTF` | `File3D` | JSON-based glTF |
| FILE_3D_FBX | `io.File3DFBX` | `File3D` | FBX format |
| FILE_3D_OBJ | `io.File3DOBJ` | `File3D` | OBJ format |
| FILE_3D_STL | `io.File3DSTL` | `File3D` | STL format (3D printing) |
| FILE_3D_USDZ | `io.File3DUSDZ` | `File3D` | Apple AR format |
| SVG | `io.SVG` | `SVG` | Scalable vector graphics |
| LOAD_3D | `io.Load3D` | `{"image": str, "mask": str, "normal": str, "camera_info": CameraInfo}` | 3D model with renders |
| LOAD_3D_ANIMATION | `io.Load3DAnimation` | Same as Load3D | Animated 3D model |
| LOAD3D_CAMERA | `io.Load3DCamera` | `{"position": dict, "target": dict, "zoom": int, "cameraType": str}` | 3D camera info |

### Widget Types (create UI controls)

| Type | V3 Class | Python Type | Description |
|---|---|---|---|
| INT | `io.Int` | `int` | Integer with min/max/step |
| FLOAT | `io.Float` | `float` | Float with min/max/step/round |
| STRING | `io.String` | `str` | Text (single/multi-line) |
| BOOLEAN | `io.Boolean` | `bool` | Toggle with labels |
| COMBO | `io.Combo` | `str` | Dropdown selection |
| COMBO (multi) | `io.MultiCombo` | `list[str]` | Multi-select dropdown |
| COLOR | `io.Color` | `str` (hex) | Color picker, default `#ffffff` |
| BOUNDING_BOX | `io.BoundingBox` | `{"x": int, "y": int, "width": int, "height": int}` | Rectangle region |
| CURVE | `io.Curve` | `list[tuple[float, float]]` | Spline curve points |
| IMAGECOMPARE | `io.ImageCompare` | `dict` | Image comparison widget |
| WEBCAM | `io.Webcam` | `str` | Webcam capture widget |
| HISTOGRAM | `io.Histogram` | `list[int]` | Histogram bin counts |

### Special Types

| Type | V3 Class | Description |
|---|---|---|
| `*` (ANY) | `io.AnyType` | Matches any type |
| COMFY_MULTITYPED_V3 | `io.MultiType` | Accept multiple specific types on one input |
| COMFY_MATCHTYPE_V3 | `io.MatchType` | Generic type matching across inputs/outputs |
| COMFY_AUTOGROW_V3 | `io.Autogrow` | Dynamic growing inputs |
| COMFY_DYNAMICCOMBO_V3 | `io.DynamicCombo` | Combo that reveals sub-inputs per option |
| FLOW_CONTROL | `io.FlowControl` | Internal testing only |
| ACCUMULATION | `io.Accumulation` | Internal testing only |

## IMAGE Type

Images are `torch.Tensor` with shape `[B, H, W, C]`:
- **B** = batch size (1 for single image)
- **H** = height in pixels
- **W** = width in pixels
- **C** = channels (3 for RGB, values 0.0-1.0)

```python
import torch
import numpy as np
from PIL import Image as PILImage

class ImageProcessor(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ImageProcessor",
            display_name="Image Processor",
            category="image",
            inputs=[io.Image.Input("image")],
            outputs=[io.Image.Output("IMAGE")],
        )

    @classmethod
    def execute(cls, image):
        b, h, w, c = image.shape
        result = torch.clamp(image * 1.5, 0.0, 1.0)
        return io.NodeOutput(result)
```

### Loading / Saving Images

```python
from PIL import ImageOps

# Load from file → tensor
def load_image(path):
    img = PILImage.open(path)
    img = ImageOps.exif_transpose(img)   # fix rotation from camera EXIF
    if img.mode == "I":                  # handle 16-bit images
        img = img.point(lambda i: i * (1 / 255))
    img = img.convert("RGB")
    return torch.from_numpy(np.array(img).astype(np.float32) / 255.0).unsqueeze(0)

# Tensor → save to file
def save_image(tensor, path):
    if tensor.dim() == 4:
        tensor = tensor[0]
    PILImage.fromarray(np.clip(255.0 * tensor.cpu().numpy(), 0, 255).astype(np.uint8)).save(path)

# Batch operations
batch = torch.cat([img1, img2], dim=0)    # stack into batch
single = image[i]                          # extract from batch [H,W,C]
single_batch = image.unsqueeze(0)          # add batch dim [1,H,W,C]
```

## MASK Type

`torch.Tensor` with shape `[H, W]` or `[B, H, W]`, values 0.0-1.0.

```python
# Invert mask
inverted = 1.0 - mask

# Mask ↔ Image conversion
alpha = mask.unsqueeze(0).unsqueeze(-1)                   # [1,H,W,1]
gray_mask = 0.299*img[:,:,:,0] + 0.587*img[:,:,:,1] + 0.114*img[:,:,:,2]
image_from_mask = mask.unsqueeze(-1).repeat(1, 1, 1, 3)  # [B,H,W,3]

# Ensure batch dim
if mask.dim() == 2:
    mask = mask.unsqueeze(0)  # [1, H, W]
```

## LATENT Type

Dict with typed keys:

```python
class LatentDict(TypedDict):
    samples: torch.Tensor       # [B, C, H, W] (image) or [B, C, T, H, W] (video) - required
    noise_mask: NotRequired[torch.Tensor]
    batch_index: NotRequired[list[int]]
    type: NotRequired[str]      # only for "audio", "hunyuan3dv2"
```

**Image models** (SD1.5, SDXL, SD3, Flux): 4D `[B, C, H, W]` — SD1.5/SDXL = 4 channels, SD3/Flux = 16 channels. Latent dimensions are 1/8 of pixel dims.

**Video models** (Hunyuan Video, Wan, Cosmos, LTX Video, Mochi): 5D `[B, C, T, H, W]` — T is the temporal (frame) dimension.

```python
samples = latent["samples"]
# Check dimensionality:
if samples.ndim == 5:
    B, C, T, H, W = samples.shape   # video latent
else:
    B, C, H, W = samples.shape      # image latent

# Always preserve extra keys when modifying:
result = latent.copy()
result["samples"] = modified_samples
```

## CONDITIONING Type

`list[tuple[Tensor, PooledDict]]` — a list of (cond_tensor, metadata_dict) pairs.

The `PooledDict` contains many optional keys for different models:

```python
class PooledDict(TypedDict):
    pooled_output: torch.Tensor
    control: NotRequired[ControlNet]
    area: NotRequired[tuple[int, ...]]
    strength: NotRequired[float]           # default 1.0
    mask: NotRequired[torch.Tensor]
    start_percent: NotRequired[float]      # 0.0-1.0
    end_percent: NotRequired[float]        # 0.0-1.0
    guidance: NotRequired[float]           # Flux-like models
    hooks: NotRequired[HookGroup]
    # ... many more model-specific keys (SDXL, SVD, WAN, etc.)
```

Combine conditioning: `result = cond_a + cond_b` (list concatenation).

## VIDEO Type

`VideoInput` is an abstract base class with methods:

```python
class VideoInput(ABC):
    def get_components(self) -> VideoComponents    # images tensor + audio + frame_rate
    def save_to(self, path, format, codec, metadata)
    def as_trimmed(self, start_time, duration) -> VideoInput | None
    def get_stream_source(self) -> str | BytesIO
    def get_dimensions(self) -> tuple[int, int]     # (width, height)
    def get_duration(self) -> float                  # seconds
    def get_frame_count(self) -> int
    def get_frame_rate(self) -> Fraction
    def get_container_format(self) -> str
```

Concrete implementations: `VideoFromFile`, `VideoFromComponents` (available via `from comfy_api.latest import InputImpl`).

## 3D Types

### File3D

```python
from comfy_api.latest import Types

# File3D wraps a 3D file (disk path or BytesIO stream)
file_3d = Types.File3D(source="/path/to/model.glb", file_format="glb")
file_3d.format              # "glb"
file_3d.is_disk_backed      # True
file_3d.get_data()          # BytesIO
file_3d.get_bytes()         # raw bytes
file_3d.save_to("/output/model.glb")
```

### MESH and VOXEL

```python
from comfy_api.latest import Types

mesh = Types.MESH(vertices=torch.tensor(...), faces=torch.tensor(...))
voxel = Types.VOXEL(data=torch.tensor(...))
```

## Widget Types with Special Features

### Color

```python
io.Color.Input("color", default="#ff0000", socketless=True)
# Value is a hex string like "#ff0000"
```

### BoundingBox

```python
io.BoundingBox.Input("bbox",
    default={"x": 0, "y": 0, "width": 512, "height": 512},
    socketless=True,
    component="my_component",  # optional custom UI component
)
# Value is {"x": int, "y": int, "width": int, "height": int}
```

### Curve

```python
io.Curve.Input("curve",
    default=[(0.0, 0.0), (1.0, 1.0)],  # linear
    socketless=True,
)
# Value is list of (x, y) tuples
```

### MultiCombo

```python
io.MultiCombo.Input("tags",
    options=["tag1", "tag2", "tag3"],
    default=["tag1"],
    placeholder="Select tags...",
    chip=True,  # show as chips
)
# Value is list[str]
```

### Webcam

```python
io.Webcam.Input("webcam_capture")
# Value is str (captured image data)
```

### ImageCompare

```python
io.ImageCompare.Input("comparison", socketless=True)
# Value is dict
```

## Custom Types

```python
# Simple: create inline custom type
MyData = io.Custom("MY_DATA_TYPE")

# Use in inputs/outputs
io.Schema(
    inputs=[MyData.Input("data")],
    outputs=[MyData.Output("MY_DATA")],
)
```

### Advanced: @comfytype decorator

For custom types with type hints or custom Input/Output classes:

```python
from comfy_api.latest._io import comfytype, ComfyTypeIO

@comfytype(io_type="MY_DATA_TYPE")
class MyData(ComfyTypeIO):
    Type = dict[str, Any]  # type hint for the data
```

## AnyType / Wildcard

```python
# Accept any single type (always a connection input, no widget)
io.AnyType.Input("anything")

# Accept specific multiple types
io.MultiType.Input("data", types=[io.Image, io.Mask, io.Latent])

# MultiType with widget override (shows widget for first type)
io.MultiType.Input(
    io.Float.Input("value", default=1.0),
    types=[io.Float, io.Int],
)
```

## Imports from comfy_api.latest

```python
from comfy_api.latest import (
    ComfyExtension,  # extension registration
    ComfyAPI,        # runtime API (progress, node replacement)
    io,              # all io types (io.Image, io.Schema, io.ComfyNode, etc.)
    ui,              # UI output helpers (ui.PreviewImage, ui.SavedImages, etc.)
    Input,           # Input.Image (ImageInput), Input.Audio, Input.Mask, Input.Latent, Input.Video
    InputImpl,       # InputImpl.VideoFromFile, InputImpl.VideoFromComponents
    Types,           # Types.MESH, Types.VOXEL, Types.File3D, Types.VideoCodec, etc.
)
```

## Tensor Safety

When checking if a tensor exists, always use `is not None` instead of truthiness:

```python
# CORRECT
if image is not None:
    process(image)

# WRONG — multi-element tensors don't support bool()
if image:       # raises RuntimeError
    process(image)

# For boolean conditions on tensors, use .all() or .any()
if (mask > 0.5).all():
    ...
```

## Type Conversion Patterns

```python
# IMAGE [B,H,W,C] → MASK [B,H,W]
mask = 0.299 * image[:,:,:,0] + 0.587 * image[:,:,:,1] + 0.114 * image[:,:,:,2]

# MASK [B,H,W] → IMAGE [B,H,W,C]
image = mask.unsqueeze(-1).repeat(1, 1, 1, 3)

# Resize image tensor
import torch.nn.functional as F
resized = F.interpolate(
    image.permute(0, 3, 1, 2),  # [B,C,H,W] for interpolate
    size=(new_h, new_w), mode='bilinear', align_corners=False
).permute(0, 2, 3, 1)  # back to [B,H,W,C]
```

## See Also

- `comfyui-node-basics` - Node class structure and registration
- `comfyui-node-inputs` - Input configuration details (widget options)
- `comfyui-node-outputs` - Output types and UI outputs
- `comfyui-node-advanced` - MatchType, MultiType, Autogrow, DynamicCombo

---

## Lifecycle

# ComfyUI Node Execution Lifecycle

Understanding the execution lifecycle helps build efficient, correct nodes.

## Execution Flow Overview

```
1. Prompt received from frontend
2. Validation phase
   ├── Look up each node class
   ├── Call INPUT_TYPES() / define_schema() for input specs
   ├── Validate connections and types
   └── Call validate_inputs() for each node
3. Build execution order (topological sort from output nodes)
4. For each node in order:
   ├── Cache check (fingerprint_inputs)
   ├── Input resolution (get upstream values)
   ├── Lazy evaluation (check_lazy_status)
   ├── Execute function
   └── Store outputs in cache
5. Return results to frontend
```

## Execution Order

ComfyUI executes from **output nodes backward**:
1. Identifies output nodes (`is_output_node=True`)
2. Builds dependency graph
3. Topological sort determines execution order
4. Only nodes connected to output nodes execute

## Cache Control: fingerprint_inputs (V3) / IS_CHANGED (V1)

Controls when a node re-executes vs uses cached results.

```python
class RandomNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="RandomNode",
            display_name="Random Value",
            category="utils",
            inputs=[
                io.Float.Input("min_val", default=0.0),
                io.Float.Input("max_val", default=1.0),
            ],
            outputs=[io.Float.Output("FLOAT")],
        )

    @classmethod
    def fingerprint_inputs(cls, min_val, max_val):
        """Return value compared to last run. Different value = re-execute."""
        # Return unique value each time to always re-execute
        import time
        return time.time()

    @classmethod
    def execute(cls, min_val, max_val):
        import random
        return io.NodeOutput(random.uniform(min_val, max_val))
```

**How caching works**:
- Before execution, `fingerprint_inputs()` is called with the same args as `execute()`
- Return value is compared to the previous run's return value
- If **same** → skip execution, use cached output
- If **different** → re-execute the node
- If `fingerprint_inputs` is not defined → cache based on input values

**V1 equivalent** (`IS_CHANGED`):
```python
@classmethod
def IS_CHANGED(s, min_val, max_val):
    return time.time()  # always re-execute
```

### not_idempotent Flag

For nodes that should never be cached:

```python
io.Schema(
    node_id="AlwaysRunNode",
    not_idempotent=True,  # prevents all caching
    # ...
)
```

### has_intermediate_output Flag

For nodes with interactive UI that produce intermediate outputs (e.g., Image Crop, Painter). These behave like output nodes (UI results are cached and resent to the frontend on page refresh) but do NOT automatically get added to the execution list — they only execute if on the dependency path of a real output node.

```python
io.Schema(
    node_id="InteractiveCropNode",
    has_intermediate_output=True,
    # ...
)
```

## Input Validation: validate_inputs (V3) / VALIDATE_INPUTS (V1)

Validates inputs before execution. Runs during the validation phase.

```python
class ValidatedNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ValidatedNode",
            display_name="Validated Node",
            category="utils",
            inputs=[
                io.Int.Input("width", default=512, min=1, max=8192),
                io.Int.Input("height", default=512, min=1, max=8192),
            ],
            outputs=[io.Image.Output("IMAGE")],
        )

    @classmethod
    def validate_inputs(cls, width, height):
        """Return True if valid, or error string if invalid."""
        if width % 8 != 0 or height % 8 != 0:
            return "Width and height must be multiples of 8"
        if width * height > 4096 * 4096:
            return "Total pixels exceed maximum (4096x4096)"
        return True

    @classmethod
    def execute(cls, width, height):
        import torch
        return io.NodeOutput(torch.zeros(1, height, width, 3))
```

**V1 equivalent**:
```python
@classmethod
def VALIDATE_INPUTS(s, width, height):
    if width % 8 != 0:
        return "Width must be a multiple of 8"
    return True
```

### Skipping Type Validation

To accept any type (wildcard inputs), include `input_types` parameter:

```python
@classmethod
def validate_inputs(cls, input_types: dict = None, **kwargs):
    # input_types contains the actual types of connected inputs
    # Returning True skips the default type checking
    return True
```

## Lazy Evaluation: check_lazy_status

Controls which lazy inputs actually need evaluation. See `comfyui-node-inputs` for full details.

```python
@classmethod
def check_lazy_status(cls, condition, value_a=None, value_b=None):
    """Called before execute. Return names of inputs that need evaluation."""
    if condition and value_a is None:
        return ["value_a"]
    if not condition and value_b is None:
        return ["value_b"]
    return []
```

**Key behaviors**:
- Only called if the node has lazy inputs
- May be called **multiple times** as inputs become available
- Unevaluated lazy inputs are `None`
- Return empty list (or `None`) when ready to execute
- Evaluated inputs retain their value across calls

## Output Nodes

Nodes with `is_output_node=True` are execution roots — ComfyUI traces backward from these:

```python
class SaveMyData(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="SaveMyData",
            display_name="Save Data",
            category="output",
            is_output_node=True,  # marks as output node
            inputs=[
                io.String.Input("data"),
                io.String.Input("filename", default="output.txt"),
            ],
            outputs=[],  # output nodes may have no outputs
            hidden=[io.Hidden.prompt, io.Hidden.extra_pnginfo],
        )

    @classmethod
    def execute(cls, data, filename):
        import folder_paths, os
        output_dir = folder_paths.get_output_directory()
        with open(os.path.join(output_dir, filename), 'w') as f:
            f.write(data)
        return io.NodeOutput()
```

## List Processing

### Receiving Lists

```python
# V3: is_input_list=True in Schema (same as V1 INPUT_IS_LIST)
# All inputs arrive as lists — including widget values like batch_size
# Widget values: use widget_value[0] to get the scalar
# Shorter lists are padded by repeating the last value

# V1: INPUT_IS_LIST = True to receive full lists
class ListNode:
    INPUT_IS_LIST = True
    # Now execute() receives lists instead of individual items
```

### Outputting Lists

```python
# V3
io.Image.Output("IMAGE", is_output_list=True)

# V1
OUTPUT_IS_LIST = (True,)  # tuple matching RETURN_TYPES
```

## Error Handling

```python
@classmethod
def execute(cls, image, model):
    try:
        result = model.process(image)
    except RuntimeError as e:
        if "out of memory" in str(e):
            import torch
            torch.cuda.empty_cache()
            # Try with smaller batch
            result = process_in_chunks(image, model)
        else:
            raise
    return io.NodeOutput(result)
```

## Server Communication

Send messages to the frontend during execution:

```python
from server import PromptServer

@classmethod
def execute(cls, data):
    PromptServer.instance.send_sync(
        "my_extension.status",
        {"message": "Processing complete", "progress": 100}
    )
    return io.NodeOutput(data)
```

## Complete Lifecycle Example

```python
import time
import torch
from comfy_api.latest import ComfyExtension, io, ComfyAPISync

class FullLifecycleNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="FullLifecycleNode",
            display_name="Full Lifecycle Demo",
            category="example",
            inputs=[
                io.Image.Input("image"),
                io.Float.Input("threshold", default=0.5, min=0.0, max=1.0),
                io.Image.Input("optional_ref", optional=True, lazy=True),
            ],
            outputs=[
                io.Image.Output("IMAGE"),
                io.Mask.Output("MASK"),
            ],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def validate_inputs(cls, image, threshold, optional_ref=None):
        if threshold == 0.0:
            return "Threshold cannot be exactly 0"
        return True

    @classmethod
    def fingerprint_inputs(cls, image, threshold, optional_ref=None):
        # Re-execute if threshold changed; cache otherwise
        return threshold

    @classmethod
    def check_lazy_status(cls, image, threshold, optional_ref=None):
        # Only request optional_ref if threshold is high
        if threshold > 0.8 and optional_ref is None:
            return ["optional_ref"]
        return []

    @classmethod
    def execute(cls, image, threshold, optional_ref=None):
        node_id = cls.hidden.unique_id

        api = ComfyAPISync()  # use ComfyAPISync in sync execute; ComfyAPI in async
        api.execution.set_progress(0, 2)

        # Generate mask from threshold
        gray = image[:, :, :, 0] * 0.299 + image[:, :, :, 1] * 0.587 + image[:, :, :, 2] * 0.114
        mask = (gray > threshold).float()

        api.execution.set_progress(1, 2)

        # Apply mask
        result = image * mask.unsqueeze(-1)
        if optional_ref is not None:
            result = result + optional_ref * (1 - mask.unsqueeze(-1))

        api.execution.set_progress(2, 2)
        return io.NodeOutput(result, mask)
```

## See Also

- `comfyui-node-basics` - Node structure fundamentals
- `comfyui-node-inputs` - Input types and lazy evaluation
- `comfyui-node-advanced` - Expansion, MatchType, DynamicCombo
- `comfyui-node-outputs` - UI outputs and previews