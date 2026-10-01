import { snapToGrid } from "./grid";

export type SnapGuide = {
  axis: "x" | "y";
  position: number;
  label: string;
};

type SnapOptions = {
  canvas: boolean;
  grid: boolean;
  spacing: number;
  padding: number;
  zoom: number;
};

export function snapLayerPosition(
  position: { x: number; y: number },
  size: { width: number; height: number },
  canvas: { width: number; height: number },
  options: SnapOptions,
): { x: number; y: number; guides: SnapGuide[] } {
  const guides: SnapGuide[] = [];
  const tolerance = 8 / options.zoom;

  function snapAxis(
    axis: "x" | "y",
    value: number,
    length: number,
    limit: number,
  ) {
    if (options.canvas) {
      const targets = [
        { value: 0, position: 0, label: "Edge · 0px" },
        { value: limit - length, position: limit, label: `Edge · ${limit}px` },
        { value: (limit - length) / 2, position: limit / 2, label: "Center" },
      ];
      if (options.padding > 0 && length <= limit - options.padding * 2) {
        targets.push(
          {
            value: options.padding,
            position: options.padding,
            label: `Padding · ${options.padding}px`,
          },
          {
            value: limit - length - options.padding,
            position: limit - options.padding,
            label: `Padding · ${options.padding}px`,
          },
        );
      }
      const target = targets
        .filter((target) => Math.abs(value - target.value) <= tolerance)
        .sort(
          (left, right) =>
            Math.abs(value - left.value) - Math.abs(value - right.value),
        )[0];
      if (target) {
        guides.push({ axis, position: target.position, label: target.label });
        return target.value;
      }
    }
    if (options.grid) {
      const snapped = snapToGrid(value, options.spacing);
      guides.push({ axis, position: snapped, label: `Grid · ${snapped}px` });
      return snapped;
    }
    return value;
  }

  const x = snapAxis("x", position.x, size.width, canvas.width);
  const y = snapAxis("y", position.y, size.height, canvas.height);
  return { x, y, guides };
}
