# Design System

## Visual Theme

**Mood:** calm clinical daylight desk
**Density:** comfortable-dense (admin tables and forms)
**Strategy:** Restrained — white canvas, indigo primary ≤10% of surface, teal as secondary accent

No gradients. No glassmorphism. No dark mode as default.

## Color

| Role | Token | Value | Use |
|------|-------|-------|-----|
| Canvas | `--background` | white `oklch(1 0 0)` | Page and content plane |
| Ink | `--foreground` | indigo-tinted dark `oklch(0.28 0.04 260)` | Body text |
| Primary | `--primary` | logo indigo `oklch(0.35 0.09 265)` | Buttons, active nav, focus |
| Accent | `--teal` | logo ring `oklch(0.62 0.08 195)` | Subtle accents, success-adjacent highlights |
| Muted | `--muted` | `oklch(0.97 0.01 250)` | Soft fills only (chips, table zebra optional) |
| Border | `--border` | `oklch(0.90 0.015 250)` | Hairlines that clarify structure |
| Sidebar | `--sidebar` | white | Same canvas; separate with border, not tint wash |

Charts: indigo, teal, then restrained amber/slate. Avoid purple/pink decorative palettes.

## Typography

- **UI family:** DM Sans (sans) for headings, labels, body, buttons
- **Mono:** only for codes, IDs, raw tokens if shown; phones and counts use proportional + `tabular-nums`
- Scale: tight product ratio (~1.125–1.2). Page titles `text-xl font-semibold`, section titles `text-base font-semibold`, body `text-sm`
- No display/extrabold marketing headings inside admin

## Layout

- Admin content max width ~1280–1400px so the main task (tables, compose, breakdowns) can breathe
- Section gap larger than within-group gap (`space-y-8` between regions, `space-y-3`–`4` inside)
- Cards only for interactive or clearly bounded units (compose, directory, filters). Prefer spacing over card-in-card

## Components

- Primary button: indigo fill, white label
- Secondary: white + border
- Active nav: light indigo wash, not heavy side stripe (>1px)
- Tables: clear header, comfortable row padding, actions right-aligned

## Motion

150–250ms state transitions only. No page-load choreography.
