import { expect, test } from "vitest";
import {
  addRectangleLayer,
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

test("rectangles are centered, selected-size independent, and one undoable addition", () => {
  const original = setView(openProject(), 2, 100, -50);
  const project = addRectangleLayer(original, "rectangle");
  expect(project.layers[0]).toMatchObject({
    kind: "rectangle",
    x: 300,
    y: 240,
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
    x: 316,
    y: 256,
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
