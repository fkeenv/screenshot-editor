import { expect, test } from "vitest";
import {
  addImageLayer,
  addTextLayer,
  beginUndoableEdit,
  cropImageLayer,
  colorTextRange,
  contentToDocument,
  deleteLayer,
  documentToContent,
  duplicateLayer,
  editTextLayer,
  fitImageLayerToCanvas,
  moveLayer,
  nudgeLayer,
  openProject,
  openSavedProject,
  parseColoredText,
  redo,
  reorderLayer,
  renameLayer,
  setLayerVisibility,
  setLayerOpacity,
  resizeTextLayer,
  resizeImageLayer,
  replaceTextRange,
  scaleImageLayer,
  saveProject,
  setCanvasBackground,
  setCanvasSize,
  setView,
  supportedImageFormat,
  TEXT_COLOR_PRESETS,
  undo,
} from "./editor";

test("canvas backgrounds are undoable without changing layers or view", () => {
  const project = setView(projectWithImage(), 2, 15, -10);
  const solid = setCanvasBackground(project, {
    kind: "solid",
    color: "#abcdef",
  });
  expect(solid.canvasBackground).toEqual({ kind: "solid", color: "#abcdef" });
  expect(solid.layers).toEqual(project.layers);
  expect([solid.zoom, solid.panX, solid.panY]).toEqual([2, 15, -10]);
  expect(undo(solid).canvasBackground).toEqual({ kind: "transparent" });
  expect(undo(solid).layers).toEqual(project.layers);
  expect(redo(undo(solid)).canvasBackground).toEqual({
    kind: "solid",
    color: "#abcdef",
  });
});

test("older project files default to transparent and new files preserve solid backgrounds", () => {
  const legacy =
    '{"version":1,"project":{"canvasWidth":800,"canvasHeight":600,"zoom":1,"panX":0,"panY":0,"layers":[]}}';
  expect(openSavedProject(legacy).canvasBackground).toEqual({
    kind: "transparent",
  });
  const project = setCanvasBackground(projectWithImage(), {
    kind: "solid",
    color: "#123456",
  });
  expect(openSavedProject(saveProject(project)).canvasBackground).toEqual({
    kind: "solid",
    color: "#123456",
  });
  expect(openSavedProject(saveProject(project)).layers).toEqual(project.layers);
});

test("invalid or unchanged background choices do not add history, and malformed saved backgrounds are rejected", () => {
  const project = openProject();
  expect(setCanvasBackground(project, { kind: "transparent" })).toBe(project);
  expect(
    setCanvasBackground(project, { kind: "solid", color: "rgba(1,2,3,0.5)" }),
  ).toBe(project);
  const serialized = JSON.parse(saveProject(project));
  serialized.project.canvasBackground = { kind: "solid", color: "not-a-color" };
  expect(() => openSavedProject(JSON.stringify(serialized))).toThrow(
    "not a valid",
  );
});

test("new chat text defaults to bold lettering with no outline and a soft shadow", () => {
  expect(addTextLayer(openProject(), "chat").layers[0]).toMatchObject({
    fontFamily: "Arial",
    fontSize: 14,
    bold: true,
    outlineWidth: 0,
    shadow: { offsetX: 1, offsetY: 1, blur: 2, color: "#000000" },
  });
});

test("shadow edits are undoable, saved, and optional in older projects", () => {
  const original = addTextLayer(openProject(), "chat");
  const edited = editTextLayer(original, "chat", {
    shadow: { offsetX: -2, offsetY: 3, blur: 1, color: "#123456" },
  });
  expect(openSavedProject(saveProject(edited)).layers[0]).toMatchObject({
    shadow: { offsetX: -2, offsetY: 3, blur: 1, color: "#123456" },
  });
  expect(undo(edited).layers).toEqual(original.layers);
  expect(redo(undo(edited)).layers).toEqual(edited.layers);
  const legacy = JSON.parse(saveProject(original));
  delete legacy.project.layers[0].shadow;
  Object.assign(legacy.project.layers[0], {
    fontSize: 24,
    bold: false,
    outlineWidth: 2,
  });
  expect(openSavedProject(JSON.stringify(legacy)).layers[0]).toMatchObject({
    fontSize: 24,
    bold: false,
    outlineWidth: 2,
  });
  expect(openSavedProject(JSON.stringify(legacy)).layers[0]).not.toHaveProperty(
    "shadow",
  );
});

test("malformed saved shadows are rejected", () => {
  const file = JSON.parse(saveProject(addTextLayer(openProject(), "chat")));
  file.project.layers[0].shadow.blur = -1;
  expect(() => openSavedProject(JSON.stringify(file))).toThrow("not a valid");
});

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

test.each([
  ["nw", -120, -60, -200, -90],
  ["ne", 120, -60, 40, -90],
  ["sw", -120, 60, -200, 30],
  ["se", 120, 60, 40, 30],
] as const)(
  "resizing the %s image corner preserves the cropped ratio and anchors its opposite corner",
  (corner, dx, dy, x, y) => {
    let project = cropImageLayer(projectWithImage(), "image-1", {
      x: 20,
      y: 10,
      width: 240,
      height: 120,
    });
    project = scaleImageLayer(project, "image-1", 2);
    project = moveLayer(project, "image-1", 40, 30);
    project = setView(project, 0.5, 18, -12);

    const resized = resizeImageLayer(project, "image-1", corner, {
      x: dx,
      y: dy,
    });

    expect(resized.layers[0]).toMatchObject({
      x,
      y,
      scale: 3,
      crop: { x: 20, y: 10, width: 240, height: 120 },
    });
    expect(resized.past).toHaveLength(project.past.length + 1);
    expect(undo(resized).layers).toEqual(project.layers);
    expect(redo(undo(resized)).layers).toEqual(resized.layers);
    expect(openSavedProject(saveProject(resized)).layers).toEqual(
      resized.layers,
    );
  },
);

test("resizing past the anchor stays positive and invalid pointer deltas leave the image unchanged", () => {
  const project = projectWithImage();
  const resized = resizeImageLayer(project, "image-1", "nw", {
    x: 640,
    y: 360,
  });
  const layer = resized.layers[0];
  if (layer?.kind !== "image") throw new Error("Expected an image");
  expect(layer.scale).toBeCloseTo(1 / 180);
  expect(layer.x).toBeCloseTo(318.2222222222);
  expect(layer.y).toBe(179);
  expect(openSavedProject(saveProject(resized)).layers).toEqual(resized.layers);
  expect(resizeImageLayer(project, "image-1", "se", { x: NaN, y: 0 })).toBe(
    project,
  );
  expect(
    resizeImageLayer(project, "image-1", "se", { x: 0, y: Infinity }),
  ).toBe(project);
  expect(resizeImageLayer(project, "image-1", "se", { x: 0, y: 0 })).toBe(
    project,
  );
  expect(resizeImageLayer(project, "missing", "se", { x: 40, y: 20 })).toBe(
    project,
  );
});

test("an unmoved resize corner preserves fractional position without adding history", () => {
  const fractional = moveLayer(
    scaleImageLayer(projectWithImage(), "image-1", 1.23),
    "image-1",
    10.1,
    20.2,
  );
  expect(resizeImageLayer(fractional, "image-1", "nw", { x: 0, y: 0 })).toBe(
    fractional,
  );
});

test("an image resize previews without history and finishes or cancels as one complete edit", () => {
  const project = projectWithImage();
  const gesture = beginUndoableEdit(project);
  const preview = gesture.preview({
    type: "resize-image",
    layerId: "image-1",
    corner: "nw",
    screenDelta: { x: -160, y: -90 },
  });
  expect(preview.layers[0]).toMatchObject({ x: -160, y: -90, scale: 1.5 });
  expect(preview.past).toEqual(project.past);
  expect(gesture.cancel()).toBe(project);
  const finished = gesture.finish({
    type: "resize-image",
    layerId: "image-1",
    corner: "nw",
    screenDelta: { x: -320, y: -180 },
  });
  expect(finished.layers[0]).toMatchObject({ x: -320, y: -180, scale: 2 });
  expect(finished.past).toHaveLength(project.past.length + 1);
  expect(undo(finished)).toEqual({ ...project, future: [expect.any(Object)] });
  expect(redo(undo(finished)).layers).toEqual(finished.layers);
});

test("duplicating an image preserves its appearance and inserts an offset copy immediately above it", () => {
  let project = cropImageLayer(projectWithImage(), "image-1", {
    x: 12,
    y: 8,
    width: 240,
    height: 120,
  });
  project = scaleImageLayer(project, "image-1", 1.5);
  project = moveLayer(project, "image-1", 40, 24);
  project = setLayerVisibility(project, "image-1", false);
  project = setLayerOpacity(project, "image-1", 0.45);
  project = addTextLayer(project, "caption");

  const duplicated = duplicateLayer(project, "image-1", "image-copy");

  expect(duplicated.layers.map((layer) => layer.id)).toEqual([
    "image-1",
    "image-copy",
    "caption",
  ]);
  expect(duplicated.layers[1]).toEqual({
    id: "image-copy",
    kind: "image",
    name: "Screenshot copy",
    visible: false,
    opacity: 0.45,
    source: TEST_IMAGE.source,
    format: "image/png",
    naturalWidth: 320,
    naturalHeight: 180,
    x: 56,
    y: 40,
    scale: 1.5,
    crop: { x: 12, y: 8, width: 240, height: 120 },
  });
  expect(duplicated.layers[0]).toEqual(project.layers[0]);
  expect(duplicated.past).toHaveLength(project.past.length + 1);
  expect(undo(duplicated).layers).toEqual(project.layers);
  expect(redo(undo(duplicated)).layers).toEqual(duplicated.layers);
  expect(openSavedProject(saveProject(duplicated)).layers).toEqual(
    duplicated.layers,
  );
});

test("duplication with a missing source, empty identity, or existing identity is a no-op", () => {
  const project = projectWithImage();
  expect(duplicateLayer(project, "missing", "copy")).toBe(project);
  expect(duplicateLayer(project, "image-1", "image-1")).toBe(project);
  expect(duplicateLayer(project, "image-1", "")).toBe(project);
});

test("duplicating styled text preserves its content and keeps later edits independent", () => {
  let project = addTextLayer(
    openProject(),
    "caption",
    { x: 80, y: 56 },
    {
      text: "John says hello.",
      colorRuns: [{ start: 10, end: 16, color: "#edaa41" }],
    },
  );
  project = editTextLayer(project, "caption", {
    fontFamily: "Georgia",
    fontSize: 32,
    bold: true,
    outlineWidth: 3,
    outlineColor: "#112233",
    shadow: undefined,
    lineSpacing: 1.5,
    wrapWidth: 280,
  });
  project = renameLayer(project, "caption", "Chat caption");
  project = setLayerVisibility(project, "caption", false);
  project = setLayerOpacity(project, "caption", 0.6);

  const duplicated = duplicateLayer(project, "caption", "caption-copy");

  expect(duplicated.layers[1]).toEqual({
    id: "caption-copy",
    kind: "text",
    name: "Chat caption copy",
    x: 96,
    y: 72,
    visible: false,
    opacity: 0.6,
    text: "John says hello.",
    colorRuns: [{ start: 10, end: 16, color: "#edaa41" }],
    fontFamily: "Georgia",
    fontSize: 32,
    bold: true,
    outlineWidth: 3,
    outlineColor: "#112233",
    lineSpacing: 1.5,
    wrapWidth: 280,
  });
  expect(undo(duplicated).layers).toEqual(project.layers);
  expect(redo(undo(duplicated)).layers).toEqual(duplicated.layers);
  expect(openSavedProject(saveProject(duplicated)).layers).toEqual(
    duplicated.layers,
  );

  const edited = editTextLayer(duplicated, "caption-copy", {
    text: "A new caption.",
    colorRuns: [{ start: 0, end: 13, color: "#ff0000" }],
    fontSize: 48,
    wrapWidth: 200,
  });
  expect(edited.layers[0]).toEqual(project.layers[0]);
  expect(edited.layers[1]).toMatchObject({
    text: "A new caption.",
    fontSize: 48,
    wrapWidth: 200,
  });
});

test("an image copy can be cropped, scaled, and moved without changing the original", () => {
  const project = projectWithImage();
  let duplicated = duplicateLayer(project, "image-1", "copy");
  duplicated = cropImageLayer(duplicated, "copy", {
    x: 10,
    y: 5,
    width: 100,
    height: 80,
  });
  duplicated = scaleImageLayer(duplicated, "copy", 2);
  duplicated = moveLayer(duplicated, "copy", 90, 60);
  duplicated = setLayerVisibility(duplicated, "copy", false);
  duplicated = setLayerOpacity(duplicated, "copy", 0.3);

  expect(duplicated.layers[0]).toEqual(project.layers[0]);
  expect(duplicated.layers[1]).toMatchObject({
    crop: { x: 10, y: 5, width: 100, height: 80 },
    scale: 2,
    x: 90,
    y: 60,
    visible: false,
    opacity: 0.3,
  });
});

test("repeated copies have distinct names and identities through undo, redo, and a new history branch", () => {
  const first = duplicateLayer(projectWithImage(), "image-1", "copy-1");
  const second = duplicateLayer(first, "image-1", "copy-2");
  expect(second.layers.map((layer) => [layer.id, layer.name])).toEqual([
    ["image-1", "Screenshot"],
    ["copy-2", "Screenshot copy (1)"],
    ["copy-1", "Screenshot copy"],
  ]);
  expect(undo(second).layers).toEqual(first.layers);
  expect(redo(undo(second)).layers).toEqual(second.layers);

  const forked = duplicateLayer(undo(second), "image-1", "copy-2");
  expect(forked.layers).toEqual(second.layers);
  expect(redo(forked)).toBe(forked);
});

test("deleting a layer removes it, saves the remaining stack, and restores it with one undo step", () => {
  const image = projectWithImage();
  const stacked = addTextLayer(image, "chat-1", { x: 80, y: 56 }, {
    text: "John says hello.",
    colorRuns: [{ start: 10, end: 16, color: "#edaa41" }],
  });

  const deleted = deleteLayer(stacked, "image-1");

  expect(deleted.layers.map((layer) => layer.id)).toEqual(["chat-1"]);
  expect(deleted.past).toHaveLength(stacked.past.length + 1);
  expect(openSavedProject(saveProject(deleted)).layers).toEqual(deleted.layers);
  expect(undo(deleted).layers).toEqual(stacked.layers);
  expect(redo(deleted).layers).toEqual(deleted.layers);
});

test("deleting an unknown layer is a no-op and deleting the only layer empties the project", () => {
  const image = projectWithImage();
  expect(deleteLayer(image, "missing")).toBe(image);
  const deleted = deleteLayer(image, "image-1");
  expect(deleted.layers).toEqual([]);
  expect(undo(deleted).layers).toEqual(image.layers);
});

test("a new project opens on a canvas with a visible size", () => {
  const project = openProject();

  expect(project.canvasWidth).toBe(1920);
  expect(project.canvasHeight).toBe(1080);
});

test("a saved project reopens with its editable canvas and layer stack intact", () => {
  let project = addImageLayer(openProject(), TEST_IMAGE);
  project = cropImageLayer(project, "image-1", {
    x: 12,
    y: 8,
    width: 240,
    height: 120,
  });
  project = scaleImageLayer(project, "image-1", 1.5);
  project = moveLayer(project, "image-1", 40, 24);
  project = addTextLayer(project, "text-1", { x: 80, y: 56 });
  project = editTextLayer(project, "text-1", {
    text: "John Smith waves.",
    colorRuns: [{ start: 0, end: 17, color: "#c2a3da" }],
    fontFamily: "Georgia",
    fontSize: 32,
    bold: true,
    outlineWidth: 3,
    outlineColor: "#112233",
    lineSpacing: 1.5,
    wrapWidth: 280,
  });
  project = setLayerVisibility(project, "image-1", false);
  project = setLayerOpacity(project, "text-1", 0.45);
  project = renameLayer(project, "text-1", "Chat caption");
  project = reorderLayer(project, "image-1", 1);
  project = setCanvasSize(project, 1150, 600);
  project = setView(project, 1.25, 18, -12);

  const reopened = openSavedProject(saveProject(project));

  expect(reopened).toEqual({ ...project, past: [], future: [] });
});

test("a chat draft becomes one editable, undoable layer with colors that survive reopening", () => {
  const content = parseColoredText(
    "* John Smith looks around.\nJohn Smith says: Hello.",
  );
  const placed = addTextLayer(openProject(), "chat-1", { x: 80, y: 56 }, content);
  const layer = placed.layers[0];

  expect(layer).toMatchObject({
    kind: "text",
    x: 80,
    y: 56,
    text: content.text,
    colorRuns: content.colorRuns,
  });
  expect(undo(placed).layers).toHaveLength(0);
  expect(redo(undo(placed)).layers[0]).toEqual(layer);
  expect(openSavedProject(saveProject(placed)).layers[0]).toEqual(layer);

  const editedContent = replaceTextRange(
    content,
    content.text.length,
    content.text.length,
    " Again.",
  );
  const edited = editTextLayer(placed, "chat-1", editedContent);
  expect(openSavedProject(saveProject(edited)).layers[0]).toMatchObject({
    text: editedContent.text,
    colorRuns: editedContent.colorRuns,
  });
});

test("opening an unsupported project file version gives a useful error", () => {
  const serialized = JSON.stringify({ version: 2, project: {} });

  expect(() => openSavedProject(serialized)).toThrow(
    "This project file version is not supported.",
  );
});

test("opening a malformed project file gives a useful error", () => {
  const serialized = JSON.stringify({ version: 1, project: {} });

  expect(() => openSavedProject(serialized)).toThrow(
    "This is not a valid screenshot editor project.",
  );
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

test("viewport panning previews live and finishes as one undoable edit", () => {
  const project = setView(openProject(), 2, 0, 0);
  const gesture = beginUndoableEdit(project);

  const previewed = gesture.preview({
    type: "pan-viewport",
    panX: 40,
    panY: -15,
  });

  expect(previewed).toMatchObject({ zoom: 2, panX: 40, panY: -15 });
  expect(previewed.past).toHaveLength(project.past.length);

  const finished = gesture.finish();
  expect(finished.past).toHaveLength(project.past.length + 1);
  expect(undo(finished)).toMatchObject({ zoom: 2, panX: 0, panY: 0 });
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
  expect(afterSizeUndo.canvasWidth).toBe(1920);
  expect(afterSizeUndo.canvasHeight).toBe(1080);

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
  expect(project.canvasWidth).toBe(1920);
  expect(project.canvasHeight).toBe(1080);
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
      fontSize: 14,
      bold: true,
      outlineWidth: 0,
      outlineColor: "#000000",
      shadow: { offsetX: 1, offsetY: 1, blur: 2, color: "#000000" },
      lineSpacing: 1.2,
      wrapWidth: 400,
    },
  ]);
  expect(project.canvasWidth).toBe(1920);
  expect(project.canvasHeight).toBe(1080);
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

test("opacity uses one undoable edit from preview through redo", () => {
  const added = addTextLayer(openProject(), "text-1");
  const gesture = beginUndoableEdit(added);
  const previewed = gesture.preview({
    type: "set-layer-opacity",
    layerId: "text-1",
    opacity: 0.4,
  });

  expect(previewed.layers[0]).toMatchObject({ opacity: 0.4 });
  expect(previewed.past).toHaveLength(added.past.length);

  const committed = gesture.finish();
  expect(committed.past).toHaveLength(added.past.length + 1);
  expect(undo(committed).layers[0]).toMatchObject({ opacity: 1 });
  expect(redo(undo(committed)).layers[0]).toMatchObject({ opacity: 0.4 });
});

test("an opacity interaction ending at its starting value adds no history", () => {
  const added = addTextLayer(openProject(), "text-1");
  const gesture = beginUndoableEdit(added);

  gesture.preview({
    type: "set-layer-opacity",
    layerId: "text-1",
    opacity: 0.4,
  });
  const unchanged = gesture.finish({
    type: "set-layer-opacity",
    layerId: "text-1",
    opacity: 1,
  });

  expect(unchanged).toBe(added);
  expect(unchanged.past).toHaveLength(added.past.length);
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
  expect(project.canvasWidth).toBe(1920);
  expect(project.canvasHeight).toBe(1080);
  expect(project.panX).toBe(0);
  expect(project.panY).toBe(0);
});

test("a layer drag previews live and finishes as one undoable edit", () => {
  const imported = projectWithImage();
  const gesture = beginUndoableEdit(imported);

  const previewed = gesture.preview({
    type: "move-layer",
    layerId: "image-1",
    x: 48,
    y: 72,
  });

  expect(previewed.layers[0]).toMatchObject({ x: 48, y: 72 });
  expect(previewed.past).toHaveLength(imported.past.length);

  const finished = gesture.finish();
  expect(finished.past).toHaveLength(imported.past.length + 1);
  expect(undo(finished).layers[0]).toMatchObject({ x: 0, y: 0 });
});

test("cancelling a pointer edit restores its start without an undo entry", () => {
  const imported = projectWithImage();
  const gesture = beginUndoableEdit(imported);

  gesture.preview({
    type: "move-layer",
    layerId: "image-1",
    x: 48,
    y: 72,
  });
  const cancelled = gesture.cancel();

  expect(cancelled).toBe(imported);
  expect(cancelled.layers[0]).toMatchObject({ x: 0, y: 0 });
  expect(cancelled.past).toHaveLength(imported.past.length);
});

test("finishing a pointer edit without a change adds no undo entry", () => {
  const imported = projectWithImage();
  const gesture = beginUndoableEdit(imported);

  gesture.preview({
    type: "move-layer",
    layerId: "image-1",
    x: 48,
    y: 72,
  });
  const unchanged = gesture.finish({
    type: "move-layer",
    layerId: "image-1",
    x: 0,
    y: 0,
  });

  expect(unchanged).toBe(imported);
  expect(unchanged.past).toHaveLength(imported.past.length);
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

test("a text resize previews live and finishes as one undoable edit", () => {
  const added = addTextLayer(openProject(), "text-1", { x: 32, y: 32 });
  const gesture = beginUndoableEdit(added);

  const previewed = gesture.preview({
    type: "resize-text",
    layerId: "text-1",
    x: 12,
    wrapWidth: 420,
  });

  expect(previewed.layers[0]).toMatchObject({ x: 12, wrapWidth: 420 });
  expect(previewed.past).toHaveLength(added.past.length);

  const finished = gesture.finish();
  expect(finished.past).toHaveLength(added.past.length + 1);
  expect(undo(finished).layers[0]).toMatchObject({ x: 32, wrapWidth: 400 });
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
    fontSize: 14,
    bold: true,
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

test("committing edited rich text creates one undo entry", () => {
  const added = addTextLayer(openProject(), "text-1");
  const edit = beginUndoableEdit(added);

  const committed = edit.finish({
    type: "edit-text-content",
    layerId: "text-1",
    content: {
      text: "John Smith waves.",
      colorRuns: [{ start: 0, end: 17, color: "#c2a3da" }],
    },
  });

  expect(committed.past).toHaveLength(added.past.length + 1);
  expect(committed.layers[0]).toMatchObject({
    text: "John Smith waves.",
    colorRuns: [{ start: 0, end: 17, color: "#c2a3da" }],
  });
  expect(undo(committed).layers[0]).toMatchObject({
    text: "Text",
    colorRuns: [],
  });
  expect(redo(undo(committed)).layers[0]).toMatchObject({
    text: "John Smith waves.",
    colorRuns: [{ start: 0, end: 17, color: "#c2a3da" }],
  });
});

test("committing a selection color creates one undo entry", () => {
  const added = addTextLayer(openProject(), "text-1");
  const edit = beginUndoableEdit(added);

  edit.preview({
    type: "edit-text-content",
    layerId: "text-1",
    content: {
      text: "Text",
      colorRuns: [{ start: 0, end: 4, color: "#00ff00" }],
    },
  });
  edit.preview({
    type: "edit-text-content",
    layerId: "text-1",
    content: {
      text: "Text",
      colorRuns: [{ start: 0, end: 4, color: "#ff0000" }],
    },
  });
  const committed = edit.finish();

  expect(committed.past).toHaveLength(added.past.length + 1);
  expect(committed.layers[0]).toMatchObject({
    text: "Text",
    colorRuns: [{ start: 0, end: 4, color: "#ff0000" }],
  });
  expect(undo(committed).layers[0]).toMatchObject({
    text: "Text",
    colorRuns: [],
  });
});

test("cancelling or leaving rich text unchanged creates no undo entry", () => {
  const added = addTextLayer(openProject(), "text-1");
  const colored = editTextLayer(added, "text-1", {
    colorRuns: [{ start: 0, end: 4, color: "#c2a3da" }],
  });
  const cancelledEdit = beginUndoableEdit(colored);
  cancelledEdit.preview({
    type: "edit-text-content",
    layerId: "text-1",
    content: { text: "Changed", colorRuns: [] },
  });

  const cancelled = cancelledEdit.cancel();
  const unchanged = beginUndoableEdit(colored).finish({
    type: "edit-text-content",
    layerId: "text-1",
    content: {
      text: "Text",
      colorRuns: [{ start: 0, end: 4, color: "#c2a3da" }],
    },
  });

  expect(cancelled).toBe(colored);
  expect(unchanged).toBe(colored);
  expect(cancelled.past).toHaveLength(colored.past.length);
  expect(unchanged.past).toHaveLength(colored.past.length);
});

test("scaling changes the image size without changing the canvas size", () => {
  const imported = projectWithImage();

  const project = scaleImageLayer(imported, "image-1", 1.5);

  expect(project.layers[0]).toMatchObject({ scale: 1.5 });
  expect(project.canvasWidth).toBe(1920);
  expect(project.canvasHeight).toBe(1080);
});

test("scale uses one undoable edit from preview through redo", () => {
  const imported = projectWithImage();
  const gesture = beginUndoableEdit(imported);

  const firstPreview = gesture.preview({
    type: "scale-image",
    layerId: "image-1",
    scale: 1.25,
  });
  const finalPreview = gesture.preview({
    type: "scale-image",
    layerId: "image-1",
    scale: 1.5,
  });

  expect(firstPreview.layers[0]).toMatchObject({ scale: 1.25 });
  expect(finalPreview.layers[0]).toMatchObject({ scale: 1.5 });
  expect(finalPreview.past).toHaveLength(imported.past.length);

  const committed = gesture.finish();

  expect(committed.past).toHaveLength(imported.past.length + 1);
  expect(undo(committed).layers[0]).toMatchObject({ scale: 1 });
  expect(redo(undo(committed)).layers[0]).toMatchObject({ scale: 1.5 });
});

test("cancelling a scale interaction restores its starting value", () => {
  const imported = projectWithImage();
  const gesture = beginUndoableEdit(imported);

  gesture.preview({
    type: "scale-image",
    layerId: "image-1",
    scale: 1.5,
  });
  const cancelled = gesture.cancel();

  expect(cancelled).toBe(imported);
  expect(cancelled.layers[0]).toMatchObject({ scale: 1 });
  expect(cancelled.past).toHaveLength(imported.past.length);
});

test("fit scales the visible image region inside the canvas", () => {
  const imported = projectWithImage();

  const fitted = fitImageLayerToCanvas(imported, "image-1");

  expect(fitted.layers[0]).toMatchObject({ scale: 6 });
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
  expect(project.canvasWidth).toBe(1920);
  expect(project.canvasHeight).toBe(1080);
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
