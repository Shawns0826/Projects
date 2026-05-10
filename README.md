# Projects

Application security case studies and templates. The **live portfolio** is built with [**Jekyll**](https://jekyllrb.com/) and deployed to **GitHub Pages** via GitHub Actions.

**Site (after Pages is enabled):** [https://shawns0826.github.io/Projects/](https://shawns0826.github.io/Projects/)

## Repository layout

| Path | Purpose |
|------|---------|
| `_case_studies/` | **Canonical published posts**—each `.md` file becomes a page on the site |
| `_config.yml` | Site URL, plugins, collection definition, and defaults |
| `_data/writing_series.yml` | **Series metadata** for the homepage (`slug`, `title`, `description`, optional `parts_planned`); each post opts in with matching `series` + `series_order` |
| `_layouts/`, `assets/css/` | Theme (layouts + SCSS → CSS) |
| `templates/` | Starters for Hashnode or drafts (excluded from the site build) |
| `projects/` | Optional workspace for notes (excluded from the site build) |

## GitHub Pages setup

1. Repo → **Settings** → **Pages** → **Build and deployment** → Source: **GitHub Actions**.
2. Push to `main`; the workflow `.github/workflows/jekyll-gh-pages.yml` builds with `github-pages` (includes `--future` so upcoming-dated drafts still ship) and deploys `_site`.
3. Private repos need a GitHub plan that includes Pages for private repositories.

## Local preview (optional)

Requires Ruby + Bundler:

```bash
bundle install
bundle exec jekyll serve
```

Open `http://127.0.0.1:4000/Projects/` (include `/Projects` baseurl).

## Adding a case study

Create `_case_studies/your-slug.md` with YAML front matter at the top, for example:

```yaml
---
title: "Your title"
description: "One-line summary for cards and SEO."
tags:
  - security
date: 2026-05-10
---
```

Body uses normal Markdown; fenced code blocks get syntax highlighting via Rouge. Save files as **UTF-8 without BOM**—a BOM before the opening `---` breaks YAML front matter in Jekyll, so posts disappear from the site.

**Dates:** `_config.yml` sets **`future: true`**, and the Pages workflow passes **`--future`**, so posts with a **`date:`** slightly in the future still appear after deploy (Jekyll’s default is to hide them until that calendar day in UTC).

## Series vs standalone

- **Numbered sequence** (e.g. four related essays): add a row in `_data/writing_series.yml` (`slug`, `title`, `description`, optional `parts_planned`). On each post set matching `series: <slug>` and **integer** `series_order: 1` (then `2`, `3`, …). They render together under **Series** with Part badges and prev/next links.
- **Unrelated posts**: omit `series` entirely—they appear under **Standalone · Other articles** only.
- If you set `series` on a post but forget a `writing_series` row in `_data/writing_series.yml`, the site still lists those posts under a fallback block with a reminder to register the slug.
