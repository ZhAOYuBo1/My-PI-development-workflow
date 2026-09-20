---
name: CodePIddy
description: A calm graphite developer cockpit for Pi-powered feature and bug workflows.
colors:
  accent: "#397b5a"
  accent-strong: "#2f684b"
  accent-soft: "#e7f1ea"
  sidebar: "#171b19"
  sidebar-raised: "#202522"
  canvas: "#f4f6f3"
  surface: "#ffffff"
  surface-subtle: "#f8f9f7"
  border: "#dfe4df"
  text: "#202522"
  muted: "#717a74"
  danger: "#a64b42"
typography:
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  heading:
    fontFamily: "Segoe UI Variable Display, Segoe UI, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 680
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  composer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "11px 12px"
  sidebar-navigation:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
---

# Design System: CodePIddy

## Overview

**Creative North Star: "The Graphite Workshop."** CodePIddy should feel like a serious developer tool that stays out of the way while still making workflow state immediately legible. A graphite application shell contains a quiet, paper-like working canvas. The interface is dense enough for daily engineering work but uses spacing, hierarchy, and restrained depth to avoid looking like an admin dashboard.

**Key Characteristics:**

- Dark graphite project navigation paired with a warm, low-glare work canvas.
- Muted evergreen accents reserved for active, successful, and actionable states.
- Compact controls, clear state boundaries, and generous reading width for long sessions.
- Native Windows typography and predictable keyboard focus.

## Colors

The dark shell creates a stable project-management zone. The light canvas is reserved for conversation, review, and configuration work. Evergreen is the single interaction accent; warning and failure colors remain semantic.

**The One Accent Rule.** Do not introduce another decorative brand color. New interactive states should derive from the evergreen accent or remain neutral.

## Typography

Segoe UI Variable is the primary voice because the application is a Windows desktop tool. Headings use tighter tracking and stronger weight, while code, paths, commands, and measurements use the monospace stack only when the content is genuinely technical.

**The Technical Type Rule.** Monospace communicates code or measurable data, never generic product personality.

## Layout

The application uses a fixed project sidebar and one flexible working canvas. Conversation content is centered around an approximately 820px reading measure. Headers stay compact, and the composer remains visually anchored at the bottom without spanning the entire window.

At narrower desktop widths, the shell loses its outer frame, the sidebar becomes narrower, and content padding reduces without changing information architecture.

## Elevation & Depth

Depth is quiet and functional: the main canvas sits above the graphite shell, the composer lifts above the transcript, and menus or modals receive the strongest shadow. Ordinary rows rely on background contrast rather than floating-card shadows.

**The Three-Layer Rule.** Use only shell, working surface, and overlay depth. Avoid stacking cards inside cards.

## Shapes

Most interactive controls use 6–10px corners. Large workspace surfaces and modals use 14px corners. Pills are limited to status indicators and counts.

## Components

### Buttons

Primary buttons use evergreen fill and compact 36px height. Secondary buttons use a white surface and visible neutral border. Icon controls remain square with a 7–10px radius rather than circular unless the action is the composer send control.

### Cards / Containers

Workflow and settings containers use a near-white surface, a quiet border, and little or no shadow. Hovering a selectable workflow row may lift it by one pixel to indicate direct manipulation.

### Inputs / Fields

Inputs are white with neutral borders. Focus uses an evergreen border plus a low-opacity outer ring. Placeholder text remains readable but clearly secondary.

### Navigation

The project sidebar uses graphite surfaces, subdued labels, and a single raised selected state. Agent abbreviations are compact role identifiers rather than decorative symbols.

### Composer

The composer is the signature component: centered, elevated, and visually separate from the transcript. Model, attachment, and send controls share one compact toolbar and use a stronger focus state when the editor is active.

## Do's and Don'ts

### Do:

- Keep the conversation canvas quiet and readable during long sessions.
- Use evergreen to communicate action, active selection, progress, and success.
- Preserve clear separation between project navigation and agent work.
- Show keyboard focus and meaningful loading, empty, error, and disabled states.

### Don't:

- Do not turn every section into a floating card.
- Do not use bright gradients, neon glows, or decorative glass effects.
- Do not use monospaced text for ordinary labels.
- Do not add another accent color for visual variety alone.
- Do not hide workflow state behind hover-only interactions.
