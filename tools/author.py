#!/usr/bin/env python3
"""author.py — Local web UI for authoring pipe-works.org articles.

Provides a browser-based editor with live preview styled using the
actual pipe-works.org CSS.  Saves markdown to content/, publishes
HTML to site/ramblings/ via publish.py.

Usage:
    python tools/author.py              # Start on port 5555
    python tools/author.py --port 8888  # Custom port
"""

import argparse
import html as html_mod
import re
import subprocess
import sys
import webbrowser
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content"
SITE_DIR = ROOT / "site"

try:
    import markdown
except ImportError:
    sys.exit("Missing dependency: pip install markdown")

try:
    from flask import (
        Flask,
        render_template_string,
        request,
        redirect,
        url_for,
        jsonify,
    )
except ImportError:
    sys.exit("Missing dependency: pip install flask")

app = Flask(__name__, static_folder=str(SITE_DIR), static_url_path="/site")


# ---------------------------------------------------------------------------
# Helpers (duplicated from publish.py to stay self-contained)
# ---------------------------------------------------------------------------

def parse_frontmatter(text):
    if not text.startswith("---"):
        return {}, text
    end = text.find("---", 3)
    if end == -1:
        return {}, text
    meta = {}
    for line in text[3:end].strip().splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip().strip('"').strip("'")
    return meta, text[end + 3:].strip()


def md_to_html(text):
    md = markdown.Markdown(
        extensions=["fenced_code", "smarty", "tables"],
        output_format="html5",
    )
    return md.convert(text)


def list_articles(section):
    path = CONTENT_DIR / section
    if not path.exists():
        return []
    articles = []
    for f in sorted(path.glob("*.md")):
        text = f.read_text(encoding="utf-8")
        meta, _ = parse_frontmatter(text)
        articles.append({
            "slug": f.stem,
            "title": meta.get("title", f.stem.replace("-", " ").title()),
            "date": meta.get("date", ""),
            "draft": meta.get("draft", "").lower() in ("true", "yes", "1"),
        })
    articles.sort(key=lambda a: a.get("date", ""), reverse=True)
    return articles


def slugify(text):
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

SHELL_TOP = """\
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>pipe-works.org &mdash; {{ page_title }}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/site/css/fonts.css" />
  <link rel="stylesheet" href="/site/css/pipe-works-base.css" />
  <style>
    /* Author UI overrides */
    body { background: var(--bg); }
    .sheet { max-width: 80vw; width: 80vw; }

    .author-bar {
      display: flex; gap: 0.75rem; align-items: center;
      flex-wrap: wrap; margin-top: 1rem;
    }
    .author-bar button,
    .author-bar a {
      font-family: var(--font-record); font-size: 0.85rem;
      padding: 0.35rem 1rem; cursor: pointer;
      background: var(--paper); color: var(--ink);
      border: 1px solid var(--ink-faded); text-decoration: none;
    }
    .author-bar button:hover,
    .author-bar a:hover { background: var(--ink); color: var(--paper); }
    .author-bar .danger { border-color: var(--blood); color: var(--blood); }
    .author-bar .danger:hover { background: var(--blood); color: var(--paper); }

    .editor-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-top: 1.5rem;
    }
    @media (max-width: 960px) {
      .editor-layout { grid-template-columns: 1fr; }
    }

    .editor-pane label {
      display: block; font-family: var(--font-record);
      font-size: 0.8rem; color: var(--ink-faded);
      margin: 0.75rem 0 0.25rem;
    }
    .editor-pane label:first-child { margin-top: 0; }
    .editor-pane input[type="text"],
    .editor-pane input[type="date"],
    .editor-pane select {
      width: 100%; box-sizing: border-box;
      font-family: var(--font-record); font-size: 0.9rem;
      padding: 0.3rem 0.5rem;
      background: var(--paper); color: var(--ink);
      border: 1px solid var(--ink-faded);
    }
    .editor-pane textarea {
      width: 100%; box-sizing: border-box;
      min-height: 60vh; resize: vertical;
      font-family: var(--font-record); font-size: 0.9rem;
      line-height: 1.6; padding: 0.75rem;
      background: var(--paper); color: var(--ink);
      border: 1px solid var(--ink-faded);
      tab-size: 4;
    }
    .editor-pane .field-row {
      display: grid; grid-template-columns: 1fr 1fr 1fr;
      gap: 0.75rem;
    }
    @media (max-width: 640px) {
      .editor-pane .field-row { grid-template-columns: 1fr; }
    }

    .preview-pane iframe {
      width: 100%; min-height: 70vh; border: 1px solid var(--ink-faded);
      background: var(--paper);
    }
    .preview-pane h3 {
      font-family: var(--font-record); font-size: 0.8rem;
      color: var(--ink-faded); margin: 0 0 0.5rem;
    }

    .badge {
      display: inline-block; font-family: var(--font-record);
      font-size: 0.7rem; padding: 0.1rem 0.4rem;
      border: 1px solid var(--ink-faded); color: var(--ink-faded);
      vertical-align: middle; margin-left: 0.5rem;
    }
    .badge--draft { border-color: var(--blood); color: var(--blood); }

    .flash {
      font-family: var(--font-record); font-size: 0.85rem;
      padding: 0.5rem 1rem; margin-top: 1rem;
      border-left: 3px solid var(--blood);
      background: var(--paper);
      white-space: pre-wrap; word-break: break-word;
    }
  </style>
</head>
<body>
<main class="sheet">
  <header class="masthead" id="top">
    <h1>PIPE-WORKS</h1>
    <p class="strapline">{{ strapline }}</p>
  </header>
"""

SHELL_BOTTOM = """\
</main>
</body>
</html>
"""

# ----- Dashboard ----------------------------------------------------------

DASHBOARD = SHELL_TOP + """\
  <section class="notice">
    <p>Write markdown. Preview with the real stylesheet. Publish when ready.</p>
    <div class="author-bar">
      <form method="post" action="{{ url_for('publish') }}">
        <button type="submit">Publish</button>
      </form>
      <form method="post" action="{{ url_for('git_commit') }}">
        <button type="submit">Commit</button>
      </form>
      <form method="post" action="{{ url_for('git_push') }}">
        <button type="submit">Push</button>
      </form>
      <form method="post" action="{{ url_for('open_site') }}">
        <button type="submit">Open Site</button>
      </form>
    </div>
  </section>

  {% if flash_msg %}
  <pre class="flash">{{ flash_msg }}</pre>
  {% endif %}

  <section class="ledger">
    <h3>CHALKBOARD</h3>
    <ul>
    {% for a in chalkboard %}
      <li>
        <a href="{{ url_for('edit', section='chalkboard', slug=a.slug) }}">{{ a.title }}</a>
        {% if a.date %}<span class="badge">{{ a.date }}</span>{% endif %}
        {% if a.draft %}<span class="badge badge--draft">draft</span>{% endif %}
      </li>
    {% endfor %}
      <li><a href="{{ url_for('new', section='chalkboard') }}">+ New chalkboard article</a></li>
    </ul>
  </section>

  <section class="ledger">
    <h3>NOTICES</h3>
    <ul>
    {% for a in notices %}
      <li>
        <a href="{{ url_for('edit', section='notices', slug=a.slug) }}">{{ a.title }}</a>
        {% if a.date %}<span class="badge">{{ a.date }}</span>{% endif %}
        {% if a.draft %}<span class="badge badge--draft">draft</span>{% endif %}
      </li>
    {% endfor %}
      <li><a href="{{ url_for('new', section='notices') }}">+ New notice</a></li>
    </ul>
  </section>
""" + SHELL_BOTTOM

# ----- Editor -------------------------------------------------------------

EDITOR = SHELL_TOP + """\
  <section class="notice">
    <p>
      <a href="{{ url_for('dashboard') }}">&larr; Back to desk</a>
    </p>
  </section>

  <form method="post" action="{{ url_for('save') }}" id="editor-form">
    <input type="hidden" name="section" value="{{ section }}" />
    <input type="hidden" name="original_slug" value="{{ slug }}" />

    <div class="editor-pane">
      <div class="field-row">
        <div>
          <label for="slug">Filename (slug)</label>
          <input id="slug" name="slug" type="text" value="{{ slug }}"
                 {% if editing %}readonly{% endif %}
                 placeholder="auto-generated-from-title" />
        </div>
        <div>
          <label for="date">Date</label>
          <input id="date" name="date" type="date" value="{{ meta.date or today }}" />
        </div>
        <div>
          <label for="draft-toggle">Status</label>
          <select id="draft-toggle" name="draft">
            <option value="" {% if not meta.draft %}selected{% endif %}>Published</option>
            <option value="true" {% if meta.draft %}selected{% endif %}>Draft</option>
          </select>
        </div>
      </div>

      <label for="title">Title</label>
      <input id="title" name="title" type="text" value="{{ meta.title or '' }}"
             placeholder="Article title" />

      <label for="strapline-field">Strapline</label>
      <input id="strapline-field" name="strapline" type="text"
             value="{{ meta.strapline or '' }}"
             placeholder="Appears under PIPE-WORKS masthead" />

      <div class="author-bar">
        <button type="submit">Save</button>
        <a href="{{ url_for('dashboard') }}">Cancel</a>
        {% if editing %}
        <button type="button" class="danger" id="delete-btn">Delete</button>
        {% endif %}
      </div>
    </div>

    <div class="editor-layout">
      <div class="editor-pane">
        <label for="body">Markdown</label>
        <textarea id="body" name="body" placeholder="Write here...">{{ body }}</textarea>
      </div>

      <div class="preview-pane">
        <h3>PREVIEW</h3>
        <iframe id="preview-frame" sandbox="allow-same-origin"></iframe>
      </div>
    </div>
  </form>

  {% if editing %}
  <form method="post" action="{{ url_for('delete') }}" id="delete-form" hidden>
    <input type="hidden" name="section" value="{{ section }}" />
    <input type="hidden" name="slug" value="{{ slug }}" />
  </form>
  {% endif %}

  <script>
    const titleEl = document.getElementById('title');
    const strapEl = document.getElementById('strapline-field');
    const bodyEl = document.getElementById('body');
    const slugEl = document.getElementById('slug');
    const iframe = document.getElementById('preview-frame');
    let timer;

    function debounce(fn, ms) {
      return function() { clearTimeout(timer); timer = setTimeout(fn, ms); };
    }

    function updatePreview() {
      const fd = new FormData();
      fd.append('title', titleEl.value);
      fd.append('strapline', strapEl.value);
      fd.append('body', bodyEl.value);
      fetch('{{ url_for("api_preview") }}', { method: 'POST', body: fd })
        .then(r => r.text())
        .then(h => { iframe.srcdoc = h; });
    }

    const debouncedPreview = debounce(updatePreview, 300);
    titleEl.addEventListener('input', debouncedPreview);
    strapEl.addEventListener('input', debouncedPreview);
    bodyEl.addEventListener('input', debouncedPreview);
    updatePreview();

    /* Auto-slug from title (only for new articles) */
    {% if not editing %}
    titleEl.addEventListener('input', function() {
      slugEl.value = titleEl.value.toLowerCase().trim()
        .replace(/[^\\w\\s-]/g, '').replace(/[\\s_]+/g, '-').replace(/-+/g, '-');
    });
    {% endif %}

    /* Delete confirmation */
    const delBtn = document.getElementById('delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', function() {
        if (confirm('Delete this article? The markdown file will be removed.')) {
          document.getElementById('delete-form').submit();
        }
      });
    }

    /* Tab key inserts spaces in textarea */
    bodyEl.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;
        this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 4;
        debouncedPreview();
      }
    });
  </script>
""" + SHELL_BOTTOM

# ----- Preview (rendered inside iframe) -----------------------------------

PREVIEW_PAGE = """\
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="/site/css/fonts.css" />
  <link rel="stylesheet" href="/site/css/pipe-works-base.css" />
</head>
<body>
  <main class="sheet">
    <header class="masthead" id="top">
      <h1>PIPE-WORKS</h1>
      <p class="strapline">{{ strapline }}</p>
    </header>

    <section class="notice">
      <p><strong>{{ title }}</strong></p>
    </section>

    <section class="rule">
{{ content | safe }}
    </section>
  </main>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def dashboard():
    flash_msg = request.args.get("msg", "")
    return render_template_string(
        DASHBOARD,
        page_title="Author's Desk",
        strapline="The author's desk. Local only.",
        chalkboard=list_articles("chalkboard"),
        notices=list_articles("notices"),
        flash_msg=flash_msg,
    )


@app.route("/new/<section>")
def new(section):
    if section not in ("chalkboard", "notices"):
        return redirect(url_for("dashboard"))
    return render_template_string(
        EDITOR,
        page_title=f"New {section} article",
        strapline="Fresh sheet. Wet ink.",
        section=section,
        slug="",
        meta={},
        body="",
        editing=False,
        today=date.today().isoformat(),
    )


@app.route("/edit/<section>/<slug>")
def edit(section, slug):
    if section not in ("chalkboard", "notices"):
        return redirect(url_for("dashboard"))

    md_file = CONTENT_DIR / section / f"{slug}.md"
    if not md_file.exists():
        return redirect(url_for("new", section=section))

    text = md_file.read_text(encoding="utf-8")
    meta, body = parse_frontmatter(text)

    return render_template_string(
        EDITOR,
        page_title=f"Edit — {meta.get('title', slug)}",
        strapline="Revising. The ink is never quite dry.",
        section=section,
        slug=slug,
        meta=meta,
        body=body,
        editing=True,
        today=date.today().isoformat(),
    )


@app.route("/save", methods=["POST"])
def save():
    section = request.form.get("section", "")
    if section not in ("chalkboard", "notices"):
        return redirect(url_for("dashboard"))

    title = request.form.get("title", "").strip()
    strapline = request.form.get("strapline", "").strip()
    date_str = request.form.get("date", "").strip()
    draft = request.form.get("draft", "").strip()
    body = request.form.get("body", "")
    slug = request.form.get("slug", "").strip()
    original_slug = request.form.get("original_slug", "").strip()

    if not slug:
        slug = slugify(title) if title else "untitled"

    # Build frontmatter
    fm_lines = ["---"]
    if title:
        fm_lines.append(f"title: {title}")
    if strapline:
        fm_lines.append(f"strapline: {strapline}")
    if date_str:
        fm_lines.append(f"date: {date_str}")
    if draft:
        fm_lines.append(f"draft: {draft}")
    fm_lines.append("---")

    content = "\n".join(fm_lines) + "\n\n" + body.rstrip() + "\n"

    out_dir = CONTENT_DIR / section
    out_dir.mkdir(parents=True, exist_ok=True)

    # If slug changed, remove old file
    if original_slug and original_slug != slug:
        old = out_dir / f"{original_slug}.md"
        if old.exists():
            old.unlink()

    out_file = out_dir / f"{slug}.md"
    out_file.write_text(content, encoding="utf-8")

    return redirect(url_for("edit", section=section, slug=slug))


@app.route("/delete", methods=["POST"])
def delete():
    section = request.form.get("section", "")
    slug = request.form.get("slug", "")

    if section in ("chalkboard", "notices") and slug:
        md_file = CONTENT_DIR / section / f"{slug}.md"
        if md_file.exists():
            md_file.unlink()

    return redirect(url_for("dashboard", msg="Deleted."))


@app.route("/publish", methods=["POST"])
def publish():
    result = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "publish.py")],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
    )
    msg = "Published." if result.returncode == 0 else f"Error: {result.stderr}"
    return redirect(url_for("dashboard", msg=msg))


@app.route("/git/commit", methods=["POST"])
def git_commit():
    # Stage content and generated HTML
    paths = ["content/", "site/ramblings/"]
    subprocess.run(["git", "add"] + paths, cwd=str(ROOT))

    # Check if there is anything staged
    status = subprocess.run(
        ["git", "diff", "--cached", "--quiet"],
        cwd=str(ROOT),
    )
    if status.returncode == 0:
        return redirect(url_for("dashboard", msg="Nothing to commit."))

    # Try commit — pre-commit hooks may fix files and fail on first pass
    for attempt in range(2):
        result = subprocess.run(
            ["git", "commit", "-m", "Publish articles"],
            capture_output=True,
            text=True,
            cwd=str(ROOT),
        )
        if result.returncode == 0:
            return redirect(url_for("dashboard", msg="Committed."))

        # Hooks may have modified files (prettier, trailing whitespace, etc.)
        # Re-stage and retry once
        if attempt == 0:
            subprocess.run(["git", "add"] + paths, cwd=str(ROOT))
            # If nothing is staged after re-add, hooks fixed everything
            # but there may be a lint error that won't auto-fix
            check = subprocess.run(
                ["git", "diff", "--cached", "--quiet"], cwd=str(ROOT)
            )
            if check.returncode == 0:
                # Nothing left to commit after hook fixes
                break

    # If we get here, commit failed even after retry — show hook output
    output = (result.stdout + "\n" + result.stderr).strip()
    # Pull out actionable lines (failures and file-level errors)
    lines = []
    for line in output.splitlines():
        if "Failed" in line or line.startswith("content/") or line.startswith("site/"):
            lines.append(line)
    summary = "\n".join(lines) if lines else output
    msg = f"Commit failed:\n{summary}"
    return redirect(url_for("dashboard", msg=msg))


@app.route("/git/push", methods=["POST"])
def git_push():
    result = subprocess.run(
        ["git", "push"],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
    )
    if result.returncode == 0:
        msg = "Pushed."
    else:
        msg = f"Push failed: {result.stderr.strip()}"
    return redirect(url_for("dashboard", msg=msg))


@app.route("/open", methods=["POST"])
def open_site():
    webbrowser.open("https://pipe-works.org/ramblings/")
    return redirect(url_for("dashboard", msg="Opened pipe-works.org in browser."))


@app.route("/api/preview", methods=["POST"])
def api_preview():
    title = request.form.get("title", "")
    strapline = request.form.get("strapline", "")
    body = request.form.get("body", "")

    content_html = md_to_html(body)

    return render_template_string(
        PREVIEW_PAGE,
        title=title,
        strapline=strapline,
        content=content_html,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Pipe-Works article author UI")
    parser.add_argument("--port", type=int, default=5555, help="Port (default: 5555)")
    args = parser.parse_args()

    print(f"\n  Pipe-Works Author — http://localhost:{args.port}\n")
    app.run(host="127.0.0.1", port=args.port, debug=True)


if __name__ == "__main__":
    main()
