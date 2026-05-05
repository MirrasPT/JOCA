#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "google-genai",
#     "pillow",
# ]
# ///
"""
Generate images using Google's Gemini image models.

Usage:
    uv run generate.py --prompt "A minimalist dark dashboard UI"
    uv run generate.py --prompt "Product mockup" --output "./out/product.png"
    uv run generate.py --prompt "Widescreen hero" --size 2K --aspect 16:9
    uv run generate.py --prompt "Logo variant" --model pro --size 4K
    uv run generate.py --prompt "Style like this" --reference "./ref.png" --output "./styled.png"
    uv run generate.py --prompt "Blend styles" --reference "./a.png" --reference "./b.png"
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

from google import genai
from google.genai import types
from PIL import Image

MODEL_IDS = {
    "flash": "gemini-2.5-flash-image",
    "pro":   "gemini-3-pro-image-preview",
    "2":     "gemini-3.1-flash-image-preview",
}

ASPECT_ALIASES = {
    "square":    "1:1",
    "landscape": "16:9",
    "portrait":  "9:16",
}

ALL_ASPECT_RATIOS = [
    "1:1", "1:4", "1:8", "2:3", "3:2", "3:4",
    "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
]

MODEL_ASPECT_RATIOS = {
    "flash": ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    "pro":   ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    "2":     ALL_ASPECT_RATIOS,
}

ASPECT_INSTRUCTIONS = {
    "1:1":  "square image (1:1)",
    "1:4":  "tall narrow image (1:4)",
    "1:8":  "very tall image (1:8)",
    "2:3":  "tall portrait image (2:3)",
    "3:2":  "wide image (3:2)",
    "3:4":  "tall image (3:4)",
    "4:1":  "wide panoramic image (4:1)",
    "4:3":  "landscape image (4:3)",
    "4:5":  "slightly tall image (4:5)",
    "5:4":  "slightly wide image (5:4)",
    "8:1":  "ultra-wide panoramic image (8:1)",
    "9:16": "portrait/mobile image (9:16)",
    "16:9": "widescreen landscape image (16:9)",
    "21:9": "cinematic ultra-wide image (21:9)",
}

# Approx costs per image (USD)
COSTS = {
    "flash": {"512": None, "1K": 0.003, "2K": None,   "4K": None},
    "pro":   {"512": None, "1K": 0.134, "2K": 0.201,  "4K": 0.302},
    "2":     {"512": 0.045, "1K": 0.067, "2K": 0.101, "4K": 0.151},
}


def resolve_aspect(aspect: str) -> str:
    return ASPECT_ALIASES.get(aspect, aspect)


def auto_output(prompt: str) -> str:
    slug = prompt[:40].lower().replace(" ", "-").replace("/", "-")
    slug = "".join(c for c in slug if c.isalnum() or c == "-")
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir = Path("./fig")
    out_dir.mkdir(exist_ok=True)
    return str(out_dir / f"{ts}-{slug}.png")


def generate(prompt, output, aspect, references, model, size):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    aspect_ratio = resolve_aspect(aspect)
    valid_ratios = MODEL_ASPECT_RATIOS[model]
    if aspect_ratio not in valid_ratios:
        print(f"Error: '{aspect_ratio}' not supported for model '{model}'. Valid: {', '.join(valid_ratios)}", file=sys.stderr)
        sys.exit(1)

    full_prompt = f"Generate a {ASPECT_INSTRUCTIONS.get(aspect_ratio, aspect_ratio)}. {prompt}"

    contents: list = []
    if references:
        for ref in references:
            if not os.path.exists(ref):
                print(f"Error: Reference not found: {ref}", file=sys.stderr)
                sys.exit(1)
            contents.append(Image.open(ref))
        ref_note = "reference image" if len(references) == 1 else f"{len(references)} reference images"
        full_prompt += f" Use the provided {ref_note} for style/composition guidance."
    contents.append(full_prompt)

    client = genai.Client(api_key=api_key)
    model_id = MODEL_IDS[model]

    if model in ("pro", "2"):
        valid_sizes = ["512", "1K", "2K", "4K"] if model == "2" else ["1K", "2K", "4K"]
        if size not in valid_sizes:
            print(f"Error: Size '{size}' not valid for model '{model}'. Valid: {', '.join(valid_sizes)}", file=sys.stderr)
            sys.exit(1)
        config = types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
            image_config=types.ImageConfig(aspect_ratio=aspect_ratio, image_size=size),
        )
        response = client.models.generate_content(model=model_id, contents=contents, config=config)
    else:
        response = client.models.generate_content(model=model_id, contents=contents)

    if output is None:
        output = auto_output(prompt)

    Path(output).parent.mkdir(parents=True, exist_ok=True)

    for part in response.parts:
        if part.text:
            print(f"[gemini] {part.text}")
        elif part.inline_data is not None:
            part.as_image().save(output)
            cost = COSTS.get(model, {}).get(size)
            cost_str = f" (~${cost:.3f})" if cost else ""
            print(f"Saved: {output}{cost_str}")
            return

    print("Error: No image in response", file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Generate images via Gemini image models")
    parser.add_argument("--prompt",    required=True, help="Image description")
    parser.add_argument("--output",    default=None,  help="Output PNG path (default: ./fig/<timestamp>-<slug>.png)")
    parser.add_argument("--aspect",    default="square", choices=list(ASPECT_ALIASES) + ALL_ASPECT_RATIOS,
                        help="Aspect ratio: square/landscape/portrait or 16:9, 4:3, etc.")
    parser.add_argument("--reference", action="append", dest="references",
                        help="Reference image path (repeat for multiple)")
    parser.add_argument("--model",     default="2", choices=["flash", "pro", "2"],
                        help="flash=fast/cheap, 2=fast+high-res (default), pro=highest quality")
    parser.add_argument("--size",      default="1K", choices=["512", "1K", "2K", "4K"],
                        help="Resolution: 512/1K/2K/4K (ignored for flash)")
    args = parser.parse_args()
    generate(args.prompt, args.output, args.aspect, args.references, args.model, args.size)


if __name__ == "__main__":
    main()
