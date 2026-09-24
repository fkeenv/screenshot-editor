import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent,
} from "react";
import {
  addImageLayer,
  cropImageLayer,
  moveImageLayer,
  openProject,
  redo,
  scaleImageLayer,
  setCanvasSize,
  setView,
  SUPPORTED_IMAGE_ACCEPT,
  supportedImageFormat,
  undo,
  type ImageLayer,
  type Project,
} from "./editor";

const PRESETS = [
  { width: 800, height: 600 },
  { width: 1150, height: 600 },
] as const;

function readImage(file: File): Promise<{
  source: string;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("The image could not be read."));
        return;
      }

      const source = reader.result;
      const image = new Image();
      image.onerror = () => reject(new Error("The image could not be decoded."));
      image.onload = () =>
        resolve({
          source,
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

function CropControls({
  layer,
  onCrop,
}: {
  layer: ImageLayer;
  onCrop: (crop: ImageLayer["crop"]) => void;
}) {
  function applyCrop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onCrop({
      x: Number(values.get("cropX")),
      y: Number(values.get("cropY")),
      width: Number(values.get("cropWidth")),
      height: Number(values.get("cropHeight")),
    });
  }

  return (
    <form
      className="control-group crop-controls"
      key={`${layer.id}-${layer.crop.x}-${layer.crop.y}-${layer.crop.width}-${layer.crop.height}`}
      onSubmit={applyCrop}
    >
      <span className="control-title">Crop</span>
      <label>
        X
        <input
          name="cropX"
          type="number"
          min={layer.crop.x}
          max={layer.crop.x + layer.crop.width - 1}
          defaultValue={layer.crop.x}
          required
        />
      </label>
      <label>
        Y
        <input
          name="cropY"
          type="number"
          min={layer.crop.y}
          max={layer.crop.y + layer.crop.height - 1}
          defaultValue={layer.crop.y}
          required
        />
      </label>
      <label>
        W
        <input
          name="cropWidth"
          type="number"
          min="1"
          max={layer.crop.width}
          defaultValue={layer.crop.width}
          required
        />
      </label>
      <label>
        H
        <input
          name="cropHeight"
          type="number"
          min="1"
          max={layer.crop.height}
          defaultValue={layer.crop.height}
          required
        />
      </label>
      <button type="submit">Apply crop</button>
    </form>
  );
}

function ScaleControls({
  layer,
  onScale,
}: {
  layer: ImageLayer;
  onScale: (scale: number) => void;
}) {
  const [percent, setPercent] = useState(Math.round(layer.scale * 100));

  return (
    <form
      className="control-group scale-control"
      onSubmit={(event) => {
        event.preventDefault();
        onScale(percent / 100);
      }}
    >
      <label>
        Scale
        <input
          type="range"
          min="5"
          max="400"
          step="5"
          value={percent}
          onChange={(event) => setPercent(Number(event.target.value))}
        />
      </label>
      <output>{percent}%</output>
      <button type="submit">Apply scale</button>
    </form>
  );
}

export function App() {
  const [project, setProject] = useState<Project>(openProject);
  const [width, setWidth] = useState(String(project.canvasWidth));
  const [height, setHeight] = useState(String(project.canvasHeight));
  const [selectedLayerId, setSelectedLayerId] = useState<string>();
  const [importError, setImportError] = useState<string>();
  const selectedLayer = project.layers.find(
    (layer) => layer.id === selectedLayerId,
  );

  function applySize(nextWidth: number, nextHeight: number) {
    if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight)) return;
    if (nextWidth < 1 || nextHeight < 1) return;
    setProject((current) => setCanvasSize(current, nextWidth, nextHeight));
    setWidth(String(nextWidth));
    setHeight(String(nextHeight));
  }

  function applyTypedSize(event: FormEvent) {
    event.preventDefault();
    applySize(Number(width), Number(height));
  }

  function changeZoom(nextZoom: number) {
    setProject((current) =>
      setView(current, nextZoom, current.panX, current.panY),
    );
  }

  async function importImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const format = supportedImageFormat(file.name, file.type);
    if (!format) {
      setImportError("Choose a JPG, PNG, WebP, GIF, or BMP image.");
      return;
    }

    try {
      const image = await readImage(file);
      const id = crypto.randomUUID();
      setProject((current) =>
        addImageLayer(current, {
          id,
          name: file.name,
          format,
          ...image,
        }),
      );
      setSelectedLayerId(id);
      setImportError(undefined);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "The image could not be imported.",
      );
    }
  }

  function onViewportPointerDown(event: PointerEvent<HTMLDivElement>) {
    const viewport = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = project.panX;
    const originY = project.panY;
    viewport.setPointerCapture(event.pointerId);

    function onMove(move: globalThis.PointerEvent) {
      if (move.buttons === 0) return;
      setProject((current) => ({
        ...current,
        panX: originX + move.clientX - startX,
        panY: originY + move.clientY - startY,
      }));
    }

    function onUp(up: globalThis.PointerEvent) {
      viewport.removeEventListener("pointermove", onMove);
      viewport.removeEventListener("pointerup", onUp);
      viewport.removeEventListener("pointercancel", onUp);
      const panX = originX + up.clientX - startX;
      const panY = originY + up.clientY - startY;
      if (panX === originX && panY === originY) return;
      setProject((current) =>
        setView(
          { ...current, panX: originX, panY: originY },
          current.zoom,
          panX,
          panY,
        ),
      );
    }

    viewport.addEventListener("pointermove", onMove);
    viewport.addEventListener("pointerup", onUp);
    viewport.addEventListener("pointercancel", onUp);
  }

  function onLayerPointerDown(
    event: PointerEvent<HTMLDivElement>,
    layer: ImageLayer,
  ) {
    event.stopPropagation();
    setSelectedLayerId(layer.id);
    const element = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = layer.x;
    const originY = layer.y;
    const zoom = project.zoom;
    let finalX = originX;
    let finalY = originY;
    element.setPointerCapture(event.pointerId);

    function onMove(move: globalThis.PointerEvent) {
      if (move.buttons === 0) return;
      finalX = originX + (move.clientX - startX) / zoom;
      finalY = originY + (move.clientY - startY) / zoom;
      setProject((current) => ({
        ...current,
        layers: current.layers.map((currentLayer) =>
          currentLayer.id === layer.id
            ? { ...currentLayer, x: finalX, y: finalY }
            : currentLayer,
        ),
      }));
    }

    function onUp(up: globalThis.PointerEvent) {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
      if (up.type !== "pointercancel") {
        finalX = originX + (up.clientX - startX) / zoom;
        finalY = originY + (up.clientY - startY) / zoom;
      }
      if (finalX === originX && finalY === originY) return;

      setProject((current) =>
        moveImageLayer(
          {
            ...current,
            layers: current.layers.map((currentLayer) =>
              currentLayer.id === layer.id
                ? { ...currentLayer, x: originX, y: originY }
                : currentLayer,
            ),
          },
          layer.id,
          finalX,
          finalY,
        ),
      );
    }

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);
  }

  useEffect(() => {
    setWidth(String(project.canvasWidth));
    setHeight(String(project.canvasHeight));
  }, [project.canvasWidth, project.canvasHeight]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") {
        return;
      }
      event.preventDefault();
      setProject((current) => (event.shiftKey ? redo(current) : undo(current)));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="app">
      <header className="toolbar">
        <div className="control-group">
          <button
            type="button"
            onClick={() => setProject(undo)}
            disabled={project.past.length === 0}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => setProject(redo)}
            disabled={project.future.length === 0}
          >
            Redo
          </button>
        </div>

        <form className="control-group" onSubmit={applyTypedSize}>
          {PRESETS.map((preset) => (
            <button
              key={`${preset.width}x${preset.height}`}
              type="button"
              onClick={() => applySize(preset.width, preset.height)}
            >
              {preset.width}×{preset.height}
            </button>
          ))}
          <label>
            Width
            <input
              value={width}
              inputMode="numeric"
              onChange={(event) => setWidth(event.target.value)}
            />
          </label>
          <label>
            Height
            <input
              value={height}
              inputMode="numeric"
              onChange={(event) => setHeight(event.target.value)}
            />
          </label>
          <button type="submit">Apply size</button>
        </form>

        <div className="control-group">
          <button type="button" onClick={() => changeZoom(project.zoom / 1.25)}>
            Zoom out
          </button>
          <span className="zoom-value">{Math.round(project.zoom * 100)}%</span>
          <button type="button" onClick={() => changeZoom(project.zoom * 1.25)}>
            Zoom in
          </button>
        </div>

        <label className="import-button">
          Import image
          <input
            type="file"
            accept={SUPPORTED_IMAGE_ACCEPT}
            onChange={importImage}
          />
        </label>

        {selectedLayer ? (
          <>
            <ScaleControls
              key={`${selectedLayer.id}-${selectedLayer.scale}`}
              layer={selectedLayer}
              onScale={(scale) =>
                setProject((current) =>
                  scaleImageLayer(current, selectedLayer.id, scale),
                )
              }
            />
            <CropControls
              layer={selectedLayer}
              onCrop={(crop) =>
                setProject((current) =>
                  cropImageLayer(current, selectedLayer.id, crop),
                )
              }
            />
          </>
        ) : null}

        {importError ? <p className="import-error">{importError}</p> : null}
      </header>

      <div className="viewport" onPointerDown={onViewportPointerDown}>
        <div
          className="canvas"
          style={{
            width: project.canvasWidth,
            height: project.canvasHeight,
            transform: `translate(${project.panX}px, ${project.panY}px) scale(${project.zoom})`,
          }}
        >
          {project.layers.map((layer) => (
            <div
              className={`image-layer${selectedLayerId === layer.id ? " selected" : ""}`}
              key={layer.id}
              style={{
                left: layer.x,
                top: layer.y,
                width: layer.crop.width * layer.scale,
                height: layer.crop.height * layer.scale,
              }}
              title={layer.name}
              onPointerDown={(event) => onLayerPointerDown(event, layer)}
            >
              <img
                src={layer.source}
                alt=""
                draggable={false}
                style={{
                  width: layer.naturalWidth * layer.scale,
                  height: layer.naturalHeight * layer.scale,
                  left: -layer.crop.x * layer.scale,
                  top: -layer.crop.y * layer.scale,
                }}
              />
            </div>
          ))}
          <span className="canvas-size">
            {project.canvasWidth}×{project.canvasHeight}
          </span>
        </div>
      </div>
    </div>
  );
}
