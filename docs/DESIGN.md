# Toka Design System

This document specifies the design system tokens, typography, and UI rules for **Toka** (African Creator Economy Short-Video Platform), aligned with the Tailwind CSS v4 design configuration in the codebase.

## Design Tokens

### Color Palette
The colors are defined using `oklch` for high color accuracy and support both light and dark modes (defaulting to dark mode for the immersive mobile short-video feed).

| Token | CSS Variable | Value | Description |
| :--- | :--- | :--- | :--- |
| **Midnight Boma** | `--midnight-boma` | `oklch(0.130 0.005 277.0)` | Deep immersive background (#09090B) |
| **Shaded Canopy** | `--shaded-canopy` | `oklch(0.200 0.006 277.0)` | Elevated surfaces, cards & menus (#18181B) |
| **Toka Flare** | `--toka-flare` | `oklch(0.630 0.230 35.0)` | Primary Brand Energy, Call-to-actions (#FF4F00) |
| **Fintech Mint** | `--fintech-mint` | `oklch(0.700 0.160 160.0)` | Tipping indicators, Brand Safety badges (#10B981) |
| **Cloud White** | `--cloud-white` | `oklch(0.985 0.000 0.0)` | Crisp typography and light surface states (#FAFAFA) |

---

### Theme Mappings

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

### Typography
- **Primary Font**: `Geist Sans` (Inter, sans-serif fallbacks)
- **Monospace Font**: `Geist Mono` (monospace fallbacks, used for transactions, currency codes, and counts)

### Geometry
- **Border Radius**: `0.625rem` (10px, consistent across cards, action items, and buttons)

---

## Component Styles

### Buttons & Overlays
- **Primary Action (Tip/Support)**: Filled with `var(--primary)` (`Toka Flare`), high contrast text in white, border-radius `0.625rem`. Used for immediate engagement actions.
- **Fintech Secondary (Status/Success)**: Bordered or filled with `var(--secondary)` (`Fintech Mint`), text in `Fintech Mint`. Used for transaction success states, verified creators, and brand-safe status.
- **Elevation Layers**: Overlays (like creator profiles, description banners, and action lists) sit above the video player container, utilizing `var(--muted)` with appropriate transparency/blur for readability.

### Form Fields
- Inputs must have a border color of `var(--muted)`, background color of `var(--background)`, text in `var(--foreground)`, and rounded corners at `0.625rem`.
- Active focus state should use outline or ring of `var(--primary)` color.

### Layout & Spacing
- Dashboard components (like the Moderator View) use a card layout with background `var(--muted)` (Shaded Canopy in Dark Mode), text `var(--foreground)`, and borders of `var(--muted)`.
- Spacing follows a strict mobile-first layout with generous spacing for interactive feed buttons.
