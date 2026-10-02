import { createRequire } from "node:module";
import { expect, test, vi } from "vitest";

const { createUpdateChecker, registerUpdateHandlers } = createRequire(import.meta.url)("./updates.cjs");

function setup(version = "v2026.10.1", currentVersion = "2026.10.0") {
  const release = { tag_name: version, draft: false, prerelease: false,
    assets: [{ name: "ShotMagicSetup.exe", state: "uploaded", size: 100 }] };
  const fetchRelease = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => release });
  const openExternal = vi.fn().mockResolvedValue(undefined);
  const checker = createUpdateChecker({ currentVersion, enabled: true, fetchRelease, openExternal });
  return { checker, release, fetchRelease, openExternal };
}

test.each([
  ["v2026.10.1", "2026.10.0", "available"],
  ["2026.10.0", "2026.9.10", "available"],
  ["2027.1.0", "2026.12.9", "available"],
  ["2026.10.0", "2026.10.0", "current"],
  ["2026.9.10", "2026.10.0", "current"],
])("compares %s numerically against %s", async (next, current, status) => {
  expect(await setup(next, current).checker.check()).toMatchObject({ status, currentVersion: current });
});

test("uses only public release metadata with a timeout and coalesces concurrent checks", async () => {
  const { checker, fetchRelease } = setup();
  const first = checker.check();
  expect(checker.check()).toBe(first);
  await first;
  expect(fetchRelease).toHaveBeenCalledTimes(1);
  expect(fetchRelease).toHaveBeenCalledWith("https://api.github.com/repos/fkeenv/shotmagic/releases/latest",
    expect.objectContaining({ signal: expect.any(AbortSignal), redirect: "error", credentials: "omit" }));
  await checker.check();
  expect(fetchRelease).toHaveBeenCalledTimes(2);
});

test("opens only a constructed release URL and ignores caller-supplied destinations", async () => {
  const { checker, openExternal, release } = setup();
  Object.assign(release, { html_url: "https://evil.example" });
  await expect(checker.openRelease("file:///etc/passwd")).rejects.toThrow("Check for");
  await checker.check();
  await checker.openRelease("https://evil.example");
  expect(openExternal).toHaveBeenCalledWith("https://github.com/fkeenv/shotmagic/releases/tag/v2026.10.1");
});

test.each(["draft", "prerelease", "no-installer", "empty-installer", "uploading"])("does not advertise a %s release", async (kind) => {
  const { checker, release } = setup();
  if (kind === "draft") release.draft = true;
  if (kind === "prerelease") release.prerelease = true;
  if (kind === "no-installer") release.assets = [];
  if (kind === "empty-installer") release.assets[0].size = 0;
  if (kind === "uploading") release.assets[0].state = "new";
  expect(await checker.check()).toMatchObject({ status: "no-release" });
  await expect(checker.openRelease()).rejects.toThrow("Check for");
});

test.each(["v2026.10.1-beta", "2026.010.1", "../../other", null])("rejects malformed version %s", async (version) => {
  await expect(setup(version as string).checker.check()).rejects.toThrow("Invalid release version");
});

test("handles missing releases, rate limits, offline and timeouts without allowing stale downloads", async () => {
  const { checker, fetchRelease } = setup();
  await checker.check();
  fetchRelease.mockResolvedValueOnce({ status: 404 });
  expect(await checker.check()).toMatchObject({ status: "no-release" });
  await expect(checker.openRelease()).rejects.toThrow("Check for");
  fetchRelease.mockResolvedValueOnce({ status: 403, ok: false });
  await expect(checker.check()).rejects.toThrow("try again later");
  fetchRelease.mockRejectedValueOnce(new Error("offline"));
  await expect(checker.check()).rejects.toThrow("offline");
  fetchRelease.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
  await expect(checker.check()).rejects.toThrow("timeout");
  expect(await checker.check()).toMatchObject({ status: "available" });
});

test("unpackaged and unsupported platforms never contact GitHub", async () => {
  const fetchRelease = vi.fn();
  const checker = createUpdateChecker({ currentVersion: "2026.10.0", enabled: false, fetchRelease });
  expect(await checker.check()).toMatchObject({ status: "unsupported" });
  expect(fetchRelease).not.toHaveBeenCalled();
});

test("IPC rejects untrusted frames and exposes only check and open-release actions", async () => {
  const handlers = new Map();
  const ipcMain = { handle: (name: string, action: unknown) => handlers.set(name, action) };
  const { checker, openExternal } = setup();
  registerUpdateHandlers(ipcMain, checker, (event: { trusted: boolean }) => event.trusted);
  expect([...handlers.keys()]).toEqual(["updates:check", "updates:open-release"]);
  expect(() => handlers.get("updates:check")({ trusted: false })).toThrow("Untrusted");
  await handlers.get("updates:check")({ trusted: true });
  expect(() => handlers.get("updates:open-release")({ trusted: false })).toThrow("Untrusted");
  await handlers.get("updates:open-release")({ trusted: true }, "https://evil.example");
  expect(openExternal).toHaveBeenCalledWith("https://github.com/fkeenv/shotmagic/releases/tag/v2026.10.1");
});
