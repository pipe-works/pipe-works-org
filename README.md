[![CI](https://github.com/pipe-works/pipe-works-org/actions/workflows/ci.yml/badge.svg)](https://github.com/pipe-works/pipe-works-org/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/downloads/)

# pipe-works-org

`pipe-works-org` is the source repository for [pipe-works.org](https://www.pipe-works.org/) — a public workbench:
writing code with the garage door up, documenting coding failures, small goblin successes, and experiments in public.
It also showcases snippets from the PipeWorks MUD server before The Daily Undertaking is officially open for play.

The site is static HTML and CSS with a print-workshop aesthetic. A Python-based static site generator and local
authoring tool live in `tools/` for managing the ramblings content.

## PipeWorks Workspace

These repositories are designed to live inside a shared PipeWorks workspace
rooted at `/srv/work/pipeworks`.

- `repos/` contains source checkouts only.
- `venvs/` contains per-project virtual environments such as `pw-pipeworks-org`.
- `runtime/` contains mutable runtime state such as databases, exports, session
  files, and caches.
- `logs/` contains service-owned log output when a project writes logs outside
  the process manager.
- `config/` contains workspace-level configuration files that should not be
  treated as source.
- `bin/` contains optional workspace helper scripts.
- `home/` is reserved for workspace-local user data when a project needs it.

Across the PipeWorks ecosphere, the rule is simple: keep source in `repos/`,
keep mutable state outside the repo checkout, and use explicit paths between
repos when one project depends on another.

## What This Repo Owns

This repository is the source of truth for:

- the static HTML and CSS pages published to `pipe-works.org`
- the `tools/publish.py` static site generator that converts markdown content
  to styled HTML pages
- the `tools/author.py` local Flask-based authoring UI with live preview
- site assets: fonts, images, and JavaScript
- content source in `content/` (markdown articles for the ramblings sections)
- deployment configuration for the live Mythic Beasts host and for local
  development surfaces

This repository does not own:

- the Mythic Beasts server configuration
- DNS records for `pipe-works.org`
- any PipeWorks MUD server or game content

## Repository Layout

```text
site/               Hand-authored HTML pages and assets served as the web root
  index.html        Main landing page
  css/              Shared and page-specific stylesheets
  js/               Vanilla JavaScript (interactive pub-crawl story, session tagging)
  assets/
    fonts/          Locally served WOFF2 font families with OFL licences
    images/         Static images
  explore/          Pub-crawl experience pages
  ramblings/        Generated article pages (output of tools/publish.py)

content/            Markdown source for ramblings articles
  chalkboard/       Philosophy and process articles
  notices/          Goblin Laws extended documents

tools/
  publish.py        Static site generator: converts content/ markdown to site/ramblings/ HTML
  author.py         Local Flask UI for drafting and previewing articles
  requirements-publish.txt  Python dependencies for both tools (markdown, flask)

deploy/
  nginx/            Nginx vhost configuration templates
  systemd/          Systemd service unit templates
```

## Design System

The site uses a newsprint and print-workshop aesthetic. All CSS custom properties are defined in
`site/css/pipe-works-base.css`:

- Active palette tokens: `--paper`, `--ink`, `--ink-faded`, `--blood`, `--pin`, `--cooling-brown`, `--bg`
- Typography roles: masthead (IM Fell English SC), headlines (Libre Baskerville), body (Crimson Text),
  records (Courier Prime), accents (Special Elite)
- Do not hardcode hex values — always use the defined tokens

## Local Development

### Python Tools Setup

The authoring and publish tools require a Python environment. The PipeWorks workspace convention
is a dedicated venv under `venvs/pw-pipeworks-org`:

```bash
python3.13 -m venv /srv/work/pipeworks/venvs/pw-pipeworks-org
/srv/work/pipeworks/venvs/pw-pipeworks-org/bin/pip install -r tools/requirements-publish.txt
```

### Static Preview

The site is plain HTML and CSS — no build step is needed for the hand-authored pages. Any local HTTP
server pointed at `site/` works as a preview:

```bash
# Activate the workspace venv first
source /srv/work/pipeworks/venvs/pw-pipeworks-org/bin/activate

# Quick one-off preview
python3 -m http.server 8000 --directory site/
```

When running on a host with nginx configured, the deploy templates in `deploy/nginx/` provide
HTTPS vhost configurations for a local preview surface and for the authoring UI.

### Publishing Articles

Convert markdown content to HTML and update the ramblings section:

```bash
source /srv/work/pipeworks/venvs/pw-pipeworks-org/bin/activate

# Build all articles
python tools/publish.py

# Include draft articles in the build
python tools/publish.py --drafts

# Remove generated files and rebuild clean
python tools/publish.py --clean
```

### Author UI

The `author.py` tool provides a browser-based editor with live preview styled using the actual
site CSS. It saves markdown to `content/` and publishes HTML via `publish.py`:

```bash
source /srv/work/pipeworks/venvs/pw-pipeworks-org/bin/activate
python tools/author.py              # Start on port 8410
python tools/author.py --port 8888  # Custom port
```

The deploy templates in `deploy/systemd/` provide a systemd service unit for running the author
UI as a persistent local service when that is preferred.

## Deployment

The live site at [pipe-works.org](https://www.pipe-works.org/) is deployed to Mythic Beasts hosting.
Any push to `main` triggers the GitHub Actions deploy workflow, which uses SSH and rsync to publish
the contents of `site/` as the web root. Manual deploys are also available via the GitHub Actions UI.

See `.github/workflows/deploy.yml` for the deploy workflow and `deploy/` for host configuration templates.

## Licence

GPL-3.0. See `LICENSE` for the full text. Font assets are distributed under their respective OFL licences,
included in `site/assets/fonts/`.
