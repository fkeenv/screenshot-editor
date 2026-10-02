import { expect, test } from "vitest";
import { snapLayerPosition } from "./snapping";

const size = { width: 200, height: 120 };
const canvas = { width: 800, height: 600 };
const options = {
  canvas: true,
  grid: false,
  spacing: 20,
  padding: 16,
  zoom: 1,
};

test("center and 20px padding remain magnetic with optional snapping off", () => {
  const disabled = { ...options, canvas: false, padding: 20 };
  expect(snapLayerPosition({ x: 305, y: 244 }, size, canvas, disabled)).toMatchObject({ x: 300, y: 240 });
  expect(snapLayerPosition({ x: 23, y: 463 }, size, canvas, disabled)).toMatchObject({ x: 20, y: 460 });
  expect(snapLayerPosition({ x: 2, y: 100 }, size, canvas, disabled)).toMatchObject({ x: 2, y: 100 });
});

test("layer center snaps to canvas center with visible axis guides", () => {
  expect(snapLayerPosition({ x: 305, y: 244 }, size, canvas, options)).toEqual({
    x: 300,
    y: 240,
    guides: [
      { axis: "x", position: 400, label: "Center" },
      { axis: "y", position: 300, label: "Center" },
    ],
  });
});

test.each([
  [0, 0],
  [600, 0],
  [0, 480],
  [600, 480],
])("snap to canvas corner %s/%s aligns the layer's actual edges", (x, y) => {
  const snapped = snapLayerPosition(
    { x: x + 3, y: y + 3 },
    size,
    canvas,
    options,
  );
  expect(snapped).toMatchObject({ x, y });
  expect(snapped.guides).toHaveLength(2);
  expect(snapped.guides.every((guide) => guide.label.startsWith("Edge"))).toBe(
    true,
  );
});

test.each([
  [16, 16],
  [584, 16],
  [16, 464],
  [584, 464],
])(
  "snap to padded corner %s/%s leaves 16px between layer and canvas",
  (x, y) => {
    const snapped = snapLayerPosition(
      { x: x + 3, y: y + 3 },
      size,
      canvas,
      options,
    );
    expect(snapped).toMatchObject({ x, y });
    expect(
      snapped.guides.every((guide) => guide.label === "Padding · 16px"),
    ).toBe(true);
  },
);

test("capture distance is eight screen pixels at every zoom", () => {
  expect(
    snapLayerPosition({ x: 6, y: 100 }, size, canvas, { ...options, zoom: 2 })
      .x,
  ).toBe(6);
  expect(
    snapLayerPosition({ x: 6, y: 100 }, size, canvas, { ...options, zoom: 0.5 })
      .x,
  ).toBe(0);
});

test("canvas targets take priority over grid snapping independently on each axis", () => {
  const snapped = snapLayerPosition({ x: 304, y: 135 }, size, canvas, {
    ...options,
    grid: true,
    spacing: 32,
  });
  expect(snapped).toMatchObject({ x: 300, y: 128 });
  expect(snapped.guides.map((guide) => guide.label)).toEqual([
    "Center",
    "Grid · 128px",
  ]);
});

test("no guides appear away from canvas targets when grid snapping is disabled", () => {
  expect(snapLayerPosition({ x: 100, y: 150 }, size, canvas, options)).toEqual({
    x: 100,
    y: 150,
    guides: [],
  });
});

test("padding can be adjusted or disabled and is skipped when the layer does not fit inside it", () => {
  expect(
    snapLayerPosition({ x: 31, y: 31 }, size, canvas, {
      ...options,
      padding: 32,
    }),
  ).toMatchObject({ x: 32, y: 32 });
  expect(
    snapLayerPosition({ x: 16, y: 16 }, size, canvas, {
      ...options,
      padding: 0,
    }).guides,
  ).toEqual([]);
  const result = snapLayerPosition(
    { x: 16, y: 16 },
    { width: 790, height: 590 },
    canvas,
    options,
  );
  expect(
    result.guides.every((guide) => !guide.label.startsWith("Padding")),
  ).toBe(true);
});
