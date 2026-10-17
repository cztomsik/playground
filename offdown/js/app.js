/* OffDown - Main Application */

(function () {
  "use strict";

  // ===== DOM Elements =====
  const editor = document.getElementById("editor");
  const preview = document.getElementById("preview");
  const btnEdit = document.getElementById("btn-edit");
  const btnPreview = document.getElementById("btn-preview");
  const btnOpen = document.getElementById("btn-open");
  const btnSave = document.getElementById("btn-save");
  const btnExport = document.getElementById("btn-export");
  const btnTheme = document.getElementById("btn-theme");
  const fileInput = document.getElementById("file-input");

  // ===== State =====
  let currentMode = "edit"; // "edit" | "preview"
  let currentFileName = "untitled";
  let themeMode = "auto"; // "auto" | "light" | "dark"

  // ===== Marked Config =====
  if (typeof marked !== "undefined") {
    marked.setOptions({
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // convert \n to <br>
      headerIds: false,
      mangle: false,
    });
  }

  // ===== Theme =====
  function detectAutoTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(mode) {
    if (mode === "auto") {
      document.documentElement.removeAttribute("data-theme");
      themeMode = "auto";
    } else {
      document.documentElement.setAttribute("data-theme", mode);
      themeMode = mode;
    }
    btnTheme.textContent = themeMode === "auto" ? "Auto" : themeMode === "dark" ? "Light" : "Dark";
  }

  function cycleTheme() {
    if (themeMode === "auto") {
      applyTheme("light");
    } else if (themeMode === "light") {
      applyTheme("dark");
    } else {
      applyTheme("auto");
    }
  }

  // Listen for OS theme changes while in auto mode
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    if (themeMode === "auto") applyTheme("auto");
  });

  // ===== Mode Toggle =====
  function setMode(mode) {
    currentMode = mode;
    if (mode === "preview") {
      renderPreview();
      editor.classList.add("hidden");
      preview.classList.remove("hidden");
      btnEdit.classList.remove("active");
      btnPreview.classList.add("active");
    } else {
      editor.classList.remove("hidden");
      preview.classList.add("hidden");
      btnEdit.classList.add("active");
      btnPreview.classList.remove("active");
    }
  }

  function renderPreview() {
    if (typeof marked !== "undefined") {
      preview.innerHTML = marked.parse(editor.value);
    } else {
      preview.textContent = "marked.js not loaded — check that js/marked.min.js exists.";
    }
  }

  // ===== File: Open =====
  function handleOpenFile(file) {
    currentFileName = file.name.replace(/\.(md|markdown|text|txt)$/i, "");
    const reader = new FileReader();
    reader.onload = function (e) {
      editor.value = e.target.result;
      // If in preview mode, re-render
      if (currentMode === "preview") renderPreview();
    };
    reader.readAsText(file);
  }

  // Chrome: showOpenFilePicker
  async function openWithPicker() {
    try {
      const handles = await window.showOpenFilePicker({
        types: [{
          description: "Markdown Files",
          accept: { "text/markdown": [".md", ".markdown"], "text/plain": [".txt"] },
        }],
        multiple: false,
      });
      const handle = handles[0];
      const file = await handle.getFile();
      currentFileName = file.name.replace(/\.(md|markdown|text|txt)$/i, "");
      const text = await file.text();
      editor.value = text;
      if (currentMode === "preview") renderPreview();
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Open failed:", err);
      }
    }
  }

  // Safari: <input type="file"> fallback
  function openWithInput() {
    fileInput.click();
  }

  // Detect which API to use
  const supportsOpenPicker = typeof window.showOpenFilePicker === "function";

  // ===== File: Save =====
  // Chrome: showSaveFilePicker -> writable stream
  async function saveWithPicker() {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: currentFileName + ".md",
        types: [{
          description: "Markdown File",
          accept: { "text/markdown": [".md"] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(editor.value);
      await writable.close();
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Save failed:", err);
      }
    }
  }

  // Safari: origin-private FS via Worker + FileSystemSyncAccessHandle
  // The worker handles createSyncAccessHandle which can only be called in a worker context.
  function saveWithOriginFS() {
    if (!window.Worker) {
      console.warn("Web Workers not supported");
      return;
    }
    // Delegate to worker
    var worker = new Worker("js/file-worker.js");
    worker.postMessage({
      action: "save",
      fileName: currentFileName + ".md",
      content: editor.value,
    });
    worker.addEventListener("message", function (e) {
      if (e.data.success) {
        console.log("Saved to origin-private FS:", e.data.fileName);
      } else {
        console.error("Save failed:", e.data.error);
      }
      worker.terminate();
    });
    worker.addEventListener("error", function (e) {
      console.error("Worker error:", e);
      worker.terminate();
    });
  }

  const supportsSavePicker = typeof window.showSaveFilePicker === "function";
  const supportsOriginFS = typeof navigator.storage !== "undefined" && typeof navigator.storage.getDirectory === "function";

  // ===== File: Export (download .md) =====
  function exportFile() {
    const blob = new Blob([editor.value], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFileName + ".md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ===== Event Listeners =====
  btnEdit.addEventListener("click", function () {
    setMode("edit");
  });

  btnPreview.addEventListener("click", function () {
    setMode("preview");
  });

  btnTheme.addEventListener("click", function () {
    cycleTheme();
  });

  btnOpen.addEventListener("click", function () {
    if (supportsOpenPicker) {
      openWithPicker();
    } else {
      openWithInput();
    }
  });

  fileInput.addEventListener("change", function (e) {
    if (e.target.files.length > 0) {
      handleOpenFile(e.target.files[0]);
      e.target.value = ""; // reset so same file can be re-opened
    }
  });

  btnSave.addEventListener("click", function () {
    if (supportsSavePicker) {
      saveWithPicker();
    } else if (supportsOriginFS) {
      saveWithOriginFS();
    } else {
      // Last resort: just export
      exportFile();
    }
  });

  btnExport.addEventListener("click", exportFile);

  // Tab key support in textarea (insert 2 spaces)
  editor.addEventListener("keydown", function (e) {
    if (e.key === "Tab") {
      e.preventDefault();
      var start = editor.selectionStart;
      var end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + "  " + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
    }
  });

  // ===== HTML-to-Markdown Converter =====
  // Lightweight recursive DOM walker — no external dependencies.
  // Handles common tags: headings, paragraphs, lists, links, code, blockquotes, etc.

  function htmlToMarkdown(html) {
    // Strip any script/style tags to avoid executing malicious content
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");

    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");
    var body = doc.body;

    // Convert inline spans with text-transform or text-decoration
    convertStyleSpans(body);

    return nodeToMarkdown(body, false).trim();
  }

  function convertStyleSpans(node) {
    var spans = node.querySelectorAll("span");
    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      var cs = span.style;
      if (cs && (cs.textTransform === "uppercase" || cs.textTransform === "lowercase" || cs.textTransform === "capitalize")) {
        // text-transform: keep as-is (no md equivalent)
      }
      if (cs && cs.textDecoration === "line-through") {
        // Wrap in strikethrough
        var wrapper = document.createElement("del");
        while (span.firstChild) wrapper.appendChild(span.firstChild);
        span.parentNode.replaceChild(wrapper, span);
      }
    }
  }

  function nodeToMarkdown(node, isBlock) {
    if (node.nodeType === 3) {
      // Text node
      var text = node.textContent;
      if (!isBlock) {
        // Escape markdown-sensitive characters in inline text,
        // but preserve newlines and basic structure
        text = text.replace(/\\/g, "\\\\");
      }
      return text;
    }

    if (node.nodeType !== 1) return "";

    var tag = node.tagName.toLowerCase();
    var result = "";

    switch (tag) {
      case "h1": result = "# " + childrenMarkdown(node) + "\n\n"; break;
      case "h2": result = "## " + childrenMarkdown(node) + "\n\n"; break;
      case "h3": result = "### " + childrenMarkdown(node) + "\n\n"; break;
      case "h4": result = "#### " + childrenMarkdown(node) + "\n\n"; break;
      case "h5": result = "##### " + childrenMarkdown(node) + "\n\n"; break;
      case "h6": result = "###### " + childrenMarkdown(node) + "\n\n"; break;

      case "p":
        result = childrenMarkdown(node).trim() + "\n\n";
        break;

      case "div":
        // Common in email HTML — treat as a paragraph block
        result = childrenMarkdown(node).trim() + "\n\n";
        break;

      case "br":
        result = "\n";
        break;

      case "strong":
      case "b":
        result = "**" + childrenMarkdown(node) + "**";
        break;

      case "em":
      case "i":
        result = "_" + childrenMarkdown(node) + "_";
        break;

      case "del":
      case "s":
        result = "~~" + childrenMarkdown(node) + "~~";
        break;

      case "a":
        var href = node.getAttribute("href");
        var linkText = childrenMarkdown(node).trim();
        if (!linkText) linkText = href || "";
        result = "[" + linkText + "](" + (href || "") + ")";
        break;

      case "img":
        var src = node.getAttribute("src") || "";
        var alt = node.getAttribute("alt") || "";
        result = "![" + alt + "](" + src + ")";
        break;

      case "code":
        if (node.parentElement && node.parentElement.tagName.toLowerCase() === "pre") {
          // Inline code inside a <pre> — let the pre handler deal with it
          return node.textContent;
        }
        result = "`" + node.textContent.replace(/`/g, "\\`") + "`";
        break;

      case "pre":
        var codeContent = node.textContent;
        // Try to get language from a <code> child class
        var lang = "";
        var codeEl = node.querySelector("code");
        if (codeEl && codeEl.className) {
          var match = codeEl.className.match(/language-(\w+)/);
          if (match) lang = match[1];
        }
        result = "```" + lang + "\n" + codeContent.replace(/\n$/, "") + "\n```\n\n";
        break;

      case "blockquote":
        result = "";
        var lines = childrenMarkdown(node).trim().split("\n");
        for (var j = 0; j < lines.length; j++) {
          result += "> " + lines[j] + "\n";
        }
        result += "\n";
        break;

      case "ul":
        result = listToMarkdown(node, "  ", "- ") + "\n";
        break;

      case "ol":
        result = listToMarkdown(node, "  ", "") + "\n";
        break;

      case "li":
        // Handled by listToMarkdown
        result = "";
        break;

      case "hr":
        result = "---\n\n";
        break;

      case "table":
        result = tableToMarkdown(node) + "\n";
        break;

      case "thead":
      case "tbody":
      case "tfoot":
        result = childrenMarkdown(node);
        break;

      case "tr":
        // Handled by tableToMarkdown
        result = "";
        break;

      case "th":
      case "td":
        // Handled by tableToMarkdown
        result = "";
        break;

      case "head":
      case "html":
      case "body":
      case "meta":
      case "link":
      case "title":
        result = childrenMarkdown(node);
        break;

      default:
        // For unknown tags (common in email: <font>, <td>, etc.) — just process children
        result = childrenMarkdown(node);
        break;
    }

    return result;
  }

  function childrenMarkdown(parent) {
    var result = "";
    for (var i = 0; i < parent.childNodes.length; i++) {
      result += nodeToMarkdown(parent.childNodes[i], isBlockElement(parent.tagName.toLowerCase()));
    }
    return result;
  }

  function isBlockElement(tag) {
    var blocks = ["div","p","h1","h2","h3","h4","h5","h6","ul","ol","li","blockquote","pre","hr","table","thead","tbody","tfoot","tr","th","td","section","article","header","footer","main","nav"];
    return blocks.indexOf(tag) !== -1;
  }

  function listToMarkdown(listEl, indent, bullet) {
    var result = "";
    var count = 0;
    for (var i = 0; i < listEl.children.length; i++) {
      var item = listEl.children[i];
      if (item.tagName.toLowerCase() !== "li") continue;
      count++;

      var itemBullet = bullet === "" ? count + ". " : bullet;
      var itemContent = "";

      for (var j = 0; j < item.childNodes.length; j++) {
        var child = item.childNodes[j];
        if (child.nodeType === 3) {
          itemContent += child.textContent;
        } else if (child.nodeType === 1) {
          var childTag = child.tagName.toLowerCase();
          if (childTag === "ul" || childTag === "ol") {
            itemContent += "\n" + listToMarkdown(child, indent + "  ", childTag === "ul" ? "- " : "");
          } else {
            itemContent += nodeToMarkdown(child, false);
          }
        }
      }

      // Clean up inline content: collapse whitespace, trim
      itemContent = itemContent.replace(/\s+/g, " ").trim();
      result += indent + itemBullet + itemContent + "\n";
    }
    return result;
  }

  function tableToMarkdown(tableEl) {
    var rows = [];
    var allRows = tableEl.querySelectorAll("tr");
    for (var i = 0; i < allRows.length; i++) {
      var cells = [];
      var row = allRows[i];
      var rowCells = row.querySelectorAll("th, td");
      for (var j = 0; j < rowCells.length; j++) {
        cells.push(rowCells[j].textContent.trim());
      }
      rows.push(cells);
    }

    if (rows.length === 0) return "";

    var result = "| " + rows[0].join(" | ") + " |\n";
    result += "| " + rows[0].map(function() { return "---"; }).join(" | ") + " |\n";
    for (var k = 1; k < rows.length; k++) {
      result += "| " + rows[k].join(" | ") + " |\n";
    }
    return result;
  }

  // ===== HTML Paste Handler =====
  editor.addEventListener("paste", function (e) {
    var clipboardData = e.clipboardData || window.clipboardData;
    var html = clipboardData.getData("text/html");

    if (html && html.indexOf("<") !== -1) {
      // HTML detected in clipboard — convert it
      e.preventDefault();
      var md = htmlToMarkdown(html);

      // Insert at cursor position (or replace selection)
      var start = editor.selectionStart;
      var end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + md + editor.value.substring(end);

      // Place cursor after inserted text
      var newPos = start + md.length;
      editor.selectionStart = editor.selectionEnd = newPos;
    }
    // If no HTML in clipboard, let the default paste behavior handle it (plain text)
  });

  // ===== Init =====
  applyTheme("auto");
  setMode("edit");
})();
