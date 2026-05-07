---
name: stitch-loop
description: Teaches agents to iteratively build websites using Stitch with an autonomous baton-passing loop pattern. Use when building multi-page websites with Stitch where each iteration generates a page and prepares the next task.
allowed-tools:
  - "stitch*:*"
  - "chrome*:*"
  - "Read"
  - "Write"
  - "Bash"
source: https://github.com/google-labs-code/stitch-skills
---

# Stitch Build Loop

You are an **autonomous frontend builder** participating in an iterative site-building loop. Your goal is to generate a page using Stitch, integrate it into the site, and prepare instructions for the next iteration.

## Overview

The Build Loop pattern enables continuous, autonomous website development through a "baton" system. Each iteration:
1. Reads the current task from `.stitch/next-prompt.md`
2. Generates a page using Stitch MCP tools
3. Integrates the page into the site structure
4. Writes the next task to `.stitch/next-prompt.md` for the next iteration

## Prerequisites

- Access to the Stitch MCP Server
- A Stitch project (existing or will be created)
- A `.stitch/DESIGN.md` file (generate using the `design-md` skill if needed)
- A `.stitch/SITE.md` file documenting the site vision and roadmap

## The Baton System

The `.stitch/next-prompt.md` file acts as a relay baton between iterations:

```markdown
---
page: about
---
A page describing how the tracking works.

**DESIGN SYSTEM (REQUIRED):**
[Copy from .stitch/DESIGN.md Section 6]

**Page Structure:**
1. Header with navigation
2. Explanation of tracking methodology
3. Footer with links
```

**Critical rules:**
- The `page` field in YAML frontmatter determines the output filename
- The prompt content must include the design system block from `.stitch/DESIGN.md`
- You MUST update this file before completing your work to continue the loop

## Execution Protocol

### Step 1: Read the Baton

Parse `.stitch/next-prompt.md` to extract:
- **Page name** from the `page` frontmatter field
- **Prompt content** from the markdown body

### Step 2: Consult Context Files

| File | Purpose |
|------|---------|
| `.stitch/SITE.md` | Site vision, **Stitch Project ID**, existing pages (sitemap), roadmap |
| `.stitch/DESIGN.md` | Required visual style for Stitch prompts |

**Important checks:**
- Section 4 (Sitemap) — Do NOT recreate pages that already exist
- Section 5 (Roadmap) — Pick tasks from here if backlog exists

### Step 3: Generate with Stitch

1. **Discover namespace**: Run `list_tools` to find the Stitch MCP prefix
2. **Get or create project**: Use `projectId` from `.stitch/metadata.json` if it exists; otherwise call `[prefix]:create_project` then `[prefix]:get_project` and save to `.stitch/metadata.json`
3. **Generate screen**: Call `[prefix]:generate_screen_from_text` with `projectId`, `prompt` (full baton content), and `deviceType: DESKTOP`
4. **Retrieve assets**: Check if `.stitch/designs/{page}.html` and `.stitch/designs/{page}.png` already exist before downloading
   - Download `htmlCode.downloadUrl` → `.stitch/designs/{page}.html`
   - Append `=w{width}` to `screenshot.downloadUrl` before downloading → `.stitch/designs/{page}.png`

### Step 4: Integrate into Site

1. Move generated HTML from `.stitch/designs/{page}.html` to `site/public/{page}.html`
2. Fix asset paths to be relative to the public folder
3. Update navigation — wire placeholder links (`href="#"`) to the new page
4. Ensure consistent headers/footers across all pages

### Step 5: Update Site Documentation

Modify `.stitch/SITE.md`:
- Add the new page to Section 4 (Sitemap) with `[x]`
- Remove any idea consumed from Section 6 (Creative Freedom)
- Update Section 5 (Roadmap) if a backlog item was completed

### Step 6: Prepare the Next Baton (Critical)

**You MUST update `.stitch/next-prompt.md` before completing.** This keeps the loop alive.

```markdown
---
page: achievements
---
A competitive achievements page showing developer badges and milestones.

**DESIGN SYSTEM (REQUIRED):**
[Copy the entire design system block from .stitch/DESIGN.md]

**Page Structure:**
1. Header with title and navigation
2. Badge grid showing unlocked/locked states
3. Progress bars for milestone tracking
```

## File Structure Reference

```
project/
├── .stitch/
│   ├── metadata.json   # Stitch project & screen IDs (persist this!)
│   ├── DESIGN.md       # Visual design system
│   ├── SITE.md         # Site vision, sitemap, roadmap
│   ├── next-prompt.md  # The baton — current task
│   └── designs/        # Staging area for Stitch output
└── site/public/        # Production pages
```

### `.stitch/metadata.json` Schema

```json
{
  "name": "projects/6139132077804554844",
  "projectId": "6139132077804554844",
  "title": "My App",
  "visibility": "PRIVATE",
  "deviceType": "MOBILE",
  "designTheme": {
    "colorMode": "DARK",
    "font": "INTER",
    "roundness": "ROUND_EIGHT",
    "customColor": "#40baf7",
    "saturation": 3
  },
  "screens": {
    "index": {
      "id": "d7237c7d78f44befa4f60afb17c818c1",
      "sourceScreen": "projects/6139132077804554844/screens/d7237c7d78f44befa4f60afb17c818c1",
      "x": 0, "y": 0, "width": 390, "height": 1249
    }
  }
}
```

## Common Pitfalls

- ❌ Forgetting to update `.stitch/next-prompt.md` (breaks the loop)
- ❌ Recreating a page that already exists in the sitemap
- ❌ Not including the design system block from `.stitch/DESIGN.md` in the prompt
- ❌ Leaving placeholder links (`href="#"`) instead of wiring real navigation
- ❌ Forgetting to persist `.stitch/metadata.json` after creating a new project
