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

  /* Toka Brand Palette Swatches */
  --midnight-boma: oklch(0.130 0.005 277.0);   /* Deep immersive background #09090B */
  --shaded-canopy: oklch(0.200 0.006 277.0);   /* Elevated surfaces & menus #18181B */
  --toka-flare: oklch(0.630 0.230 35.0);       /* Primary Brand Energy #FF4F00 */
  --fintech-mint: oklch(0.700 0.160 160.0);    /* Tipping & Brand Safety #10B981 */
  --cloud-white: oklch(0.985 0.000 0.0);       /* Crisp Text #FAFAFA */

  /* Light Theme Mapping */
  --background: var(--cloud-white);
  --foreground: var(--midnight-boma);
  --primary: var(--toka-flare);
  --secondary: var(--fintech-mint);
  --muted: var(--shaded-canopy);
}

.dark {
  /* Dark Theme Mapping (Toka defaults to Dark Mode for the video feed) */
  --background: var(--midnight-boma);
  --foreground: var(--cloud-white);
  --primary: var(--toka-flare);
  --secondary: var(--fintech-mint);
  --muted: var(--shaded-canopy);
}
```

---

## 🎨 Phase 3: Stitch MCP UI Prototyping Sequence

Use Stitch MCP to prototype, generate, and validate high-fidelity screens before code implementation:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Initialize Stitch Project:  StitchMCP/create_project                      │
│ 2. Upload Design System:       StitchMCP/upload_design_md                   │
│                                StitchMCP/create_design_system_from_design_md│
│ 3. Generate Views from Text:   StitchMCP/generate_screen_from_text          │
│    (Provide rich high-density layout prompts)                               │
│ 4. Variant & Contrast Check:   StitchMCP/generate_variants                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📐 Phase 4: Mockup Visual Audit ("To The Tee")

When replicating a design mockup image or Stitch output, perform a 5-point visual audit:

1. **Layout Grid & Pane Ratios**: Measure relative widths (e.g. Vertical Video Feed player `w-full max-w-md`, Overlay Info Panels, Admin Moderation Split View: Player pane `w-1/2`, Review actions/risk-flags pane `w-1/2`).
2. **Typography Contrast**: Contrast sans-serif creator/title fonts (`font-sans` for main content) against monospace text (`font-mono` for transaction amounts, timestamps, and confidence scores).
3. **Pill & Badge Micro-States**:
   - `APPROVED / BRAND SAFE` -> Mint green filled badge (`#10B981`) with dark/white text.
   - `HUMAN REVIEW` -> Warning orange filled badge (`#FFB01F`) with dark text.
   - `REJECTED` -> Muted red background.
4. **Primary CTAs**: Ensure primary action buttons (e.g., *Tip 10 ZAR*) use full-contrast brand accent colors (`Toka Flare`) with prominent coin/cash icons.
5. **Interactive Controls**: Build live state switches (e.g., Human Takeover toggle button) with smooth position transitions.

---

## 🚀 Phase 5: Code Implementation & Build Verification

1. **Zustand 5 State Store**: Initialize store (`src/store/useFeedStore.ts`) with mock data matching the mockup to allow instant visual rendering.
2. **React 19 Component Assembly**: Build clean, un-nested functional components passing `ref` directly as a prop.
3. **Build Check Verification**: Always run production compilation (`npm run build` or `npx tsc --noEmit`) to ensure 0 TypeScript or Next.js build errors before concluding.

---

## 📋 Copy-Paste Checklist for Future Projects

- [x] Write `docs/prompt.md` defining Next.js 16, React 19, Tailwind v4, and Zustand 5 stack rules.
- [x] Convert hex brand colors to OKLCH using Node.js script.
- [x] Write `@theme` OKLCH color definitions into `src/app/globals.css`.
- [x] Document design tokens in `docs/DESIGN.md`.
- [x] Register design system in Stitch MCP (`create_project` -> `upload_design_md` -> `create_design_system_from_design_md`).
- [x] Generate high-fidelity screen prototypes with `generate_screen_from_text`.
- [ ] Scaffold Zustand 5 stores with initial mock data matching mockup.
- [ ] Replicate UI components to the tee
- [ ] Verify zero errors with `npm run build`.
