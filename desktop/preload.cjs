const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("screenshotEditorFiles", {
  open: (request) => ipcRenderer.invoke("files:open", request),
  save: (request) => ipcRenderer.invoke("files:save", request),
});
