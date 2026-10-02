import type { CSSProperties, PointerEvent } from "react";
import type { ImageLayer, ImageResizeCorner, RectangleLayer } from "./editor";

const CORNERS = [
  ["nw", "top left"],
  ["ne", "top right"],
  ["sw", "bottom left"],
  ["se", "bottom right"],
] as const;

export function LayerResizeHandles({
  layer,
  zoom,
  onStart,
}: {
  layer: ImageLayer | RectangleLayer;
  zoom: number;
  onStart: (
    event: PointerEvent<HTMLButtonElement>,
    corner: ImageResizeCorner,
  ) => void;
}) {
  const width = layer.kind === "image" ? layer.crop.width * layer.scale : layer.width;
  const height = layer.kind === "image" ? layer.crop.height * layer.scale : layer.height;
  return (
    <>
      <div
        className="image-resize-outline"
        aria-hidden="true"
        style={
          {
            left: layer.x,
            top: layer.y,
            width,
            height,
            ["--resize-zoom"]: zoom,
          } as CSSProperties
        }
      />
      <div
        className="image-resize-handles"
        style={
          {
            left: layer.x + width / 2,
            top: layer.y + height / 2,
            width: Math.max(width, 48 / zoom),
            height: Math.max(height, 48 / zoom),
            ["--resize-zoom"]: zoom,
          } as CSSProperties
        }
      >
        {CORNERS.map(([corner, label]) => (
          <button
            key={corner}
            type="button"
            className={`image-resize-handle ${corner}`}
            aria-label={`Resize ${layer.kind} ${label}`}
            onPointerDown={(event) => onStart(event, corner)}
          />
        ))}
      </div>
    </>
  );
}
