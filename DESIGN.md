---
name: MockerAI
description: Editorial studio language on warm cream paper. Deep navy ink (Pantone P 105-8 C), one signal red accent (P 48-8 C) and a butter-yellow highlighter (938 C). Instrument Serif display with italic accent words, Inter Tight UI, JetBrains Mono labels. Motion is cinematic but purposeful.
sources:
  palette: "User-specified Pantone colors: P 105-8 C, P 48-8 C, 938 C (sRGB values from published Pantone reference conversions)"
  layout-and-motion: "Analysis of triovexsolution.com (structure, easing, reveals, pinned steps, splash); adapted, not copied: own wordmark, content and marks"
---

# MockerAI design system

## Color

| Token | Light | Dark (`.section-dark`) | Notes |
|---|---|---|---|
| `--canvas` | `#fbf6e3` cream | `#111c3a` deep navy | page background |
| `--surface` | `#fffdf5` | `#15224a` | panels |
| `--canvas-alt` | `#f4ead0` | `#1a2a55` | cards, hover fills |
| `--ink` | `#293f76` **P 105-8 C** | `#fbf6e3` | all text |
| `--accent` | `#d62e2f` **P 48-8 C** | `#fceea8` **938 C** | italic accent words, bars, marks |
| `--accent-strong` | `#d62e2f` | `#d62e2f` | button fill (white text 5.5:1) |
| `--accent-soft` | `#fceea8` **938 C** | `rgb(252 238 168 / .12)` | highlighter: selected rows, feedback boxes |
| `--good` / `--fair` / `--low` | `#2f7a4b` / `#a85a06` / `#a61e22` | `#7fd6a0` / `#f5c26b` / `#ff8f8a` | score tones only |

Rules
- One accent per surface. Red on cream, butter yellow on navy (red on navy fails contrast at 2.9:1).
- Buttons are always red with white text, on both themes.
- Shadows and glows are tinted navy or red, never neutral black.

## Type
- Display: Instrument Serif 400, italic for the single accent word in a headline.
- UI / body: Inter Tight (variable).
- Labels, eyebrows, numbers in data: JetBrains Mono, 10.5–11px, uppercase, 0.12em tracking.

## Shape
- Controls are pills. Panels 20px radius. Inner elements 12px.
- Major panels sit in a double bezel (6px tinted tray + hairline).

## Motion
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` everywhere; button icon nudges use `cubic-bezier(0.32, 0.72, 0, 1)`.
- Splash: particle morph (scatter, ring mark, serif wordmark, burst), 3.6s, once per session, 0.7s under reduced motion.
- Headlines reveal line by line from masks; accent CTA letters resolve from blur.
- Scroll: pinned 4-step "How it works", 2px progress line, glass pill header that tones to the section behind it.
- Everything honours `prefers-reduced-motion`.
