// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App";
import {
  addImageLayer,
  addTextLayer,
  openProject,
  openSavedProject,
  saveProject,
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
  async function pointer(type: string, x: number) {
    const event = new MouseEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: 0,
      buttons: type === "pointerup" ? 0 : 1,
    });
    Object.defineProperty(event, "pointerId", { value: 1 });
    await act(async () => image.dispatchEvent(event));
  }
  await pointer("pointerdown", 0);
  await pointer("pointermove", 40);
  await click("Delete layer");
  await pointer("pointerup", 80);

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
  async function pointer(type: string, x: number) {
    const event = new MouseEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: 0,
      buttons: type === "pointerup" ? 0 : 1,
    });
    Object.defineProperty(event, "pointerId", { value: 1 });
    await act(async () => handle.dispatchEvent(event));
  }
  await pointer("pointerdown", 0);
  await pointer("pointermove", 40);
  await click("Delete layer");
  await pointer("pointerup", 80);

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
