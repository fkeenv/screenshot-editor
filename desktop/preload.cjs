const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("screenshotEditorFiles", {
  open: (request) => ipcRenderer.invoke("files:open", request),
  save: (request) => ipcRenderer.invoke("files:save", request),
});

if (process.argv.includes("--shotmagic-update-checks")) {
  contextBridge.exposeInMainWorld("shotMagicUpdates", {
    check: () => ipcRenderer.invoke("updates:check"),
    openRelease: () => ipcRenderer.invoke("updates:open-release"),
  });
}
