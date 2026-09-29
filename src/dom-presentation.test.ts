import { expect, test } from "vitest";
import { imageLayerStyles } from "./dom-presentation";
import type { ImageLayerPresentation } from "./presentation";

test("the DOM adapter maps shared image decisions to layer styles", () => {
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

  expect(imageLayerStyles(image)).toEqual({
    frame: {
      left: 12,
      top: 18,
      width: 60,
      height: 30,
      opacity: 0.4,
    },
    content: {
      left: -15,
      top: -7.5,
      width: 150,
      height: 120,
    },
  });
});
