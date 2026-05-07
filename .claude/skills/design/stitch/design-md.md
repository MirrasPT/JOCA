---
name: design-md
description: Analyze Stitch projects and synthesize a semantic design system into DESIGN.md files. Use when the user needs to create or update a .stitch/DESIGN.md from an existing Stitch project screen.
allowed-tools:
  - "stitch*:*"
  - "Read"
  - "Write"
  - "web_fetch"
source: https://github.com/google-labs-code/stitch-skills
---

# Stitch DESIGN.md Skill

You are an expert Design Systems Lead. Your goal is to analyze Stitch project assets and synthesize a "Semantic Design System" into a `DESIGN.md` file.

## Overview

The `DESIGN.md` file serves as the "source of truth" for prompting Stitch to generate new screens that align with existing design language. Stitch interprets design through "Visual Descriptions" supported by specific color values.

## Prerequisites

- Access to the Stitch MCP Server
- A Stitch project with at least one designed screen

## Retrieval and Networking

1. **Namespace discovery**: Run `list_tools` to find the Stitch MCP prefix.
2. **Project lookup** (if Project ID unknown): Call `[prefix]:list_projects` with `filter: "view=owned"` — identify target project, extract Project ID from `name` field (e.g. `projects/13534454087919359824`).
3. **Screen lookup** (if Screen ID unknown): Call `[prefix]:list_screens` with the `projectId` (numeric only).
4. **Metadata fetch**: Call `[prefix]:get_screen` with both `projectId` and `screenId` (numeric IDs only). Returns `screenshot.downloadUrl`, `htmlCode.downloadUrl`, `width`, `height`, `deviceType`, `designTheme`.
5. **Asset download**: Download HTML from `htmlCode.downloadUrl` to parse Tailwind classes, custom CSS, and component patterns. Download screenshot for visual reference.
6. **Project metadata**: Call `[prefix]:get_project` with the full project name (`projects/{id}`) for `designTheme`, device type, and layout principles.

## Analysis & Synthesis

### 1. Extract Project Identity
- Locate the Project Title and specific Project ID.

### 2. Define the Atmosphere
Evaluate the screenshot and HTML to capture the overall "vibe." Use evocative adjectives: "Airy," "Dense," "Minimalist," "Utilitarian."

### 3. Map the Color Palette
For each color:
- A descriptive natural language name (e.g., "Deep Muted Teal-Navy")
- The specific hex code in parentheses (e.g., "#294056")
- Its specific functional role (e.g., "Used for primary actions")

### 4. Translate Geometry & Shape
Convert technical values into physical descriptions:
- `rounded-full` → "Pill-shaped"
- `rounded-lg` → "Subtly rounded corners"
- `rounded-none` → "Sharp, squared-off edges"

### 5. Describe Depth & Elevation
Explain how the UI handles layers. Describe shadow quality: "Flat," "Whisper-soft diffused shadows," "Heavy, high-contrast drop shadows."

## Output Format (DESIGN.md Structure)

```markdown
# Design System: [Project Title]
**Project ID:** [Insert Project ID Here]

## 1. Visual Theme & Atmosphere
(Description of the mood, density, and aesthetic philosophy.)

## 2. Color Palette & Roles
(List colors by Descriptive Name + Hex Code + Functional Role.)

## 3. Typography Rules
(Font family, weight usage for headers vs. body, letter-spacing character.)

## 4. Component Stylings
* **Buttons:** (Shape description, color assignment, behavior).
* **Cards/Containers:** (Corner roundness description, background color, shadow depth).
* **Inputs/Forms:** (Stroke style, background).

## 5. Layout Principles
(Description of whitespace strategy, margins, and grid alignment.)
```

## Common Pitfalls to Avoid

- ❌ Using technical jargon without translation (e.g., "rounded-xl" instead of "generously rounded corners")
- ❌ Omitting color codes or using only descriptive names
- ❌ Forgetting to explain functional roles of design elements
- ❌ Being too vague in atmosphere descriptions
