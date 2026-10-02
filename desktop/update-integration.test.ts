import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);
const desktopPath = fileURLToPath(new URL(".", import.meta.url));

async function launch(packaged = true, platform = "win32") {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const windows: { options: Record<string, any>; loadFile: ReturnType<typeof vi.fn> }[] = [];
  const net = { fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({
    tag_name: "v2026.10.1", draft: false, prerelease: false,
    assets: [{ name: "ShotMagic.exe", size: 100, state: "uploaded" }],
  }))) };
  const shell = { openExternal: vi.fn().mockResolvedValue(undefined) };
  class BrowserWindow {
    static getAllWindows() { return windows; }
    constructor(options: Record<string, any>) {
      windows.push({ options, loadFile: this.loadFile });
    }
    once() {}
    show() {}
    webContents = { setWindowOpenHandler() {}, on() {} };
    loadFile = vi.fn();
    loadURL = vi.fn();
  }
  const electron = {
    app: { isPackaged: packaged, getVersion: () => "2026.10.0", quit: vi.fn(), on: vi.fn(), whenReady: () => Promise.resolve() },
    BrowserWindow, ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler) },
    dialog: {}, net, shell,
  };
  runInNewContext(readFileSync(new URL("main.cjs", import.meta.url), "utf8"), {
    require: (name: string) => name === "electron" ? electron : name === "electron-squirrel-startup" ? false : name === "./updates.cjs" ? require("./updates.cjs") : require(name),
    __dirname: desktopPath, process: { platform }, URL,
  });
  await Promise.resolve();
  return { handlers, windows, net, shell };
}

function sender(url = new URL("../dist/index.html", import.meta.url).href, subframe = false) {
  const frame = { url };
  return { senderFrame: frame, sender: { mainFrame: subframe ? {} : frame } };
}

test("packaged Windows startup enables the restricted preload bridge and checks through the real IPC handlers", async () => {
  const { handlers, windows, net, shell } = await launch();
  expect(windows[0].options.webPreferences).toMatchObject({
    contextIsolation: true, nodeIntegration: false, sandbox: true,
    additionalArguments: ["--shotmagic-update-checks"],
  });
  expect(await handlers.get("updates:check")!(sender())).toEqual({
    status: "available", currentVersion: "2026.10.0", version: "2026.10.1",
  });
  expect(net.fetch).toHaveBeenCalledTimes(1);
  expect(shell.openExternal).not.toHaveBeenCalled();
  await handlers.get("updates:open-release")!(sender(), "https://evil.example");
  expect(shell.openExternal).toHaveBeenCalledWith("https://github.com/fkeenv/shotmagic/releases/tag/v2026.10.1");
});

test.each([
  ["https://evil.example", false],
  ["file:///tmp/other.html", false],
  [undefined, true],
])("rejects update IPC from %s (subframe=%s)", async (url, subframe) => {
  const { handlers, net } = await launch();
  expect(() => handlers.get("updates:check")!(sender(url, subframe))).toThrow("Untrusted");
  expect(net.fetch).not.toHaveBeenCalled();
});

test.each([[false, "win32"], [true, "darwin"], [true, "linux"]])("does not enable updates for packaged=%s platform=%s", async (packaged, platform) => {
  const { handlers, windows, net } = await launch(packaged as boolean, platform as string);
  expect(windows[0].options.webPreferences.additionalArguments).toEqual([]);
  expect(() => handlers.get("updates:check")!(sender())).toThrow("Untrusted");
  expect(net.fetch).not.toHaveBeenCalled();
});

test.each([false, true])("preload exposes fixed update methods only when enabled=%s", async (enabled) => {
  const exposed = new Map();
  const invoke = vi.fn().mockResolvedValue(undefined);
  runInNewContext(readFileSync(new URL("preload.cjs", import.meta.url), "utf8"), {
    require: () => ({ contextBridge: { exposeInMainWorld: (name: string, value: unknown) => exposed.set(name, value) }, ipcRenderer: { invoke } }),
    process: { argv: enabled ? ["--shotmagic-update-checks"] : [] },
  });
  expect(exposed.has("shotMagicUpdates")).toBe(enabled);
  if (enabled) {
    const bridge = exposed.get("shotMagicUpdates");
    expect(Object.keys(bridge)).toEqual(["check", "openRelease"]);
    await bridge.check();
    await bridge.openRelease("https://evil.example");
    expect(invoke).toHaveBeenNthCalledWith(1, "updates:check");
    expect(invoke).toHaveBeenNthCalledWith(2, "updates:open-release");
  }
});
