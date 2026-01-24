# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

pipe-works.org is a static HTML/CSS website with a print-workshop aesthetic. It features interconnected pages with shared typography and styling, themed around "goblin laws" and philosophical content. GPL-3.0 licensed.

## Development

**No build system, dependencies, or installation required.** Edit files and reload browser.

```bash
# Serve locally (pick one)
open index.html                    # Direct file access
python3 -m http.server 8000        # Python server at localhost:8000
npx http-server                    # Node server at localhost:8080
```

## Architecture

### Pages
- `index.html` — Main landing page with masthead and navigation
- `crooked-pipe.html` — Interactive reveal page with form-triggered animations
- `three-pillars.html` — Philosophy/process page with ASCII art stamps
- `goblin_laws.html` — Extended laws document with categorized sections

### CSS Structure
- `css/shared-base.css` — Global CSS tokens, reset, utilities (modify for new tokens)
- `css/style.css` — Page-specific styling using shared tokens
- `css/fonts.css` — @font-face declarations for locally-served WOFF2 fonts

### Assets
- `assets/fonts/` — Six font families (Crimson Text, Libre Baskerville, IM Fell English, Courier Prime, Special Elite) with OFL licenses
- `assets/images/` — Static images

## Design System

### CSS Variables (defined in shared-base.css)
- `--paper`, `--ink`, `--ink-faded`, `--blood`, `--pin`, `--cooling-brown`, `--bg`
- All colors use these tokens; don't hardcode hex values

### Typography Roles
- Masthead: IM Fell English SC
- Headlines: Libre Baskerville
- Body: Crimson Text
- Records/ledgers: Courier Prime
- Editorial marks: IM Fell English
- Accents: Special Elite

### Key Styling Patterns
- `.sheet` — Main container with shadow and noise texture
- `.margin-note` — Commentary positioned with precise px/rem values
- `.reveal-hidden` / `.reveal-item` — Staggered fadeInUp animations
- Rotations (-3.8deg, 7deg) for "crooked" print aesthetic

## JavaScript

Minimal vanilla JS, inline in HTML `<script>` tags. Used only for:
- Form input validation (enable/disable buttons)
- Reveal animations on form submission (DOM class toggling)

No external libraries.
