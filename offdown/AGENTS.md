# OffDown - Project Context

## System Environment

- **Node.js**: v24.14.1 (`node -e "..."` for quick JS evaluation)
- **Python**: 3.9.6 (`python3 -c "..."` for quick scripting)
- **uv**: installed at `~/.local/bin/uv`
- **ripgrep**: `rg` available for fast code search (e.g. `rg -o '^\s*(function|const|let|var)\s+\w+' js/`)
- **jq**: available for JSON parsing
- **curl**: available for HTTP requests

Quick computations should use `node -e` for JS or `python3 -c` for Python snippets.
Use `rg` for navigating source code (e.g., `rg -l 'marked' .` to find files referencing marked).

## Project Overview

**OffDown** is an offline-first, zero-dependency (at runtime) markdown editor web app. It uses vanilla HTML/CSS/JS with `marked.js` bundled locally for GFM rendering. No build step, no frameworks — just open `index.html` in a browser.

**Tech stack**: HTML5, CSS3 (custom properties, flexbox), Vanilla JS (IIFE pattern), `marked.min.js` (bundled locally).

**Build command**: None — this is a static app served directly from files.

## Source Structure

| File | Purpose |
|------|---------|
| `index.html` | Entry point. Defines header (Edit/Preview toggle, Open/Save/Export/Theme buttons), editor textarea, and preview div. Loads `marked.min.js` then `app.js`. |
| `css/styles.css` | All styles. CSS custom properties for light/dark themes. Auto-detects OS theme via `prefers-color-scheme`. Responsive layout with mobile breakpoint at 600px. GitHub-flavored markdown preview styling. |
| `js/app.js` | Main application logic (IIFE). Handles mode toggling, theme cycling, file open/save/export with browser API detection, tab key support in textarea. |
| `js/file-worker.js` | Web Worker for Safari's `FileSystemSyncAccessHandle` writes. Required because `createSyncAccessHandle()` only works in workers. Handles origin-private FS writes. |
| `js/marked.min.js` | Bundled minified copy of the marked library for offline markdown rendering. |
| `PLAN.md` | Implementation plan with checklist of completed/pending tasks. |

## Architecture Notes

### File I/O Strategy (browser-detection cascade)

- **Open file**: Chrome/Edge use `showOpenFilePicker()`; Safari falls back to a hidden `<input type="file">`.
- **Save file**: Chrome/Edge use `showSaveFilePicker()` with writable streams. Safari uses origin-private filesystem via `navigator.storage.getDirectory()` + Web Worker (`file-worker.js`) + `createSyncAccessHandle()`. If neither API is available, falls back to `exportFile()`.
- **Export**: Universal `<a download>` blob link approach, works in all browsers.

### Theme System

- Three states: `auto` (follows OS), `light`, `dark`. Cycling: auto → light → dark → auto.
- `auto` removes the `data-theme` attribute, letting the CSS `@media (prefers-color-scheme: dark)` query take effect.
- Manual override sets `[data-theme="light|dark"]` on `<html>`, which takes precedence over the media query due to higher specificity.
- Listens for OS theme changes while in auto mode.

### Editor/Preview Toggle

- Single `<textarea>` (editor) and single `<div>` (preview), toggled via `.hidden` class.
- Preview renders markdown through `marked.parse()` on every mode switch.
- Tab key inserts 2 spaces in the textarea.

### Offline Design

- `marked.min.js` is bundled locally — no CDN fetches.
- No external network calls; the entire app runs from local files.

### Pending Work (from PLAN.md)

- Step 10: Test and polish (responsive layout, edge cases, offline check) — not yet completed.
