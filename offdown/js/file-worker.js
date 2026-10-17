/* OffDown - File Worker for Safari FileSystemSyncAccessHandle writes */

self.addEventListener("message", async function (e) {
  var data = e.data;

  if (data.action === "save") {
    try {
      // Get the origin-private root directory
      var root = await navigator.storage.getDirectory();

      // Get or create the file handle
      var fileHandle = await root.getFileHandle(data.fileName, { create: true });

      // Create a sync access handle for writing
      var accessHandle = await fileHandle.createSyncAccessHandle();

      // Truncate to current size (overwrite)
      accessHandle.truncate(0);

      // Encode content and write
      var encoder = new TextEncoder();
      var writeBuffer = encoder.encode(data.content);
      accessHandle.write(writeBuffer, { at: 0 });

      // Flush to disk
      accessHandle.flush();

      // Close the access handle
      accessHandle.close();

      self.postMessage({ success: true, fileName: data.fileName });
    } catch (err) {
      self.postMessage({ success: false, error: err.message });
    }
    self.close();
  }
});
