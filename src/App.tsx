import { Button } from "@mantine/core";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent,
} from "react";
import {
  addImageLayer,
  addTextLayer,
  cropImageLayer,
  editTextLayer,
  finishLayerOpacity,
  finishImageScale,
  fitImageLayerToCanvas,
  moveLayer,
  nudgeLayer,
  openProject,
  previewLayerOpacity,
  previewImageScale,
  renameLayer,
  redo,
  reorderLayer,
  resizeTextLayer,
  scaleImageLayer,
  setCanvasSize,
  setLayerVisibility,
  setView,
  SUPPORTED_IMAGE_ACCEPT,
  supportedImageFormat,
  TEXT_COLOR_PRESETS,
  undo,
  type ImageLayer,
  type Layer,
  type Project,
  type TextContent,
  type TextLayer,
  type TextLayerEdit,
} from "./editor";
import {
  ColoredText,
  InlineTextEditor,
  type TextEditorHandle,
} from "./InlineTextEditor";
import { LayersPanel } from "./LayersPanel";

const PRESETS = [
  { width: 800, height: 600 },
  { width: 1150, height: 600 },
] as const;

const SCALE_PRESETS = [0.25, 0.5, 1, 2] as const;
const TEXT_EDIT_FRAME_WIDTH = 6;

const TOOL_MENUS = ["File", "Edit", "Image", "Text", "View"] as const;
type ToolMenu = (typeof TOOL_MENUS)[number];

const FONT_FAMILIES = [
  "Arial",
  "Verdana",
  "Tahoma",
  "Georgia",
  "Courier New",
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
  onPreview,
  onCommit,
  onSetScale,
  onFit,
}: {
  layer: ImageLayer;
  onPreview: (scale: number) => void;
  onCommit: (previousScale: number) => void;
  onSetScale: (scale: number) => void;
  onFit: () => void;
}) {
  const gestureStart = useRef<number | undefined>(undefined);

  function beginGesture() {
    gestureStart.current ??= layer.scale;
  }

  function finishGesture() {
    const previousScale = gestureStart.current;
    gestureStart.current = undefined;
    if (previousScale !== undefined) onCommit(previousScale);
  }

  const percent = Math.round(layer.scale * 100);

  return (
    <div className="control-group scale-control">
      <label>
        Scale
        <input
          type="range"
          min="5"
          max={Math.max(400, percent)}
          step="5"
          value={percent}
          onPointerDown={beginGesture}
          onPointerUp={finishGesture}
          onPointerCancel={finishGesture}
          onKeyDown={beginGesture}
          onKeyUp={finishGesture}
          onBlur={finishGesture}
          onChange={(event) => onPreview(Number(event.target.value) / 100)}
        />
      </label>
      <output>{percent}%</output>
      <button type="button" onClick={onFit} title="Fit image to canvas">
        Fit
      </button>
      {SCALE_PRESETS.map((scale) => (
        <button type="button" key={scale} onClick={() => onSetScale(scale)}>
          {scale * 100}%
        </button>
      ))}
    </div>
  );
}

function TextControls({
  layer,
  onEdit,
  canColorSelection,
  onApplyColor,
  onBeginColorInteraction,
  onRefocusEditor,
}: {
  layer: TextLayer;
  onEdit: (changes: TextLayerEdit) => void;
  canColorSelection: boolean;
  onApplyColor: (color: string) => void;
  onBeginColorInteraction: () => void;
  onRefocusEditor: () => void;
}) {
  const [customColor, setCustomColor] = useState("#ffffff");

  function editNumber(
    property:
      | "fontSize"
      | "outlineWidth"
      | "lineSpacing"
      | "wrapWidth",
    value: string,
    minimum: number,
  ) {
    const number = Number(value);
    if (Number.isFinite(number)) onEdit({ [property]: Math.max(minimum, number) });
  }

  return (
    <div className="text-controls" role="toolbar" aria-label="Text formatting">
      <label>
        Font
        <select
          value={layer.fontFamily}
          onChange={(event) => onEdit({ fontFamily: event.target.value })}
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font}>{font}</option>
          ))}
        </select>
      </label>
      <label>
        Size
        <input
          type="number"
          min="1"
          value={layer.fontSize}
          onChange={(event) => editNumber("fontSize", event.target.value, 1)}
        />
      </label>
      <button
        type="button"
        className={layer.bold ? "active-control" : ""}
        aria-pressed={layer.bold}
        onClick={() => onEdit({ bold: !layer.bold })}
      >
        B
      </button>
      <span className="toolbar-divider" />
      <label>
        Outline
        <input
          type="number"
          min="0"
          step="0.5"
          value={layer.outlineWidth}
          onChange={(event) =>
            editNumber("outlineWidth", event.target.value, 0)
          }
        />
      </label>
      <label>
        Outline color
        <input
          className="color-input"
          type="color"
          value={layer.outlineColor}
          onChange={(event) => onEdit({ outlineColor: event.target.value })}
        />
      </label>
      <label>
        Spacing
        <input
          type="number"
          min="0.5"
          step="0.1"
          value={layer.lineSpacing}
          onChange={(event) =>
            editNumber("lineSpacing", event.target.value, 0.5)
          }
        />
      </label>
      <label>
        Width
        <input
          type="number"
          min="1"
          value={layer.wrapWidth}
          onChange={(event) => editNumber("wrapWidth", event.target.value, 1)}
        />
      </label>
      <span className="toolbar-divider" />
      <div className="selection-colors" aria-label="Selection colors">
        {Object.entries(TEXT_COLOR_PRESETS).map(([preset, presetDetails]) => (
          <button
            type="button"
            className="color-preset"
            data-text-color-control
            disabled={!canColorSelection}
            key={preset}
            style={{ ["--preset" as string]: presetDetails.color }}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onApplyColor(presetDetails.color)}
          >
            <span className="color-swatch" />
            {presetDetails.label}
          </button>
        ))}
        <label>
          Custom
          <input
            className="color-input"
            data-text-color-control
            type="color"
            value={customColor}
            disabled={!canColorSelection}
            onPointerDown={onBeginColorInteraction}
            onChange={(event) => {
              setCustomColor(event.target.value);
              onApplyColor(event.target.value);
            }}
            onBlur={onRefocusEditor}
          />
        </label>
      </div>
    </div>
  );
}

export function App() {
  const [project, setProject] = useState<Project>(openProject);
  const [width, setWidth] = useState(String(project.canvasWidth));
  const [height, setHeight] = useState(String(project.canvasHeight));
  const [selectedLayerId, setSelectedLayerId] = useState<string>();
  const [importError, setImportError] = useState<string>();
  const [activeMenu, setActiveMenu] = useState<ToolMenu>("Image");
  const [editingTextLayerId, setEditingTextLayerId] = useState<string>();
  const [selectTextOnEdit, setSelectTextOnEdit] = useState(false);
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const [placingText, setPlacingText] = useState(false);
  const [layersPanelOpen, setLayersPanelOpen] = useState(true);
  const textEditor = useRef<TextEditorHandle | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const selectedLayer = project.layers.find(
    (layer) => layer.id === selectedLayerId,
  );
  const selectedImageLayer =
    selectedLayer?.kind === "image" ? selectedLayer : undefined;
  const selectedTextLayer =
    selectedLayer?.kind === "text" ? selectedLayer : undefined;

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
      setActiveMenu("Image");
      setImportError(undefined);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "The image could not be imported.",
      );
    }
  }

  function placeTextBox(event: { clientX: number; clientY: number }) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const border = Number.parseFloat(getComputedStyle(canvas).borderLeftWidth) || 0;
    const x = (event.clientX - rect.left - border) / project.zoom;
    const y = (event.clientY - rect.top - border) / project.zoom;
    if (x < 0 || y < 0 || x > project.canvasWidth || y > project.canvasHeight) {
      return;
    }

    const id = crypto.randomUUID();
    setProject((current) => addTextLayer(current, id, { x, y }));
    setSelectedLayerId(id);
    setEditingTextLayerId(id);
    setSelectTextOnEdit(true);
    setHasTextSelection(false);
    setPlacingText(false);
    setActiveMenu("Text");
  }

  function resizeTextBox(
    event: PointerEvent<HTMLSpanElement>,
    layer: TextLayer,
    corner: "nw" | "ne" | "sw" | "se",
  ) {
    event.stopPropagation();
    event.preventDefault();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const originWidth = layer.wrapWidth;
    const originX = layer.x;
    const zoom = project.zoom;
    const fromLeft = corner === "nw" || corner === "sw";
    let width = originWidth;
    let x = originX;
    handle.setPointerCapture(event.pointerId);

    function measure(clientX: number) {
      const dx = (clientX - startX) / zoom;
      width = Math.max(40, Math.round(originWidth + (fromLeft ? -dx : dx)));
      x = fromLeft ? originX + originWidth - width : originX;
    }

    function preview(clientX: number) {
      measure(clientX);
      setProject((current) => ({
        ...current,
        layers: current.layers.map((item) =>
          item.id === layer.id && item.kind === "text"
            ? { ...item, x, wrapWidth: width }
            : item,
        ),
      }));
    }

    function onMove(move: globalThis.PointerEvent) {
      if (move.buttons === 0) return;
      preview(move.clientX);
    }

    function onUp(up: globalThis.PointerEvent) {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      if (up.type !== "pointercancel") measure(up.clientX);
      setProject((current) => {
        const restored = {
          ...current,
          layers: current.layers.map((item) =>
            item.id === layer.id && item.kind === "text"
              ? { ...item, x: originX, wrapWidth: originWidth }
              : item,
          ),
        };
        return resizeTextLayer(restored, layer.id, x, width);
      });
    }

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  function beginTextEditing(layerId: string) {
    setSelectedLayerId(layerId);
    setEditingTextLayerId(layerId);
    setSelectTextOnEdit(true);
    setActiveMenu("Text");
  }

  function finishTextEditing(layerId: string, content: TextContent) {
    setProject((current) => editTextLayer(current, layerId, content));
    setEditingTextLayerId(undefined);
    setSelectTextOnEdit(false);
    setHasTextSelection(false);
  }

  function cancelTextEditing() {
    setEditingTextLayerId(undefined);
    setSelectTextOnEdit(false);
    setHasTextSelection(false);
  }

  function onViewportPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (placingText) return;
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
    layer: Layer,
  ) {
    event.stopPropagation();
    if (placingText) {
      placeTextBox(event);
      return;
    }
    if (layer.kind === "text" && editingTextLayerId === layer.id) {
      event.preventDefault();
    }
    setSelectedLayerId(layer.id);
    setActiveMenu(layer.kind === "image" ? "Image" : "Text");
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
        moveLayer(
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
      if (
        event.target instanceof HTMLElement &&
        event.target.matches("input, textarea, select, button, [contenteditable='true']")
      ) {
        return;
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();
        setProject((current) => (event.shiftKey ? redo(current) : undo(current)));
        return;
      }

      if (event.key === "Escape") {
        setPlacingText(false);
        return;
      }

      if (
        !selectedLayerId ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
          event.key,
        )
      ) {
        return;
      }

      event.preventDefault();
      const distance = event.shiftKey ? 10 : 1;
      const deltaX =
        event.key === "ArrowLeft"
          ? -distance
          : event.key === "ArrowRight"
            ? distance
            : 0;
      const deltaY =
        event.key === "ArrowUp"
          ? -distance
          : event.key === "ArrowDown"
            ? distance
            : 0;
      setProject((current) =>
        nudgeLayer(current, selectedLayerId, deltaX, deltaY),
      );
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedLayerId]);

  return (
    <div className="app">
      <header className="editor-chrome">
        <div className="menu-row">
          <span className="app-title">Screenshot editor</span>
          <nav className="menu-tabs" role="tablist" aria-label="Editor tools">
            {TOOL_MENUS.map((menu) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeMenu === menu}
                aria-controls="active-tool-panel"
                className={activeMenu === menu ? "active" : ""}
                key={menu}
                onClick={() => setActiveMenu(menu)}
              >
                {menu}
              </button>
            ))}
          </nav>
          <span className="document-status">
            {project.canvasWidth}×{project.canvasHeight} · {Math.round(project.zoom * 100)}%
          </span>
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            style={{ alignSelf: "center", marginLeft: 8 }}
            aria-controls="layers-panel"
            aria-expanded={layersPanelOpen}
            onClick={() => setLayersPanelOpen((open) => !open)}
          >
            {layersPanelOpen ? "Hide layers" : "Show layers"}
          </Button>
        </div>

        <div
          className="tool-panel"
          id="active-tool-panel"
          role="tabpanel"
          aria-label={`${activeMenu} tools`}
        >
          {activeMenu === "File" ? (
            <div className="control-group">
              <label className="import-button">
                Import image
                <input
                  type="file"
                  accept={SUPPORTED_IMAGE_ACCEPT}
                  onChange={importImage}
                />
              </label>
              <span className="tool-hint">JPG, PNG, WebP, GIF, or BMP</span>
            </div>
          ) : null}

          {activeMenu === "Edit" ? (
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
              <span className="tool-hint">Ctrl/Cmd+Z · Shift+Ctrl/Cmd+Z</span>
            </div>
          ) : null}

          {activeMenu === "Image" ? (
            <>
              <form className="control-group" onSubmit={applyTypedSize}>
                <span className="control-title">Canvas size</span>
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
                <button type="submit">Apply</button>
              </form>

              {selectedImageLayer ? (
                <>
                  <div className="tool-divider" />
                  <ScaleControls
                    key={selectedImageLayer.id}
                    layer={selectedImageLayer}
                    onPreview={(scale) =>
                      setProject((current) =>
                        previewImageScale(
                          current,
                          selectedImageLayer.id,
                          scale,
                        ),
                      )
                    }
                    onCommit={(previousScale) =>
                      setProject((current) =>
                        finishImageScale(
                          current,
                          selectedImageLayer.id,
                          previousScale,
                        ),
                      )
                    }
                    onSetScale={(scale) =>
                      setProject((current) =>
                        scaleImageLayer(current, selectedImageLayer.id, scale),
                      )
                    }
                    onFit={() =>
                      setProject((current) =>
                        fitImageLayerToCanvas(current, selectedImageLayer.id),
                      )
                    }
                  />
                  <div className="tool-divider" />
                  <CropControls
                    layer={selectedImageLayer}
                    onCrop={(crop) =>
                      setProject((current) =>
                        cropImageLayer(current, selectedImageLayer.id, crop),
                      )
                    }
                  />
                </>
              ) : (
                <span className="tool-hint">Import or select an image to scale and crop it.</span>
              )}
            </>
          ) : null}

          {activeMenu === "Text" ? (
            <>
              <div className="control-group">
                <button
                  type="button"
                  aria-pressed={placingText}
                  className={placingText ? "active-control" : ""}
                  onClick={() => setPlacingText((current) => !current)}
                >
                  Add text box
                </button>
              </div>
              {selectedTextLayer ? (
                <div className="composer">
                  <TextControls
                    layer={selectedTextLayer}
                    canColorSelection={
                      editingTextLayerId === selectedTextLayer.id &&
                      hasTextSelection
                    }
                    onApplyColor={(color) =>
                      textEditor.current?.applyColor(color)
                    }
                    onBeginColorInteraction={() =>
                      textEditor.current?.preserveOnBlur()
                    }
                    onRefocusEditor={() => textEditor.current?.focus()}
                    onEdit={(changes) =>
                      setProject((current) =>
                        editTextLayer(current, selectedTextLayer.id, changes),
                      )
                    }
                  />
                </div>
              ) : (
                <span className="tool-hint">
                  {placingText
                    ? "Click the canvas to place the text box."
                    : "Add a text box, then edit it here."}
                </span>
              )}
            </>
          ) : null}

          {activeMenu === "View" ? (
            <div className="control-group">
              <button type="button" onClick={() => changeZoom(project.zoom / 1.25)}>
                Zoom out
              </button>
              <span className="zoom-value">{Math.round(project.zoom * 100)}%</span>
              <button type="button" onClick={() => changeZoom(project.zoom * 1.25)}>
                Zoom in
              </button>
            </div>
          ) : null}

          {importError ? <p className="import-error">{importError}</p> : null}
        </div>
      </header>

      <div
        className={`viewport${placingText ? " placing-text" : ""}`}
        onPointerDown={onViewportPointerDown}
      >
        <div
          className="canvas"
          ref={canvasRef}
          onPointerDown={(event) => {
            if (!placingText) return;
            event.stopPropagation();
            placeTextBox(event);
          }}
          style={{
            width: project.canvasWidth,
            height: project.canvasHeight,
            transform: `translate(${project.panX}px, ${project.panY}px) scale(${project.zoom})`,
          }}
        >
          {project.layers.map((layer) =>
            layer.kind === "image" ? (
              <div
                className={`canvas-layer image-layer${selectedLayerId === layer.id ? " selected" : ""}`}
                key={layer.id}
                style={{
                  left: layer.x,
                  top: layer.y,
                  width: layer.crop.width * layer.scale,
                  height: layer.crop.height * layer.scale,
                  display: layer.visible ? undefined : "none",
                  opacity: layer.opacity,
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
            ) : (
              <div
                className={`canvas-layer text-layer${selectedLayerId === layer.id ? " selected" : ""}${editingTextLayerId === layer.id ? " editing" : ""}`}
                key={layer.id}
                style={{
                  left:
                    layer.x -
                    (editingTextLayerId === layer.id
                      ? TEXT_EDIT_FRAME_WIDTH
                      : 0),
                  top:
                    layer.y -
                    (editingTextLayerId === layer.id
                      ? TEXT_EDIT_FRAME_WIDTH
                      : 0),
                  width:
                    layer.wrapWidth +
                    (editingTextLayerId === layer.id
                      ? TEXT_EDIT_FRAME_WIDTH * 2
                      : 0),
                  minHeight:
                    layer.fontSize * layer.lineSpacing +
                    (editingTextLayerId === layer.id
                      ? TEXT_EDIT_FRAME_WIDTH * 2
                      : 0),
                  padding:
                    editingTextLayerId === layer.id
                      ? TEXT_EDIT_FRAME_WIDTH
                      : 0,
                  fontFamily: layer.fontFamily,
                  fontSize: layer.fontSize,
                  fontWeight: layer.bold ? 700 : 400,
                  lineHeight: layer.lineSpacing,
                  WebkitTextStroke: `${layer.outlineWidth}px ${layer.outlineColor}`,
                  display: layer.visible ? undefined : "none",
                  opacity: layer.opacity,
                }}
                title={layer.name}
                onPointerDown={(event) => onLayerPointerDown(event, layer)}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  beginTextEditing(layer.id);
                }}
              >
                {selectedLayerId === layer.id
                  ? (["nw", "ne", "sw", "se"] as const).map((corner) => (
                      <span
                        key={corner}
                        className={`text-resize-handle ${corner}`}
                        onPointerDown={(event) => resizeTextBox(event, layer, corner)}
                      />
                    ))
                  : null}
                {editingTextLayerId === layer.id ? (
                  <InlineTextEditor
                    layer={layer}
                    selectText={selectTextOnEdit}
                    editorHandle={textEditor}
                    onSelectionChange={setHasTextSelection}
                    onColorCommit={(previous, next) =>
                      setProject((current) => {
                        const withPendingText = editTextLayer(
                          current,
                          layer.id,
                          previous,
                        );
                        return editTextLayer(withPendingText, layer.id, next);
                      })
                    }
                    onHistory={(shouldRedo) =>
                      setProject((current) =>
                        shouldRedo ? redo(current) : undo(current),
                      )
                    }
                    onCommit={(content) => finishTextEditing(layer.id, content)}
                    onCancel={cancelTextEditing}
                  />
                ) : (
                  <ColoredText text={layer.text} colorRuns={layer.colorRuns} />
                )}
              </div>
            ),
          )}
          <span className="canvas-size">
            {project.canvasWidth}×{project.canvasHeight}
          </span>
        </div>
      </div>
      {layersPanelOpen ? (
        <LayersPanel
          layers={project.layers}
          selectedLayerId={selectedLayerId}
          actions={{
            select: setSelectedLayerId,
            reorder: (layerId, targetIndex) =>
              setProject((current) =>
                reorderLayer(current, layerId, targetIndex),
              ),
            rename: (layerId, name) =>
              setProject((current) => renameLayer(current, layerId, name)),
            setVisibility: (layerId, visible) =>
              setProject((current) =>
                setLayerVisibility(current, layerId, visible),
              ),
            previewOpacity: (layerId, opacity) =>
              setProject((current) =>
                previewLayerOpacity(current, layerId, opacity),
              ),
            commitOpacity: (layerId, previousOpacity) =>
              setProject((current) =>
                finishLayerOpacity(current, layerId, previousOpacity),
              ),
          }}
        />
      ) : null}
    </div>
  );
}
