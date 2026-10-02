const { app, BrowserWindow, dialog, ipcMain, net, shell } = require("electron");
const { createUpdateChecker, registerUpdateHandlers } = require("./updates.cjs");
const { readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { fileURLToPath } = require("node:url");

if (require("electron-squirrel-startup")) app.quit();

const RENDERER_FILE = path.join(__dirname, "../dist/index.html");
const DEVELOPMENT_ORIGIN = "http://127.0.0.1:5173";
const UPDATES_ENABLED = app.isPackaged && process.platform === "win32";
const IMAGE_EXTENSION_BY_MEDIA_TYPE = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const IMAGE_FILTER = {
  name: "Images",
  extensions: ["jpg", "jpeg", "png", "webp", "gif", "bmp"],
};
const PROJECT_FILTER = {
  name: "Screenshot editor projects",
  extensions: ["json"],
};

function ownerWindow(event) {
  return BrowserWindow.fromWebContents(event.sender) ?? undefined;
}

function validateOpenRequest(request) {
  if (
    !request ||
    !["images", "projects"].includes(request.kind) ||
    typeof request.multiple !== "boolean"
  ) {
    throw new Error("Invalid open-file request.");
  }
}

function validateSaveRequest(request) {
  if (
    !request ||
    !["project", "image"].includes(request.kind) ||
    typeof request.filename !== "string" ||
    !ArrayBuffer.isView(request.bytes) ||
    typeof request.mediaType !== "string" ||
    (request.kind === "project" && request.mediaType !== "application/json") ||
    (request.kind === "image" &&
      !Object.hasOwn(IMAGE_EXTENSION_BY_MEDIA_TYPE, request.mediaType))
  ) {
    throw new Error("Invalid save-file request.");
  }
}

function registerFileDialogs() {
  ipcMain.handle("files:open", async (event, request) => {
    validateOpenRequest(request);
    const result = await dialog.showOpenDialog(ownerWindow(event), {
      title: request.kind === "images" ? "Import image" : "Open project",
      filters: [request.kind === "images" ? IMAGE_FILTER : PROJECT_FILTER],
      properties: [
        "openFile",
        ...(request.multiple ? ["multiSelections"] : []),
      ],
    });
    if (result.canceled) return [];

    return await Promise.all(
      result.filePaths.map(async (filePath) => ({
        name: path.basename(filePath),
        bytes: new Uint8Array(await readFile(filePath)),
      })),
    );
  });

  ipcMain.handle("files:save", async (event, request) => {
    validateSaveRequest(request);
    const result = await dialog.showSaveDialog(ownerWindow(event), {
      title: request.kind === "project" ? "Save project" : "Export image",
      defaultPath: request.filename,
      filters:
        request.kind === "project"
          ? [PROJECT_FILTER]
          : [{
              name: "Image",
              extensions: [IMAGE_EXTENSION_BY_MEDIA_TYPE[request.mediaType]],
            }],
    });
    if (result.canceled || !result.filePath) return false;

    await writeFile(result.filePath, Buffer.from(request.bytes));
    return true;
  });
}

function createWindow() {
  const window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#e9edf6",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: UPDATES_ENABLED ? ["--shotmagic-update-checks"] : [],
    },
  });

  window.once("ready-to-show", () => window.show());

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    let allowed = false;
    try {
      const destination = new URL(url);
      allowed = app.isPackaged
        ? destination.protocol === "file:" &&
          path.resolve(fileURLToPath(destination)) === path.resolve(RENDERER_FILE)
        : destination.origin === DEVELOPMENT_ORIGIN;
    } catch {
      allowed = false;
    }
    if (!allowed) event.preventDefault();
  });

  if (app.isPackaged) {
    void window.loadFile(RENDERER_FILE);
  } else {
    void window.loadURL(DEVELOPMENT_ORIGIN);
  }
}

app.whenReady().then(() => {
  registerFileDialogs();
  const checker = createUpdateChecker({
    currentVersion: app.getVersion(),
    enabled: UPDATES_ENABLED,
    fetchRelease: (...args) => net.fetch(...args),
    openExternal: (url) => shell.openExternal(url),
  });
  registerUpdateHandlers(ipcMain, checker, (event) => {
    if (!UPDATES_ENABLED || event.senderFrame !== event.sender.mainFrame) return false;
    try {
      const url = new URL(event.senderFrame.url);
      return url.protocol === "file:" && path.resolve(fileURLToPath(url)) === path.resolve(RENDERER_FILE);
    } catch {
      return false;
    }
  });
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
