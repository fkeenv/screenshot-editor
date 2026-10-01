import { expect, test } from "vitest";
import { snapToGrid } from "./grid";

test.each([
  [29, 20, 20],
  [31, 20, 40],
  [-31, 20, -40],
  [-9, 20, 0],
  [10, 20, 20],
  [80, 20, 80],
  [23.5, 8, 24],
])("snap %s to a %spx grid gives %s", (value, spacing, expected) => {
  expect(snapToGrid(value, spacing)).toBe(expected);
});

test.each([0, -1, NaN, Infinity])(
  "invalid grid spacing %s leaves the value unchanged",
  (spacing) => {
    expect(snapToGrid(12, spacing)).toBe(12);
  },
);
