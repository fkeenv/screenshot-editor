import { expect, test } from "vitest";
import {
  addImageLayer,
  addTextLayer,
  cropImageLayer,
  editTextLayer,
  finishImageScale,
  fitImageLayerToCanvas,
  moveLayer,
  nudgeLayer,
  openProject,
  previewImageScale,
  redo,
  scaleImageLayer,
  setCanvasSize,
  setView,
  supportedImageFormat,
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
      text: "Text",
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

test("dragging moves the image without moving or resizing the canvas", () => {
  const imported = projectWithImage();

  const project = moveLayer(imported, "image-1", 48, 72);

  expect(project.layers[0]).toMatchObject({ x: 48, y: 72 });
  expect(project.canvasWidth).toBe(800);
  expect(project.canvasHeight).toBe(600);
  expect(project.panX).toBe(0);
  expect(project.panY).toBe(0);
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
