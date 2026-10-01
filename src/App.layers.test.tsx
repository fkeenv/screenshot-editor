// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App";
import {
  addImageLayer,
  addTextLayer,
  cropImageLayer,
  moveLayer,
  openProject,
  openSavedProject,
  saveProject,
  scaleImageLayer,
  setView,
  type Project,
} from "./editor";

let root: Root;
let container: HTMLDivElement;
let saved: string | undefined;

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
