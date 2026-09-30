import type { ImageLayer } from "./editor";

export type CropHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export function resizeImageCrop(
  layer: Pick<ImageLayer, "crop" | "scale">,
  crop: ImageLayer["crop"],
  handle: CropHandle,
  screenDelta: { x: number; y: number },
  zoom: number,
): ImageLayer["crop"] {
  const dx = screenDelta.x / (layer.scale * zoom);
  const dy = screenDelta.y / (layer.scale * zoom);
  const bounds = layer.crop;
  let left = crop.x;
  let top = crop.y;
  let right = left + crop.width;
  let bottom = top + crop.height;
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.round(value)));

  if (handle.includes("w")) left = clamp(left + dx, bounds.x, right - 1);
  if (handle.includes("e")) {
    right = clamp(right + dx, left + 1, bounds.x + bounds.width);
  }
  if (handle.includes("n")) top = clamp(top + dy, bounds.y, bottom - 1);
  if (handle.includes("s")) {
    bottom = clamp(bottom + dy, top + 1, bounds.y + bounds.height);
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}
