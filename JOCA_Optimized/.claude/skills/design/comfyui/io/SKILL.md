---
name: comfyui-io
description: ComfyUI node inputs, outputs, and frontend UI. Use when defining INPUT_TYPES, handling node outputs, building custom JavaScript widgets, or implementing interactive node UIs.
---


---

## Inputs

# ComfyUI Node Inputs

Inputs define what data a node accepts. Widget inputs create UI controls; connection inputs create socket slots.

## Widget Input Types

### INT

```python
io.Int.Input("seed",
    default=0,
    min=0,
    max=0xffffffffffffffff,
    step=1,
    control_after_generate=True,  # adds increment/decrement/randomize control
    display_mode=io.NumberDisplay.number,  # "number", "slider", or "gradient_slider"
    tooltip="Random seed for generation",
)
```

**NumberDisplay options**: `io.NumberDisplay.number`, `io.NumberDisplay.slider`, `io.NumberDisplay.gradient_slider`

**ControlAfterGenerate options**: `True` (default randomize), or `io.ControlAfterGenerate.fixed`, `.increment`, `.decrement`, `.randomize`

### FLOAT

```python
io.Float.Input("strength",
    default=1.0,
    min=0.0,
    max=10.0,
    step=0.01,
    round=0.001,         # rounding precision
    display_mode=io.NumberDisplay.slider,
    gradient_stops=[{"offset": 0.0, "color": [0, 0, 0]}, {"offset": 1.0, "color": [255, 255, 255]}],  # for gradient_slider mode
    tooltip="Effect strength",
)
```

### STRING

```python
# Single-line string
io.String.Input("name",
    default="",
    placeholder="Enter name...",
)

# Multi-line text area
io.String.Input("prompt",
    multiline=True,
    default="",
    placeholder="Enter prompt...",
    dynamic_prompts=True,  # enable dynamic prompt syntax
)
```

### BOOLEAN

```python
io.Boolean.Input("enabled",
    default=True,
    label_on="Enabled",
    label_off="Disabled",
    tooltip="Toggle this feature",
)
```

### COMBO (Dropdown)

```python
io.Combo.Input("mode",
    options=["option_a", "option_b", "option_c"],
    default="option_a",
    tooltip="Select processing mode",
    control_after_generate=True,  # adds increment/decrement/randomize control
)
```

**Combo with Enum**:
```python
from enum import Enum

class BlendMode(Enum):
    NORMAL = "normal"
    MULTIPLY = "multiply"
    SCREEN = "screen"

io.Combo.Input("blend", options=BlendMode, default=BlendMode.NORMAL)
# Enum values auto-converted to string list
```

**Combo with file upload**:
```python
io.Combo.Input("image_file",
    options=[],
    upload=io.UploadType.image,          # .image, .audio, .video, .model (for generic file upload)
    image_folder=io.FolderType.input,    # .input, .output, .temp
)
```

**Dynamic combo with remote options**:
```python
io.Combo.Input("model_name",
    options=[],
    remote=io.RemoteOptions(
        route="/internal/models/checkpoints",
        refresh_button=True,
        control_after_refresh="first",  # "first" or "last"
        timeout=5000,        # ms
        max_retries=3,
        refresh=60000,       # TTL refresh interval in ms
    ),
)
```

### MULTICOMBO (Multi-select Dropdown)

```python
io.MultiCombo.Input("tags",
    options=["tag1", "tag2", "tag3", "tag4"],
    default=["tag1"],
    placeholder="Select tags...",
    chip=True,  # display as chips
)
# Value type: list[str]
```

### COLOR (Color Picker)

```python
io.Color.Input("color",
    default="#ffffff",
    socketless=True,  # widget only by default
)
# Value type: str (hex color)
```

### BOUNDING_BOX (Rectangle Selector)

```python
io.BoundingBox.Input("region",
    default={"x": 0, "y": 0, "width": 512, "height": 512},
    socketless=True,
    component="my_component",  # optional custom UI component name
    force_input=False,
)
# Value type: {"x": int, "y": int, "width": int, "height": int}
```

### CURVE (Spline Editor)

```python
io.Curve.Input("curve",
    default=[(0.0, 0.0), (1.0, 1.0)],  # linear ramp
    socketless=True,
)
# Value type: list[tuple[float, float]]
```

### WEBCAM (Camera Capture)

```python
io.Webcam.Input("capture")
# Value type: str
```

### IMAGECOMPARE (Comparison Widget)

```python
io.ImageCompare.Input("comparison", socketless=True)
# Value type: dict
```

## Input Options (Common to All)

```python
io.Image.Input("image",
    optional=True,        # not required; creates optional input socket
    tooltip="Description shown on hover",
    lazy=True,            # lazy evaluation - only computed when needed
    advanced=True,        # hidden by default in compact mode
    raw_link=True,        # receive raw link reference instead of value
)
```

### force_input

Forces a widget input to appear as a connection socket instead of a widget:

```python
io.Float.Input("value",
    default=1.0,
    force_input=True,   # shows as socket, not slider
)
```

### socketless

Makes a widget input appear only as a widget with no input socket:

```python
io.String.Input("note",
    default="",
    socketless=True,     # widget only, no connection socket
)
```

## Optional Inputs

```python
class MyNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MyNode",
            display_name="My Node",
            category="example",
            inputs=[
                io.Image.Input("image"),                        # required
                io.Mask.Input("mask", optional=True),           # optional
                io.Float.Input("blend", default=0.5),           # has default widget
            ],
            outputs=[io.Image.Output("IMAGE")],
        )

    @classmethod
    def execute(cls, image, mask=None, blend=0.5):
        # Optional inputs default to None when not connected
        if mask is not None:
            image = image * (1 - blend) + image * mask.unsqueeze(-1) * blend
        return io.NodeOutput(image)
```

## Hidden Inputs

Hidden inputs receive server-provided values, not user input:

```python
class MyNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MyNode",
            display_name="My Node",
            category="example",
            inputs=[io.String.Input("text")],
            outputs=[io.String.Output()],
            hidden=[
                io.Hidden.unique_id,       # node's unique ID
                io.Hidden.prompt,           # full prompt data
                io.Hidden.extra_pnginfo,    # PNG metadata dict
                io.Hidden.dynprompt,        # dynamic prompt object
                io.Hidden.auth_token_comfy_org,  # auth token
                io.Hidden.api_key_comfy_org,     # API key
            ],
        )

    @classmethod
    def execute(cls, text):
        # Access hidden values via cls.hidden
        node_id = cls.hidden.unique_id
        prompt = cls.hidden.prompt
        extra = cls.hidden.extra_pnginfo
        return io.NodeOutput(f"{text} (node: {node_id})")
```

## Lazy Evaluation

Lazy inputs are only evaluated when actually needed, saving computation:

```python
class ConditionalNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ConditionalNode",
            display_name="Conditional",
            category="logic",
            inputs=[
                io.Boolean.Input("condition"),
                io.Image.Input("if_true", lazy=True),
                io.Image.Input("if_false", lazy=True),
            ],
            outputs=[io.Image.Output("IMAGE")],
        )

    @classmethod
    def check_lazy_status(cls, condition, if_true=None, if_false=None):
        """Return list of input names that need evaluation."""
        if condition and if_true is None:
            return ["if_true"]
        if not condition and if_false is None:
            return ["if_false"]
        return []

    @classmethod
    def execute(cls, condition, if_true, if_false):
        return io.NodeOutput(if_true if condition else if_false)
```

**Rules for lazy evaluation**:
- Mark inputs with `lazy=True`
- Implement `check_lazy_status()` classmethod
- Unevaluated inputs are `None`
- Return list of input names that need computing, or empty list
- Method may be called multiple times

## V1 Input Format (Legacy Reference)

```python
@classmethod
def INPUT_TYPES(s):
    return {
        "required": {
            "image": ("IMAGE",),
            "strength": ("FLOAT", {
                "default": 1.0, "min": 0.0, "max": 10.0, "step": 0.01
            }),
            "mode": (["option_a", "option_b"],),
            "text": ("STRING", {"multiline": True, "default": ""}),
        },
        "optional": {
            "mask": ("MASK",),
        },
        "hidden": {
            "unique_id": "UNIQUE_ID",
            "prompt": "PROMPT",
            "extra_pnginfo": "EXTRA_PNGINFO",
        },
    }
```

## Complete Example: Multi-Input Node

```python
class AdvancedImageNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="AdvancedImageNode",
            display_name="Advanced Image",
            category="image/advanced",
            description="Demonstrates various input types",
            inputs=[
                # Required connection input
                io.Image.Input("image", tooltip="Input image"),
                # Required widget inputs
                io.Float.Input("brightness", default=1.0, min=0.0, max=3.0,
                               step=0.1, display_mode=io.NumberDisplay.slider),
                io.Float.Input("contrast", default=1.0, min=0.0, max=3.0, step=0.1),
                io.Int.Input("seed", default=0, min=0, max=0xffffffffffffffff,
                             control_after_generate=True),
                io.Combo.Input("blend_mode", options=["normal", "multiply", "screen"]),
                io.Boolean.Input("flip_horizontal", default=False),
                io.String.Input("label", default="", socketless=True),
                # Optional inputs
                io.Mask.Input("mask", optional=True),
                io.Image.Input("overlay", optional=True),
                # Advanced inputs (collapsed by default)
                io.Float.Input("gamma", default=1.0, min=0.1, max=3.0, advanced=True),
            ],
            outputs=[
                io.Image.Output("IMAGE"),
                io.Mask.Output("MASK"),
            ],
        )

    @classmethod
    def execute(cls, image, brightness, contrast, seed, blend_mode,
                flip_horizontal, label, mask=None, overlay=None, gamma=1.0):
        result = image * brightness
        if flip_horizontal:
            result = torch.flip(result, dims=[2])
        if mask is not None:
            result = result * mask.unsqueeze(-1)
        return io.NodeOutput(result, mask if mask is not None else torch.ones(result.shape[:3]))
```

## See Also

- `comfyui-node-basics` - Node structure overview
- `comfyui-node-datatypes` - Data type details
- `comfyui-node-advanced` - MatchType, Autogrow, DynamicCombo
- `comfyui-node-lifecycle` - Lazy evaluation details

---

## Outputs

# ComfyUI Node Outputs

Nodes return data through `io.NodeOutput`. V3 provides built-in UI helpers for previews and file saving.

## Basic Output

```python
class SimpleNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="SimpleNode",
            display_name="Simple Node",
            category="example",
            inputs=[io.Float.Input("a"), io.Float.Input("b")],
            outputs=[
                io.Float.Output("SUM"),
                io.Float.Output("PRODUCT"),
            ],
        )

    @classmethod
    def execute(cls, a, b):
        # Values must match output order
        return io.NodeOutput(a + b, a * b)
```

## Output Configuration

```python
io.Schema(
    outputs=[
        io.Image.Output("IMAGE"),                    # basic output
        io.Int.Output("COUNT"),                      # integer output
        io.Float.Output("VALUE", display_name="Result"),  # custom display name
        io.String.Output("TEXT", tooltip="The processed text"),
        io.Image.Output("FRAMES", is_output_list=True),  # outputs a list
    ],
)
```

## NodeOutput Variants

```python
# Data only
return io.NodeOutput(image_tensor, mask_tensor)

# UI only (output node with no data outputs)
return io.NodeOutput(ui=ui.PreviewImage(images, cls=cls))

# Data + UI
return io.NodeOutput(image_tensor, ui=ui.PreviewImage(images, cls=cls))

# No output
return io.NodeOutput()

# Block execution
return io.NodeOutput(block_execution="Reason for blocking")

# Node expansion (positional args are outputs, not result= keyword)
return io.NodeOutput(output_ref, expand=graph.finalize())
```

## UI Preview Helpers

Import `ui` from `comfy_api.latest`:

```python
from comfy_api.latest import io, ui
```

### PreviewImage

Display image previews on the node. Saves to temp directory automatically.

```python
# Constructor: PreviewImage(image, animated=False, cls=None)
class PreviewNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="PreviewNode",
            display_name="Preview Image",
            category="image",
            is_output_node=True,
            inputs=[io.Image.Input("images")],
            outputs=[],
            hidden=[io.Hidden.prompt, io.Hidden.extra_pnginfo],
        )

    @classmethod
    def execute(cls, images):
        return io.NodeOutput(ui=ui.PreviewImage(images, cls=cls))
```

### PreviewMask

```python
# Constructor: PreviewMask(mask, animated=False, cls=None)
# Auto-converts mask to 3-channel grayscale for display
return io.NodeOutput(ui=ui.PreviewMask(masks, cls=cls))
```

### PreviewAudio

```python
# Constructor: PreviewAudio(audio, cls=None)
# Saves as FLAC to temp directory
return io.NodeOutput(ui=ui.PreviewAudio(audio, cls=cls))
```

### PreviewVideo

```python
# Constructor: PreviewVideo(values: list[SavedResult | dict])
return io.NodeOutput(ui=ui.PreviewVideo(saved_video_results))
```

### PreviewText

Display text output:

```python
return io.NodeOutput(ui=ui.PreviewText(value))
```

### PreviewUI3D

Display 3D model preview:

```python
return io.NodeOutput(ui=ui.PreviewUI3D(
    model_file=saved_result,   # SavedResult for the 3D file
    camera_info=camera_dict,   # camera position/target/zoom
    bg_image=image_tensor,     # optional background image (via **kwargs)
))
```

## Saving Images

### Using ImageSaveHelper

The `ui.ImageSaveHelper` class provides static methods for various image formats:

```python
# Save as PNG (returns list[SavedResult])
results = ui.ImageSaveHelper.save_images(
    images,                              # tensor [B,H,W,C]
    filename_prefix="ComfyUI",
    folder_type=io.FolderType.output,    # output, temp, or input
    cls=cls,                             # node class (for metadata)
    compress_level=4,
)

# Save and get UI object directly (saves to output folder)
saved_ui = ui.ImageSaveHelper.get_save_images_ui(images, "ComfyUI", cls=cls)
return io.NodeOutput(ui=saved_ui)

# Save animated PNG
result = ui.ImageSaveHelper.save_animated_png(
    images, "anim", io.FolderType.output, cls=cls, fps=12.0, compress_level=4
)

# Save animated PNG and get UI
saved_ui = ui.ImageSaveHelper.get_save_animated_png_ui(images, "anim", cls=cls, fps=12.0, compress_level=4)

# Save animated WebP
result = ui.ImageSaveHelper.save_animated_webp(
    images, "anim", io.FolderType.output, cls=cls,
    fps=12.0, lossless=False, quality=80, method=4
)

# Save animated WebP and get UI
saved_ui = ui.ImageSaveHelper.get_save_animated_webp_ui(
    images, "anim", cls=cls, fps=12.0, lossless=False, quality=80, method=4
)
```

**Simple save node example:**

```python
class SaveImageNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="SaveImageNode",
            display_name="Save Image",
            category="image",
            is_output_node=True,
            inputs=[
                io.Image.Input("images"),
                io.String.Input("filename_prefix", default="ComfyUI"),
            ],
            outputs=[],
            hidden=[io.Hidden.prompt, io.Hidden.extra_pnginfo],
        )

    @classmethod
    def execute(cls, images, filename_prefix):
        saved = ui.ImageSaveHelper.get_save_images_ui(images, filename_prefix, cls=cls)
        return io.NodeOutput(ui=saved)
```

### Manual Image Saving

```python
import os
import json
import numpy as np
from PIL import Image as PILImage
from PIL.PngImagePlugin import PngInfo
import folder_paths

class CustomSaveNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="CustomSaveNode",
            display_name="Custom Save",
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
        output_dir = folder_paths.get_output_directory()
        results = []

        for i, image in enumerate(images):
            # Convert tensor to PIL
            img_array = np.clip(255.0 * image.cpu().numpy(), 0, 255).astype(np.uint8)
            pil_image = PILImage.fromarray(img_array)

            # Add metadata
            metadata = PngInfo()
            if cls.hidden.prompt:
                metadata.add_text("prompt", json.dumps(cls.hidden.prompt))
            if cls.hidden.extra_pnginfo:
                for k, v in cls.hidden.extra_pnginfo.items():
                    metadata.add_text(k, json.dumps(v))

            # Save with counter
            filename = f"{prefix}_{i:05d}.png"
            filepath = os.path.join(output_dir, filename)
            pil_image.save(filepath, pnginfo=metadata)

            results.append(ui.SavedResult(
                filename=filename,
                subfolder="",
                type=io.FolderType.output,
            ))

        return io.NodeOutput(ui=ui.SavedImages(results))
```

## Saving Audio

The `ui.AudioSaveHelper` supports FLAC, MP3, and Opus formats:

```python
# Save audio (returns list[SavedResult])
results = ui.AudioSaveHelper.save_audio(
    audio,                               # {"waveform": Tensor, "sample_rate": int}
    filename_prefix="audio",
    folder_type=io.FolderType.output,
    cls=cls,
    format="flac",                       # "flac", "mp3", or "opus"
    quality="128k",                      # MP3: "V0","128k","320k"; Opus: "64k"-"320k"
)

# Save and get UI object
saved_ui = ui.AudioSaveHelper.get_save_audio_ui(audio, "audio", cls=cls, format="flac", quality="128k")
return io.NodeOutput(ui=saved_ui)
```

```python
class SaveAudioNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="SaveAudioNode",
            display_name="Save Audio",
            category="audio",
            is_output_node=True,
            inputs=[
                io.Audio.Input("audio"),
                io.String.Input("prefix", default="audio"),
                io.Combo.Input("format", options=["flac", "mp3", "opus"], default="flac"),
            ],
            outputs=[],
            hidden=[io.Hidden.prompt, io.Hidden.extra_pnginfo],
        )

    @classmethod
    def execute(cls, audio, prefix, format):
        saved = ui.AudioSaveHelper.get_save_audio_ui(audio, prefix, cls=cls, format=format)
        return io.NodeOutput(ui=saved)
```

## Temporary Previews vs Permanent Saves

- **Previews** (PreviewImage, etc.) save to the `temp` directory and are ephemeral
- **Saves** (ImageSaveHelper.save_images) save to the `output` directory permanently
- Use `io.FolderType.temp`, `io.FolderType.output`, or `io.FolderType.input`

## V1 Output Patterns (Legacy Reference)

```python
class V1SaveNode:
    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "save"

    def save(self, images, prefix):
        # ... save logic ...
        return {
            "ui": {
                "images": [
                    {"filename": "out.png", "subfolder": "", "type": "output"}
                ]
            }
        }

# Data + UI in V1:
class V1PreviewAndOutput:
    RETURN_TYPES = ("IMAGE",)
    OUTPUT_NODE = True
    FUNCTION = "run"

    def run(self, image):
        # ... preview logic ...
        return {
            "ui": {"images": [...]},
            "result": (processed_image,),
        }
```

## See Also

- `comfyui-node-basics` - Node structure and Schema
- `comfyui-node-datatypes` - Data type formats
- `comfyui-node-lifecycle` - Execution flow

---

## Frontend

# ComfyUI Frontend Extensions

Custom nodes can extend the ComfyUI frontend with JavaScript. Extensions register hooks, widgets, commands, settings, and UI components.

## Quick Start

### 1. Export WEB_DIRECTORY in Python

```python
# __init__.py
WEB_DIRECTORY = "./js"
__all__ = ["WEB_DIRECTORY"]
```

### 2. Create JavaScript Extension

```javascript
// js/my_extension.js
import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "my_nodes.my_extension",

    async setup() {
        console.log("Extension loaded!");
    },
});
```

All `.js` files in `WEB_DIRECTORY` are loaded automatically when ComfyUI starts.

## Extension Hooks (Lifecycle Order)

### init — After canvas created, before nodes

```javascript
app.registerExtension({
    name: "my.ext",
    async init(app) {
        // Modify core behavior, add global listeners
    },
});
```

### addCustomNodeDefs — Modify node definitions

```javascript
async addCustomNodeDefs(defs, app) {
    // defs is a dict of all node definitions
    // Can add or modify definitions before registration
    defs["MyFrontendNode"] = {
        input: { required: { text: ["STRING", {}] } },
        output: ["STRING"],
        output_name: ["text"],
        name: "MyFrontendNode",
        display_name: "My Frontend Node",
        category: "custom",
    };
},
```

### getCustomWidgets — Register custom widget types

```javascript
getCustomWidgets(app) {
    return {
        MY_WIDGET(node, inputName, inputData, app) {
            const widget = node.addWidget("text", inputName, "", () => {});
            widget.serializeValue = () => widget.value;
            return { widget };
        },
    };
},
```

### beforeRegisterNodeDef — Modify node prototype

```javascript
async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name === "MyNode") {
        // Chain onto prototype methods
        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.apply(this, arguments);
            // Add custom widget, modify behavior, etc.
            this.addWidget("button", "Run", null, () => {
                console.log("Button clicked!");
            });
        };
    }
},
```

### nodeCreated — After node instance created

```javascript
nodeCreated(node, app) {
    if (node.comfyClass === "MyNode") {
        // Modify this specific node instance
        node.color = "#335";
    }
},
```

### setup — After app fully loaded

```javascript
async setup(app) {
    // Add event listeners, register UI components
    app.api.addEventListener("executed", (event) => {
        console.log("Node executed:", event.detail);
    });
},
```

### loadedGraphNode — When loading saved graph

```javascript
loadedGraphNode(node, app) {
    if (node.comfyClass === "MyNode") {
        // Restore state from saved graph
    }
},
```

### registerCustomNodes — Register additional node types

```javascript
registerCustomNodes(app) {
    // Register custom LiteGraph node types
},
```

### beforeRegisterVueAppNodeDefs — Modify node defs before Vue registration

```javascript
beforeRegisterVueAppNodeDefs(defs, app) {
    // Modify definitions before they reach the Vue app
},
```

### beforeConfigureGraph / afterConfigureGraph

```javascript
async beforeConfigureGraph(graphData, missingNodeTypes, app) {
    // Before graph data is applied
},
async afterConfigureGraph(missingNodeTypes, app) {
    // After graph is fully configured
},
```

### getSelectionToolboxCommands — Add commands to selection toolbox

```javascript
getSelectionToolboxCommands(selectedItem) {
    // Return array of command IDs to show when item is selected
    return ["my.ext.doSomething"];
},
```

### Authentication Hooks

```javascript
onAuthUserResolved(user, app) {
    // Fires when user authentication resolves
},
onAuthTokenRefreshed() {
    // Fires when auth token is refreshed
},
onAuthUserLogout() {
    // Fires when user logs out
},
```

## Custom Widgets

### Adding DOM Widgets

```javascript
beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name === "MyNode") {
        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.apply(this, arguments);

            const container = document.createElement("div");
            container.innerHTML = `<input type="color" value="#ff0000">`;
            container.querySelector("input").addEventListener("change", (e) => {
                this.widgets.find(w => w.name === "color").value = e.target.value;
            });

            this.addDOMWidget("colorPicker", "custom", container, {
                serialize: true,
                getValue() { return container.querySelector("input").value; },
                setValue(v) { container.querySelector("input").value = v; },
            });
        };
    }
},
```

### Widget Hooks

```javascript
// Called before prompt is queued
widget.beforeQueued = function () {
    // Prepare widget value
};

// Called after prompt is queued
widget.afterQueued = function () {
    // Reset or update widget
};

// Custom serialization
widget.serializeValue = function (node, index) {
    return JSON.stringify(this.value);
};
```

## Declarative Extension Properties

### Commands

```javascript
app.registerExtension({
    name: "my.ext",
    commands: [
        {
            id: "my.ext.doSomething",
            label: "Do Something",
            icon: "pi pi-bolt",
            function: () => { console.log("Executed!"); },
        },
    ],
});
```

### Keybindings

```javascript
keybindings: [
    {
        commandId: "my.ext.doSomething",
        combo: { key: "d", ctrl: true, shift: true },
    },
],
```

### Settings

```javascript
settings: [
    {
        id: "my.ext.mySetting",
        name: "My Setting",
        type: "boolean",
        defaultValue: true,
        onChange: (value) => { console.log("Setting changed:", value); },
    },
    {
        id: "my.ext.mode",
        name: "Processing Mode",
        type: "combo",
        options: ["fast", "quality", "balanced"],
        defaultValue: "balanced",
    },
],
```

**Setting types**: `boolean`, `number`, `slider`, `knob`, `combo`, `radio`, `text`, `image`, `color`, `url`, `hidden`, `backgroundImage`

### Sidebar Tabs

```javascript
async setup(app) {
    app.extensionManager.registerSidebarTab({
        id: "my-sidebar",
        title: "My Panel",
        icon: "pi pi-cog",
        type: "custom",
        render: (container) => {
            container.innerHTML = "<h3>My Custom Panel</h3>";
        },
        destroy: () => {
            // Cleanup
        },
    });
},
```

### Bottom Panel Tabs

```javascript
bottomPanelTabs: [
    {
        id: "my-panel",
        title: "My Panel",
        type: "custom",
        render: (container) => {
            container.innerHTML = "<div>Panel content</div>";
        },
    },
],
```

### Menu Commands

```javascript
menuCommands: [
    {
        path: ["My Extension"],
        commands: ["my.ext.doSomething"],
    },
],
```

### About Page Badges

```javascript
aboutPageBadges: [
    { label: "v1.0.0", url: "https://github.com/...", icon: "pi pi-github", severity: "warn" },
    // severity is optional: "danger" | "warn"
],
```

### Top Bar Badges

```javascript
topbarBadges: [
    {
        text: "My Extension",        // required
        label: "BETA",               // optional badge label
        variant: "info",             // "info" | "warning" | "error"
        icon: "pi pi-star",          // optional icon
        tooltip: "Extension info",   // optional tooltip
    },
],
```

### Action Bar Buttons

```javascript
actionBarButtons: [
    {
        icon: "pi pi-bolt",           // required
        label: "My Action",           // optional label
        tooltip: "Run my action",     // optional tooltip
        onClick: () => { /* ... */ },  // required click handler
    },
],
```

## API Events

Listen to execution events:

```javascript
// Node execution completed
app.api.addEventListener("executed", ({ detail }) => {
    const { node, output } = detail;
    // output contains images, text, etc.
});

// Execution progress
app.api.addEventListener("progress", ({ detail }) => {
    const { value, max, node } = detail;
});

// Execution started/completed
app.api.addEventListener("execution_start", ({ detail }) => {});
app.api.addEventListener("execution_success", ({ detail }) => {});
app.api.addEventListener("execution_error", ({ detail }) => {});

// Status updates
app.api.addEventListener("status", ({ detail }) => {
    const { exec_info } = detail;
});
```

## Server-to-Client Communication

### Python (server side):

```python
from server import PromptServer

PromptServer.instance.send_sync(
    "my_extension.update",
    {"status": "complete", "data": result}
)
```

### JavaScript (client side):

```javascript
app.api.addEventListener("my_extension.update", ({ detail }) => {
    console.log("Received:", detail);
});
```

## Toast Notifications

```javascript
app.extensionManager.toast.add({
    severity: "info",  // "success", "info", "warn", "error"
    summary: "Title",
    detail: "Message content",
    life: 3000,  // auto-dismiss after ms
});
```

## Dialogs

```javascript
// Confirmation dialog
const result = await app.extensionManager.dialog.confirm({
    title: "Confirm Action",
    message: "Are you sure?",
});

// Prompt dialog
const value = await app.extensionManager.dialog.prompt({
    title: "Enter Value",
    message: "Provide a name:",
    defaultValue: "default",
});
```

## ExtensionManager Utilities

### Setting Access

```javascript
// Read a setting value
const val = app.extensionManager.setting.get("my.ext.mySetting");

// Write a setting value
app.extensionManager.setting.set("my.ext.mySetting", newValue);
```

### Execution Errors (read-only)

```javascript
// Last node-level errors (keyed by node ID)
const nodeErrors = app.extensionManager.lastNodeErrors;

// Last execution-level error
const execError = app.extensionManager.lastExecutionError;
```

### Markdown Rendering

```javascript
// Render markdown to sanitized HTML (marked + DOMPurify, safe for innerHTML)
const html = app.extensionManager.renderMarkdownToHtml(markdownStr, baseUrl);
```

## Context Menu Items

```javascript
app.registerExtension({
    name: "my.ext",

    // Canvas right-click menu
    getCanvasMenuItems(canvas) {
        return [{
            content: "My Action",
            callback: () => { console.log("Canvas menu clicked"); },
        }];
    },

    // Node right-click menu
    getNodeMenuItems(node) {
        if (node.comfyClass === "MyNode") {
            return [{
                content: "Custom Action",
                callback: () => { console.log("Node:", node.id); },
            }];
        }
        return [];
    },
});
```

## Node Instance Properties (LGraphNode Augmentations)

```javascript
// Available on node instances:
node.comfyClass       // ComfyUI node type name
node.isVirtualNode    // true for frontend-only nodes
node.imgs             // preview images array
node.imageIndex       // current preview image index

// Callbacks:
node.onExecuted = function(output) { /* execution result */ };
node.onExecutionStart = function() { /* about to execute */ };
node.onDragOver = function(event) { /* file drag over */ };
node.onDragDrop = function(event) { /* file dropped */ };
```

## Frontend Scripts API

Custom node JavaScript can import from the frontend's `src/scripts/` modules. Imports use the Vite shim pattern:

```javascript
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
```

Symbols are also accessible via `window.comfyAPI.<module>.<export>`.

### Stability Levels

| Level | Modules | Notes |
|---|---|---|
| **Stable** | `scripts/app`, `scripts/api` | Guaranteed public API |
| **Internal** (console warning) | `scripts/widgets`, `scripts/domWidget`, `scripts/utils`, `scripts/pnginfo`, `scripts/changeTracker`, `scripts/defaultGraph`, `scripts/metadata/*` | Usable but may change |
| **Deprecated** | `scripts/ui` | Will be removed; use Vue alternatives |

### Key Modules

- **`scripts/api`** — `ComfyApi` class: `fetchApi()`, `queuePrompt()`, `getNodeDefs()`, WebSocket events, settings, user data, system stats
- **`scripts/app`** — `ComfyApp` singleton (`app`): graph operations, `registerExtension()`, `extensionManager`, clipboard, coordinate conversion
- **`scripts/widgets`** — `ComfyWidgets` registry (INT, FLOAT, STRING, BOOLEAN, COMBO, IMAGEUPLOAD, etc.), `addValueControlWidgets()`
- **`scripts/domWidget`** — `addDOMWidget()`, `DOMWidgetImpl`, `ComponentWidgetImpl` (Vue component wrapper)
- **`scripts/utils`** — `clone()`, `addStylesheet()`, `uploadFile()`, `downloadBlob()`, storage helpers
- **`scripts/pnginfo`** — `getPngMetadata()`, `getWebpMetadata()`, `importA1111()`, format-specific extractors

For full API details, see the [API Reference](api-reference.md).

## See Also

- `comfyui-node-basics` - Backend node structure
- `comfyui-node-packaging` - Project structure with JS extensions
- `comfyui-node-inputs` - Backend input types