import { expect, test } from "vitest";
import { imageLayerStyles, textLayerStyles } from "./dom-presentation";
import type {
  ImageLayerPresentation,
  TextLayerPresentation,
} from "./presentation";

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

test("the DOM adapter maps shared text decisions to layer styles", () => {
  const text: TextLayerPresentation = {
    kind: "text",
    id: "text-1",
    name: "Caption",
    opacity: 0.6,
    frame: { x: 12, y: 18, width: 80, height: 30 },
    font: {
      family: "Courier New",
      size: 10,
      weight: 700,
    },
    lineHeight: 15,
    outline: { width: 2, color: "#112233" },
    lines: [],
  };

  expect(textLayerStyles(text)).toEqual({
    frame: {
      left: 12,
      top: 18,
      width: 80,
      minHeight: 30,
      fontFamily: "Courier New",
      fontSize: 10,
      fontWeight: 700,
      lineHeight: "15px",
      WebkitTextStroke: "2px #112233",
      opacity: 0.6,
      overflowWrap: "normal",
      whiteSpace: "pre",
    },
    line: { height: 15, whiteSpace: "pre" },
  });
});
