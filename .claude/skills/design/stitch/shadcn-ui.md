---
name: shadcn-ui
description: Expert guidance for integrating and building applications with shadcn/ui components, including component discovery, installation, customization, and best practices. Use when the user wants to use shadcn/ui, Radix UI, or accessible component libraries with Tailwind CSS.
allowed-tools:
  - "shadcn*:*"
  - "mcp_shadcn*"
  - "Read"
  - "Write"
  - "Bash"
  - "web_fetch"
source: https://github.com/google-labs-code/stitch-skills
---

# shadcn/ui Component Integration

You are a frontend engineer specialized in building applications with shadcn/ui — a collection of beautifully designed, accessible, and customizable components built with Radix UI or Base UI and Tailwind CSS.

## Core Principles

shadcn/ui is **not a component library** — it's a collection of reusable components that you copy into your project:
- **Full ownership**: Components live in your codebase, not node_modules
- **Complete customization**: Modify styling, behavior, and structure freely
- **No version lock-in**: Update components selectively at your own pace
- **Zero runtime overhead**: No library bundle, just the code you need

## Project Setup

**New projects:**
```bash
npx shadcn@latest create
```

**Existing projects:**
```bash
npx shadcn@latest init
```

This creates `components.json` with your configuration (style, baseColor, cssVariables, tailwind config, aliases, rsc, rtl).

## Component Installation

**Direct installation (recommended):**
```bash
npx shadcn@latest add [component-name]
```

This downloads the component source, installs required dependencies, and places files in `components/ui/`.

## File Structure

```
src/
├── components/
│   ├── ui/              # shadcn components
│   └── [custom]/        # your composed components
├── lib/
│   └── utils.ts         # cn() utility
└── app/
    └── page.tsx
```

## The `cn()` Utility

All shadcn components use `cn()` for intelligent class merging:

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

## Customization

### Theme

Edit CSS variables in `app/globals.css`:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
  }
}
```

### Component Variants

Use `class-variance-authority` (cva):

```typescript
import { cva } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        outline: "border border-input",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

### Extending Components

Create wrapper components in `components/` (not `components/ui/`):

```typescript
import { Button, ButtonProps } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function LoadingButton({ loading, children, ...props }: ButtonProps & { loading?: boolean }) {
  return (
    <Button disabled={loading} {...props}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}
```

## Common Patterns

### Form Building

```typescript
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
// Use with react-hook-form for validation
```

### Dialog/Modal

```typescript
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
```

### Data Display

```typescript
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
```

## Requirements

- React 18+
- Tailwind CSS 3.0+
- `class-variance-authority`, `clsx`, `tailwind-merge`
- Radix UI OR Base UI primitives

## Accessibility

All shadcn/ui components are built on Radix UI primitives:
- Full keyboard navigation
- Proper ARIA attributes
- Logical focus flow
- Disabled states handled

When customizing, maintain accessibility: keep ARIA attributes, preserve keyboard handlers, test with screen readers.

## Troubleshooting

**Import errors**: Check `components.json` for correct alias configuration and `tsconfig.json` for `@` path alias.

**Style conflicts**: Ensure Tailwind CSS is configured and `globals.css` is imported in your root layout.

**Missing dependencies**: Run component installation via CLI to auto-install deps, or check `get_component_metadata` for dependency lists.
