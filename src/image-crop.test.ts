import { expect, test } from "vitest";
import { resizeImageCrop, type CropHandle } from "./image-crop";

test("visual crop maps pointer movement to source pixels at image scale and viewport zoom", () => {
  const layer = {
    crop: { x: 20, y: 10, width: 240, height: 120 },
    scale: 2,
  };

  expect(
    resizeImageCrop(layer, layer.crop, "nw", { x: 32, y: 24 }, 0.5),
  ).toEqual({ x: 52, y: 34, width: 208, height: 96 });
});

test.each([
  ["nw", -1000, -1000, { x: 20, y: 10, width: 240, height: 120 }],
  ["se", 1000, 1000, { x: 20, y: 10, width: 240, height: 120 }],
  ["nw", 1000, 1000, { x: 259, y: 129, width: 1, height: 1 }],
  ["se", -1000, -1000, { x: 20, y: 10, width: 1, height: 1 }],
] as const)(
  "%s handle stays inside the current crop and cannot collapse or cross",
  (handle, x, y, expected) => {
    const layer = { crop: { x: 20, y: 10, width: 240, height: 120 }, scale: 1 };
    expect(resizeImageCrop(layer, layer.crop, handle, { x, y }, 1)).toEqual(
      expected,
    );
  },
);

test.each([
  ["n", { x: 20, y: 30, width: 240, height: 100 }],
  ["ne", { x: 20, y: 30, width: 200, height: 100 }],
  ["e", { x: 20, y: 10, width: 200, height: 120 }],
  ["se", { x: 20, y: 10, width: 200, height: 120 }],
  ["s", { x: 20, y: 10, width: 240, height: 120 }],
  ["sw", { x: 20, y: 10, width: 240, height: 120 }],
  ["w", { x: 20, y: 10, width: 240, height: 120 }],
] satisfies [
  CropHandle,
  { x: number; y: number; width: number; height: number },
][])("%s handle only changes the requested edges", (handle, expected) => {
  const layer = { crop: { x: 20, y: 10, width: 240, height: 120 }, scale: 0.5 };
  expect(
    resizeImageCrop(layer, layer.crop, handle, { x: -40, y: 20 }, 2),
  ).toEqual(expected);
});

test("a draft can expand back within the current crop before applying, without revealing a previous crop", () => {
  const layer = { crop: { x: 20, y: 10, width: 240, height: 120 }, scale: 1 };
  const draft = { x: 60, y: 40, width: 100, height: 60 };
  expect(resizeImageCrop(layer, draft, "nw", { x: -100, y: -100 }, 1)).toEqual({
    x: 20,
    y: 10,
    width: 140,
    height: 90,
  });
});
