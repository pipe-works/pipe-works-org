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
- `goblin-laws.html` — Extended laws document with categorized sections

### CSS Structure

- `css/fonts.css` — @font-face declarations for locally-served WOFF2 fonts
- `css/pipe-works-base.css` — Unified foundation: tokens, reset, typography, common components
- `css/index.css` — Index page (actions list, crooked-pipe link, footer positioning)
- `css/crooked-pipe.css` — Crooked Pipe page (door image, login form, interactive story)
- `css/three-pillars.css` — Three Pillars page (pillar positioning)
- `css/goblin-laws.css` — Goblin Laws page (blockquotes, margin positioning)

### Assets

- `assets/fonts/` — Six font families (Crimson Text, Libre Baskerville, IM Fell English, Courier Prime, Special Elite) with OFL licenses
- `assets/images/` — Static images

## Design System

### CSS Variables (all in pipe-works-base.css)

- **Newsprint palette** (legacy): `--ink-newsprint-*`, `--paper-newsprint`, `--rule`, `--shadow-*`
- **Pipe-works palette** (active): `--paper`, `--ink`, `--ink-faded`, `--blood`, `--pin`, `--cooling-brown`, `--bg`
- **Typography**: `--font-masthead`, `--font-headline`, `--font-body`, `--font-record`, `--font-symbols`
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

Located in `js/` directory. Vanilla JS, no external libraries.

- `js/crooked-pipe.js` — Interactive story game with keyboard bindings (1, 2, etc.)
