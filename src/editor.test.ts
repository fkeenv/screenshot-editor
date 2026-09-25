import { expect, test } from "vitest";
import {
  addImageLayer,
  addTextLayer,
  cropImageLayer,
  colorTextRange,
  contentToDocument,
  documentToContent,
  editTextLayer,
  finishLayerOpacity,
  finishImageScale,
  fitImageLayerToCanvas,
  moveLayer,
  nudgeLayer,
  openProject,
  parseColoredText,
  previewLayerOpacity,
  previewImageScale,
  redo,
  reorderLayer,
  renameLayer,
  setLayerVisibility,
  setLayerOpacity,
  resizeTextLayer,
  replaceTextRange,
  scaleImageLayer,
  setCanvasSize,
  setView,
  supportedImageFormat,
  TEXT_COLOR_PRESETS,
  undo,
} from "./editor";

const TEST_IMAGE = {
  id: "image-1",
  name: "Screenshot",
  source: "data:image/png;base64,example",
  format: "image/png",
  width: 320,
  height: 180,
} as const;

function projectWithImage() {
  return addImageLayer(openProject(), TEST_IMAGE);
}

test("a new project opens on a canvas with a visible size", () => {
  const project = openProject();

  expect(project.canvasWidth).toBe(800);
  expect(project.canvasHeight).toBe(600);
});

test("choosing 1150×600 changes the canvas", () => {
  const project = setCanvasSize(openProject(), 1150, 600);

  expect(project.canvasWidth).toBe(1150);
  expect(project.canvasHeight).toBe(600);
});

test("typing a custom width and height changes the canvas", () => {
  const project = setCanvasSize(openProject(), 640, 480);

  expect(project.canvasWidth).toBe(640);
  expect(project.canvasHeight).toBe(480);
});

test("zoom and pan change the view and leave the canvas size unchanged", () => {
  const sized = setCanvasSize(openProject(), 1150, 600);
  const project = setView(sized, 2, 40, -15);

  expect(project.zoom).toBe(2);
  expect(project.panX).toBe(40);
  expect(project.panY).toBe(-15);
  expect(project.canvasWidth).toBe(1150);
  expect(project.canvasHeight).toBe(600);
});

test("undo and redo restore the previous canvas size and view", () => {
  const resized = setCanvasSize(openProject(), 1150, 600);
  const viewed = setView(resized, 2, 10, 20);

  const afterViewUndo = undo(viewed);
  expect(afterViewUndo.zoom).toBe(1);
  expect(afterViewUndo.panX).toBe(0);
  expect(afterViewUndo.panY).toBe(0);
  expect(afterViewUndo.canvasWidth).toBe(1150);
  expect(afterViewUndo.canvasHeight).toBe(600);

  const afterSizeUndo = undo(afterViewUndo);
  expect(afterSizeUndo.canvasWidth).toBe(800);
  expect(afterSizeUndo.canvasHeight).toBe(600);

  const redone = redo(afterSizeUndo);
  expect(redone.canvasWidth).toBe(1150);
  expect(redone.canvasHeight).toBe(600);
  expect(redone.zoom).toBe(1);
});

test.each([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
] as const)("importing a %s creates its own image layer", (format) => {
  const project = addImageLayer(openProject(), {
    id: `image-${format}`,
    name: "Screenshot",
    source: "data:image/example",
    format,
    width: 320,
    height: 180,
  });

  expect(project.layers).toEqual([
    {
      id: `image-${format}`,
      kind: "image",
      name: "Screenshot",
      visible: true,
      opacity: 1,
      source: "data:image/example",
      format,
      naturalWidth: 320,
      naturalHeight: 180,
      x: 0,
      y: 0,
      scale: 1,
      crop: { x: 0, y: 0, width: 320, height: 180 },
    },
  ]);
  expect(project.canvasWidth).toBe(800);
  expect(project.canvasHeight).toBe(600);
});

test("adding a text box creates a layer separate from the canvas", () => {
  const project = addTextLayer(openProject(), "text-1");

  expect(project.layers).toEqual([
    {
      id: "text-1",
      kind: "text",
      name: "Text",
      visible: true,
      opacity: 1,
      text: "Text",
      colorRuns: [],
      x: 32,
      y: 32,
      fontFamily: "Arial",
      fontSize: 24,
      bold: false,
      outlineWidth: 2,
      outlineColor: "#000000",
      lineSpacing: 1.2,
      wrapWidth: 400,
    },
  ]);
  expect(project.canvasWidth).toBe(800);
  expect(project.canvasHeight).toBe(600);
});

test("repeated text boxes receive numbered layer names", () => {
  const project = addTextLayer(
    addTextLayer(addTextLayer(openProject(), "text-1"), "text-2"),
    "text-3",
  );

  expect(project.layers.map((layer) => layer.name)).toEqual([
    "Text",
    "Text (1)",
    "Text (2)",
  ]);
});

test("images with the same file name receive numbered layer names", () => {
  const image = {
    name: "screenshot.png",
    source: "data:image/example",
    format: "image/png" as const,
    width: 320,
    height: 180,
  };
  const project = addImageLayer(
    addImageLayer(openProject(), { ...image, id: "image-1" }),
    { ...image, id: "image-2" },
  );

  expect(project.layers.map((layer) => layer.name)).toEqual([
    "screenshot.png",
    "screenshot.png (1)",
  ]);
});

test("reordering a layer changes its paint order from bottom to top", () => {
  const withTwoLayers = addTextLayer(
    addTextLayer(openProject(), "bottom"),
    "top",
  );

  const project = reorderLayer(withTwoLayers, "bottom", 1);

  expect(project.layers.map((layer) => layer.id)).toEqual(["top", "bottom"]);
});

test("hiding a layer records visibility without changing its content", () => {
  const added = addTextLayer(openProject(), "text-1");

  const project = setLayerVisibility(added, "text-1", false);

  expect(project.layers[0]).toMatchObject({
    id: "text-1",
    visible: false,
    text: "Text",
  });
});

test("renaming a layer changes its panel name without changing its content", () => {
  const added = addTextLayer(openProject(), "text-1");

  const project = renameLayer(added, "text-1", "Caption");

  expect(project.layers[0]).toMatchObject({ name: "Caption", text: "Text" });
});

test("setting opacity changes only a layer's visual strength", () => {
  const added = addTextLayer(openProject(), "text-1");

  const project = setLayerOpacity(added, "text-1", 0.4);

  expect(project.layers[0]).toMatchObject({ opacity: 0.4, text: "Text" });
});

test("opacity previews live and commits one undoable edit", () => {
  const added = addTextLayer(openProject(), "text-1");
  const previewed = previewLayerOpacity(added, "text-1", 0.4);

  expect(previewed.layers[0]).toMatchObject({ opacity: 0.4 });
  expect(previewed.past).toHaveLength(added.past.length);

  const committed = finishLayerOpacity(previewed, "text-1", 1);
  expect(committed.past).toHaveLength(added.past.length + 1);
  expect(undo(committed).layers[0]).toMatchObject({ opacity: 1 });
});

test("undo and redo restore layer order, visibility, name, and opacity", () => {
  const base = addTextLayer(addTextLayer(openProject(), "bottom"), "top");
  const changed = setLayerOpacity(
    renameLayer(
      setLayerVisibility(reorderLayer(base, "bottom", 1), "bottom", false),
      "bottom",
      "Background",
    ),
    "bottom",
    0.35,
  );

  expect(changed.layers.map((layer) => layer.id)).toEqual(["top", "bottom"]);
  expect(changed.layers[1]).toMatchObject({
    visible: false,
    name: "Background",
    opacity: 0.35,
  });

  const original = undo(undo(undo(undo(changed))));
  expect(original.layers.map((layer) => layer.id)).toEqual(["bottom", "top"]);
  expect(original.layers[0]).toMatchObject({
    visible: true,
    name: "Text",
    opacity: 1,
  });

  const restored = redo(redo(redo(redo(original))));
  expect(restored.layers).toEqual(changed.layers);
});

test("a text box is placed where the canvas was clicked", () => {
  const project = addTextLayer(openProject(), "text-1", { x: 180, y: 96 });
  const layer = project.layers[0];

  expect(layer?.kind).toBe("text");
  if (layer?.kind !== "text") return;
  expect(layer.x).toBe(180);
  expect(layer.y).toBe(96);
});

test("pasted text and its drawing style are stored on the text layer", () => {
  const added = addTextLayer(openProject(), "text-1");

  const project = editTextLayer(added, "text-1", {
    text: "/me looks around.\nHello there!",
    fontFamily: "Verdana",
    fontSize: 32,
    bold: true,
    outlineWidth: 3,
    outlineColor: "#ff00aa",
    lineSpacing: 1.5,
    wrapWidth: 240,
  });

  expect(project.layers[0]).toMatchObject({
    text: "/me looks around.\nHello there!",
    fontFamily: "Verdana",
    fontSize: 32,
    bold: true,
    outlineWidth: 3,
    outlineColor: "#ff00aa",
    lineSpacing: 1.5,
    wrapWidth: 240,
  });
});

test("pasted SA-MP color codes color the following text and are not displayed", () => {
  const content = parseColoredText("{c2a3da}* John looks around.");

  expect(content).toEqual({
    text: "* John looks around.",
    colorRuns: [{ start: 0, end: 20, color: "#c2a3da" }],
  });
});

test("pasted chat lines recognize character actions and regular speech", () => {
  const content = parseColoredText(
    "John Smith reaches for the door.\nJohn Smith says: Hello.",
  );

  expect(content.colorRuns).toEqual([
    { start: 0, end: 32, color: "#c2a3da" },
    { start: 33, end: 56, color: "#f1f1f1" },
  ]);
});

test("regular speech recognition does not require a colon after says", () => {
  const content = parseColoredText('John Smith says "Hello."');

  expect(content.colorRuns).toEqual([
    { start: 0, end: 24, color: "#f1f1f1" },
  ]);
});

test("GTA World presets use the documented chat colors", () => {
  expect(TEXT_COLOR_PRESETS).toMatchObject({
    me: { color: "#c2a3da" },
    do: { color: "#c2a3da" },
    say: { color: "#f1f1f1" },
    low: { color: "#adadad" },
    whisper: { color: "#eda841" },
    phone: { color: "#fbf724" },
    transaction: { color: "#56d64b" },
    inventory: { color: "#ffff00" },
    radio: { color: "#ece3a7" },
    hq: { color: "#006eff" },
    phoneNotice: { color: "#ffff00" },
    intercom: { color: "#3896f3" },
    characterKill: { color: "#f00000" },
  });
});

test("pasted GTA World roleplay lines ignore timestamps when classifying", () => {
  const content = parseColoredText(
    [
      "[17:22:25] * John Smith opens the door.",
      "[17:22:26] * The door is open. (( John Smith ))",
      "[17:22:27] > John Smith checks his watch.",
      "[17:22:28] John Smith says: Hello.",
      "[17:22:29] John Smith says [low]: Stay close.",
      "[17:22:30] John Smith whispers: Do not move.",
      "[17:22:31] John Smith shouts (to Jane Doe): STOP!",
      "[17:22:32] John Smith says (cellphone): Hello.",
    ].join("\n"),
  );

  expect(content.colorRuns.map((run) => run.color)).toEqual([
    "#c2a3da",
    "#c2a3da",
    "#c2a3da",
    "#f1f1f1",
    "#adadad",
    "#eda841",
    "#f1f1f1",
    "#fbf724",
  ]);
});

test("pasted GTA World system lines recognize their separate colors", () => {
  const content = parseColoredText(
    [
      "[17:22:33] You paid $2,000 to Jane Doe (15/AUG/2024 - 23:25:44).",
      "[17:22:34] You took 1 Smoking Pipe from the vehicle.",
      "[17:22:35] ** [S: 1 | CH: BASE] John Smith says: Copy.",
      "[17:22:36] [HQ] Unit requested at Mission Row.",
      "[17:22:37] [PHONE] Incoming call from John Smith.",
      "[17:22:38] [INTERCOM] Please proceed to reception.",
      "[17:22:39] [Character kill] John Smith has been killed.",
    ].join("\n"),
  );

  expect(content.colorRuns.map((run) => run.color)).toEqual([
    "#56d64b",
    "#ffff00",
    "#ece3a7",
    "#006eff",
    "#ffff00",
    "#3896f3",
    "#f00000",
  ]);
});

test("GTA World inline color tokens are removed and override inference", () => {
  const content = parseColoredText(
    "[17:22:40] !{#FEB822}John Smith whispers: Wait.",
  );

  expect(content).toEqual({
    text: "[17:22:40] John Smith whispers: Wait.",
    colorRuns: [{ start: 11, end: 37, color: "#feb822" }],
  });
});

test("a manual color overrides an inferred color only within the selection", () => {
  const content = parseColoredText("John Smith says: Hello.");

  const colored = colorTextRange(content, 17, 22, "#ff0000");

  expect(colored.colorRuns).toEqual([
    { start: 0, end: 17, color: "#f1f1f1" },
    { start: 17, end: 22, color: "#ff0000" },
    { start: 22, end: 23, color: "#f1f1f1" },
  ]);
});

test("colored chat lines round-trip through the rich text document", () => {
  const content = parseColoredText(
    "{c2a3da}* John looks around.\nJohn says: Hello.",
  );
  const restored = documentToContent(contentToDocument(content));

  expect(restored.text).toBe("* John looks around.\nJohn says: Hello.");
  expect(restored.colorRuns).toEqual(content.colorRuns);
});

test("replacing selected text keeps surrounding colors and parses pasted codes", () => {
  const content = parseColoredText("John Smith says: Hello.");

  const replaced = replaceTextRange(
    content,
    17,
    22,
    "{c2a3da}waves",
  );

  expect(replaced).toEqual({
    text: "John Smith says: waves.",
    colorRuns: [
      { start: 0, end: 17, color: "#f1f1f1" },
      { start: 17, end: 22, color: "#c2a3da" },
      { start: 22, end: 23, color: "#f1f1f1" },
    ],
  });
});

test("leaving text unchanged does not add an undo entry", () => {
  const added = addTextLayer(openProject(), "text-1");

  const unchanged = editTextLayer(added, "text-1", { text: "Text" });

  expect(unchanged).toBe(added);
  expect(unchanged.past).toHaveLength(1);
});

test("dragging moves the image without moving or resizing the canvas", () => {
  const imported = projectWithImage();

  const project = moveLayer(imported, "image-1", 48, 72);

  expect(project.layers[0]).toMatchObject({ x: 48, y: 72 });
  expect(project.canvasWidth).toBe(800);
  expect(project.canvasHeight).toBe(600);
  expect(project.panX).toBe(0);
  expect(project.panY).toBe(0);
});

test("resizing a text box from the left changes its width and keeps the right edge", () => {
  const added = addTextLayer(openProject(), "text-1", { x: 32, y: 32 });
  const project = resizeTextLayer(added, "text-1", 12, 420);
  const layer = project.layers[0];

  expect(layer?.kind).toBe("text");
  if (layer?.kind !== "text") return;
  expect(layer.x).toBe(12);
  expect(layer.wrapWidth).toBe(420);
  expect(layer.x + layer.wrapWidth).toBe(432);
});

test("dragging and nudging move the text layer", () => {
  const added = addTextLayer(openProject(), "text-1");

  const dragged = moveLayer(added, "text-1", 48, 72);
  const nudged = nudgeLayer(dragged, "text-1", -1, 1);

  expect(dragged.layers[0]).toMatchObject({ x: 48, y: 72 });
  expect(nudged.layers[0]).toMatchObject({ x: 47, y: 73 });
});

test("undo and redo restore text, style, and position", () => {
  const added = addTextLayer(openProject(), "text-1");
  const edited = editTextLayer(added, "text-1", {
    text: "A pasted roleplay line",
    fontSize: 32,
    bold: true,
    wrapWidth: 240,
  });
  const moved = moveLayer(edited, "text-1", 48, 72);

  const moveUndone = undo(moved);
  expect(moveUndone.layers[0]).toMatchObject({
    text: "A pasted roleplay line",
    fontSize: 32,
    bold: true,
    wrapWidth: 240,
    x: 32,
    y: 32,
  });

  const editUndone = undo(moveUndone);
  expect(editUndone.layers[0]).toMatchObject({
    text: "Text",
    fontSize: 24,
    bold: false,
    wrapWidth: 400,
  });

  const redone = redo(redo(editUndone));
  expect(redone.layers[0]).toMatchObject({
    text: "A pasted roleplay line",
    fontSize: 32,
    bold: true,
    wrapWidth: 240,
    x: 48,
    y: 72,
  });
});

test("undo and redo restore text color runs", () => {
  const added = addTextLayer(openProject(), "text-1");
  const purple = editTextLayer(added, "text-1", {
    colorRuns: [{ start: 0, end: 4, color: "#c2a3da" }],
  });
  const red = editTextLayer(purple, "text-1", {
    colorRuns: [{ start: 0, end: 4, color: "#ff0000" }],
  });

  expect(red.layers[0]).toMatchObject({
    colorRuns: [{ start: 0, end: 4, color: "#ff0000" }],
  });
  expect(undo(red).layers[0]).toMatchObject({
    colorRuns: [{ start: 0, end: 4, color: "#c2a3da" }],
  });
  expect(redo(undo(red)).layers[0]).toMatchObject({
    colorRuns: [{ start: 0, end: 4, color: "#ff0000" }],
  });
});

test("scaling changes the image size without changing the canvas size", () => {
  const imported = projectWithImage();

  const project = scaleImageLayer(imported, "image-1", 1.5);

  expect(project.layers[0]).toMatchObject({ scale: 1.5 });
  expect(project.canvasWidth).toBe(800);
  expect(project.canvasHeight).toBe(600);
});

test("scale previews live and commits one undoable edit", () => {
  const imported = projectWithImage();

  const firstPreview = previewImageScale(imported, "image-1", 1.25);
  const finalPreview = previewImageScale(firstPreview, "image-1", 1.5);

  expect(firstPreview.layers[0]).toMatchObject({ scale: 1.25 });
  expect(finalPreview.layers[0]).toMatchObject({ scale: 1.5 });
  expect(finalPreview.past).toHaveLength(imported.past.length);

  const committed = finishImageScale(finalPreview, "image-1", 1);

  expect(committed.past).toHaveLength(imported.past.length + 1);
  expect(undo(committed).layers[0]).toMatchObject({ scale: 1 });
});

test("fit scales the visible image region inside the canvas", () => {
  const imported = projectWithImage();

  const fitted = fitImageLayerToCanvas(imported, "image-1");

  expect(fitted.layers[0]).toMatchObject({ scale: 2.5 });
  expect(undo(fitted).layers[0]).toMatchObject({ scale: 1 });
});

test("cropping keeps only the chosen image region", () => {
  const imported = projectWithImage();

  const project = cropImageLayer(imported, "image-1", {
    x: 20,
    y: 10,
    width: 240,
    height: 120,
  });

  expect(project.layers[0]).toMatchObject({
    crop: { x: 20, y: 10, width: 240, height: 120 },
  });
  expect(project.canvasWidth).toBe(800);
  expect(project.canvasHeight).toBe(600);
});

test("cropping cannot restore pixels discarded by an earlier crop", () => {
  const imported = projectWithImage();
  const cropped = cropImageLayer(imported, "image-1", {
    x: 20,
    y: 10,
    width: 240,
    height: 120,
  });

  const expanded = cropImageLayer(cropped, "image-1", {
    x: 0,
    y: 0,
    width: 320,
    height: 180,
  });

  expect(expanded.layers[0]).toMatchObject({
    crop: { x: 20, y: 10, width: 240, height: 120 },
  });
});

test("undo and redo restore image position, scale, and crop", () => {
  const imported = projectWithImage();
  const moved = moveLayer(imported, "image-1", 48, 72);
  const scaled = scaleImageLayer(moved, "image-1", 1.5);
  const cropped = cropImageLayer(scaled, "image-1", {
    x: 20,
    y: 10,
    width: 240,
    height: 120,
  });

  const cropUndone = undo(cropped);
  expect(cropUndone.layers[0]).toMatchObject({
    x: 48,
    y: 72,
    scale: 1.5,
    crop: { x: 0, y: 0, width: 320, height: 180 },
  });

  const scaleUndone = undo(cropUndone);
  expect(scaleUndone.layers[0]).toMatchObject({ scale: 1 });

  const moveUndone = undo(scaleUndone);
  expect(moveUndone.layers[0]).toMatchObject({ x: 0, y: 0 });

  const redone = redo(redo(redo(moveUndone)));
  expect(redone.layers[0]).toMatchObject({
    x: 48,
    y: 72,
    scale: 1.5,
    crop: { x: 20, y: 10, width: 240, height: 120 },
  });
});

test.each([
  ["photo.jpg", "image/jpeg", "image/jpeg"],
  ["photo.PNG", "", "image/png"],
  ["photo.webp", "image/webp", "image/webp"],
  ["photo.GIF", "", "image/gif"],
  ["photo.bmp", "", "image/bmp"],
] as const)("recognizes supported image file %s", (name, type, format) => {
  expect(supportedImageFormat(name, type)).toBe(format);
});

test("rejects an unsupported image format", () => {
  expect(supportedImageFormat("drawing.svg", "image/svg+xml")).toBeUndefined();
});
