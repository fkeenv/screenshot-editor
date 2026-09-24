import { useEffect, useState, type FormEvent, type PointerEvent } from "react";
import {
  openProject,
  redo,
  setCanvasSize,
  setView,
  undo,
  type Project,
} from "./editor";

const PRESETS = [
  { width: 800, height: 600 },
  { width: 1150, height: 600 },
] as const;

export function App() {
  const [project, setProject] = useState<Project>(openProject);
  const [width, setWidth] = useState(String(project.canvasWidth));
  const [height, setHeight] = useState(String(project.canvasHeight));

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

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = project.panX;
    const originY = project.panY;
    event.currentTarget.setPointerCapture(event.pointerId);

    function onMove(move: globalThis.PointerEvent) {
      setProject((current) => ({
        ...current,
        panX: originX + move.clientX - startX,
        panY: originY + move.clientY - startY,
      }));
    }

    function onUp(up: globalThis.PointerEvent) {
      event.currentTarget.removeEventListener("pointermove", onMove);
      event.currentTarget.removeEventListener("pointerup", onUp);
      const panX = originX + up.clientX - startX;
      const panY = originY + up.clientY - startY;
      if (panX === originX && panY === originY) {
        setProject((current) => ({ ...current, panX: originX, panY: originY }));
        return;
      }
      setProject((current) =>
        setView(
          { ...current, panX: originX, panY: originY },
          current.zoom,
          panX,
          panY,
        ),
      );
    }

    event.currentTarget.addEventListener("pointermove", onMove);
    event.currentTarget.addEventListener("pointerup", onUp);
  }

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
      <form className="toolbar" onSubmit={applyTypedSize}>
        <button type="button" onClick={() => setProject(undo)} disabled={project.past.length === 0}>
          Undo
        </button>
        <button type="button" onClick={() => setProject(redo)} disabled={project.future.length === 0}>
          Redo
        </button>
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
        <button type="button" onClick={() => changeZoom(project.zoom / 1.25)}>
          Zoom out
        </button>
        <button type="button" onClick={() => changeZoom(project.zoom * 1.25)}>
          Zoom in
        </button>
      </form>
      <div className="viewport" onPointerDown={onPointerDown}>
        <div
          className="canvas"
          style={{
            width: project.canvasWidth * project.zoom,
            height: project.canvasHeight * project.zoom,
            transform: `translate(${project.panX}px, ${project.panY}px)`,
          }}
        >
          {project.canvasWidth}×{project.canvasHeight}
        </div>
      </div>
    </div>
  );
}
