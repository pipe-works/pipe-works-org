#!/usr/bin/env python3
"""publish.py — Static site generator for pipe-works.org articles.

Converts markdown files in content/chalkboard/ and content/notices/
to HTML pages styled with the pipe-works.org CSS.

Usage:
    python tools/publish.py              # Build all
    python tools/publish.py --clean      # Remove generated files first
    python tools/publish.py --drafts     # Include draft articles
"""

import argparse
import html
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content"
SITE_DIR = ROOT / "site"
RAMBLINGS_DIR = SITE_DIR / "ramblings"

try:
    import markdown
except ImportError:
    print("Missing dependency: pip install markdown")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Frontmatter
# ---------------------------------------------------------------------------

def parse_frontmatter(text):
    """Parse YAML-like frontmatter between --- markers."""
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


# ---------------------------------------------------------------------------
# Markdown conversion
# ---------------------------------------------------------------------------

def md_to_html(text):
    """Convert markdown body to HTML fragment."""
    md = markdown.Markdown(
        extensions=["fenced_code", "smarty", "tables"],
        output_format="html5",
    )
    return md.convert(text)


# ---------------------------------------------------------------------------
# HTML templates
# ---------------------------------------------------------------------------

ARTICLE_TEMPLATE = """\
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>pipe-works.org &mdash; {title_escaped}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <link rel="stylesheet" href="../../css/fonts.css" />
    <link rel="stylesheet" href="../../css/pipe-works-base.css" />
  </head>

  <body>
    <main class="sheet">
      <header class="masthead" id="top">
        <h1>PIPE-WORKS</h1>
        <p class="strapline">{strapline_escaped}</p>
      </header>

      <section class="notice">
        <p><strong>{title_escaped}</strong></p>
        <p>
          <a href="index.html">&larr; Back to {back_label}</a>
        </p>
      </section>

      <section class="rule">
{content}
      </section>

      <footer class="imprint">
        <p class="small">{date_str}</p>
      </footer>
    </main>
  </body>
</html>
"""

INDEX_TEMPLATE = """\
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>pipe-works.org &mdash; {section_title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <link rel="stylesheet" href="../../css/fonts.css" />
    <link rel="stylesheet" href="../../css/pipe-works-base.css" />
  </head>

  <body>
    <main class="sheet">
      <header class="masthead" id="top">
        <h1>PIPE-WORKS</h1>
        <p class="strapline">{strapline_escaped}</p>
      </header>

      <section class="notice">
        <p>{description}</p>
        <p>
          <a href="../index.html">&larr; Back to ramblings</a>
        </p>
      </section>

      <section class="ledger">
        <h3>{section_upper}</h3>
        <ul>
{article_links}
        </ul>
      </section>
    </main>
  </body>
</html>
"""


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------

SECTION_CONFIG = {
    "chalkboard": {
        "back_label": "chalkboard",
        "section_title": "Chalkboard",
        "strapline": "Long thoughts, short chalk.",
        "description": "Longer pieces. Written slowly, posted when dry.",
    },
    "notices": {
        "back_label": "notices",
        "section_title": "Notices",
        "strapline": "Pinned to the board with bent nails.",
        "description": "Short posts. Quick observations nailed to the wall.",
    },
}


def build_section(section_name, *, include_drafts=False):
    """Build all articles for a content section. Returns list of article info."""
    cfg = SECTION_CONFIG[section_name]
    content_path = CONTENT_DIR / section_name
    output_path = RAMBLINGS_DIR / section_name

    if not content_path.exists():
        print(f"  No content directory: {content_path}")
        return []

    md_files = sorted(content_path.glob("*.md"))
    if not md_files:
        print(f"  No markdown files in {content_path}")
        return []

    output_path.mkdir(parents=True, exist_ok=True)

    articles = []
    for md_file in md_files:
        text = md_file.read_text(encoding="utf-8")
        meta, body = parse_frontmatter(text)

        # Skip drafts unless requested
        if meta.get("draft", "").lower() in ("true", "yes", "1"):
            if not include_drafts:
                print(f"  [draft] {md_file.name} — skipped")
                continue

        title = meta.get("title", md_file.stem.replace("-", " ").title())
        strapline = meta.get("strapline", cfg["strapline"])
        article_date = meta.get("date", "")
        slug = md_file.stem

        content_html = md_to_html(body)

        page_html = ARTICLE_TEMPLATE.format(
            title_escaped=html.escape(title),
            strapline_escaped=html.escape(strapline),
            back_label=cfg["back_label"],
            content=content_html,
            date_str=html.escape(article_date),
        )

        out_file = output_path / f"{slug}.html"
        out_file.write_text(page_html, encoding="utf-8")
        print(f"  {md_file.name} -> {out_file.relative_to(ROOT)}")

        articles.append({"title": title, "date": article_date, "slug": slug})

    # Sort by date descending
    articles.sort(key=lambda a: a.get("date", ""), reverse=True)

    # Generate index page
    lines = []
    for a in articles:
        prefix = f'{a["date"]} &mdash; ' if a["date"] else ""
        lines.append(
            f'          <li><a href="{a["slug"]}.html">'
            f"{prefix}{html.escape(a['title'])}</a></li>"
        )

    index_html = INDEX_TEMPLATE.format(
        section_title=cfg["section_title"],
        section_upper=cfg["section_title"].upper(),
        strapline_escaped=html.escape(cfg["strapline"]),
        description=cfg["description"],
        article_links="\n".join(lines)
        if lines
        else "          <li><em>Nothing pinned yet.</em></li>",
    )

    index_file = output_path / "index.html"
    index_file.write_text(index_html, encoding="utf-8")
    print(f"  -> {index_file.relative_to(ROOT)}")

    return articles


def update_ramblings_index():
    """Point the ramblings hub at the generated index pages."""
    index_path = RAMBLINGS_DIR / "index.html"
    if not index_path.exists():
        print("  Warning: ramblings/index.html not found, skipping")
        return

    text = index_path.read_text(encoding="utf-8")

    text = re.sub(
        r'<li><a href="#">Chalkboard:</a></li>',
        '<li><a href="chalkboard/">Chalkboard</a></li>',
        text,
    )
    text = re.sub(
        r'<li><a href="#">Notices:</a></li>',
        '<li><a href="notices/">Notices</a></li>',
        text,
    )

    index_path.write_text(text, encoding="utf-8")
    print(f"  -> Updated {index_path.relative_to(ROOT)}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Build pipe-works.org articles from markdown."
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove generated article directories before building",
    )
    parser.add_argument(
        "--drafts", action="store_true", help="Include articles marked as draft"
    )
    args = parser.parse_args()

    if args.clean:
        for name in SECTION_CONFIG:
            d = RAMBLINGS_DIR / name
            if d.exists():
                shutil.rmtree(d)
                print(f"Cleaned {d.relative_to(ROOT)}")

    print("Building chalkboard (long-form)...")
    chalkboard = build_section("chalkboard", include_drafts=args.drafts)

    print("\nBuilding notices (short-form)...")
    notices = build_section("notices", include_drafts=args.drafts)

    print("\nUpdating ramblings index...")
    update_ramblings_index()

    total = len(chalkboard) + len(notices)
    print(f"\nDone. {total} article(s) published.")


if __name__ == "__main__":
    main()
