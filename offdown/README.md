# OffDown

An offline-first, zero-dependency markdown editor web app. No build step, no frameworks — just open `index.html` in a browser.

## Features

- **Edit & Preview** — toggle between raw markdown editing and a rendered GitHub-flavored preview
- **File I/O** — open, save, and export `.md` files with browser-native APIs
- **HTML Paste** — paste rich text from email clients, browsers, or documents; HTML is converted to markdown automatically
- **Themes** — auto (follows OS), light, and dark modes
- **Tab Support** — press Tab in the editor to insert 2 spaces
- **Fully Offline** — `marked.js` bundled locally; no CDN or network calls required

## Usage

1. Open `index.html` in any modern browser
2. Write markdown in the editor
3. Switch to **Preview** to see the rendered output
4. Use **Open**, **Save**, or **Export** for file operations
5. Paste rich content (HTML) directly into the editor — it converts to markdown automatically

## Browser Support

| Feature | Chrome / Edge | Safari | Firefox |
|---------|--------------|--------|---------|
| Open file | `showOpenFilePicker()` | `<input type="file">` fallback | `<input type="file">` fallback |
| Save file | `showSaveFilePicker()` | Origin-private FS + Web Worker | Export fallback |
| Export | Universal blob download | Universal blob download | Universal blob download |
| HTML paste | Supported | Supported | Supported |

## Project Structure

```
offdown/
├── index.html           # Entry point
├── css/
│   └── styles.css       # All styles (light/dark themes, GFM preview)
├── js/
│   ├── app.js           # Main application logic (IIFE)
│   ├── file-worker.js   # Web Worker for Safari origin-private FS writes
│   └── marked.min.js    # Bundled marked library (offline markdown rendering)
├── README.md
└── PLAN.md              # Implementation plan
```

## Tech Stack

- **HTML5** — semantic markup, no frameworks
- **CSS3** — custom properties, flexbox, `prefers-color-scheme` media query, responsive at 600px
- **Vanilla JS** — IIFE pattern, no bundlers
- **marked.js** — local copy for offline GFM rendering

## File I/O Strategy

A browser-detection cascade handles file operations:

- **Open**: Chrome/Edge use the File System Access API (`showOpenFilePicker`). Safari and Firefox fall back to a hidden `<input type="file">`.
- **Save**: Chrome/Edge use `showSaveFilePicker` with writable streams. Safari uses the origin-private filesystem (`navigator.storage.getDirectory`) with a Web Worker and `createSyncAccessHandle`. If neither is available, falls back to export.
- **Export**: Universal blob-download link approach (`<a download>`), works in all browsers.

## Theme System

Three states cycle with the **Theme** button:

1. **Auto** — follows OS preference via `prefers-color-scheme`
2. **Light** — manual override to light theme
3. **Dark** — manual override to dark mode

Manual overrides set `data-theme` on `<html>`, which takes CSS specificity precedence over the auto media query.

## HTML-to-Markdown Conversion

When pasting content that contains HTML (e.g., from email clients), OffDown converts it to markdown using a built-in recursive DOM walker. Supported conversions include:

| HTML Element | Markdown Output |
|-------------|-----------------|
| `<h1>`–`<h6>` | `#`–`######` headers |
| `<strong>`, `<b>` | `**bold**` |
| `<em>`, `<i>` | `_italic_` |
| `<del>`, `<s>`, line-through spans | `~~strikethrough~~` |
| `<a>` | `[text](url)` |
| `<img>` | `![alt](src)` |
| `<code>`, `<pre>` | Inline and fenced code blocks |
| `<blockquote>` | `> quoted text` |
| `<ul>`, `<ol>`, `<li>` | `-` / `1.` lists (nested) |
| `<table>` | Pipe tables |
| `<hr>` | `---` |
| Unknown tags | Children only (graceful fallback) |

`<script>` and `<style>` tags are stripped as a safety measure.

