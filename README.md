# Writing portfolio

Markdown-first layout for case studies and project write-ups. Publish from here to GitHub (`*.md` renders in the repo), GitHub Pages, or paste into [Hashnode](https://hashnode.com/) / other static hosts.

## Layout

| Path | Purpose |
|------|---------|
| `templates/` | Starter Markdown files—copy one into a new project folder and fill in |
| `assets/images/` | Shared images (logo, diagrams you reuse across posts). Reference as `../../assets/images/filename.png` from a project folder |
| `projects/<slug>/` | One folder per post or case study |
| `projects/<slug>/post.md` | Main article (rename if your platform prefers `index.md`) |
| `projects/<slug>/images/` | Images only for that piece. Reference as `./images/filename.png` from `post.md` |

## Quick start

1. Copy `templates/case-study.md` (or another template) into `projects/your-project-slug/post.md`.
2. Add images under `projects/your-project-slug/images/`.
3. Use relative paths so files stay portable: `./images/hero.png`.

See `projects/authentication-bypass-client-side-device-binding/post.md` for the first published case study.
