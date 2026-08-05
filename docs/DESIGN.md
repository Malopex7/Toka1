# CryoByte Overwatch Design System

This document specifies the design system tokens, typography, and UI rules for **Overwatch ITSM**, aligned with the Tailwind CSS v4 design configuration in the codebase.

## Design Tokens

### Color Palette
The colors are defined using `oklch` for high color accuracy and support both light and dark modes.

| Token | Light Mode Value | Dark Mode Value | Description |
| :--- | :--- | :--- | :--- |
| **Background** | `oklch(1 0 0)` (White) | `oklch(0.145 0 0)` (Dark Grey) | Default page background |
| **Foreground** | `oklch(0.145 0 0)` (Dark Charcoal) | `oklch(0.985 0 0)` (Off-white) | Default text color |
| **Primary** | `oklch(0.205 0 0)` (Off-black) | `oklch(0.922 0 0)` (Light Grey) | Buttons, active states, key elements |
| **Secondary** | `oklch(0.97 0 0)` (Light Grey) | `oklch(0.269 0 0)` (Medium Dark Grey) | Secondary actions, alternative background panels |
| **Muted** | `oklch(0.97 0 0)` (Light Grey) | `oklch(0.269 0 0)` (Medium Dark Grey) | Inactive tabs, disabled state background |
| **Accent** | `oklch(0.97 0 0)` (Light Grey) | `oklch(0.269 0 0)` (Medium Dark Grey) | Highlights, hovers, subtle status accents |
| **Destructive** | `oklch(0.577 0.245 27.325)` (Crimson Red) | `oklch(0.704 0.191 22.216)` (Vibrant Red) | Danger actions, SLA breach indicators, P1 incidents |
| **Border / Input**| `oklch(0.922 0 0)` (Soft Border) | `oklch(1 0 0 / 10%)` (Semi-transparent White) | Input borders, separator lines |

### Typography
- **Primary Font**: `Geist Sans` (inter, sans-serif fallbacks)
- **Monospace Font**: `Geist Mono` (monospace fallbacks, used for timestamps, IDs, code)

### Geometry
- **Border Radius**: `0.625rem` (10px, medium roundness)

---

## Component Styles

### Buttons
- **Primary Button**: Filled with `Primary` color, text in `Primary-Foreground`, border-radius `0.625rem`. High contrast, clean.
- **Secondary Button**: Filled with `Secondary` color, text in `Secondary-Foreground`, border-radius `0.625rem`.
- **Destructive Button**: Filled with `Destructive` color, text in white, border-radius `0.625rem`.

### Form Fields
- Inputs must have a border color of `Border`, background color of `Background`, text in `Foreground`, and rounded corners at `0.625rem`.
- Active focus state should use outline or ring of `Primary` color.

### Layout & Spacing
- Dashboard components use a card layout with background `Card`, text `Card-Foreground`, and borders of `Border`.
- Spacing follows a strict grid alignment with generous padding for technician views.
