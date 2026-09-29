import { expect, test } from "vitest";
import {
  addImageLayer,
  addTextLayer,
  cropImageLayer,
  moveLayer,
  openProject,
  scaleImageLayer,
  setLayerOpacity,
  setLayerVisibility,
} from "./editor";
import { presentProject } from "./presentation";

test("project presentation resolves image visibility, order, and geometry", () => {
  let project = openProject();
  project = addImageLayer(project, {
    id: "lower",
    name: "Lower",
    source: "lower.png",
    format: "image/png",
    width: 100,
    height: 80,
  });
  project = cropImageLayer(project, "lower", {
    x: 10,
    y: 5,
    width: 40,
    height: 20,
  });
  project = scaleImageLayer(project, "lower", 1.5);
  project = moveLayer(project, "lower", 12, 18);
  project = setLayerOpacity(project, "lower", 0.4);
  project = addImageLayer(project, {
    id: "hidden",
    name: "Hidden",
    source: "hidden.png",
    format: "image/png",
    width: 10,
    height: 10,
  });
  project = setLayerVisibility(project, "hidden", false);
  project = addImageLayer(project, {
    id: "upper",
    name: "Upper",
    source: "upper.png",
    format: "image/png",
    width: 20,
    height: 10,
  });
  project = moveLayer(project, "upper", 20, 20);

  expect(presentProject(project)).toEqual([
    {
      kind: "image",
      id: "lower",
      name: "Lower",
      source: "lower.png",
      opacity: 0.4,
      crop: { x: 10, y: 5, width: 40, height: 20 },
      frame: { x: 12, y: 18, width: 60, height: 30 },
      content: { x: -15, y: -7.5, width: 150, height: 120 },
    },
    {
      kind: "image",
      id: "upper",
      name: "Upper",
      source: "upper.png",
      opacity: 1,
      crop: { x: 0, y: 0, width: 20, height: 10 },
      frame: { x: 20, y: 20, width: 20, height: 10 },
      content: { x: 0, y: 0, width: 20, height: 10 },
    },
  ]);
});

test("project presentation keeps visible text between image layers", () => {
  let project = openProject();
  project = addImageLayer(project, {
    id: "lower",
    name: "Lower",
    source: "lower.png",
    format: "image/png",
    width: 10,
    height: 10,
  });
  project = addTextLayer(project, "caption");
  project = addImageLayer(project, {
    id: "upper",
    name: "Upper",
    source: "upper.png",
    format: "image/png",
    width: 10,
    height: 10,
  });

  expect(
    presentProject(project).map((layer) => [layer.kind, layer.id]),
  ).toEqual([
    ["image", "lower"],
    ["text", "caption"],
    ["image", "upper"],
  ]);
});
