import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { addTextLayer, editTextLayer, openProject } from "./editor";
import { presentProject, type TextFontPresentation } from "./presentation";
import { PresentedText } from "./PresentedText";
import { drawTextLayer } from "./raster-presentation";

test("the DOM adapter renders shared line breaks and color segments", () => {
  let project = addTextLayer(openProject(), "caption");
  project = editTextLayer(project, "caption", {
    text: "A B\n\nLONG",
    colorRuns: [
      { start: 0, end: 1, color: "#ff0000" },
      { start: 2, end: 3, color: "#0000ff" },
    ],
    fontSize: 10,
    lineSpacing: 1.5,
    wrapWidth: 30,
  });
  const measure = (_font: TextFontPresentation, text: string) =>
    text.length * 10;
  const [caption] = presentProject(project, measure);
  if (caption?.kind !== "text") throw new Error("Expected text presentation.");

  const markup = renderToStaticMarkup(<PresentedText text={caption} />);

  expect(markup).toBe(
    '<div class="presented-text"><div class="presented-text-line" style="height:15px;white-space:pre"><span style="color:#ff0000">A</span><span style="color:#ffffff"> </span><span style="color:#0000ff">B</span></div><div class="presented-text-line" style="height:15px;white-space:pre"></div><div class="presented-text-line" style="height:15px;white-space:pre"><span style="color:#ffffff">LON</span></div><div class="presented-text-line" style="height:15px;white-space:pre"><span style="color:#ffffff">G</span></div></div>',
  );

  const rasterLines: unknown[][] = [];
  const context = {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textBaseline: "alphabetic" as CanvasTextBaseline,
    lineWidth: 0,
    lineJoin: "miter" as CanvasLineJoin,
    fillText: (text: string, x: number, y: number) => {
      rasterLines.push([text, x, y, context.fillStyle]);
    },
    strokeText: () => undefined,
  };

  drawTextLayer(context, caption);

  expect(rasterLines).toEqual([
    ["A", 32, 32, "#ff0000"],
    [" ", 42, 32, "#ffffff"],
    ["B", 52, 32, "#0000ff"],
    ["LON", 32, 62, "#ffffff"],
    ["G", 32, 77, "#ffffff"],
  ]);
});
