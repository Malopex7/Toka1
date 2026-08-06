# Master Design & UI Replication Playbook (`design-process.md`)

This playbook documents the exact end-to-end engineering and design methodology used to create high-fidelity, pixel-perfect web applications using **Next.js 16**, **React 19**, **Tailwind CSS v4**, **shadcn/ui**, **OKLCH Design Tokens**, and **Stitch MCP UI Prototyping**.

Follow this 5-step process on any future project to reliably go from visual design concept to a verified, zero-error production codebase.

---

## 🛠️ Phase 1: Define Technical Constraints & Stack Rules

Before writing any code or generating UI prototypes, define a single strict architectural prompt (`docs/prompt.md`) enforcing modern standards:

1. **Framework Standard**: Next.js 16 App Router (`src/app/` structure, React Server Components by default).
2. **React Version Standard**: React 19 Strict Mode. **Rule**: Direct `ref` prop passing only; omit legacy `forwardRef`.
3. **Styling Standard**: Tailwind CSS v4 CSS-first configuration inside `src/app/globals.css` with the `@theme` directive. Do not create `tailwind.config.js`.
4. **UI Primitives**: `shadcn/ui` using `cva` (class-variance-authority), `clsx`, and `tailwind-merge`.
5. **State Management**: Zustand v5 (atomic, modular client-side stores).

---

## 🎨 Phase 2: Perceptually Uniform OKLCH Color Token System

Always use OKLCH color spaces for high color accuracy and seamless Light/Dark mode contrast.

### 1. Hex to OKLCH Calculation Script
Run this Node.js snippet to compute exact OKLCH values for any hex palette:

```javascript
function hexToOklch(hex) {
  let c = hex.replace('#', '');
  let r = parseInt(c.substring(0,2), 16)/255;
  let g = parseInt(c.substring(2,4), 16)/255;
  let b = parseInt(c.substring(4,6), 16)/255;

  let sRgbToLinear = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  let lr = sRgbToLinear(r), lg = sRgbToLinear(g), lb = sRgbToLinear(b);

  let l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  let m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969557 * lb);
  let s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299786997 * lb);

  let L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720403 * s;
  let a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  let b_val = 0.0259040371 * l + 0.7827717662 * m - 0.8086757989 * s;

  let C = Math.sqrt(a * a + b_val * b_val);
  let H = Math.atan2(b_val, a) * (180 / Math.PI);
  if (H < 0) H += 360;

  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
}
```

### 2. Document Tokens (`docs/DESIGN.md`) & Configure `globals.css`
Map the computed values into semantic Tailwind v4 tokens:

```css
@import "tailwindcss";

:root {
  --radius: 0.625rem;

  /* Brand Palette Swatches */
  --trapped-darkness: oklch(0.212 0.035 248.2); /* Deep Slate #0B1A28 */
  --nocturne: oklch(0.400 0.040 238.3);         /* Muted Surface #334B5B */
  --super-rare-jade: oklch(0.708 0.122 183.8);  /* Primary Brand #18B9A9 */
  --master-nacho: oklch(0.813 0.165 75.1);      /* Warning/Accent #FFB01F */
  --white: oklch(0.997 0.001 286.4);             /* Text #FEFEFF */

  /* Light Theme Mapping */
  --background: var(--white);
  --foreground: var(--trapped-darkness);
  --primary: var(--super-rare-jade);
  --secondary: var(--master-nacho);
}

.dark {
  /* Dark Theme Mapping */
  --background: var(--trapped-darkness);
  --foreground: var(--white);
  --primary: var(--super-rare-jade);
  --secondary: var(--master-nacho);
}
```

---

## 🎨 Phase 3: Stitch MCP UI Prototyping Sequence

Use Stitch MCP to prototype, generate, and validate high-fidelity screens before code implementation:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Initialize Stitch Project:  StitchMCP/create_project                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Upload Design System:       StitchMCP/upload_design_md                   │
│                                StitchMCP/create_design_system_from_design_md│
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Generate Views from Text:   StitchMCP/generate_screen_from_text          │
│    (Provide rich high-density layout prompts)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Variant & Contrast Check:   StitchMCP/generate_variants                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📐 Phase 4: Mockup Visual Audit ("To The Tee")

When replicating a design mockup image or Stitch output, perform a 5-point visual audit:

1. **Layout Grid & Pane Ratios**: Measure relative widths (e.g. Far-Left Narrow Icon Sidebar `w-16`, Pane 1 `w-80`, Pane 2 `flex-1`, Pane 3 `w-88`).
2. **Typography Contrast**: Contrast serif header fonts (`font-serif` for titles/names) against monospace text (`font-mono` for IDs, timestamps, and status tags).
3. **Pill & Badge Micro-States**:
   - `ACTIVE` -> Jade border & text (`#18B9A9`).
   - `HUMAN TAKEOVER` -> Nacho Orange filled badge (`#FFB01F`) with dark text.
   - `WAITING PAYMENT` -> Muted slate background.
4. **Primary CTAs**: Ensure primary action buttons (e.g., *Send Paystack Payment Link*) use full-contrast brand accent colors with prominent icon badges.
5. **Interactive Controls**: Build live state switches (e.g., Human Takeover toggle button) with smooth position transitions.

---

## 🚀 Phase 5: Code Implementation & Build Verification

1. **Zustand 5 State Store**: Initialize store (`src/store/use-chat-store.ts`) with mock data matching the mockup to allow instant visual rendering.
2. **React 19 Component Assembly**: Build clean, un-nested functional components passing `ref` directly as a prop.
3. **Build Check Verification**: Always run production compilation (`npm run build` or `npx tsc --noEmit`) to ensure 0 TypeScript or Next.js build errors before concluding.

---

## 📋 Copy-Paste Checklist for Future Projects

- [ ] Write `docs/prompt.md` defining Next.js 16, React 19, Tailwind v4, and Zustand 5 stack rules.
- [ ] Convert hex brand colors to OKLCH using Node.js script.
- [ ] Write `@theme` OKLCH color definitions into `src/app/globals.css`.
- [ ] Document design tokens in `docs/DESIGN.md`.
- [ ] Register design system in Stitch MCP (`create_project` -> `upload_design_md` -> `create_design_system_from_design_md`).
- [ ] Generate high-fidelity screen prototypes with `generate_screen_from_text`.
- [ ] Scaffold Zustand 5 stores with initial mock data matching mockup.
- [ ] Replicate UI components to the tee (Narrow Icon Sidebar, Pane Layouts, Micro Badges, CTAs).
- [ ] Verify zero errors with `npm run build`.
