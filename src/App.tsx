import { Button } from "@mantine/core";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
} from "react";
import {
  useControlEditLifetime,
  type ControlEdit,
} from "./control-edit";
import {
  imageLayerStyles,
  measureDomText,
  textLayerStyles,
} from "./dom-presentation";
import {
  addImageLayer,
  addTextLayer,
  beginUndoableEdit,
  cropImageLayer,
  editTextLayer,
  fitImageLayerToCanvas,
  nudgeLayer,
  openProject,
  openSavedProject,
  renameLayer,
  redo,
  reorderLayer,
  scaleImageLayer,
  saveProject,
  setCanvasSize,
  setLayerVisibility,
  setView,
  supportedImageFormat,
  TEXT_COLOR_PRESETS,
  undo,
  type ImageLayer,
  type Project,
  type TextContent,
  type TextLayer,
  type TextLayerEdit,
  type UndoableEditUpdate,
} from "./editor";
import {
  InlineTextEditor,
  type TextEditorHandle,
} from "./InlineTextEditor";
import {
  exportFlattened,
  exportStitch,
  type ExportFormat,
  type ExportOptions,
} from "./export";
import {
  fileWorkflowForWindow,
  type PickedFile,
} from "./file-workflow";
import { LayersPanel } from "./LayersPanel";
import { presentProject } from "./presentation";
import { PresentedText } from "./PresentedText";

const PRESETS = [
  { width: 800, height: 600 },
  { width: 1150, height: 600 },
] as const;

const SCALE_PRESETS = [0.25, 0.5, 1, 2] as const;
const TEXT_EDIT_FRAME_WIDTH = 6;
const TOOL_MENUS = ["File", "Stitch", "Edit", "Image", "Text", "View"] as const;
type ToolMenu = (typeof TOOL_MENUS)[number];

type StitchScreen = {
  id: string;
  name: string;
  project: Project;
};

const FONT_FAMILIES = [
  "Arial",
  "Verdana",
  "Tahoma",
  "Georgia",
  "Courier New",
] as const;

function readImage(file: PickedFile, mediaType: string): Promise<{
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
    const copy = new Uint8Array(file.bytes.byteLength);
    copy.set(file.bytes);
    reader.readAsDataURL(new Blob([copy.buffer], { type: mediaType }));
  });
}

const EXPORT_EXTENSION: Record<ExportFormat, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
};

function showsExportQuality(format: ExportFormat, lossless: boolean): boolean {
  return format === "jpeg" || (format === "webp" && !lossless);
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
  beginEdit,
  onSetScale,
  onFit,
}: {
  layer: ImageLayer;
  beginEdit: () => ControlEdit;
  onSetScale: (scale: number) => void;
  onFit: () => void;
}) {
  const edit = useControlEditLifetime(beginEdit);

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
          onPointerDown={edit.pointerDown}
          onPointerUp={edit.pointerUp}
          onPointerCancel={edit.pointerCancel}
          onKeyDown={(event) => edit.keyDown(event.key)}
          onKeyUp={(event) => edit.keyUp(event.key)}
          onBlur={edit.blur}
          onChange={(event) => edit.preview(Number(event.target.value) / 100)}
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
  onFinishColorInteraction,
}: {
  layer: TextLayer;
  onEdit: (changes: TextLayerEdit) => void;
  canColorSelection: boolean;
  onApplyColor: (color: string) => void;
  onBeginColorInteraction: () => void;
  onFinishColorInteraction: () => void;
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
            onClick={() => {
              onBeginColorInteraction();
              onApplyColor(presetDetails.color);
              onFinishColorInteraction();
            }}
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
            onBlur={onFinishColorInteraction}
          />
        </label>
      </div>
    </div>
  );
}

export function App() {
  const [files] = useState(() => fileWorkflowForWindow(window));
  const [project, setProject] = useState<Project>(openProject);
  const [width, setWidth] = useState(String(project.canvasWidth));
  const [height, setHeight] = useState(String(project.canvasHeight));
  const [customCanvasSizeOpen, setCustomCanvasSizeOpen] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string>();
  const [importError, setImportError] = useState<string>();
  const [projectFileError, setProjectFileError] = useState<string>();
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportQuality, setExportQuality] = useState(80);
  const [exportLossless, setExportLossless] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const [stitchScreens, setStitchScreens] = useState<StitchScreen[]>([]);
  const [stitchError, setStitchError] = useState<string>();
  const [activeMenu, setActiveMenu] = useState<ToolMenu>("Image");
  const [editingTextLayerId, setEditingTextLayerId] = useState<string>();
  const [selectTextOnEdit, setSelectTextOnEdit] = useState(false);
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const [editingTextPreview, setEditingTextPreview] = useState<{
    layerId: string;
    content: TextContent;
  }>();
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
  const presentationProject = editingTextPreview
    ? {
        ...project,
        layers: project.layers.map((layer) =>
          layer.kind === "text" && layer.id === editingTextPreview.layerId
            ? { ...layer, ...editingTextPreview.content }
            : layer,
        ),
      }
    : project;

  function beginControlEdit<Value>(
    update: (value: Value) => UndoableEditUpdate | undefined,
  ): ControlEdit<Value> {
    const edit = beginUndoableEdit(project);
    return {
      preview: (value) => {
        const next = update(value);
        if (next) setProject(edit.preview(next));
      },
      finish: () => setProject(edit.finish()),
      cancel: () => setProject(edit.cancel()),
    };
  }

  const textColorEdit = useControlEditLifetime<TextContent>(() => {
    const layerId = editingTextLayerId;
    return beginControlEdit((content) =>
      layerId
        ? { type: "edit-text-content", layerId, content }
        : undefined,
    );
  });

  function startTextEditing(layerId: string) {
    setEditingTextLayerId(layerId);
    setEditingTextPreview(undefined);
    setSelectTextOnEdit(true);
    setHasTextSelection(false);
  }

  function resetTextEditing() {
    setEditingTextLayerId(undefined);
    setEditingTextPreview(undefined);
    setSelectTextOnEdit(false);
    setHasTextSelection(false);
  }

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

  async function importImage() {
    try {
      const [file] = await files.importImages();
      if (!file) return;

      const format = supportedImageFormat(file.name, "");
      if (!format) {
        setImportError("Choose a JPG, PNG, WebP, GIF, or BMP image.");
        return;
      }
      const image = await readImage(file, format);
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

  async function openProjectFile() {
    try {
      const [file] = await files.openProjects();
      if (!file) return;
      const opened = openSavedProject(new TextDecoder().decode(file.bytes));
      setProject(opened);
      setWidth(String(opened.canvasWidth));
      setHeight(String(opened.canvasHeight));
      setCustomCanvasSizeOpen(
        !PRESETS.some(
          (preset) =>
            preset.width === opened.canvasWidth &&
            preset.height === opened.canvasHeight,
        ),
      );
      setSelectedLayerId(undefined);
      resetTextEditing();
      setPlacingText(false);
      setProjectFileError(undefined);
      setImportError(undefined);
    } catch (error) {
      setProjectFileError(
        error instanceof Error
          ? error.message
          : "The project file could not be opened.",
      );
    }
  }

  async function addStitchScreens() {
    try {
      const selected = await files.openProjects({ multiple: true });
      if (selected.length === 0) return;

      const opened: StitchScreen[] = [];
      let failure: string | undefined;
      for (const file of selected) {
        try {
          opened.push({
            id: crypto.randomUUID(),
            name: file.name,
            project: openSavedProject(new TextDecoder().decode(file.bytes)),
          });
        } catch (error) {
          failure =
            error instanceof Error
              ? error.message
              : "The project file could not be opened.";
        }
      }
      if (opened.length > 0) {
        setStitchScreens((current) => [...current, ...opened]);
      }
      setStitchError(failure);
    } catch (error) {
      setStitchError(
        error instanceof Error
          ? error.message
          : "The project files could not be opened.",
      );
    }
  }

  function moveStitchScreen(index: number, direction: -1 | 1) {
    setStitchScreens((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [screen] = next.splice(index, 1);
      if (!screen) return current;
      next.splice(target, 0, screen);
      return next;
    });
  }

  function currentExportOptions(): ExportOptions {
    return {
      format: exportFormat,
      quality: exportQuality,
      lossless: exportFormat === "webp" && exportLossless,
    };
  }

  async function saveCurrentExport() {
    const options = currentExportOptions();
    const exported = await exportFlattened(project, options);
    await files.saveExport({
      ...exported,
      filename: `screenshot.${EXPORT_EXTENSION[options.format]}`,
    });
  }

  async function saveStitchExport() {
    const options = currentExportOptions();
    const exported = await exportStitch(
      stitchScreens.map((screen) => screen.project),
      options,
    );
    await files.saveExport({
      ...exported,
      filename: `stitch.${EXPORT_EXTENSION[options.format]}`,
    });
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
    startTextEditing(id);
    setPlacingText(false);
    setActiveMenu("Text");
  }

  function resizeTextBox(
    event: PointerEvent<HTMLSpanElement>,
    layer: { id: string; x: number; wrapWidth: number },
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
    const gesture = beginUndoableEdit(project);
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
      setProject(
        gesture.preview({
          type: "resize-text",
          layerId: layer.id,
          x,
          wrapWidth: width,
        }),
      );
    }

    function onMove(move: globalThis.PointerEvent) {
      if (move.buttons === 0) return;
      preview(move.clientX);
    }

    function onUp(up: globalThis.PointerEvent) {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      if (up.type === "pointercancel") {
        setProject(gesture.cancel());
        return;
      }
      measure(up.clientX);
      setProject(
        gesture.finish({
          type: "resize-text",
          layerId: layer.id,
          x,
          wrapWidth: width,
        }),
      );
    }

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  function beginTextEditing(layerId: string) {
    setSelectedLayerId(layerId);
    startTextEditing(layerId);
    setActiveMenu("Text");
  }

  function finishTextEditing(layerId: string, content: TextContent) {
    commitTextContent(layerId, content);
    resetTextEditing();
  }

  function commitTextContent(layerId: string, content: TextContent) {
    setProject((current) =>
      beginUndoableEdit(current).finish({
        type: "edit-text-content",
        layerId,
        content,
      }),
    );
  }

  function beginTextColorInteraction() {
    textEditor.current?.preserveOnBlur();
    textColorEdit.pointerDown();
  }

  function finishTextColorInteraction() {
    textColorEdit.blur();
    textEditor.current?.focus();
  }

  function cancelTextEditing() {
    resetTextEditing();
  }

  function onViewportPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (placingText) return;
    const viewport = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = project.panX;
    const originY = project.panY;
    const gesture = beginUndoableEdit(project);
    viewport.setPointerCapture(event.pointerId);

    function onMove(move: globalThis.PointerEvent) {
      if (move.buttons === 0) return;
      setProject(
        gesture.preview({
          type: "pan-viewport",
          panX: originX + move.clientX - startX,
          panY: originY + move.clientY - startY,
        }),
      );
    }

    function onUp(up: globalThis.PointerEvent) {
      viewport.removeEventListener("pointermove", onMove);
      viewport.removeEventListener("pointerup", onUp);
      viewport.removeEventListener("pointercancel", onUp);
      if (up.type === "pointercancel") {
        setProject(gesture.cancel());
        return;
      }
      const panX = originX + up.clientX - startX;
      const panY = originY + up.clientY - startY;
      setProject(
        gesture.finish({
          type: "pan-viewport",
          panX,
          panY,
        }),
      );
    }

    viewport.addEventListener("pointermove", onMove);
    viewport.addEventListener("pointerup", onUp);
    viewport.addEventListener("pointercancel", onUp);
  }

  function onLayerPointerDown(
    event: PointerEvent<HTMLDivElement>,
    layer: {
      id: string;
      kind: "image" | "text";
      x: number;
      y: number;
    },
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
    const gesture = beginUndoableEdit(project);
    element.setPointerCapture(event.pointerId);

    function onMove(move: globalThis.PointerEvent) {
      if (move.buttons === 0) return;
      setProject(
        gesture.preview({
          type: "move-layer",
          layerId: layer.id,
          x: originX + (move.clientX - startX) / zoom,
          y: originY + (move.clientY - startY) / zoom,
        }),
      );
    }

    function onUp(up: globalThis.PointerEvent) {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
      if (up.type === "pointercancel") {
        setProject(gesture.cancel());
        return;
      }
      setProject(
        gesture.finish({
          type: "move-layer",
          layerId: layer.id,
          x: originX + (up.clientX - startX) / zoom,
          y: originY + (up.clientY - startY) / zoom,
        }),
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
              <button
                type="button"
                onClick={() => {
                  void files.saveProject(saveProject(project)).then(
                    () => setProjectFileError(undefined),
                    (error: unknown) =>
                      setProjectFileError(
                        error instanceof Error
                          ? error.message
                          : "The project file could not be saved.",
                      ),
                  );
                }}
              >
                Save project
              </button>
              <button
                type="button"
                onClick={() => void openProjectFile()}
              >
                Open project
              </button>
              <span className="tool-divider" />
              <button type="button" onClick={() => void importImage()}>
                Import image
              </button>
              <span className="tool-hint">
                Projects keep editable layers · Images: JPG, PNG, WebP, GIF, or BMP
              </span>
              <span className="tool-divider" />
              <label>
                Export
                <select
                  value={exportFormat}
                  onChange={(event) =>
                    setExportFormat(event.target.value as ExportFormat)
                  }
                >
                  <option value="png">PNG</option>
                  <option value="jpeg">JPG</option>
                  <option value="webp">WebP</option>
                </select>
              </label>
              {exportFormat === "webp" ? (
                <label className="check-option">
                  <input
                    type="checkbox"
                    checked={exportLossless}
                    onChange={(event) => setExportLossless(event.target.checked)}
                  />
                  Lossless
                </label>
              ) : null}
              {showsExportQuality(exportFormat, exportLossless) ? (
                <>
                  <label className="scale-control">
                    Quality
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={exportQuality}
                      onChange={(event) =>
                        setExportQuality(Number(event.target.value))
                      }
                    />
                  </label>
                  <output>{exportQuality}</output>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  void saveCurrentExport().then(
                    () => setExportError(undefined),
                    (error: unknown) =>
                      setExportError(
                        error instanceof Error
                          ? error.message
                          : "The image could not be exported.",
                      ),
                  );
                }}
              >
                Export
              </button>
              <span className="tool-hint">
                PNG stays sharp and can be transparent. JPG is opaque. Lower
                quality makes JPG and WebP smaller.
              </span>
            </div>
          ) : null}

          {activeMenu === "Stitch" ? (
            <div className="control-group stitch-panel">
              <button type="button" onClick={() => void addStitchScreens()}>
                Add screens
              </button>
              <ol className="stitch-list">
                {stitchScreens.map((screen, index) => (
                  <li key={screen.id}>
                    <span>{screen.name}</span>
                    <span>
                      {screen.project.canvasWidth}×{screen.project.canvasHeight}
                    </span>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveStitchScreen(index, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      disabled={index === stitchScreens.length - 1}
                      onClick={() => moveStitchScreen(index, 1)}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setStitchScreens((current) =>
                          current.filter((item) => item.id !== screen.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => {
                  void saveStitchExport().then(
                    () => setStitchError(undefined),
                    (error: unknown) =>
                      setStitchError(
                        error instanceof Error
                          ? error.message
                          : "The stitch could not be exported.",
                      ),
                  );
                }}
              >
                Export stitch
              </button>
              <span className="tool-hint">
                Add saved screens and order them from top to bottom. Export uses
                the format and quality selected under File.
              </span>
              {stitchError ? <p className="import-error">{stitchError}</p> : null}
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
                    className={
                      !customCanvasSizeOpen &&
                      project.canvasWidth === preset.width &&
                      project.canvasHeight === preset.height
                        ? "active-control"
                        : undefined
                    }
                    onClick={() => {
                      setCustomCanvasSizeOpen(false);
                      applySize(preset.width, preset.height);
                    }}
                  >
                    {preset.width}×{preset.height}
                  </button>
                ))}
                <button
                  type="button"
                  className={customCanvasSizeOpen ? "active-control" : undefined}
                  aria-pressed={customCanvasSizeOpen}
                  onClick={() => setCustomCanvasSizeOpen(true)}
                >
                  Custom
                </button>
                {customCanvasSizeOpen ? (
                  <>
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
                  </>
                ) : null}
              </form>

              {selectedImageLayer ? (
                <>
                  <div className="tool-divider" />
                  <ScaleControls
                    key={selectedImageLayer.id}
                    layer={selectedImageLayer}
                    beginEdit={() =>
                      beginControlEdit((scale) => ({
                        type: "scale-image",
                        layerId: selectedImageLayer.id,
                        scale,
                      }))
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
                      beginTextColorInteraction()
                    }
                    onFinishColorInteraction={finishTextColorInteraction}
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
          {projectFileError ? (
            <p className="import-error">{projectFileError}</p>
          ) : null}
          {exportError ? <p className="import-error">{exportError}</p> : null}
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
          {presentProject(presentationProject, measureDomText).map((layer) => {
            if (layer.kind === "image") {
              const styles = imageLayerStyles(layer);
              return (
                <div
                  className={`canvas-layer image-layer${selectedLayerId === layer.id ? " selected" : ""}`}
                  key={layer.id}
                  style={styles.frame}
                  title={layer.name}
                  onPointerDown={(event) =>
                    onLayerPointerDown(event, {
                      id: layer.id,
                      kind: layer.kind,
                      x: layer.frame.x,
                      y: layer.frame.y,
                    })
                  }
                >
                  <img
                    src={layer.source}
                    alt=""
                    draggable={false}
                    style={styles.content}
                  />
                </div>
              );
            }

            const styles = textLayerStyles(layer);
            const editingLayer =
              editingTextLayerId === layer.id &&
              selectedTextLayer?.id === layer.id
                ? selectedTextLayer
                : undefined;
            return (
              <div
                className={`canvas-layer text-layer${selectedLayerId === layer.id ? " selected" : ""}${editingTextLayerId === layer.id ? " editing" : ""}`}
                key={layer.id}
                style={{
                  ...styles.frame,
                  left: layer.frame.x - (editingLayer ? TEXT_EDIT_FRAME_WIDTH : 0),
                  top: layer.frame.y - (editingLayer ? TEXT_EDIT_FRAME_WIDTH : 0),
                  width:
                    layer.frame.width +
                    (editingLayer ? TEXT_EDIT_FRAME_WIDTH * 2 : 0),
                  minHeight:
                    layer.frame.height +
                    (editingLayer ? TEXT_EDIT_FRAME_WIDTH * 2 : 0),
                  padding: editingLayer ? TEXT_EDIT_FRAME_WIDTH : 0,
                }}
                title={layer.name}
                onPointerDown={(event) =>
                  onLayerPointerDown(event, {
                    id: layer.id,
                    kind: layer.kind,
                    x: layer.frame.x,
                    y: layer.frame.y,
                  })
                }
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
                        onPointerDown={(event) =>
                          resizeTextBox(
                            event,
                            {
                              id: layer.id,
                              x: layer.frame.x,
                              wrapWidth: layer.frame.width,
                            },
                            corner,
                          )
                        }
                      />
                    ))
                  : null}
                {editingLayer ? (
                  <InlineTextEditor
                    layer={editingLayer}
                    presentation={layer}
                    selectText={selectTextOnEdit}
                    editorHandle={textEditor}
                    onSelectionChange={setHasTextSelection}
                    onPreview={(content) =>
                      setEditingTextPreview({ layerId: layer.id, content })
                    }
                    onColorCommit={textColorEdit.preview}
                    onCommit={(content) => finishTextEditing(layer.id, content)}
                    onCancel={cancelTextEditing}
                  />
                ) : (
                  <PresentedText text={layer} />
                )}
              </div>
            );
          })}
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
            beginOpacityEdit: (layerId) =>
              beginControlEdit((opacity) => ({
                type: "set-layer-opacity",
                layerId,
                opacity,
              })),
          }}
        />
      ) : null}
    </div>
  );
}
