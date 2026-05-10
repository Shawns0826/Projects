# Projects

Application security case studies and templates. The **live portfolio** is built with [**Jekyll**](https://jekyllrb.com/) and deployed to **GitHub Pages** via GitHub Actions.

**Site (after Pages is enabled):** [https://shawns0826.github.io/Projects/](https://shawns0826.github.io/Projects/)

## Repository layout

| Path | Purpose |
|------|---------|
| `_case_studies/` | **Canonical published posts**—each `.md` file becomes a page on the site |
| `_layouts/`, `assets/css/` | Theme (layouts + SCSS → CSS) |
| `templates/` | Starters for Hashnode or drafts (excluded from the site build) |
| `projects/` | Optional workspace for notes (excluded from the site build) |

## GitHub Pages setup

1. Repo → **Settings** → **Pages** → **Build and deployment** → Source: **GitHub Actions**.
2. Push to `main`; the workflow `.github/workflows/jekyll-gh-pages.yml` builds with `github-pages` and deploys `_site`.
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

Body uses normal Markdown; fenced code blocks get syntax highlighting via Rouge.
