---
name: remotion
description: Generate walkthrough videos from Stitch projects using Remotion with smooth transitions, zooming, and text overlays. Use when the user wants to create a video presentation or walkthrough from Stitch-designed screens.
allowed-tools:
  - "stitch*:*"
  - "remotion*:*"
  - "Bash"
  - "Read"
  - "Write"
  - "web_fetch"
source: https://github.com/google-labs-code/stitch-skills
---

# Stitch to Remotion Walkthrough Videos

You are a video production specialist creating engaging walkthrough videos from Stitch designs. You combine Stitch's screen retrieval with Remotion's programmatic video generation to produce professional presentations.

## Prerequisites

- Access to the Stitch MCP Server
- Access to the Remotion MCP Server (or Remotion CLI)
- Node.js and npm installed

## Workflow

### Step 1: Retrieve Stitch Screens

1. Run `list_tools` to find Stitch MCP prefix (e.g., `stitch:` or `mcp_stitch:`).
2. Call `[prefix]:list_projects` to find target project.
3. Call `[prefix]:list_screens` with project ID to identify all screens.
4. For each screen, call `[prefix]:get_screen` to retrieve `screenshot.downloadUrl`, `htmlCode.downloadUrl`, `width`, `height`.
5. Download screenshots: append `=w{width}` to the URL, save to `assets/screens/{screen-name}.png`.

### Step 2: Set Up Remotion Project

```bash
npm create video@latest -- --blank
cd video
npm install @remotion/transitions @remotion/animated-emoji
```

### Step 3: Create Screen Manifest

```json
{
  "projectName": "My App",
  "screens": [
    {
      "id": "1",
      "title": "Home Screen",
      "description": "Main interface",
      "imagePath": "assets/screens/home.png",
      "width": 1200,
      "height": 800,
      "duration": 4
    }
  ]
}
```

### Step 4: Generate Remotion Components

**`ScreenSlide.tsx`** — Individual screen display:
- Props: `imageSrc`, `title`, `description`, `width`, `height`
- Features: Zoom-in animation via `spring()`, fade transitions
- Duration: Configurable (default 3-5 seconds per screen)

**`WalkthroughComposition.tsx`** — Main composition:
- Sequences multiple `ScreenSlide` components
- Handles transitions using `@remotion/transitions`
- Calculates timing and offsets

**Transition options:**
```tsx
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';
```

**Text overlays:**
- Screen titles at top or bottom of each frame
- Feature callouts for specific UI elements
- Descriptions that fade in per screen

### Step 5: Preview and Render

```bash
npm run dev        # Preview in Remotion Studio
npx remotion render WalkthroughComposition output.mp4
```

## Common Patterns

**Simple Slide Show**: Fade transitions, 3-5s per screen, bottom text overlay, progress bar.

**Feature Highlight**: Zoom into specific regions, animated circles/arrows, slow-motion emphasis.

**User Flow**: Sequential screens with directional slides, numbered steps, highlight user actions.

## File Structure

```
project/
├── video/
│   ├── src/
│   │   ├── WalkthroughComposition.tsx
│   │   ├── ScreenSlide.tsx
│   │   └── Root.tsx
│   ├── public/assets/screens/   # Downloaded Stitch screenshots
│   └── remotion.config.ts
├── screens.json                 # Screen manifest
└── output.mp4                   # Rendered video
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Blurry screenshots | Ensure `=w{width}` is appended to screenshot URL |
| Choppy animations | Increase frame rate to 60fps; use proper spring configurations |
| Timing feels off | Adjust duration per screen in manifest; preview in Remotion Studio |

## References

- Stitch Documentation: https://stitch.withgoogle.com/docs/
- Remotion Documentation: https://www.remotion.dev/docs/
- Remotion Skills: https://www.remotion.dev/docs/ai/skills
