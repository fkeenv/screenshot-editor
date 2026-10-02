import { expect, test } from "vitest";
import {
  addRectangleLayer,
  beginUndoableEdit,
  deleteLayer,
  duplicateLayer,
  editRectangleLayer,
  moveLayer,
  nudgeLayer,
  openProject,
  openSavedProject,
  redo,
  reorderLayer,
  saveProject,
  setCanvasSize,
  setLayerOpacity,
  setLayerVisibility,
  setView,
  undo,
} from "./editor";
import { presentProject } from "./presentation";

test.each(["nw", "ne", "sw", "se"] as const)("%s rectangle resize anchors the opposite corner and survives history and save/open", (corner) => {
  const project = setView(addRectangleLayer(openProject(), "shape"), 2, 50, -30);
  const original = project.layers[0];
  if (original.kind !== "rectangle") throw new Error("Expected rectangle");
  const gesture = beginUndoableEdit(project);
  const update = { type: "resize-rectangle", layerId: "shape", corner, screenDelta: { x: 80, y: 40 } } as const;
  const preview = gesture.preview(update);
  expect(preview.past).toHaveLength(project.past.length);
  const layer = preview.layers[0];
  if (layer.kind !== "rectangle") throw new Error("Expected rectangle");
  const left = corner === "nw" || corner === "sw";
  const top = corner === "nw" || corner === "ne";
  expect(layer.width).toBe(left ? 160 : 240);
  expect(layer.height).toBe(top ? 100 : 140);
  expect(left ? layer.x + layer.width : layer.x).toBe(left ? original.x + original.width : original.x);
  expect(top ? layer.y + layer.height : layer.y).toBe(top ? original.y + original.height : original.y);
  const finished = gesture.finish(update);
  expect(finished.past).toHaveLength(project.past.length + 1);
  expect(undo(finished).layers).toEqual(project.layers);
  expect(redo(undo(finished)).layers).toEqual(finished.layers);
  expect(openSavedProject(saveProject(finished)).layers).toEqual(finished.layers);
  expect(gesture.cancel()).toBe(project);
});

test("rectangle resizing clamps at one pixel and invalid or unchanged deltas leave history untouched", () => {
  const project = addRectangleLayer(openProject(), "shape");
  const update = { type: "resize-rectangle", layerId: "shape", corner: "nw", screenDelta: { x: 9999, y: 9999 } } as const;
  expect(beginUndoableEdit(project).finish(update).layers[0]).toMatchObject({ width: 1, height: 1, x: 1059, y: 599 });
  for (const screenDelta of [{ x: 0, y: 0 }, { x: NaN, y: 0 }, { x: 0, y: Infinity }]) {
    expect(beginUndoableEdit(project).finish({ ...update, screenDelta })).toBe(project);
  }
});

test("rectangles are centered, selected-size independent, and one undoable addition", () => {
  const original = setView(openProject(), 2, 100, -50);
  const project = addRectangleLayer(original, "rectangle");
  expect(project.layers[0]).toMatchObject({
    kind: "rectangle",
    x: 860,
    y: 480,
    width: 200,
    height: 120,
    fill: "#d5b273",
    visible: true,
    opacity: 1,
  });
  expect(project.past).toHaveLength(original.past.length + 1);
  expect(undo(project).layers).toEqual([]);
  expect(redo(undo(project)).layers).toEqual(project.layers);
  expect(addRectangleLayer(project, "rectangle")).toBe(project);
  expect(addRectangleLayer(project, "")).toBe(project);
  expect(
    addRectangleLayer(setCanvasSize(openProject(), 10, 5), "small").layers[0],
  ).toMatchObject({ x: 0, y: 0, width: 10, height: 5 });
});

test("rectangle geometry and fill edits preserve history and round-trip in saved projects", () => {
  const original = addRectangleLayer(openProject(), "rectangle");
  const edited = editRectangleLayer(original, "rectangle", {
    x: -5,
    y: 10,
    width: 80.5,
    height: 32,
    fill: "#123456",
  });
  expect(openSavedProject(saveProject(edited)).layers).toEqual(edited.layers);
  expect(undo(edited).layers).toEqual(original.layers);
  expect(redo(undo(edited)).layers).toEqual(edited.layers);
  expect(editRectangleLayer(edited, "rectangle", { fill: "#123456" })).toBe(
    edited,
  );
  expect(editRectangleLayer(edited, "missing", { width: 20 })).toBe(edited);
});

test.each([
  { width: 0 },
  { height: -1 },
  { x: NaN },
  { y: Infinity },
  { width: Infinity },
  { fill: "red" },
])(
  "invalid rectangle edit %j does not mutate history and invalid saved geometry is rejected",
  (changes) => {
    const project = addRectangleLayer(openProject(), "rectangle");
    expect(editRectangleLayer(project, "rectangle", changes)).toBe(project);
    const file = JSON.parse(saveProject(project));
    Object.assign(file.project.layers[0], changes);
    expect(() => openSavedProject(JSON.stringify(file))).toThrow("not a valid");
  },
);

test("rectangles use the shared layer operations, visibility, and ordered presentation", () => {
  let project = addRectangleLayer(openProject(), "rectangle");
  project = duplicateLayer(project, "rectangle", "copy");
  expect(project.layers[1]).toMatchObject({
    name: "Rectangle copy",
    x: 876,
    y: 496,
  });
  project = editRectangleLayer(project, "copy", { fill: "#ff0000" });
  expect(project.layers[0]).toMatchObject({ fill: "#d5b273" });
  project = nudgeLayer(moveLayer(project, "copy", 10, 10), "copy", 2, -3);
  project = setLayerOpacity(project, "copy", 0.5);
  project = reorderLayer(project, "copy", 0);
  expect(presentProject(project, () => 0)[0]).toEqual({
    kind: "rectangle",
    id: "copy",
    name: "Rectangle copy",
    fill: "#ff0000",
    opacity: 0.5,
    frame: { x: 12, y: 7, width: 200, height: 120 },
  });
  const hidden = setLayerVisibility(project, "copy", false);
  expect(presentProject(hidden, () => 0).map((layer) => layer.id)).toEqual([
    "rectangle",
  ]);
  const deleted = deleteLayer(project, "copy");
  expect(deleted.layers).toHaveLength(1);
  expect(undo(deleted).layers).toEqual(project.layers);
});
