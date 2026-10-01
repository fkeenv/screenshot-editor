// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { compile } from "@tailwindcss/node";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  addImageLayer,
  addRectangleLayer,
  addTextLayer,
  cropImageLayer,
  moveLayer,
  openProject,
  openSavedProject,
  saveProject,
  scaleImageLayer,
  setLayerOpacity,
  setView,
  type Project,
} from "./editor";

let root: Root;
let container: HTMLDivElement;
let saved: string | undefined;
let editorStyles: string;

beforeAll(async () => {
  const stylesheet = await compile(readFileSync("src/index.css", "utf8"), {
    base: resolve("src"),
    onDependency: () => undefined,
  });
  const candidates = readdirSync("src")
    .filter((file) => file.endsWith(".tsx") && !file.includes(".test."))
    .flatMap(
      (file) =>
        readFileSync(`src/${file}`, "utf8").match(/[^\s"'`<>${}]+/g) ?? [],
    );
  editorStyles = stylesheet.build(candidates);
});

function stackedProject() {
  let project = addImageLayer(openProject(), {
    id: "bottom",
    name: "Bottom.png",
    source: "data:image/png;base64,bottom",
    format: "image/png",
    width: 100,
    height: 50,
  });
  project = addTextLayer(
    project,
    "middle",
    { x: 12, y: 18 },
    {
      text: "A caption",
      colorRuns: [{ start: 2, end: 9, color: "#c2a3da" }],
    },
  );
  return addImageLayer(project, {
    id: "top",
    name: "Top.png",
    source: "data:image/png;base64,top",
    format: "image/png",
    width: 40,
    height: 20,
  });
}

function resizableProject(zoom = 0.5) {
  let project = addImageLayer(openProject(), {
    id: "resizing",
    name: "Screenshot",
    source: "data:image/png;base64,image",
    format: "image/png",
    width: 320,
    height: 180,
  });
  project = cropImageLayer(project, "resizing", {
    x: 20,
    y: 10,
    width: 240,
    height: 120,
  });
  project = scaleImageLayer(project, "resizing", 2);
  project = moveLayer(project, "resizing", 40, 30);
  return setView(project, zoom, 18, -12);
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
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => ({
      font: "",
      measureText: (text: string) => ({ width: text.length * 12 }),
    }),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
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
  document.getElementById("editor-preview-styles")?.remove();
  delete document.documentElement.dataset.appearance;
});

function loadEditorStyles() {
  const style = document.createElement("style");
  style.id = "editor-preview-styles";
  style.textContent = editorStyles;
  document.head.append(style);
}

test.each(["light", "dark"])("%s text selection has explicit contrasting colors without changing chat styling", async (appearance) => {
  loadEditorStyles();
  document.documentElement.dataset.appearance = appearance;
  const project = addTextLayer(openProject(), "chat", undefined, {
    text: "Colored caption", colorRuns: [{ start: 0, end: 7, color: "#c2a3da" }],
  });
  await mount(project);
  await selectLayer("Text");
  await act(async () => container.querySelector(".text-layer")!
    .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
  const editor = container.querySelector(".inline-text-editor")!;
  expect(editor.querySelector('[contenteditable="true"]')).not.toBeNull();
  const stylesheet = (document.getElementById("editor-preview-styles") as HTMLStyleElement).sheet!;
  const selection = [...stylesheet.cssRules].find((rule) =>
    rule instanceof CSSStyleRule && rule.selectorText.includes(".inline-text-editor") && rule.selectorText.includes("::selection")) as CSSStyleRule | undefined;
  expect(selection).toBeDefined();
  expect(selection!.selectorText).toContain(".inline-text-editor *::selection");
  const style = selection!.style;
  expect(style.getPropertyValue("background-color")).toBe("rgb(37, 99, 235)");
  expect(style.getPropertyValue("color")).toBe("rgb(255, 255, 255)");
  expect(["#fff", "rgb(255, 255, 255)"]).toContain(style.getPropertyValue("-webkit-text-fill-color"));
  expect(style.getPropertyValue("text-shadow")).toBe("none");
  expect(style.getPropertyValue("-webkit-text-stroke")).toBe("0px");
  expect((await openSavedProjectFromEditor()).layers).toEqual(project.layers);
});

test.each(["Text", "Top.png", "Rectangle"])(
  "clicking outside the canvas deselects %s and hides its editing borders",
  async (name) => {
    loadEditorStyles();
    const project = addRectangleLayer(stackedProject(), "rectangle");
    await mount(project);
    await selectLayer(name);
    const viewport = container.querySelector(".viewport")!;
    await pointer(viewport, "pointerdown", 10, 10);
    await pointer(viewport, "pointerup", 10, 10);
    expect(container.querySelectorAll(".canvas-layer.selected")).toHaveLength(0);
    expect(container.querySelectorAll(".text-resize-handle, .image-resize-handle, .image-resize-outline")).toHaveLength(0);
    expect(getComputedStyle(container.querySelector(".text-layer")!).outlineStyle).toBe("none");
    expect(button("Delete layer").disabled).toBe(true);
    expect(button("Duplicate layer").disabled).toBe(true);
    expect((await openSavedProjectFromEditor()).layers).toEqual(project.layers);
    expect(button("Undo").disabled).toBe(true);
  },
);

test("clicking outside finishes chatbox editing and a workspace pan does not lose its new text", async () => {
  vi.spyOn(window, "scrollBy").mockImplementation(() => undefined);
  const createRange = document.createRange.bind(document);
  vi.spyOn(document, "createRange").mockImplementation(() => {
    const range = createRange();
    return Object.assign(range, {
      getClientRects: () => [new DOMRect(0, 0, 10, 10)],
      getBoundingClientRect: () => new DOMRect(0, 0, 10, 10),
    });
  });
  const project = addTextLayer(openProject(), "text");
  await mount(project);
  await selectLayer("Text");
  const layer = container.querySelector(".text-layer")!;
  await act(async () => layer.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
  const editor = container.querySelector('[contenteditable="true"]')!;
  const paste = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(paste, "clipboardData", { value: { getData: () => "Updated caption" } });
  await act(async () => editor.dispatchEvent(paste));
  const viewport = container.querySelector(".viewport")!;
  await pointer(viewport, "pointerdown", 10, 10);
  expect(container.querySelector('[contenteditable="true"]')).toBeNull();
  await pointer(viewport, "pointermove", 50, 40);
  await pointer(viewport, "pointerup", 50, 40);
  const edited = await openSavedProjectFromEditor();
  expect(edited.layers[0]).toMatchObject({ text: "Updated caption" });
  expect(edited).toMatchObject({ panX: 40, panY: 30 });
  expect(container.querySelectorAll(".canvas-layer.selected")).toHaveLength(0);
  await click("Undo");
  expect(await openSavedProjectFromEditor()).toMatchObject({ panX: 0, panY: 0 });
  expect((await openSavedProjectFromEditor()).layers[0]).toMatchObject({ text: "Updated caption" });
  await click("Undo");
  expect((await openSavedProjectFromEditor()).layers).toEqual(project.layers);
});

test("toolbar and inspector interactions keep the selected chatbox", async () => {
  await mount(addTextLayer(openProject(), "text"));
  await selectLayer("Text");
  await click("Properties");
  await click("Show grid");
  expect(container.querySelectorAll(".text-layer.selected")).toHaveLength(1);
  expect(container.querySelectorAll(".text-resize-handle")).toHaveLength(4);
});

test.each([
  ["center", 300, 240, "Center"],
  ["top left", 0, 0, "Edge"],
  ["bottom right", 600, 480, "Edge"],
  ["padded top left", 16, 16, "Padding · 16px"],
  ["padded bottom right", 584, 464, "Padding · 16px"],
] as const)("canvas snapping shows alignment lines at %s then removes them on release", async (_name, x, y, label) => {
  await mount(addRectangleLayer(openProject(), "rectangle"));
  await click("Snap to canvas");
  const layer = container.querySelector(".rectangle-layer")!;
  await pointer(layer, "pointerdown", 100, 100);
  await pointer(layer, "pointermove", 100 + x - 300 + 3, 100 + y - 240 + 3);
  const guides = container.querySelectorAll<HTMLElement>(".snap-guide");
  expect(guides).toHaveLength(2);
  expect([...guides].every((guide) => guide.textContent!.includes(label))).toBe(true);
  expect(container.querySelector<HTMLElement>(".rectangle-layer")!.style.left).toBe(`${x}px`);
  expect(container.querySelector<HTMLElement>(".rectangle-layer")!.style.top).toBe(`${y}px`);
  await pointer(layer, "pointerup", 100 + x - 300 + 3, 100 + y - 240 + 3);
  expect(container.querySelectorAll(".snap-guide")).toHaveLength(0);
  expect((await openSavedProjectFromEditor()).layers[0]).toMatchObject({ x, y });
  if (x !== 300 || y !== 240) {
    await click("Undo");
    expect((await openSavedProjectFromEditor()).layers[0]).toMatchObject({ x: 300, y: 240 });
    expect(button("Undo").disabled).toBe(true);
  } else expect(button("Undo").disabled).toBe(true);
});

test("canvas snapping can be bypassed with Shift and cancellation removes guides", async () => {
  await mount(addRectangleLayer(openProject(), "rectangle"));
  await click("Snap to canvas");
  const layer = container.querySelector(".rectangle-layer")!;
  await pointer(layer, "pointerdown", 100, 100);
  await pointer(layer, "pointermove", 103, 103);
  expect(container.querySelectorAll(".snap-guide")).toHaveLength(2);
  const move = new MouseEvent("pointermove", { bubbles: true, clientX: 103, clientY: 103, buttons: 1, shiftKey: true });
  Object.defineProperty(move, "pointerId", { value: 1 });
  await act(async () => layer.dispatchEvent(move));
  expect(container.querySelectorAll(".snap-guide")).toHaveLength(0);
  expect(container.querySelector<HTMLElement>(".rectangle-layer")!.style.left).toBe("303px");
  await pointer(layer, "pointercancel", 103, 103);
  expect(container.querySelectorAll(".snap-guide")).toHaveLength(0);
  expect(container.querySelector<HTMLElement>(".rectangle-layer")!.style.left).toBe("300px");
  expect(button("Undo").disabled).toBe(true);
});

test("grid snapping shows a labeled guide even when the grid is hidden", async () => {
  await mount(moveLayer(addRectangleLayer(openProject(), "rectangle"), "rectangle", 13, 17));
  await click("Snap to grid");
  const layer = container.querySelector(".rectangle-layer")!;
  await pointer(layer, "pointerdown", 100, 100);
  await pointer(layer, "pointermove", 123, 112);
  expect(container.querySelector(".canvas-grid")).toBeNull();
  expect(container.querySelector(".snap-guide.vertical")!.textContent).toBe("Grid · 40px");
  expect(container.querySelector(".snap-guide.horizontal")!.textContent).toBe("Grid · 20px");
  await pointer(layer, "pointerup", 123, 112);
  expect(container.querySelectorAll(".snap-guide")).toHaveLength(0);
});

test("crop and resize use contrasting dashed borders without changing handle geometry", async () => {
  loadEditorStyles();
  await mount(resizableProject());
  await selectLayer("Screenshot");
  const frame = container.querySelector<HTMLElement>(".image-resize-outline")!;
  expect(frame.style.left).toBe("40px");
  expect(frame.style.top).toBe("30px");
  expect(frame.style.width).toBe("480px");
  expect(frame.style.height).toBe("240px");
  expect(frame.style.getPropertyValue("--resize-zoom")).toBe("0.5");
  const frameStyle = getComputedStyle(frame);
  expect(frameStyle.borderTopStyle).toBe("dashed");
  expect(frameStyle.borderLeftStyle).toBe("dashed");
  expect(frameStyle.borderTopColor).toBe("rgb(255, 255, 255)");
  expect(frameStyle.outlineColor).toBe("rgb(17, 17, 17)");
  expect(frameStyle.outlineStyle).toBe("solid");
  expect(frameStyle.pointerEvents).toBe("none");
  expect(container.querySelectorAll(".image-resize-handle")).toHaveLength(4);
  await click("Crop image");
  expect(container.querySelector(".image-resize-outline")).toBeNull();
  const crop = container.querySelector<HTMLElement>(".image-crop-selection")!;
  expect(getComputedStyle(crop).borderTopStyle).toBe("dashed");
  expect(getComputedStyle(crop).borderLeftStyle).toBe("dashed");
  expect(getComputedStyle(crop).outlineColor).toBe("rgb(17, 17, 17)");
  expect(getComputedStyle(crop).outlineStyle).toBe("solid");
  expect(container.querySelectorAll(".image-crop-handle")).toHaveLength(8);
});

test("grid controls change an editor-only overlay without changing the saved project or history", async () => {
  loadEditorStyles();
  const project = stackedProject();
  await mount(project);
  expect(container.querySelector(".canvas-grid")).toBeNull();
  await click("Show grid");
  const grid = container.querySelector<HTMLElement>(".canvas-grid")!;
  expect(grid.style.backgroundSize).toBe("20px 20px");
  expect(grid.getAttribute("aria-hidden")).toBe("true");
  expect(getComputedStyle(grid).pointerEvents).toBe("none");
  await click("Snap to grid");
  expect(button("Snap to grid").getAttribute("aria-pressed")).toBe("true");
  await click("Properties");
  const spacing = container.querySelector<HTMLInputElement>('[aria-label="Grid spacing"]')!;
  await act(async () => {
    spacing.focus();
    spacing.value = "32";
    spacing.blur();
  });
  expect(grid.style.backgroundSize).toBe("32px 32px");
  const nextSpacing = container.querySelector<HTMLInputElement>('[aria-label="Grid spacing"]')!;
  await act(async () => {
    nextSpacing.focus();
    nextSpacing.value = "0";
    nextSpacing.blur();
  });
  expect(nextSpacing.value).toBe("32");
  expect(await openSavedProjectFromEditor()).toEqual(openSavedProject(saveProject(project)));
  expect(button("Undo").disabled).toBe(true);
  await click("Show grid");
  expect(container.querySelector(".canvas-grid")).toBeNull();
});

test.each([
  ["image", 0.5], ["image", 2], ["text", 0.5], ["text", 2],
  ["rectangle", 0.5], ["rectangle", 2],
] as const)("%s dragging snaps to document grid at zoom %s with one undo step", async (kind, zoom) => {
  let project = kind === "image"
    ? addImageLayer(openProject(), { id: "layer", name: "Image", source: "data:image/png;base64,image", format: "image/png", width: 100, height: 50 })
    : kind === "text" ? addTextLayer(openProject(), "layer")
    : addRectangleLayer(openProject(), "layer");
  project = setView(moveLayer(project, "layer", 13, 17), zoom, 50, -20);
  await mount(project);
  await click("Snap to grid");
  const layer = container.querySelector(`.${kind}-layer`)!;
  await pointer(layer, "pointerdown", 100, 100);
  await pointer(layer, "pointermove", 100 + 23 * zoom, 100 + 12 * zoom);
  await pointer(layer, "pointerup", 100 + 23 * zoom, 100 + 12 * zoom);
  expect((await openSavedProjectFromEditor()).layers[0]).toMatchObject({ x: 40, y: 20 });
  await click("Undo");
  expect((await openSavedProjectFromEditor()).layers).toEqual(project.layers);
  expect(button("Undo").disabled).toBe(true);
});

test("snap preserves click-only selection, can be bypassed with Shift, and cancels on pointercancel", async () => {
  const project = moveLayer(addRectangleLayer(openProject(), "layer"), "layer", 13, 17);
  await mount(project);
  await click("Snap to grid");
  const layer = container.querySelector(".rectangle-layer")!;
  await pointer(layer, "pointerdown", 100, 100);
  await pointer(layer, "pointerup", 100, 100);
  expect(button("Undo").disabled).toBe(true);
  await pointer(layer, "pointerdown", 100, 100);
  const up = new MouseEvent("pointerup", { bubbles: true, clientX: 123, clientY: 112, shiftKey: true });
  Object.defineProperty(up, "pointerId", { value: 1 });
  await act(async () => layer.dispatchEvent(up));
  expect((await openSavedProjectFromEditor()).layers[0]).toMatchObject({ x: 36, y: 29 });
  await click("Undo");
  await pointer(layer, "pointerdown", 100, 100);
  await pointer(layer, "pointermove", 123, 112);
  await pointer(layer, "pointercancel", 123, 112);
  expect((await openSavedProjectFromEditor()).layers).toEqual(project.layers);
});

test("text placement snaps in document pixels while grid lines remain outside project data", async () => {
  await mount(setView(openProject(), 2, 50, -20));
  await click("Snap to grid");
  await click("Chat");
  const draft = container.querySelector<HTMLTextAreaElement>('[aria-label="Chat draft"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(draft, "A caption");
    draft.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Place on canvas");
  const canvas = container.querySelector(".canvas")!;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ left: 100, top: 50 } as DOMRect);
  await pointer(canvas, "pointerdown", 173, 99);
  const savedProject = await openSavedProjectFromEditor();
  expect(savedProject.layers[0]).toMatchObject({ kind: "text", x: 40, y: 20 });
  expect(savedProject).not.toHaveProperty("gridSpacing");
  await click("Undo");
  expect((await openSavedProjectFromEditor()).layers).toHaveLength(0);
});

test("rectangle tool adds a selected editable layer and supports size, color, duplicate, delete and undo", async () => {
  await mount(openProject());
  await click("Add rectangle");
  expect(container.querySelector(".welcome-screen")).toBeNull();
  const rectangle = container.querySelector<HTMLElement>(".rectangle-layer")!;
  expect(rectangle.classList.contains("selected")).toBe(true);
  expect(rectangle.style.width).toBe("200px");
  expect(container.textContent).toContain("Rectangle properties");
  expect(container.querySelectorAll(".text-layer")).toHaveLength(0);
  const field = container.querySelector<HTMLInputElement>('[aria-label="Rectangle width"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "75");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await keyDown("Enter", field);
  expect(rectangle.style.width).toBe("75px");
  const color = container.querySelector<HTMLInputElement>('[aria-label="Rectangle fill color"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(color, "#123456");
    color.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(rectangle.style.backgroundColor).toBe("rgb(18, 52, 86)");
  const savedProject = await openSavedProjectFromEditor();
  expect(savedProject.layers[0]).toMatchObject({ kind: "rectangle", width: 75, fill: "#123456" });
  await click("Undo");
  expect(rectangle.style.backgroundColor).toBe("rgb(213, 178, 115)");
  await click("Redo");
  await click("Duplicate layer");
  expect(container.querySelectorAll(".rectangle-layer")).toHaveLength(2);
  await click("Delete layer");
  expect(container.querySelectorAll(".rectangle-layer")).toHaveLength(1);
  await click("Undo");
  expect(container.querySelectorAll(".rectangle-layer")).toHaveLength(2);
  window.screenshotEditorFiles!.open = async () => [{
    name: "rectangle.screenshot-project.json",
    bytes: new TextEncoder().encode(saveProject(savedProject)),
  }];
  await click("Open project");
  expect(container.querySelectorAll(".rectangle-layer")).toHaveLength(1);
  expect(container.querySelector<HTMLElement>(".rectangle-layer")!.style.width).toBe("75px");
});

test("invalid and cancelled rectangle sizes do not change the layer or history", async () => {
  const project = addRectangleLayer(openProject(), "rectangle");
  await mount(project);
  await selectLayer("Rectangle");
  const field = container.querySelector<HTMLInputElement>('[aria-label="Rectangle width"]')!;
  for (const value of ["0", "-10", ""]) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await keyDown("Enter", field);
    expect(field.value).toBe("200");
  }
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "75");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await keyDown("Escape", field);
  expect(field.value).toBe("200");
  expect((await openSavedProjectFromEditor()).layers).toEqual(project.layers);
  expect(button("Undo").disabled).toBe(true);
});

test("adding a rectangle cancels an active layer drag before a late release", async () => {
  const project = addRectangleLayer(openProject(), "rectangle");
  await mount(project);
  const original = container.querySelector(".rectangle-layer")!;
  await pointer(original, "pointerdown", 100, 100);
  await pointer(original, "pointermove", 150, 150);
  await click("Add rectangle");
  await pointer(original, "pointerup", 150, 150);
  expect(container.querySelectorAll(".rectangle-layer")).toHaveLength(2);
  await click("Undo");
  expect((await openSavedProjectFromEditor()).layers).toEqual(project.layers);
});

test("rectangle dragging accounts for zoom and remains one undoable move", async () => {
  const project = setView(addRectangleLayer(openProject(), "rectangle"), 2, 50, -20);
  await mount(project);
  const rectangle = container.querySelector(".rectangle-layer")!;
  await pointer(rectangle, "pointerdown", 100, 100);
  await pointer(rectangle, "pointermove", 120, 140);
  await pointer(rectangle, "pointerup", 140, 160);
  expect((await openSavedProjectFromEditor()).layers[0]).toMatchObject({ x: 320, y: 270 });
  await click("Undo");
  expect((await openSavedProjectFromEditor()).layers).toEqual(project.layers);
});

test("canvas background controls preview a saved color independently of appearance and support undo", async () => {
  loadEditorStyles();
  await mount();
  await click("Properties");
  const choice = container.querySelector<HTMLSelectElement>(
    '[aria-label="Canvas background"]',
  )!;
  expect(choice).not.toBeNull();
  await act(async () => {
    choice.value = "solid";
    choice.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const color = container.querySelector<HTMLInputElement>(
    '[aria-label="Canvas background color"]',
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(color, "#123456");
    color.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const content = container.querySelector<HTMLElement>(".canvas-content")!;
  expect(getComputedStyle(content).backgroundColor).toBe("rgb(18, 52, 86)");
  document.documentElement.dataset.appearance = "dark";
  expect(getComputedStyle(content).backgroundColor).toBe("rgb(18, 52, 86)");
  expect((await openSavedProjectFromEditor()).canvasBackground).toEqual({
    kind: "solid",
    color: "#123456",
  });
  await click("Undo");
  expect((await openSavedProjectFromEditor()).canvasBackground).toEqual({
    kind: "solid",
    color: "#ffffff",
  });
  await click("Undo");
  expect((await openSavedProjectFromEditor()).canvasBackground).toEqual({
    kind: "transparent",
  });
  expect(getComputedStyle(content).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect((await openSavedProjectFromEditor()).layers).toEqual(
    stackedProject().layers,
  );
  await click("Export");
  expect(container.textContent).toContain("#111827 for transparent projects");
});

test("the tool rail stays left while the inspector and layers share one right-hand dock", async () => {
  loadEditorStyles();
  await mount(addTextLayer(openProject(), "chat"));
  const dock = container.querySelector(".editor-dock")!;
  expect(dock.contains(container.querySelector("#tools-panel"))).toBe(true);
  expect(dock.contains(container.querySelector("#layers-panel"))).toBe(true);
  expect(getComputedStyle(dock).gridColumnStart).toBe("3");
  expect(
    getComputedStyle(container.querySelector(".tool-rail")!).gridColumnStart,
  ).toBe("1");
  expect(
    getComputedStyle(container.querySelector(".viewport")!).gridColumnStart,
  ).toBe("2");
  await click("Hide inspector");
  expect(container.querySelector("#tools-panel")).toBeNull();
  expect(container.querySelector("#layers-panel")).not.toBeNull();
  await click("Hide layers");
  expect(container.querySelector(".editor-dock")).toBeNull();
  await click("Inspector");
  await click("Layers");
  expect(
    container
      .querySelector(".editor-dock")!
      .contains(container.querySelector("#tools-panel")),
  ).toBe(true);
  expect(
    container
      .querySelector(".editor-dock")!
      .contains(container.querySelector("#layers-panel")),
  ).toBe(true);
});

test("canvas settings collapse for layer editing and still resize the canvas with undo", async () => {
  await mount(addTextLayer(openProject(), "chat"));
  await selectLayer("Text");
  const settings =
    container.querySelector<HTMLDetailsElement>(".canvas-settings")!;
  expect(settings.open).toBe(false);
  await act(async () => settings.querySelector("summary")!.click());
  expect(settings.open).toBe(true);
  await click("1150×600");
  expect(await openSavedProjectFromEditor()).toMatchObject({
    canvasWidth: 1150,
    canvasHeight: 600,
  });
  await click("Undo");
  expect(await openSavedProjectFromEditor()).toMatchObject({
    canvasWidth: 800,
    canvasHeight: 600,
  });
});

test("new text previews a shadow and exposes separate shadow and outline controls", async () => {
  loadEditorStyles();
  await mount(addTextLayer(openProject(), "chat"));
  await selectLayer("Text");
  const text = container.querySelector<HTMLElement>(".text-layer")!;
  expect(getComputedStyle(container.querySelector(".app")!).display).toBe(
    "grid",
  );
  expect(
    getComputedStyle(container.querySelector(".text-controls")!).display,
  ).toBe("grid");
  expect(text.style.fontSize).toBe("14px");
  expect(text.style.fontWeight).toBe("700");
  expect(text.style.webkitTextStroke).toBe("1px #000000");
  expect(text.style.textShadow).toBe("1px 1px 2px #000000");
  const shadow = container.querySelector<HTMLInputElement>(
    '[aria-label="Text shadow"]',
  )!;
  expect(shadow.checked).toBe(true);
  await act(async () => shadow.click());
  expect(text.style.textShadow).toBe("");
  expect(text.style.webkitTextStroke).toBe("1px #000000");
  await click("Undo");
  expect(text.style.textShadow).toBe("1px 1px 2px #000000");
  await act(async () =>
    text.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
  );
  expect(container.querySelector(".inline-text-preview")).not.toBeNull();
  expect(["none", "rgba(0, 0, 0, 0)"]).toContain(
    getComputedStyle(container.querySelector(".inline-text-editor")!)
      .textShadow,
  );
});

test("text properties use one preset dropdown that applies a selection color with one undo step", async () => {
  await mount(addTextLayer(openProject(), "chat"));
  await selectLayer("Text");
  const colors = container.querySelector<HTMLButtonElement>(
    ".selection-colors button[data-text-color-control]",
  )!;
  expect(colors.disabled).toBe(true);
  expect(container.querySelectorAll(".color-preset")).toHaveLength(0);
  await act(async () =>
    container
      .querySelector(".text-layer")!
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
  );
  expect(colors.disabled).toBe(false);
  await act(async () => colors.click());
  const options = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ];
  expect(options.map((option) => option.textContent)).toEqual([
    "/me",
    "/do",
    "Say / shout",
    "Low",
    "Whisper",
    "Phone speech",
    "Item given / money",
    "Inventory",
    "Radio",
    "HQ",
    "Phone notice",
    "Intercom / CK blue",
    "CK red",
    "Custom…",
  ]);
  expect(
    options[0].querySelector<HTMLElement>(".text-color-swatch")!.style
      .backgroundColor,
  ).toBe("rgb(194, 163, 218)");
  expect(
    options.every((option) => option.querySelector(".text-color-swatch")),
  ).toBe(true);
  await act(async () =>
    options.find((option) => option.textContent === "Whisper")!.click(),
  );
  expect((await openSavedProjectFromEditor()).layers[0]).toMatchObject({
    colorRuns: [{ start: 0, end: 4, color: "#eda841" }],
  });
  expect(colors.textContent).toBe("Whisper");
  expect(
    colors.querySelector<HTMLElement>(".text-color-swatch")!.style
      .backgroundColor,
  ).toBe("rgb(237, 168, 65)");
  await click("Undo");
  expect((await openSavedProjectFromEditor()).layers[0]).toMatchObject({
    colorRuns: [],
  });
});

test("focusing the color dropdown preserves text selection and tabbing out does not steal focus", async () => {
  await mount(addTextLayer(openProject(), "chat"));
  await selectLayer("Text");
  await act(async () =>
    container
      .querySelector(".text-layer")!
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
  );
  const colors = container.querySelector<HTMLButtonElement>(
    ".selection-colors button[data-text-color-control]",
  )!;
  await act(async () => {
    container.querySelector<HTMLElement>('[contenteditable="true"]')!.focus();
    colors.focus();
  });
  expect(colors.disabled).toBe(false);
  expect(container.querySelector('[contenteditable="true"]')).not.toBeNull();
  const width = container.querySelector<HTMLInputElement>(
    '.text-controls input[min="1"][value="400"]',
  )!;
  await act(async () => width.focus());
  expect(document.activeElement).toBe(width);
  expect(container.querySelector('[contenteditable="true"]')).toBeNull();
});

test.each(["empty", "text-only"])(
  "both appearance modes show a transparency checkerboard for a %s canvas",
  async (content) => {
    loadEditorStyles();
    const project =
      content === "empty"
        ? openProject()
        : addTextLayer(
            openProject(),
            "caption",
            { x: 10, y: 10 },
            { text: "Caption", colorRuns: [] },
          );
    await mount(project);
    const canvas = container.querySelector<HTMLElement>(".canvas")!;
    const styles = getComputedStyle(canvas);
    expect(styles.backgroundImage).toContain("repeating-conic-gradient");
    expect(styles.backgroundSize).toBe("32px 32px");
    const theme = getComputedStyle(document.documentElement);
    expect(theme.getPropertyValue("--transparency-light").trim()).toBe(
      "#faf8f4",
    );
    expect(theme.getPropertyValue("--transparency-dark").trim()).toBe(
      "#ded9d0",
    );
    document.documentElement.dataset.appearance = "dark";
    const darkTheme = getComputedStyle(document.documentElement);
    expect(darkTheme.getPropertyValue("--transparency-light").trim()).toBe(
      "#3e3943",
    );
    expect(darkTheme.getPropertyValue("--transparency-dark").trim()).toBe(
      "#302d34",
    );
    expect(getComputedStyle(canvas).backgroundImage).toContain(
      "repeating-conic-gradient",
    );
  },
);

test("changing to dark mode updates the checkerboard without changing the saved project", async () => {
  loadEditorStyles();
  await mount();
  await click("Save project");
  const lightProject = saved;
  document.documentElement.dataset.appearance = "dark";
  const theme = getComputedStyle(document.documentElement);
  expect(theme.getPropertyValue("--transparency-light").trim()).toBe("#3e3943");
  expect(theme.getPropertyValue("--transparency-dark").trim()).toBe("#302d34");
  expect(
    getComputedStyle(container.querySelector(".canvas")!).backgroundImage,
  ).toContain("repeating-conic-gradient");
  await click("Save project");
  expect(saved).toBe(lightProject);
});

test.each(["light", "dark"])(
  "%s transparency preview stays behind cropped and translucent layers at a zoomed and panned view",
  async (appearance) => {
    loadEditorStyles();
    document.documentElement.dataset.appearance = appearance;
    let project = cropImageLayer(stackedProject(), "top", {
      x: 5,
      y: 5,
      width: 20,
      height: 10,
    });
    project = moveLayer(project, "top", 30, 40);
    project = setLayerOpacity(project, "top", 0.4);
    project = setLayerOpacity(project, "middle", 0.6);
    project = setView(project, 2, 18, -12);
    await mount(project);
    const canvas = container.querySelector<HTMLElement>(".canvas")!;
    expect(canvas.style.transform).toBe("translate(18px, -12px) scale(2)");
    expect(getComputedStyle(canvas).backgroundImage).toContain(
      "repeating-conic-gradient",
    );
    const image = container.querySelector<HTMLElement>('[title="Top.png"]')!;
    const text = container.querySelector<HTMLElement>(".text-layer")!;
    expect(image.style.opacity).toBe("0.4");
    expect(image.style.left).toBe("30px");
    expect(image.style.width).toBe("20px");
    expect(getComputedStyle(image).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(text.style.opacity).toBe("0.6");
    expect(getComputedStyle(text).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(saveProject(await openSavedProjectFromEditor())).toBe(
      saveProject(project),
    );
    await selectLayer("Top.png");
    await click("Crop image");
    expect(getComputedStyle(canvas).backgroundImage).toContain(
      "repeating-conic-gradient",
    );
    await click("Cancel");
    await pointer(image, "pointerdown", 0, 0);
    await pointer(image, "pointermove", 20, 20);
    await pointer(image, "pointerup", 20, 20);
    expect(image.style.left).toBe("40px");
    expect(getComputedStyle(canvas).backgroundImage).toContain(
      "repeating-conic-gradient",
    );
  },
);

function button(name: string) {
  const found = [...container.querySelectorAll("button")].find(
    (candidate) =>
      candidate.getAttribute("aria-label") === name ||
      candidate.textContent?.trim() === name,
  );
  if (!found) throw new Error(`Missing button: ${name}`);
  return found;
}

function layerButton(name: string) {
  const found = [
    ...container.querySelectorAll<HTMLButtonElement>(".layer-select"),
  ].find((candidate) => candidate.textContent?.includes(name));
  if (!found)
    throw new Error(
      `Missing layer: ${name}; found ${[...container.querySelectorAll(".layer-select")].map((layer) => layer.textContent).join(" | ")}`,
    );
  return found;
}

async function click(name: string) {
  await act(async () => button(name).click());
}

async function mount(project: Project = stackedProject()) {
  window.screenshotEditorFiles = {
    open: async () => [
      {
        name: "stack.screenshot-project.json",
        bytes: new TextEncoder().encode(saveProject(project)),
      },
    ],
    save: async (request) => {
      saved = new TextDecoder().decode(request.bytes);
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
  await click("Open project");
}

async function selectLayer(name: string) {
  await act(async () => layerButton(name).click());
}

async function openSavedProjectFromEditor() {
  await click("Save project");
  if (!saved) throw new Error("Expected the project to be saved");
  return openSavedProject(saved);
}

async function keyDown(key: string, target: HTMLElement = document.body) {
  await act(async () =>
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    ),
  );
}

function stubImageDecode() {
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = 80;
      naturalHeight = 40;
      onload?: () => void;
      onerror?: () => void;
      set src(value: string) {
        queueMicrotask(() =>
          value.includes("Y29ycnVwdA==") ? this.onerror?.() : this.onload?.(),
        );
      }
    },
  );
}

async function transferEvent(
  type: string,
  files: File[],
  target: HTMLElement = document.body,
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const transfer = {
    files,
    types: ["Files"],
    getData: () => "",
    items: files.map((file) => ({
      kind: "file",
      type: file.type,
      getAsFile: () => file,
    })),
  };
  Object.defineProperty(
    event,
    type === "paste" ? "clipboardData" : "dataTransfer",
    { value: transfer },
  );
  await act(async () => {
    target.dispatchEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  return event;
}

test("clipboard import selects one image and survives save/open and undo/redo", async () => {
  stubImageDecode();
  await mount();
  const event = await transferEvent("paste", [
    new File(["png"], "Paste.png", { type: "image/png" }),
    new File(["png"], "Ignored.png", { type: "image/png" }),
  ]);
  expect(event.defaultPrevented).toBe(true);
  expect(layerButton("Paste.png").getAttribute("aria-pressed")).toBe("true");
  const project = await openSavedProjectFromEditor();
  expect(project.layers).toHaveLength(4);
  expect(project.layers[3]).toMatchObject({
    name: "Paste.png",
    crop: { width: 80, height: 40 },
  });
  await click("Undo");
  expect((await openSavedProjectFromEditor()).layers).toHaveLength(3);
  await click("Redo");
  expect((await openSavedProjectFromEditor()).layers).toHaveLength(4);
});

test("external drop shows feedback and imports without navigating; unrelated drops are safe", async () => {
  stubImageDecode();
  await mount();
  const viewport = container.querySelector<HTMLElement>(".viewport")!;
  const image = new File(["png"], "Drop.png", { type: "image/png" });
  expect(
    (await transferEvent("dragover", [image], viewport)).defaultPrevented,
  ).toBe(true);
  expect(viewport.textContent).toContain("Drop screenshot here");
  expect(
    (await transferEvent("drop", [image], viewport)).defaultPrevented,
  ).toBe(true);
  expect(layerButton("Drop.png").getAttribute("aria-pressed")).toBe("true");
  expect(viewport.textContent).not.toContain("Drop screenshot here");
  expect(
    (await transferEvent("drop", [new File(["text"], "note.txt")], viewport))
      .defaultPrevented,
  ).toBe(true);
  expect((await openSavedProjectFromEditor()).layers).toHaveLength(4);
});

test("unsupported first image is accepted for an error, without valid-drop feedback for a later image", async () => {
  await mount();
  const viewport = container.querySelector<HTMLElement>(".viewport")!;
  const transfer = {
    files: [],
    types: ["Files"],
    dropEffect: "none",
    items: [
      { kind: "file", type: "image/svg+xml", getAsFile: () => null },
      { kind: "file", type: "image/png", getAsFile: () => null },
    ],
  };
  const event = new Event("dragover", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  await act(async () => viewport.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  expect(transfer.dropEffect).toBe("copy");
  expect(viewport.textContent).not.toContain("Drop screenshot here");
});

test.each(["paste", "drop"])(
  "invalid %s images leave selection, project and history intact",
  async (delivery) => {
    stubImageDecode();
    await mount();
    await selectLayer("Top.png");
    const before = saveProject(await openSavedProjectFromEditor());
    const target =
      delivery === "drop"
        ? container.querySelector<HTMLElement>(".viewport")!
        : document.body;
    await transferEvent(
      delivery,
      [
        new File(["svg"], "first.svg", { type: "image/svg+xml" }),
        new File(["png"], "second.png", { type: "image/png" }),
      ],
      target,
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Choose a JPG",
    );
    await transferEvent(
      delivery,
      [new File(["corrupt"], "broken.png", { type: "image/png" })],
      target,
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "could not be decoded",
    );
    expect(saveProject(await openSavedProjectFromEditor())).toBe(before);
    expect(layerButton("Top.png").getAttribute("aria-pressed")).toBe("true");
    expect(button("Undo").disabled).toBe(true);
  },
);

test("picker uses the same image import and decode errors", async () => {
  stubImageDecode();
  await mount();
  window.screenshotEditorFiles!.open = async () => [
    { name: "Picker.png", bytes: new TextEncoder().encode("png") },
  ];
  await act(async () => {
    button("Import image").click();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(layerButton("Picker.png").getAttribute("aria-pressed")).toBe("true");
  expect((await openSavedProjectFromEditor()).layers).toHaveLength(4);
});

test("text fields and inline editor retain clipboard paste; plain text does not import", async () => {
  stubImageDecode();
  await mount();
  await click("Chat");
  const image = new File(["png"], "NoImport.png", { type: "image/png" });
  const chat = container.querySelector<HTMLTextAreaElement>("textarea")!;
  expect((await transferEvent("paste", [image], chat)).defaultPrevented).toBe(
    false,
  );
  await selectLayer("Text");
  await act(async () =>
    container
      .querySelector<HTMLElement>(".text-layer")!
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
  );
  const editable = container.querySelector<HTMLElement>(
    '[contenteditable="true"]',
  )!;
  expect(editable).not.toBeNull();
  expect(
    (await transferEvent("paste", [image], editable)).defaultPrevented,
  ).toBe(false);
  await keyDown("Escape", editable);
  expect(
    (await transferEvent("paste", [], document.body)).defaultPrevented,
  ).toBe(false);
  expect((await openSavedProjectFromEditor()).layers).toHaveLength(3);
});

test("internal layer reorder drops still change stack order", async () => {
  await mount();
  const transfer = {
    types: ["text/plain"],
    setData() {},
    getData: () => "top",
  };
  async function drag(target: HTMLElement, type: string) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: transfer });
    await act(async () => target.dispatchEvent(event));
  }
  await drag(button("Drag Top.png to reorder"), "dragstart");
  const list = container.querySelector('[role="list"]')!;
  await drag(list.lastElementChild as HTMLElement, "dragover");
  await drag(list.lastElementChild as HTMLElement, "drop");
  expect(
    (await openSavedProjectFromEditor()).layers.map((layer) => layer.id),
  ).toEqual(["top", "bottom", "middle"]);
});

test("pasting during an image drag keeps the import when the old pointer releases", async () => {
  stubImageDecode();
  await mount();
  await selectLayer("Top.png");
  const layer = [...container.querySelectorAll<HTMLElement>(".image-layer")].at(
    -1,
  )!;
  await pointer(layer, "pointerdown", 10, 10);
  await pointer(layer, "pointermove", 25, 25);
  await transferEvent("paste", [
    new File(["png"], "Paste.png", { type: "image/png" }),
  ]);
  await pointer(layer, "pointerup", 25, 25);
  expect((await openSavedProjectFromEditor()).layers).toHaveLength(4);
  await click("Undo");
  expect((await openSavedProjectFromEditor()).layers).toHaveLength(3);
});

async function pointer(target: Element, type: string, x: number, y = 0) {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    buttons: type === "pointerup" ? 0 : 1,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  await act(async () => target.dispatchEvent(event));
}

function positionInput(axis: "X" | "Y") {
  const input = container.querySelector<HTMLInputElement>(
    `[aria-label='Image ${axis}']`,
  );
  if (!input) throw new Error(`Missing ${axis} position input`);
  return input;
}

async function typePosition(axis: "X" | "Y", value: string) {
  const input = positionInput(axis);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

test("numeric image positions commit on Enter or blur rather than every keystroke", async () => {
  await mount(resizableProject());
  await selectLayer("Screenshot");
  expect(positionInput("X").value).toBe("40");
  expect(positionInput("Y").value).toBe("30");
  await typePosition("X", "1");
  await typePosition("X", "12");
  await typePosition("X", "125.5");
  expect(button("Undo").disabled).toBe(true);
  expect(container.querySelector<HTMLElement>(".image-layer")!.style.left).toBe(
    "40px",
  );
  await keyDown("Enter", positionInput("X"));
  expect((await openSavedProjectFromEditor()).layers[0]).toMatchObject({
    x: 125.5,
    y: 30,
    scale: 2,
  });
  await click("Undo");
  expect(positionInput("X").value).toBe("40");
  expect(button("Undo").disabled).toBe(true);
  await click("Redo");
  expect(positionInput("X").value).toBe("125.5");

  await act(async () => positionInput("Y").focus());
  await typePosition("Y", "-12.25");
  await act(async () => positionInput("Y").blur());
  expect((await openSavedProjectFromEditor()).layers[0]).toMatchObject({
    x: 125.5,
    y: -12.25,
  });
  await click("Undo");
  expect(positionInput("Y").value).toBe("30");
  await click("Undo");
  expect(positionInput("X").value).toBe("40");
  expect(button("Undo").disabled).toBe(true);
});

test("invalid or cancelled numeric positions leave the image and its history unchanged", async () => {
  await mount(resizableProject());
  await selectLayer("Screenshot");
  for (const invalid of ["", "1e999"]) {
    await typePosition("X", invalid);
    await keyDown("Enter", positionInput("X"));
    expect(positionInput("X").value).toBe("40");
  }
  await typePosition("Y", "-150");
  await keyDown("Escape", positionInput("Y"));
  expect(positionInput("Y").value).toBe("30");
  await keyDown("Backspace", positionInput("Y"));
  expect((await openSavedProjectFromEditor()).layers).toEqual(
    resizableProject().layers,
  );
  expect(button("Undo").disabled).toBe(true);
});

test("selecting an image reveals four handles and a corner resize previews and commits as one edit", async () => {
  await mount(resizableProject());
  expect(container.querySelectorAll(".image-resize-handle")).toHaveLength(0);
  await selectLayer("Screenshot");
  expect(container.querySelectorAll(".image-resize-handle")).toHaveLength(4);
  const handle = button("Resize image top left");
  await pointer(handle, "pointerdown", 100, 100);
  await pointer(handle, "pointermove", 40, 70);
  const image = container.querySelector<HTMLElement>(".image-layer")!;
  expect(image.style.left).toBe("-80px");
  expect(image.style.top).toBe("-30px");
  expect(image.style.width).toBe("600px");
  expect(button("Undo").disabled).toBe(true);
  await pointer(handle, "pointerup", -20, 40);

  const resized = await openSavedProjectFromEditor();
  expect(resized.layers[0]).toMatchObject({ x: -200, y: -90, scale: 3 });
  expect(resized.panX).toBe(18);
  expect(resized.panY).toBe(-12);
  await click("Undo");
  expect((await openSavedProjectFromEditor()).layers).toEqual(
    resizableProject().layers,
  );
  expect(button("Undo").disabled).toBe(true);
  await click("Redo");
  expect((await openSavedProjectFromEditor()).layers).toEqual(resized.layers);
});

test.each([0.25, 2])(
  "image resizing uses pointer deltas at zoom %s without changing pan",
  async (zoom) => {
    await mount(resizableProject(zoom));
    await selectLayer("Screenshot");
    const handle = button("Resize image bottom right");
    await pointer(handle, "pointerdown", 300, 200);
    await pointer(handle, "pointerup", 300 + 240 * zoom, 200 + 120 * zoom);
    expect(await openSavedProjectFromEditor()).toMatchObject({
      panX: 18,
      panY: -12,
      zoom,
      layers: [expect.objectContaining({ x: 40, y: 30, scale: 3 })],
    });
  },
);

test.each(["Escape", "pointercancel", "lostpointercapture"])(
  "%s cancels an image resize and ignores a late release",
  async (cancel) => {
    const project = resizableProject();
    await mount(project);
    await selectLayer("Screenshot");
    const handle = button("Resize image bottom right");
    await pointer(handle, "pointerdown", 100, 100);
    await pointer(handle, "pointermove", 220, 160);
    expect(
      container.querySelector<HTMLElement>(".image-layer")!.style.width,
    ).toBe("720px");
    if (cancel === "Escape") await keyDown("Escape", handle);
    else await pointer(handle, cancel, 220, 160);
    await pointer(handle, "pointerup", 340, 220);
    expect((await openSavedProjectFromEditor()).layers).toEqual(project.layers);
    expect(button("Undo").disabled).toBe(true);
  },
);

test("resized images still support drag, arrow nudge, scale presets, and Fit", async () => {
  await mount(resizableProject());
  await selectLayer("Screenshot");
  const handle = button("Resize image bottom right");
  await pointer(handle, "pointerdown", 0, 0);
  await pointer(handle, "pointerup", 120, 60);
  const image = container.querySelector(".image-layer")!;
  await pointer(image, "pointerdown", 0, 0);
  await pointer(image, "pointerup", 10, 5);
  await keyDown("ArrowRight");
  expect(positionInput("X").value).toBe("61");
  expect(positionInput("Y").value).toBe("40");
  await click("100%");
  expect((await openSavedProjectFromEditor()).layers[0]).toMatchObject({
    x: 61,
    y: 40,
    scale: 1,
  });
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>("[title='Fit image to canvas']")!
      .click(),
  );
  const fitted = (await openSavedProjectFromEditor()).layers[0];
  expect(fitted).toMatchObject({ x: 61, y: 40 });
  if (fitted?.kind !== "image") throw new Error("Expected an image");
  expect(fitted.scale).toBeCloseTo(800 / 240);
});

test("the visible duplicate action selects a rendered text copy and supports undo and redo", async () => {
  await mount();
  expect(button("Duplicate layer").disabled).toBe(true);
  await selectLayer("Text");
  await click("Duplicate layer");

  const duplicated = await openSavedProjectFromEditor();
  expect(duplicated.layers.map((layer) => layer.name)).toEqual([
    "Bottom.png",
    "Text",
    "Text copy",
    "Top.png",
  ]);
  expect(layerButton("Text copy").getAttribute("aria-pressed")).toBe("true");
  expect(container.querySelectorAll(".text-layer")).toHaveLength(2);
  const copy = container.querySelector<HTMLElement>(
    ".text-layer[title='Text copy']",
  )!;
  expect(copy.classList.contains("selected")).toBe(true);
  expect(copy.style.left).toBe("28px");
  expect(copy.style.top).toBe("34px");
  expect(copy.textContent).toContain("A caption");

  await click("Undo");
  expect(container.querySelectorAll(".text-layer")).toHaveLength(1);
  await click("Redo");
  expect((await openSavedProjectFromEditor()).layers).toEqual(
    duplicated.layers,
  );
});

test.each([
  ["Top.png", 0.5, 16, 16],
  ["Top.png", 2, 16, 16],
  ["Text", 0.5, 28, 34],
  ["Text", 2, 28, 34],
] as const)(
  "duplicating %s at zoom %s keeps a 16-pixel document offset and survives reopening",
  async (name, zoom, x, y) => {
    await mount(setView(stackedProject(), zoom, 20, -10));
    await selectLayer(name);
    await click("Duplicate layer");
    const duplicated = await openSavedProjectFromEditor();
    const original = duplicated.layers.find((layer) => layer.name === name)!;
    const copy = duplicated.layers.find(
      (layer) => layer.name === `${name} copy`,
    )!;

    expect(copy.id).not.toBe(original.id);
    expect(copy).toMatchObject({ x, y });
    expect(new Set(duplicated.layers.map((layer) => layer.id)).size).toBe(4);
    expect(layerButton(`${name} copy`).getAttribute("aria-pressed")).toBe(
      "true",
    );
    const selector = name === "Text" ? ".text-layer" : ".image-layer";
    const rendered = container.querySelector<HTMLElement>(
      `${selector}[title='${name} copy']`,
    )!;
    expect(rendered.style.left).toBe(`${x}px`);
    expect(rendered.style.top).toBe(`${y}px`);

    const serialized = saved!;
    window.screenshotEditorFiles!.open = async () => [
      {
        name: "duplicated.screenshot-project.json",
        bytes: new TextEncoder().encode(serialized),
      },
    ];
    await click("Open project");
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(4);
    expect(
      container.querySelector(`${selector}[title='${name} copy']`),
    ).not.toBeNull();
    expect((await openSavedProjectFromEditor()).layers).toEqual(
      duplicated.layers,
    );
  },
);

test("the visible delete action removes the selected layer, selects the next row, and supports undo and redo", async () => {
  expect(stackedProject().layers.map((layer) => layer.id)).toEqual([
    "bottom",
    "middle",
    "top",
  ]);
  await mount();
  expect(button("Delete layer").disabled).toBe(true);
  await selectLayer("Text");
  await click("Delete layer");

  expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(2);
  expect(layerButton("Bottom.png").getAttribute("aria-pressed")).toBe("true");
  const deleted = await openSavedProjectFromEditor();
  expect(deleted.layers.map((layer) => layer.id)).toEqual(["bottom", "top"]);
  expect(container.querySelector(".text-layer")).toBeNull();

  await click("Undo");
  expect(
    (await openSavedProjectFromEditor()).layers.map((layer) => layer.id),
  ).toEqual(["bottom", "middle", "top"]);
  await click("Redo");
  expect(
    (await openSavedProjectFromEditor()).layers.map((layer) => layer.id),
  ).toEqual(["bottom", "top"]);
});

test.each([
  ["Top.png", ".image-layer[title='Top.png']"],
  ["Text", ".text-resize-handle.se"],
])(
  "duplicating %s ends its active gesture so a late release keeps the copy and its history",
  async (name, selector) => {
    const project = stackedProject();
    await mount(project);
    await selectLayer(name);
    const handle = container.querySelector(selector)!;
    await pointer(handle, "pointerdown", 0);
    await pointer(handle, "pointermove", 40);
    await click("Duplicate layer");
    await pointer(handle, "pointerup", 80);

    const duplicated = await openSavedProjectFromEditor();
    expect(duplicated.layers).toHaveLength(4);
    expect(
      duplicated.layers.filter((layer) => !layer.name.endsWith(" copy")),
    ).toEqual(project.layers);
    expect(layerButton(`${name} copy`).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await click("Undo");
    expect((await openSavedProjectFromEditor()).layers).toEqual(project.layers);
    await click("Redo");
    expect((await openSavedProjectFromEditor()).layers).toEqual(
      duplicated.layers,
    );
  },
);

test.each([
  ["Top.png", "Text"],
  ["Bottom.png", "Text"],
  ["Text", "Bottom.png"],
])(
  "deleting %s selects the next layer in the visible stack",
  async (name, next) => {
    await mount();
    await selectLayer(name);
    await keyDown("Delete", layerButton(name));
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(2);
    expect(layerButton(next).getAttribute("aria-pressed")).toBe("true");
  },
);

test.each(["Delete", "Backspace"])(
  "%s removes a selected layer when focus is on its layer row",
  async (key) => {
    await mount();
    const row = layerButton("Top.png");
    await selectLayer("Top.png");
    row.focus();
    await keyDown(key, row);
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(2);
    expect(container.querySelector(".image-layer[title='Top.png']")).toBeNull();
  },
);

test.each(["chat draft", "layer name"])(
  "%s text remains editable when Delete and Backspace are pressed",
  async (field) => {
    await mount();
    await selectLayer("Text");
    const input =
      field === "chat draft"
        ? (await click("Chat"),
          container.querySelector(
            '[aria-label="Chat draft"]',
          ) as HTMLTextAreaElement)
        : (container.querySelector(
            '[aria-label="Name for Text"]',
          ) as HTMLInputElement);
    input.focus();
    await keyDown("Delete", input);
    await keyDown("Backspace", input);
    expect(layerButton("Text")).toBeDefined();
    expect(button("Delete layer").disabled).toBe(false);
  },
);

test.each(["Delete", "Backspace"])(
  "%s does not remove a layer while inline text is active",
  async (key) => {
    await mount();
    await selectLayer("Text");
    const textLayer = container.querySelector(".text-layer")!;
    await act(async () =>
      textLayer.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    const editor = container.querySelector(
      '[contenteditable="true"]',
    ) as HTMLElement;
    expect(editor).not.toBeNull();
    await keyDown(key, editor);
    expect(layerButton("Text")).toBeDefined();
  },
);

test("deleting during an image drag cancels the gesture before a late pointer release", async () => {
  await mount(
    addImageLayer(openProject(), {
      id: "moving",
      name: "Moving.png",
      source: "data:image/png;base64,image",
      format: "image/png",
      width: 100,
      height: 50,
    }),
  );
  const image = container.querySelector(".image-layer")!;
  await pointer(image, "pointerdown", 0);
  await pointer(image, "pointermove", 40);
  await click("Delete layer");
  await pointer(image, "pointerup", 80);

  const deleted = await openSavedProjectFromEditor();
  expect(deleted.layers).toEqual([]);
  await click("Undo");
  expect((await openSavedProjectFromEditor()).layers[0]).toMatchObject({
    x: 0,
    y: 0,
  });
});

test("deleting during a text resize cancels the edit before Undo restores the original text layer", async () => {
  await mount();
  await selectLayer("Text");
  const handle = container.querySelector(".text-resize-handle.se")!;
  await pointer(handle, "pointerdown", 0);
  await pointer(handle, "pointermove", 40);
  await click("Delete layer");
  await pointer(handle, "pointerup", 80);

  expect(
    (await openSavedProjectFromEditor()).layers.map((layer) => layer.id),
  ).toEqual(["bottom", "top"]);
  await click("Undo");
  expect(
    (await openSavedProjectFromEditor()).layers.find(
      (layer) => layer.id === "middle",
    ),
  ).toMatchObject({ wrapWidth: 400 });
});
