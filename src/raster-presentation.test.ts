import { expect, test, vi } from "vitest";
import { drawImageLayer } from "./raster-presentation";
import type { ImageLayerPresentation } from "./presentation";

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
