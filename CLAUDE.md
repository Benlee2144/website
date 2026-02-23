# CLAUDE.md

This file provides context for AI assistants working on this repository.

## Project Overview

**NovaBots Clone** — a static single-page landing website for the NovaBots trading bot. The site promotes the Nova trading bot and links users to a Telegram bot. It is hosted via **GitHub Pages**.

## Repository Structure

```
website/
├── index.html                      # Main (and only) page — self-contained HTML with inline CSS
├── .github/
│   └── workflows/
│       ├── static.yml              # GitHub Actions workflow for deploying to GitHub Pages
│       └── index.html              # Duplicate of static.yml (identical content, likely uploaded by mistake)
└── CLAUDE.md                       # This file
```

## Tech Stack

- **Plain HTML + CSS** — no build tools, no JavaScript frameworks, no bundler
- **Google Fonts** — `Inter` (weights 400, 700) loaded via CDN
- **CSS animations** — gradient background shift, fade-in effects, gradient text
- **GitHub Pages** — static hosting, deployed from the `main` branch

## Development Workflow

### Local Development

No build step is required. Open `index.html` directly in a browser or use any local static server:

```bash
# Python
python3 -m http.server 8000

# Node.js (npx)
npx serve .
```

### Deployment

Deployment is automated via GitHub Actions (`.github/workflows/static.yml`):

- **Trigger**: Push to `main` branch, or manual `workflow_dispatch`
- **Process**: Checks out the repo, uploads the entire repo directory as a Pages artifact, then deploys to GitHub Pages
- **Concurrency**: Only one deployment runs at a time; in-progress deployments are not cancelled

### Branching

- `master` is the primary local branch (note: the GitHub Actions workflow targets `main` — this mismatch may need to be resolved)
- Feature branches use the `claude/` prefix when created by AI assistants

## Code Conventions

### HTML / CSS

- All styles are **inline** in `<style>` within `index.html` — there are no external CSS files
- The page uses a **single-file architecture**: everything (markup, styles) lives in `index.html`
- CSS uses `box-sizing: border-box` globally via the `*` selector reset
- Colors follow a dark theme palette: `#1a1a2e`, `#16213e`, `#0f3460` (background gradient), `#0088cc` (Telegram button)
- Animations use `@keyframes` with `linear` or `ease-in-out` timing
- Font sizes use `rem` units
- The layout is centered with flexbox (`display: flex; align-items: center; justify-content: center`)

### Naming

- CSS classes use **kebab-case** (e.g., `telegram-button`, `nova`)
- No BEM or other formal methodology is used

## Key Details for AI Assistants

1. **This is a very simple static site** — do not introduce build tools, frameworks, or unnecessary complexity.
2. **All changes go in `index.html`** unless adding entirely new pages or assets.
3. **No JavaScript exists yet** — if adding interactivity, keep it minimal and inline unless the scope warrants a separate file.
4. **The `.github/workflows/index.html` file is a duplicate** of `static.yml` (identical YAML content with an `.html` extension). This is likely an accidental upload and can be cleaned up.
5. **Branch mismatch**: The GitHub Actions workflow deploys from `main`, but the local default branch is `master`. Verify which branch GitHub considers the default before making deployment changes.
6. **No tests, linters, or formatters** are configured. There is no `package.json` or any dependency management.
7. **External link**: The Telegram button links to `https://t.me/TradeonNovaBot?start=r-0R601O` — do not modify this URL without explicit permission.
