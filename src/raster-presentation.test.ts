import { expect, test, vi } from "vitest";
import { drawImageLayer, drawTextLayer } from "./raster-presentation";
import type {
  ImageLayerPresentation,
  TextLayerPresentation,
} from "./presentation";

test("the raster adapter draws from the shared crop, frame, and opacity", () => {
  const source = {} as CanvasImageSource;
  let alphaAtDraw = 1;
  const drawImage = vi.fn(() => {
    alphaAtDraw = context.globalAlpha;
  });
  const context = { globalAlpha: 1, drawImage };
  const image: ImageLayerPresentation = {
    kind: "image",
    id: "image-1",
    name: "Photo",
    source: "photo.png",
    opacity: 0.4,
    crop: { x: 10, y: 5, width: 40, height: 20 },
    frame: { x: 12, y: 18, width: 60, height: 30 },
    content: { x: -15, y: -7.5, width: 150, height: 120 },
  };

  drawImageLayer(context, source, image);

  expect(drawImage).toHaveBeenCalledWith(
    source,
    10,
    5,
    40,
    20,
    12,
    18,
    60,
    30,
  );
  expect(alphaAtDraw).toBe(0.4);
  expect(context.globalAlpha).toBe(1);
});

test("the raster adapter draws shared text segments with their style", () => {
  const fills: unknown[][] = [];
  const context = {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textBaseline: "alphabetic" as CanvasTextBaseline,
    lineWidth: 0,
    lineJoin: "miter" as CanvasLineJoin,
    fillText: vi.fn((text: string, x: number, y: number) => {
      fills.push([text, x, y, context.fillStyle, context.globalAlpha]);
    }),
    strokeText: vi.fn(),
  };
  const text: TextLayerPresentation = {
    kind: "text",
    id: "text-1",
    name: "Caption",
    opacity: 0.6,
    frame: { x: 12, y: 18, width: 80, height: 15 },
    font: {
      family: "Courier New",
      size: 10,
      weight: 700,
    },
    lineHeight: 15,
    outline: { width: 2, color: "#112233" },
    lines: [
      {
        y: 0,
        segments: [
          { text: "Red", color: "#ff0000", offset: 0, width: 30 },
          { text: "Blue", color: "#0000ff", offset: 30, width: 40 },
        ],
      },
    ],
  };

  drawTextLayer(context, text);

  expect(context).toMatchObject({
    globalAlpha: 1,
    font: '700 10px "Courier New", sans-serif',
    textBaseline: "top",
    lineWidth: 2,
    lineJoin: "round",
    strokeStyle: "#112233",
  });
  expect(context.strokeText.mock.calls).toEqual([
    ["Red", 12, 18],
    ["Blue", 42, 18],
  ]);
  expect(fills).toEqual([
    ["Red", 12, 18, "#ff0000", 0.6],
    ["Blue", 42, 18, "#0000ff", 0.6],
  ]);
});
