import { expect, test } from "vitest";
import {
  addImageLayer,
  addTextLayer,
  cropImageLayer,
  editTextLayer,
  moveLayer,
  openProject,
  scaleImageLayer,
  setLayerOpacity,
  setLayerVisibility,
} from "./editor";
import { presentProject, type TextFontPresentation } from "./presentation";

const measureMonospace = (_font: TextFontPresentation, text: string) =>
  text.length * 10;

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

  expect(presentProject(project, measureMonospace)).toEqual([
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
    presentProject(project, measureMonospace).map((layer) => [layer.kind, layer.id]),
  ).toEqual([
    ["image", "lower"],
    ["text", "caption"],
    ["image", "upper"],
  ]);
});

test("project presentation wraps multiline text and long words", () => {
  let project = addTextLayer(openProject(), "caption", { x: 12, y: 18 });
  project = editTextLayer(project, "caption", {
    text: "one two\nLONGWORD",
    bold: false,
    outlineWidth: 2,
    shadow: undefined,
    fontFamily: "Courier New",
    fontSize: 10,
    lineSpacing: 1.5,
    wrapWidth: 40,
  });

  expect(presentProject(project, measureMonospace)).toEqual([
    {
      kind: "text",
      id: "caption",
      name: "Text",
      opacity: 1,
      frame: { x: 12, y: 18, width: 40, height: 60 },
      font: {
        family: "Courier New",
        size: 10,
        weight: 400,
      },
      lineHeight: 15,
      outline: { width: 2, color: "#000000" },
      lines: [
        {
          y: 0,
          segments: [
            { text: "one ", color: "#ffffff", offset: 0, width: 40 },
          ],
        },
        {
          y: 15,
          segments: [
            { text: "two", color: "#ffffff", offset: 0, width: 30 },
          ],
        },
        {
          y: 30,
          segments: [
            { text: "LONG", color: "#ffffff", offset: 0, width: 40 },
          ],
        },
        {
          y: 45,
          segments: [
            { text: "WORD", color: "#ffffff", offset: 0, width: 40 },
          ],
        },
      ],
    },
  ]);
});

test("project presentation keeps empty lines and splits color runs", () => {
  let project = addTextLayer(openProject(), "caption", { x: 0, y: 0 });
  project = editTextLayer(project, "caption", {
    text: "A B\n\nCD",
    colorRuns: [
      { start: 0, end: 1, color: "#ff0000" },
      { start: 2, end: 3, color: "#0000ff" },
      { start: 5, end: 7, color: "#00ff00" },
    ],
    fontSize: 10,
    lineSpacing: 1.5,
    wrapWidth: 30,
  });

  const [caption] = presentProject(project, measureMonospace);
  expect(caption?.kind).toBe("text");
  if (caption?.kind !== "text") return;

  expect(caption.frame.height).toBe(45);
  expect(caption.lines).toEqual([
    {
      y: 0,
      segments: [
        { text: "A", color: "#ff0000", offset: 0, width: 10 },
        { text: " ", color: "#ffffff", offset: 10, width: 10 },
        { text: "B", color: "#0000ff", offset: 20, width: 10 },
      ],
    },
    { y: 15, segments: [] },
    {
      y: 30,
      segments: [
        { text: "CD", color: "#00ff00", offset: 0, width: 20 },
      ],
    },
  ]);
});
