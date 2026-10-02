// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App";
import {
  addImageLayer,
  cropImageLayer,
  moveLayer,
  openProject,
  openSavedProject,
  saveProject,
  scaleImageLayer,
  setView,
  type Project,
} from "./editor";
import type { SaveDialogRequest } from "./file-workflow";

let root: Root;
let container: HTMLDivElement;
let saved: SaveDialogRequest | undefined;

function imageProject() {
  let project = addImageLayer(openProject(), {
    id: "screenshot",
    name: "Screenshot",
    format: "image/png",
    source: "data:image/png;base64,example",
    width: 320,
    height: 180,
  });
  project = cropImageLayer(project, "screenshot", {
    x: 20,
    y: 10,
    width: 240,
    height: 120,
  });
  project = moveLayer(project, "screenshot", 40, 30);
  project = scaleImageLayer(project, "screenshot", 2);
  return setView(project, 0.5, 18, -12);
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  saved = undefined;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete window.screenshotEditorFiles;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function button(name: string) {
  const found = Array.from(container.querySelectorAll("button")).find(
    (element) =>
      (element.getAttribute("aria-label") ?? element.textContent?.trim()) ===
      name,
  );
  if (!found) throw new Error(`Missing button: ${name}`);
  return found;
}

async function click(name: string) {
  await act(async () => button(name).click());
}

async function mount(project: Project = imageProject()) {
  window.screenshotEditorFiles = {
    open: async () => [
      {
        name: "crop.screenshot-project.json",
        bytes: new TextEncoder().encode(saveProject(project)),
      },
    ],
    save: async (request) => {
      saved = request;
      return true;
    },
  };
  await act(async () =>
    root.render(
      <MantineProvider env="test">
        <App appearance="light" onAppearanceChange={() => undefined} />
      </MantineProvider>,
    ),
  );
}

async function pointer(element: Element, type: string, x: number, y: number) {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    buttons: type === "pointerup" ? 0 : 1,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  await act(async () => element.dispatchEvent(event));
}

async function savedProject() {
  await click("Save project");
  if (!saved) throw new Error("Expected saved project");
  return openSavedProject(new TextDecoder().decode(saved.bytes));
}

async function openImageAndStartCrop() {
  await click("Open project");
  const image = container.querySelector(".image-layer")!;
  await pointer(image, "pointerdown", 100, 100);
  await pointer(image, "pointerup", 100, 100);
  await click("Crop image");
}

test("crop is unavailable without an image selection and can be entered from the toolbar", async () => {
  await mount();
  expect(button("Crop image").disabled).toBe(true);
  await openImageAndStartCrop();
  expect(container.querySelector('[aria-label="Image crop"]')).not.toBeNull();
  expect(button("Apply")).toBeDefined();
  expect(button("Cancel")).toBeDefined();
});

test.each([".viewport", ".image-crop-overlay"])(
  "crop mode allows panning from %s without changing crop pixels or history",
  async (selector) => {
    const project = addImageLayer(openProject(), {
      id: "tall",
      name: "Tall image",
      format: "image/png",
      source: "data:image/png;base64,example",
      width: 320,
      height: 2600,
    });
    await mount(project);
    await openImageAndStartCrop();
    const target = container.querySelector(selector)!;
    await pointer(target, "pointerdown", 100, 400);
    await pointer(target, "pointermove", 100, 100);
    await pointer(target, "pointerup", 100, 100);
    expect(
      container.querySelector<HTMLElement>(".canvas")!.style.transform,
    ).toBe("translate(0px, -300px) scale(1)");
    expect(container.querySelector('[role="status"]')!.textContent).toBe(
      "320 × 2600 px",
    );
    await click("Cancel");
    expect(await savedProject()).toEqual(
      openSavedProject(saveProject(project)),
    );
    expect(button("Undo").disabled).toBe(true);
  },
);

test("crop Fit shows the entire image rather than only the canvas, and zoom leaves redo history intact", async () => {
  await mount(
    addImageLayer(openProject(), {
      id: "tall",
      name: "Tall image",
      format: "image/png",
      source: "data:image/png;base64,example",
      width: 320,
      height: 2600,
    }),
  );
  await openImageAndStartCrop();
  const viewport = container.querySelector(".viewport")!;
  Object.defineProperty(viewport, "clientWidth", { value: 1000 });
  Object.defineProperty(viewport, "clientHeight", { value: 800 });
  await click("Fit image for crop");
  expect(container.querySelector<HTMLElement>(".canvas")!.style.transform).toBe(
    "translate(196.92307692307693px, -155.0769230769231px) scale(0.24615384615384617)",
  );
  await click("Zoom in crop");
  expect(
    container.querySelector<HTMLElement>(".canvas")!.style.transform,
  ).toContain("scale(0.3076923076923077)");
  await click("Zoom out crop");
  const handle = button("Crop right");
  await pointer(handle, "pointerdown", 100, 100);
  await pointer(handle, "pointerup", 80, 100);
  await click("Apply");
  expect((await savedProject()).layers[0]).toMatchObject({
    crop: { width: 239, height: 2600 },
  });
  await click("Undo");
  expect(button("Undo").disabled).toBe(true);
  expect(button("Redo").disabled).toBe(false);
  await click("Crop image");
  await click("Fit image for crop");
  await click("Cancel");
  expect(button("Undo").disabled).toBe(true);
  expect(button("Redo").disabled).toBe(false);
  await click("Redo");
  expect((await savedProject()).layers[0]).toMatchObject({
    crop: { width: 239, height: 2600 },
  });
});

test("cancelling a crop pan restores the temporary view without moving the image", async () => {
  await mount();
  await openImageAndStartCrop();
  const overlay = container.querySelector(".image-crop-overlay")!;
  await pointer(overlay, "pointerdown", 100, 400);
  await pointer(overlay, "pointermove", 200, 100);
  await pointer(overlay, "pointercancel", 200, 100);
  expect(container.querySelector<HTMLElement>(".canvas")!.style.transform).toBe(
    "translate(18px, -12px) scale(0.5)",
  );
  await click("Apply");
  expect((await savedProject()).layers[0]).toEqual(imageProject().layers[0]);
  expect(button("Undo").disabled).toBe(true);
});

test("dragging previews a source-pixel crop, Apply commits once, and undo/redo preserve the image frame", async () => {
  await mount();
  await openImageAndStartCrop();
  const handle = button("Crop top left");
  await pointer(handle, "pointerdown", 100, 100);
  await pointer(handle, "pointermove", 132, 124);
  await pointer(handle, "pointerup", 132, 124);
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    "208 × 96 px",
  );
  await click("Apply");
  const applied = await savedProject();
  expect(applied.layers[0]).toMatchObject({
    x: 40,
    y: 30,
    scale: 2,
    crop: { x: 52, y: 34, width: 208, height: 96 },
  });
  expect(applied.canvasWidth).toBe(1920);
  expect(
    (container.querySelector('[name="cropX"]') as HTMLInputElement).value,
  ).toBe("52");
  expect(
    (container.querySelector(".image-layer") as HTMLElement).style.width,
  ).toBe("416px");
  await click("Undo");
  expect((await savedProject()).layers[0]).toEqual(imageProject().layers[0]);
  expect(button("Undo").disabled).toBe(true);
  await click("Redo");
  expect((await savedProject()).layers[0]).toEqual(applied.layers[0]);
});

test.each(["Cancel", "Escape"])(
  "%s discards a dragged crop without changing the project or redo history",
  async (action) => {
    await mount();
    await openImageAndStartCrop();
    const first = button("Crop right");
    await pointer(first, "pointerdown", 200, 100);
    await pointer(first, "pointerup", 180, 100);
    await click("Apply");
    await click("Undo");
    await click("Crop image");
    const handle = button("Crop bottom right");
    await pointer(handle, "pointerdown", 200, 150);
    await pointer(handle, "pointermove", 140, 120);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "180 × 90 px",
    );
    if (action === "Cancel") await click("Cancel");
    else
      await act(async () =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
      );
    expect(container.querySelector('[aria-label="Image crop"]')).toBeNull();
    expect((await savedProject()).layers[0]).toEqual(imageProject().layers[0]);
    expect(button("Undo").disabled).toBe(true);
    expect(button("Redo").disabled).toBe(false);
    await click("Redo");
    expect((await savedProject()).layers[0]).toMatchObject({
      crop: { width: 220, height: 120 },
    });
  },
);

test("pointer cancellation restores the crop draft and other editor actions pause until crop mode ends", async () => {
  await mount();
  await openImageAndStartCrop();
  expect(container.querySelector("header")?.hasAttribute("inert")).toBe(true);
  expect(
    container.querySelector('[aria-label="Inspector"]')?.hasAttribute("inert"),
  ).toBe(true);
  expect(
    container.querySelector('[aria-label="Layers"]')?.hasAttribute("inert"),
  ).toBe(true);
  const handle = button("Crop left");
  await pointer(handle, "pointerdown", 100, 100);
  await pointer(handle, "pointermove", 140, 100);
  await pointer(handle, "pointercancel", 140, 100);
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    "240 × 120 px",
  );
  await act(async () =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    ),
  );
  await click("Apply");
  expect((await savedProject()).layers[0]).toEqual(imageProject().layers[0]);
  expect(button("Undo").disabled).toBe(true);
});

test("a one-pixel crop keeps its handle controls separated and can expand again before Apply", async () => {
  await mount();
  await openImageAndStartCrop();
  const corner = button("Crop bottom right");
  await pointer(corner, "pointerdown", 200, 150);
  await pointer(corner, "pointerup", -1000, -1000);
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    "1 × 1 px",
  );
  const controls = container.querySelector(
    ".image-crop-handles",
  ) as HTMLElement;
  expect(controls.style.width).toBe("96px");
  expect(controls.style.height).toBe("96px");
  await pointer(corner, "pointerdown", 100, 100);
  await pointer(corner, "pointerup", 150, 125);
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    "51 × 26 px",
  );
  await click("Apply");
  expect((await savedProject()).layers[0]).toMatchObject({
    crop: { x: 20, y: 10, width: 51, height: 26 },
  });
});
