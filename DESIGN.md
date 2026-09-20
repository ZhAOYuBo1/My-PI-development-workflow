---
name: CodePIddy
description: A calm Pi workflow client with layered neutral glass surfaces.
colors:
  text: "#292928"
  muted: "#777773"
  canvas: "#eceeea"
  sidebar-tint: "rgba(247,247,245,0.70)"
  surface-glass: "rgba(255,255,255,0.70)"
  surface-strong: "rgba(255,255,255,0.84)"
  border-glass: "rgba(255,255,255,0.76)"
  accent: "#506b57"
  danger: "#a53f36"
typography:
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  heading:
    fontFamily: "Segoe UI Variable Display, Segoe UI, system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 680
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
rounded:
  sm: "7px"
  md: "11px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "28px"
components:
  glass-panel:
    backgroundColor: "{colors.surface-glass}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "12px"
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "36px"
  composer:
    backgroundColor: "{colors.surface-glass}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "11px 13px"
---

# Design System: CodePIddy

## Overview

**Creative North Star: "Quiet Liquid Layers."** Preserve CodePIddy's original warm neutral palette and compact developer-tool character. Create hierarchy through translucency, backdrop blur, white edge highlights, inset shading, and soft offset shadows. The result should feel dimensional and tactile without looking like a glossy demo or changing the product's established identity.

**Key Characteristics:**

- Original off-white, gray, charcoal, and muted green palette.
- Three perceptible depth levels: background atmosphere, working surfaces, and floating overlays.
- Glass effects concentrated on major surfaces rather than every row.
- Crisp text and restrained motion remain more important than visual effects.

## Colors

Neutral tints carry the interface. Translucent white surfaces reveal a very subtle warm-gray background field. Muted green remains semantic for active, approved, and progress states.

**The Tint Not Rebrand Rule.** Glass layers may alter opacity and light response, but they must not replace the established CodePIddy palette.

## Typography

Use Segoe UI Variable for a native Windows reading experience. Keep existing hierarchy and density. Monospace remains limited to code, paths, commands, and measurements.

## Layout

The sidebar and main working pane sit as separate layers on the application background. The composer floats above the transcript and remains centered at a readable width. At compact desktop widths, the outer glass frame collapses back to edge-to-edge surfaces.

## Elevation & Depth

Depth combines four ingredients: translucent tint, backdrop blur, a white inset top highlight, and a soft offset shadow. Major panes use mild depth; the composer and overlay menus use stronger depth; modals use the highest depth.

**The Three-Level Glass Rule.** Use glass for major panes, floating controls, and overlays only. Ordinary list rows stay flat until selected or hovered.

**The Readability Before Refraction Rule.** Avoid SVG displacement or heavy refraction behind text-heavy areas. Blur and light response must never soften copy.

## Shapes

Major panes use 16px corners. Menus, cards, and composer controls use 9–13px corners. Status pills remain the only fully rounded elements.

## Components

### Buttons

Primary actions keep the original charcoal fill. Secondary and icon buttons may use translucent white, a bright inset highlight, and a small offset shadow.

### Cards / Containers

Settings cards, work-item choices, tool results, and user messages use lightly tinted glass with quiet borders. Do not stack multiple strong glass layers inside one another.

### Inputs / Fields

Inputs use a more opaque glass tint than surrounding panels. Focus adds a muted green ring and slightly stronger elevation.

### Navigation

The sidebar stays light and neutral. Selected project and agent rows receive a translucent raised surface rather than a new color block.

### Composer

The composer is the strongest recurring glass surface. It uses a white highlight line, deep blur, inset bottom shading, and two offset shadows to separate it from the transcript.

## Do's and Don'ts

### Do:

- Preserve the original neutral colors.
- Use background blur only where a surface actually floats above content.
- Keep white highlights thin and shadows soft with visible vertical offset.
- Disable decorative motion when reduced motion is requested.

### Don't:

- Do not introduce a dark sidebar or a new brand palette.
- Do not apply distortion filters to conversation text or code.
- Do not make every row transparent and glossy.
- Do not use zero-offset glow as a substitute for depth.
- Do not sacrifice contrast for translucency.
