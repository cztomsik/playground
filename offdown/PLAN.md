# OffDown - Markdown Editor App

## Project Structure

```
offdown/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── file-worker.js
│   └── marked.min.js
```

## Features

- **Editor**: `<textarea>` for raw markdown input.
- **Preview**: `<div>` rendering markdown as HTML via `marked.js`.
- **Toggle**: button to switch between Edit and Preview modes.
- **No toolbar** (raw markdown editing only).

### File Operations

- **Open file**: Chrome uses `showOpenFilePicker()`; Safari falls back to `<input type="file">`.
- **Save / Auto-save**:
  - Chrome: `showSaveFilePicker()` → writable stream.
  - Safari: Origin-private FS via `navigator.storage.getDirectory()` + Worker + `FileSystemSyncAccessHandle`.
- **Export**: `<a download>` link to download `.md` file (works everywhere).

### Theme

- Auto-detect via `prefers-color-scheme: dark` CSS media query.
- Manual light/dark toggle button.

### Offline

- `marked.min.js` bundled locally (no CDN dependency).
- `marked` loaded from local `js/marked.min.js` via `<script>` tag.

### Dependencies

- `marked` (latest stable) — local copy for offline use.

---

## Implementation Steps

- [x] 1. Set up project structure (index.html, css/styles.css, js/app.js, js/file-worker.js)
- [x] 2. Download and bundle `marked.min.js` locally
- [x] 3. Build the HTML layout (textarea, preview div, toggle button, theme toggle, file buttons)
- [x] 4. Implement CSS with light/dark auto-theme and manual override
- [x] 5. Implement JS: toggle edit/preview, render markdown with `marked`
- [x] 6. Implement JS: open file (Chrome picker + Safari `<input>` fallback)
- [x] 7. Implement file-worker.js: Safari write via `FileSystemSyncAccessHandle`
- [x] 8. Implement JS: save file (Chrome picker + Safari origin-private FS)
- [x] 9. Implement JS: export/download `.md` file
- [ ] 10. Test and polish (responsive layout, edge cases, offline check)
