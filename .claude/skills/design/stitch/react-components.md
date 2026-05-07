---
name: react-components
description: Converts Stitch designs into modular Vite and React components using system-level networking and AST-based validation. Use when the user wants to convert a Stitch-generated design into React code.
allowed-tools:
  - "stitch*:*"
  - "Bash"
  - "Read"
  - "Write"
  - "web_fetch"
source: https://github.com/google-labs-code/stitch-skills
---

# Stitch to React Components

You are a frontend engineer focused on transforming Stitch designs into clean React code. You follow a modular approach and use automated tools to ensure code quality.

## Retrieval and Networking

1. **Namespace discovery**: Run `list_tools` to find the Stitch MCP prefix.
2. **Metadata fetch**: Call `[prefix]:get_screen` to retrieve the design JSON.
3. **Check for existing designs**: Check if `.stitch/designs/{page}.html` and `.stitch/designs/{page}.png` already exist. If yes, ask whether to refresh from Stitch or reuse local files.
4. **High-reliability download**:
   - HTML: `bash scripts/fetch-stitch.sh "[htmlCode.downloadUrl]" ".stitch/designs/{page}.html"`
   - Screenshot: Append `=w{width}` to the screenshot URL (where `{width}` is from screen metadata), then: `bash scripts/fetch-stitch.sh "[screenshot.downloadUrl]=w{width}" ".stitch/designs/{page}.png"`
5. **Visual audit**: Review the downloaded screenshot to confirm design intent and layout details.

## Architectural Rules

- **Modular components**: Break the design into independent files. Avoid large, single-file outputs.
- **Logic isolation**: Move event handlers and business logic into custom hooks in `src/hooks/`.
- **Data decoupling**: Move all static text, image URLs, and lists into `src/data/mockData.ts`.
- **Type safety**: Every component must include a `Readonly` TypeScript interface named `[ComponentName]Props`.
- **Style mapping**:
  - Extract the `tailwind.config` from the HTML `<head>`
  - Sync these values with `resources/style-guide.json`
  - Use theme-mapped Tailwind classes instead of arbitrary hex codes

## Execution Steps

1. **Environment setup**: If `node_modules` is missing, run `npm install` to enable the validation tools.
2. **Data layer**: Create `src/data/mockData.ts` based on the design content.
3. **Component drafting**: Use `resources/component-template.tsx` as a base. Replace all instances of `StitchComponent` with the actual component name.
4. **Application wiring**: Update the project entry point (like `App.tsx`) to render the new components.
5. **Quality check**:
   - Run `npm run validate <file_path>` for each component.
   - Verify the final output against `resources/architecture-checklist.md`.
   - Start the dev server with `npm run dev` to verify the live result.

## Troubleshooting

- **Fetch errors**: Ensure the URL is quoted in the bash command to prevent shell errors.
- **Validation errors**: Review the AST report and fix any missing interfaces or hardcoded styles.
