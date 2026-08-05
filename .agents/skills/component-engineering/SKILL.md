---
name: Component Engineering (Tailwind CSS v4 & shadcn/ui)
description: Engineering standards, responsive design practices, and versioning guidelines for Tailwind CSS v4 and shadcn/ui.
---

# Skill: Component Engineering (Tailwind CSS v4 & shadcn/ui)

## Context & Versioning

- CSS Engine: Tailwind CSS v4.x (CSS-first configuration with `@theme` and OKLCH color spaces)
- Component Base: shadcn/ui (React 19 compatible modules, supporting Radix UI and Base UI)

## Engineering Standards

### 1. Tailwind v4 CSS-First Configuration

Tailwind v4 drops `tailwind.config.js` in favour of native `@theme` directives directly in your main CSS file (`globals.css`).

- Do not generate javascript utility extensions unless explicitly instructed.
- Theme keys utilize CSS custom variables natively.
- Prioritize using modern OKLCH color spaces over legacy HSL color variables for smoother, more perceptually uniform color palettes.

```css
@import "tailwindcss";

@theme {
  --color-brand-primary: oklch(0.2 0.05 250);
  --color-brand-accent: oklch(0.7 0.15 200);
}
```

### 2. shadcn/ui Component Consumption

- Components are co-located in `@/components/ui` or imported via subpath imports (e.g., `package.json#imports` using `#/*`).
- When initializing or configuring, either **Radix UI** or **Base UI** primitives can be used as the underlying unstyled foundation. Note that Base UI uses a modern render API rather than the legacy `asChild` prop pattern.
- Customize the icon library in `components.json` natively using the `iconLibrary` property (e.g., `lucide`, `heroicons`, `tabler`, `radix`) rather than hardcoding `lucide-react` imports.
- Use the **New York** style variant as the default layout.
- Prioritize installing pre-assembled "Blocks" (e.g., dashboards, bento grids, complex data tables) via the CLI rather than building pages manually from basic primitives.
- When updating or modifying shadcn/ui primitives, strictly preserve the `cn()` utility integration for merging `clsx` and `tailwind-merge`.
- Align with React 19 component standards: eliminate legacy `forwardRef` wraps, and directly accept `ref` as a standard component prop.

### 3. Responsive Web Design

- Enforce standard mobile-first utility prefixes (`sm:`, `md:`, `lg:`, `xl:`).
- Utilize Tailwind v4 container queries for standalone component responsive behaviors.
