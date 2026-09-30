import { useRef, type CSSProperties, type PointerEvent } from "react";
import type { ImageLayer } from "./editor";
import { resizeImageCrop, type CropHandle } from "./image-crop";

const HANDLES = [
  ["nw", "top left"],
  ["n", "top"],
  ["ne", "top right"],
  ["e", "right"],
  ["se", "bottom right"],
  ["s", "bottom"],
  ["sw", "bottom left"],
  ["w", "left"],
] as const;

type ImageCropProps = {
  layer: ImageLayer;
  crop: ImageLayer["crop"];
  zoom: number;
  onChange: (crop: ImageLayer["crop"]) => void;
};

export function ImageCrop({ layer, crop, zoom, onChange }: ImageCropProps) {
  const drag = useRef<
    | {
        pointerId: number;
        x: number;
        y: number;
        crop: ImageLayer["crop"];
        handle: CropHandle;
        zoom: number;
      }
    | undefined
  >(undefined);

  function preview(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || event.pointerId !== start.pointerId) return;
    onChange(
      resizeImageCrop(
        layer,
        start.crop,
        start.handle,
        {
          x: event.clientX - start.x,
          y: event.clientY - start.y,
        },
        start.zoom,
      ),
    );
  }

  function cancelDrag() {
    const start = drag.current;
    drag.current = undefined;
    if (start) onChange(start.crop);
  }

  const selection = {
    left: (crop.x - layer.crop.x) * layer.scale,
    top: (crop.y - layer.crop.y) * layer.scale,
    width: crop.width * layer.scale,
    height: crop.height * layer.scale,
  };

  return (
    <div
      className="image-crop-overlay"
      role="region"
      aria-label="Image crop"
      style={
        {
          left: layer.x,
          top: layer.y,
          width: layer.crop.width * layer.scale,
          height: layer.crop.height * layer.scale,
          ["--crop-zoom"]: zoom,
        } as CSSProperties
      }
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="image-crop-preview">
        <img
          src={layer.source}
          alt=""
          draggable={false}
          style={{
            left: -layer.crop.x * layer.scale,
            top: -layer.crop.y * layer.scale,
            width: layer.naturalWidth * layer.scale,
            height: layer.naturalHeight * layer.scale,
            opacity: layer.opacity,
          }}
        />
        <div className="image-crop-selection" style={selection} />
      </div>
      <div
        className="image-crop-handles"
        style={{
          left: selection.left + selection.width / 2,
          top: selection.top + selection.height / 2,
          width: Math.max(selection.width, 48 / zoom),
          height: Math.max(selection.height, 48 / zoom),
        }}
      >
        {HANDLES.map(([handle, label]) => (
          <button
            key={handle}
            type="button"
            className={`image-crop-handle ${handle}`}
            aria-label={`Crop ${label}`}
            onPointerDown={(event) => {
              if (event.button !== 0 || drag.current) return;
              event.preventDefault();
              event.stopPropagation();
              drag.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                crop,
                handle,
                zoom,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={preview}
            onPointerUp={(event) => {
              if (event.pointerId !== drag.current?.pointerId) return;
              preview(event);
              drag.current = undefined;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={cancelDrag}
            onKeyDown={(event) => {
              if (!event.key.startsWith("Arrow")) return;
              event.preventDefault();
              const step = (event.shiftKey ? 10 : 1) * layer.scale * zoom;
              onChange(
                resizeImageCrop(
                  layer,
                  crop,
                  handle,
                  {
                    x:
                      event.key === "ArrowLeft"
                        ? -step
                        : event.key === "ArrowRight"
                          ? step
                          : 0,
                    y:
                      event.key === "ArrowUp"
                        ? -step
                        : event.key === "ArrowDown"
                          ? step
                          : 0,
                  },
                  zoom,
                ),
              );
            }}
          />
        ))}
      </div>
    </div>
  );
}
