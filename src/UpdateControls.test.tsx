// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { UpdateControls, type UpdateAdapter, type UpdateResult } from "./UpdateControls";

let root: Root;
let container: HTMLDivElement;
const available: UpdateResult = { status: "available", currentVersion: "2026.10.0", version: "2026.10.1" };

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function mount(updates?: UpdateAdapter, strict = false) {
  await act(async () => root.render(strict
    ? <StrictMode><UpdateControls updates={updates} /></StrictMode>
    : <UpdateControls updates={updates} />));
}

async function click(text: string) {
  const button = [...document.querySelectorAll("button")].find(button => button.textContent === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}

function adapter(result: UpdateResult = available) {
  return { check: vi.fn().mockResolvedValue(result), openRelease: vi.fn().mockResolvedValue(undefined) };
}

test("browser and development environments have no update action or startup request", async () => {
  await mount();
  expect(container.childNodes).toHaveLength(0);
});

test.each([false, true])("startup announces available updates, without opening or replacing the editor (strict=%s)", async (strict) => {
  const updates = adapter();
  await mount(updates, strict);
  expect(document.querySelector('[role="status"]')!.textContent).toContain("2026.10.1 is available");
  expect(document.body.textContent).toContain("Save your project before installing");
  expect(updates.openRelease).not.toHaveBeenCalled();
  await click("Download update");
  expect(updates.openRelease).toHaveBeenCalledWith();
  await click("Dismiss update notice");
  expect(document.querySelector('[role="status"]')).toBeNull();
  await click("Check for updates");
  expect(document.querySelector('[role="status"]')).not.toBeNull();
});

test.each(["current", "no-release", "unsupported"] as const)("startup stays quiet for %s but manual checks report a status", async (status) => {
  const updates = adapter({ status, currentVersion: "2026.10.0" });
  await mount(updates);
  expect(document.querySelector('[role="status"]')).toBeNull();
  await click("Check for updates");
  expect(document.querySelector('[role="status"]')).not.toBeNull();
  expect(document.body.textContent).not.toContain("Download update");
  if (status === "current") expect(document.body.textContent).toContain("2026.10.0 is up to date");
});

test("offline startup stays quiet, manual failure is actionable, and retries succeed", async () => {
  const updates = adapter();
  updates.check.mockRejectedValueOnce(new Error("offline"));
  await mount(updates);
  expect(document.querySelector('[role="status"]')).toBeNull();
  updates.check.mockRejectedValueOnce(new Error("rate limit"));
  await click("Check for updates");
  expect(document.body.textContent).toContain("Check your connection and try again later");
  await click("Check for updates");
  expect(document.body.textContent).toContain("2026.10.1 is available");
});

test("opening failure can be retried without removing the update notice", async () => {
  const updates = adapter();
  updates.openRelease.mockRejectedValueOnce(new Error("no browser"));
  await mount(updates);
  await click("Download update");
  expect(document.body.textContent).toContain("Could not open the release page");
  await click("Download update");
  expect(updates.openRelease).toHaveBeenCalledTimes(2);
  expect(document.body.textContent).not.toContain("Could not open the release page");
});

test("manual checks disable repeated requests while pending", async () => {
  const updates = adapter({ status: "current", currentVersion: "2026.10.0" });
  await mount(updates);
  let resolve!: (result: UpdateResult) => void;
  updates.check.mockReturnValueOnce(new Promise<UpdateResult>(done => { resolve = done; }));
  await click("Check for updates");
  expect(container.querySelector("button")!.disabled).toBe(true);
  await click("Checking updates…");
  expect(updates.check).toHaveBeenCalledTimes(2);
  await act(async () => resolve(available));
  expect(container.querySelector("button")!.disabled).toBe(false);
});
