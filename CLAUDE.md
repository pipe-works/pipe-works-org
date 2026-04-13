# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

pipe-works.org is a static HTML/CSS website with a print-workshop aesthetic. It features interconnected pages with shared typography and styling, themed around "goblin laws" and philosophical content. GPL-3.0 licensed.

## Luminal Local Surfaces

When working on `luminal.local`, two local browser surfaces are available:

- **Preview:** `https://pipeworks-org.luminal.local` — nginx serving `site/`
  as a static document root. Reflects the working tree in real time; no server
  restart needed after editing HTML/CSS.
- **Author UI:** `https://author.pipeworks-org.luminal.local` — the Flask
  authoring UI from `tools/author.py`, backed by
  `pipeworks-pipeworks-org-author.service` on `127.0.0.1:8410`.

Neither surface affects the live `pipe-works.org` site. Deployment to Mythic
Beasts only happens via GH Actions on push to `main`.

## Development

**Workspace venv:** `/srv/work/pipeworks/venvs/pw-pipeworks-org`

```bash
# Activate venv
source /srv/work/pipeworks/venvs/pw-pipeworks-org/bin/activate

# Run the publish tool
python tools/publish.py

# Run the author UI manually (if not using the systemd service)
python tools/author.py --port 8410
```

**No build system required for the static HTML/CSS.** Edit files and the
nginx preview surface reflects changes immediately.

## Architecture

### Pages

- `site/index.html` — Main landing page with masthead and navigation
- `site/explore/pub-crawl/index.html` — Pub crawl experience
- `site/explore/pub-crawl/crooked-pipe.html` — Interactive reveal page with form-triggered animations
- `site/ramblings/chalkboard.html` — Philosophy/process page with ASCII art stamps
- `site/ramblings/notices.html` — Extended laws document with categorized sections

### CSS Structure

- `site/css/fonts.css` — @font-face declarations for locally-served WOFF2 fonts
- `site/css/pipe-works-base.css` — Unified foundation: tokens, reset, typography, common components
- `site/css/index.css` — Index page (actions list, crooked-pipe link, footer positioning)
- `site/css/crooked-pipe.css` — Crooked Pipe page (door image, login form, interactive story)
- `site/css/three-pillars.css` — Three Pillars page (pillar positioning)
- `site/css/goblin-laws.css` — Goblin Laws page (blockquotes, margin positioning)

### Assets

- `site/assets/fonts/` — Six font families (Crimson Text, Libre Baskerville, IM Fell English, Courier Prime, Special Elite) with OFL licenses
- `site/assets/images/` — Static images

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
