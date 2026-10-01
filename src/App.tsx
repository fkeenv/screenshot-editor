import type { AppearancePreference } from "./appearance";
import { EditorIcon } from "./EditorIcon";
import { Combobox, Input, InputBase, NativeSelect, useCombobox } from "@mantine/core";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type FocusEvent,
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
  addRectangleLayer,
  addTextLayer,
  beginUndoableEdit,
  cropImageLayer,
  deleteLayer,
  duplicateLayer,
  editRectangleLayer,
  editTextLayer,
  fitImageLayerToCanvas,
  moveLayer,
  nudgeLayer,
  openProject,
  openSavedProject,
  parseColoredText,
  renameLayer,
  redo,
  reorderLayer,
  scaleImageLayer,
  saveProject,
  setCanvasSize,
  setCanvasBackground,
  setLayerVisibility,
  setView,
  supportedImageFormat,
  TEXT_COLOR_PRESETS,
  undo,
  type ImageLayer,
  type CanvasBackground,
  type ImageResizeCorner,
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
import {
  LayersPanel,
  SelectedLayerControls,
  type LayerActions,
} from "./LayersPanel";
import { presentProject } from "./presentation";
import { PresentedText } from "./PresentedText";
import { ImageCrop } from "./ImageCrop";
import { ImageResizeHandles } from "./ImageResizeHandles";
import { ImagePositionControls } from "./ImagePositionControls";
import { RectangleControls } from "./RectangleControls";
import { snapToGrid } from "./grid";
import { snapLayerPosition, type SnapGuide } from "./snapping";
import {
  prepareImageImport,
  transferredImage,
  UNSUPPORTED_IMAGE_MESSAGE,
} from "./image-intake";

const PRESETS = [
  { width: 800, height: 600 },
  { width: 1150, height: 600 },
] as const;

const SCALE_PRESETS = [0.25, 0.5, 1, 2] as const;
const TEXT_EDIT_FRAME_WIDTH = 6;
const SAMPLE_CHAT = "* John Smith looks around.\nJohn Smith says: Hello there.\nJohn Smith whispers: Follow me.";
const TOOL_MENUS = ["Chat", "Properties", "Export", "Stitch"] as const;
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
      className="control-group flex flex-wrap gap-[8px] items-end crop-controls"
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
    <div className="control-group flex flex-wrap gap-[8px] items-end scale-control">
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
  onFinishColorInteraction: (restoreFocus?: boolean) => void;
}) {
  const [customColor, setCustomColor] = useState("#ffffff");
  const [colorPreset, setColorPreset] = useState("");
  const colorCombobox = useCombobox({
    onDropdownClose: () => colorCombobox.resetSelectedOption(),
    onDropdownOpen: () => {
      onBeginColorInteraction();
      colorCombobox.selectFirstOption();
    },
  });
  const selectedColor =
    colorPreset === "custom"
      ? { color: customColor, label: "Custom…" }
      : TEXT_COLOR_PRESETS[colorPreset as keyof typeof TEXT_COLOR_PRESETS];

  function finishColorBlur(event: FocusEvent) {
    if (
      event.relatedTarget instanceof HTMLElement &&
      event.relatedTarget.closest(
        "[data-text-color-control], .inline-text-editor",
      )
    ) {
      return;
    }
    onFinishColorInteraction(false);
  }

  function editNumber(
    property: "fontSize" | "outlineWidth" | "lineSpacing" | "wrapWidth",
    value: string,
    minimum: number,
  ) {
    const number = Number(value);
    if (Number.isFinite(number))
      onEdit({ [property]: Math.max(minimum, number) });
  }

  return (
    <div className="text-controls grid grid-cols-2 gap-[12px] items-end" role="toolbar" aria-label="Text formatting">
      <h3 className="property-section-title">Typography</h3>
      <NativeSelect
        className="text-font-field"
        label="Font"
        size="xs"
        data={FONT_FAMILIES}
        value={layer.fontFamily}
        onChange={(event) => onEdit({ fontFamily: event.target.value })}
      />
      <div className="selection-colors grid gap-[8px] pt-[12px] border-t-[1px] [border-top-style:solid] border-t-stroke" aria-label="Selection colors">
        <Combobox
          store={colorCombobox}
          size="xs"
          onOptionSubmit={(value) => {
            setColorPreset(value);
            colorCombobox.closeDropdown();
            if (value === "custom") {
              colorCombobox.focusTarget();
              return;
            }
            const preset =
              TEXT_COLOR_PRESETS[value as keyof typeof TEXT_COLOR_PRESETS];
            if (!preset) return;
            onBeginColorInteraction();
            onApplyColor(preset.color);
            onFinishColorInteraction();
          }}
        >
          <Combobox.Target targetType="button">
            <InputBase
              component="button"
              type="button"
              className="text-color-field"
              label="Text color"
              size="xs"
              pointer
              data-text-color-control
              disabled={!canColorSelection}
              rightSection={<Combobox.Chevron />}
              rightSectionPointerEvents="none"
              onPointerDown={onBeginColorInteraction}
              onKeyDown={onBeginColorInteraction}
              onClick={() => colorCombobox.toggleDropdown()}
              onBlur={(event) => {
                colorCombobox.closeDropdown();
                finishColorBlur(event);
              }}
            >
              {selectedColor ? (
                <span className="text-color-option inline-flex gap-[8px] items-center">
                  <span
                    className="text-color-swatch"
                    aria-hidden="true"
                    style={{ backgroundColor: selectedColor.color }}
                  />
                  {selectedColor.label}
                </span>
              ) : (
                <Input.Placeholder>Choose a color…</Input.Placeholder>
              )}
            </InputBase>
          </Combobox.Target>
          <Combobox.Dropdown
            className="text-color-dropdown"
            data-text-color-control
          >
            <Combobox.Options>
              {Object.entries(TEXT_COLOR_PRESETS).map(([value, preset]) => (
                <Combobox.Option
                  key={value}
                  value={value}
                  active={value === colorPreset}
                >
                  <span className="text-color-option inline-flex gap-[8px] items-center">
                    <span
                      className="text-color-swatch"
                      aria-hidden="true"
                      style={{ backgroundColor: preset.color }}
                    />
                    {preset.label}
                  </span>
                </Combobox.Option>
              ))}
              <Combobox.Option value="custom" active={colorPreset === "custom"}>
                <span className="text-color-option inline-flex gap-[8px] items-center">
                  <span
                    className="text-color-swatch"
                    aria-hidden="true"
                    style={{ backgroundColor: customColor }}
                  />
                  Custom…
                </span>
              </Combobox.Option>
            </Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>
        {colorPreset === "custom" ? (
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
              onBlur={finishColorBlur}
            />
          </label>
        ) : null}
        <p className="color-selection-hint m-0 text-muted text-[12px] leading-[1.4]">
          Select text on the canvas to change its color.
        </p>
      </div>
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
      <h3 className="property-section-title">Outline &amp; shadow</h3>
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
      <label className="check-option">
        <input
          type="checkbox"
          aria-label="Text shadow"
          checked={Boolean(layer.shadow)}
          onChange={(event) =>
            onEdit({
              shadow: event.target.checked
                ? { offsetX: 1, offsetY: 1, blur: 2, color: "#000000" }
                : undefined,
            })
          }
        />
        Shadow
      </label>
      {layer.shadow ? (
        <>
          {(["offsetX", "offsetY", "blur"] as const).map((property) => (
            <label key={property}>
              {property === "blur"
                ? "Shadow blur"
                : property === "offsetX"
                  ? "Shadow X"
                  : "Shadow Y"}
              <input
                type="number"
                min={property === "blur" ? 0 : undefined}
                step="1"
                value={layer.shadow![property]}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    onEdit({
                      shadow: {
                        ...layer.shadow!,
                        [property]:
                          property === "blur" ? Math.max(0, value) : value,
                      },
                    });
                  }
                }}
              />
            </label>
          ))}
          <label>
            Shadow color
            <input
              type="color"
              value={layer.shadow.color}
              onChange={(event) =>
                onEdit({
                  shadow: { ...layer.shadow!, color: event.target.value },
                })
              }
            />
          </label>
        </>
      ) : null}
      <h3 className="property-section-title">Text box</h3>
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
      <span className="toolbar-divider w-[1px] h-[20px] my-0 mx-[4px] bg-stroke" />

    </div>
  );
}

type AppProps = {
  appearance: AppearancePreference;
  onAppearanceChange: (value: AppearancePreference) => void;
};

export function App({ appearance, onAppearanceChange }: AppProps) {
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
  const [activeMenu, setActiveMenu] = useState<ToolMenu>("Chat");
  const [chatDraft, setChatDraft] = useState("");
  const [editingTextLayerId, setEditingTextLayerId] = useState<string>();
  const [selectTextOnEdit, setSelectTextOnEdit] = useState(false);
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const [editingTextPreview, setEditingTextPreview] = useState<{
    layerId: string;
    content: TextContent;
  }>();
  const [placingText, setPlacingText] = useState(false);
  const [gridVisible, setGridVisible] = useState(false);
  const [gridSnapping, setGridSnapping] = useState(false);
  const [gridSpacing, setGridSpacing] = useState(20);
  const [canvasSnapping, setCanvasSnapping] = useState(false);
  const [snapPadding, setSnapPadding] = useState(16);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [layersPanelOpen, setLayersPanelOpen] = useState(true);
  const [toolsPanelOpen, setToolsPanelOpen] = useState(true);
  const layerInteractions = useRef(new Map<string, Set<() => void>>());
  const [imageCrop, setImageCrop] = useState<{
    layer: ImageLayer;
    crop: ImageLayer["crop"];
    view: { zoom: number; panX: number; panY: number };
  }>();
  const view = imageCrop?.view ?? project;
  const textEditor = useRef<TextEditorHandle | null>(null);
  const chatDraftRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [imageDropActive, setImageDropActive] = useState(false);
  const toolPanelRef = useRef<HTMLElement>(null);
  const selectedLayer = project.layers.find(
    (layer) => layer.id === selectedLayerId,
  );
  const selectedImageLayer =
    selectedLayer?.kind === "image" ? selectedLayer : undefined;
  const selectedTextLayer =
    selectedLayer?.kind === "text" ? selectedLayer : undefined;
  const selectedRectangleLayer =
    selectedLayer?.kind === "rectangle" ? selectedLayer : undefined;
  const draftContent = parseColoredText(chatDraft);
  const hasDraftText = draftContent.text.trim().length > 0;
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

  function trackLayerInteraction(layerId: string, cancel: () => void) {
    const interactions = layerInteractions.current;
    const active = interactions.get(layerId) ?? new Set<() => void>();
    active.add(cancel);
    interactions.set(layerId, active);

    return () => {
      active.delete(cancel);
      if (active.size === 0) interactions.delete(layerId);
    };
  }

  function cancelLayerInteractions(layerId: string) {
    for (const cancel of [...(layerInteractions.current.get(layerId) ?? [])]) {
      cancel();
    }
  }

  function changeCanvasBackground(background: CanvasBackground) {
    for (const layerId of [...layerInteractions.current.keys()]) {
      cancelLayerInteractions(layerId);
    }
    setProject((current) => setCanvasBackground(current, background));
  }

  function deleteSelectedLayer(layerId = selectedLayerId) {
    if (!layerId) return;
    const layerIndex = project.layers.findIndex((layer) => layer.id === layerId);
    if (layerIndex < 0) return;
    const nextLayer = project.layers[layerIndex - 1] ?? project.layers[layerIndex + 1];
    cancelLayerInteractions(layerId);
    if (editingTextLayerId === layerId) {
      textColorEdit.pointerCancel();
      resetTextEditing();
    }
    setProject((current) => deleteLayer(current, layerId));
    setSelectedLayerId(nextLayer?.id);
  }

  function duplicateSelectedLayer() {
    if (!selectedLayer) return;
    cancelLayerInteractions(selectedLayer.id);
    const copyId = crypto.randomUUID();
    setProject((current) => duplicateLayer(current, selectedLayer.id, copyId));
    setSelectedLayerId(copyId);
  }

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

  function fitCanvas() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const zoom = Math.min(
      (viewport.clientWidth - 48) / project.canvasWidth,
      (viewport.clientHeight - 48) / project.canvasHeight,
    );
    if (zoom <= 0) return;
    setProject((current) => setView(current, zoom, 0, 0));
  }

  async function receiveImage(file: PickedFile | File) {
    try {
      const image = await prepareImageImport(file);
      for (const layerId of [...layerInteractions.current.keys()]) {
        cancelLayerInteractions(layerId);
      }
      const id = crypto.randomUUID();
      setProject((current) =>
        addImageLayer(current, {
          id,
          ...image,
        }),
      );
      setSelectedLayerId(id);
      setActiveMenu("Properties");
      setPlacingText(false);
      setWelcomeDismissed(true);
      setImportError(undefined);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "The image could not be imported.",
      );
    }
  }

  function insertRectangle() {
    for (const layerId of [...layerInteractions.current.keys()]) {
      cancelLayerInteractions(layerId);
    }
    textEditor.current?.commit();
    resetTextEditing();
    const id = crypto.randomUUID();
    setProject((current) => addRectangleLayer(current, id));
    setSelectedLayerId(id);
    setActiveMenu("Properties");
    setToolsPanelOpen(true);
    setPlacingText(false);
    setWelcomeDismissed(true);
  }

  async function importImage() {
    try {
      const [file] = await files.importImages();
      if (file) await receiveImage(file);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "The image could not be imported.",
      );
    }
  }

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (
        imageCrop ||
        (event.target instanceof Element &&
          event.target.closest("input, textarea, select, [contenteditable]"))
      ) return;
      const file = event.clipboardData && transferredImage(event.clipboardData);
      if (!file) return;
      event.preventDefault();
      void receiveImage(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [imageCrop]);

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
      setActiveMenu("Properties");
      setWelcomeDismissed(true);
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

  function cancelTextPlacement() {
    setPlacingText(false);
    chatDraftRef.current?.focus();
  }

  function startImageCrop() {
    if (!selectedImageLayer) return;
    resetTextEditing();
    setPlacingText(false);
    setImageCrop({
      layer: selectedImageLayer,
      crop: { ...selectedImageLayer.crop },
      view: { zoom: project.zoom, panX: project.panX, panY: project.panY },
    });
  }

  function zoomImageCrop(factor: number) {
    setImageCrop((current) => {
      if (!current) return current;
      const zoom = Math.min(16, Math.max(0.00001, current.view.zoom * factor));
      const ratio = zoom / current.view.zoom;
      return {
        ...current,
        view: {
          zoom,
          panX: current.view.panX * ratio,
          panY: current.view.panY * ratio,
        },
      };
    });
  }

  function fitImageCrop() {
    const viewport = viewportRef.current;
    if (!viewport || !imageCrop) return;
    const { layer } = imageCrop;
    const width = layer.crop.width * layer.scale;
    const height = layer.crop.height * layer.scale;
    const zoom = Math.min(
      (viewport.clientWidth - 96) / width,
      (viewport.clientHeight - 160) / height,
    );
    if (zoom <= 0) return;
    setImageCrop((current) => current ? {
      ...current,
      view: {
        zoom,
        panX: (project.canvasWidth / 2 - layer.x - width / 2) * zoom,
        panY: (project.canvasHeight / 2 - layer.y - height / 2) * zoom + 32,
      },
    } : current);
  }

  function applyImageCrop() {
    if (!imageCrop) return;
    setProject((current) => cropImageLayer(current, imageCrop.layer.id, imageCrop.crop));
    setImageCrop(undefined);
  }

  function placeTextBox(event: { clientX: number; clientY: number; shiftKey?: boolean }) {
    if (!hasDraftText) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const border = Number.parseFloat(getComputedStyle(canvas).borderLeftWidth) || 0;
    const x = (event.clientX - rect.left) / project.zoom - border;
    const y = (event.clientY - rect.top) / project.zoom - border;
    if (x < 0 || y < 0 || x > project.canvasWidth || y > project.canvasHeight) {
      return;
    }

    const id = crypto.randomUUID();
    const position = gridSnapping && !event.shiftKey
      ? { x: snapToGrid(x, gridSpacing), y: snapToGrid(y, gridSpacing) }
      : { x, y };
    setProject((current) => addTextLayer(current, id, position, draftContent));
    setSelectedLayerId(id);
    resetTextEditing();
    setChatDraft("");
    setPlacingText(false);
    setActiveMenu("Properties");
    setWelcomeDismissed(true);
  }

  function resizeImage(
    event: PointerEvent<HTMLButtonElement>,
    layerId: string,
    corner: ImageResizeCorner,
  ) {
    event.stopPropagation();
    event.preventDefault();
    if (event.button !== 0 || layerInteractions.current.get(layerId)?.size)
      return;
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const gesture = beginUndoableEdit(project);
    handle.setPointerCapture(pointerId);
    function update(move: globalThis.PointerEvent): UndoableEditUpdate {
      return {
        type: "resize-image",
        layerId,
        corner,
        screenDelta: { x: move.clientX - startX, y: move.clientY - startY },
      };
    }
    function onMove(move: globalThis.PointerEvent) {
      if (move.pointerId !== pointerId || move.buttons === 0) return;
      setProject(gesture.preview(update(move)));
    }
    function onUp(up: globalThis.PointerEvent) {
      if (up.pointerId !== pointerId) return;
      cleanup();
      setProject(
        up.type === "pointercancel"
          ? gesture.cancel()
          : gesture.finish(update(up)),
      );
    }
    function cancel() {
      cleanup();
      setProject(gesture.cancel());
    }
    function onKeyDown(key: KeyboardEvent) {
      if (key.key !== "Escape") return;
      key.preventDefault();
      cancel();
    }
    function cleanup() {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      handle.removeEventListener("lostpointercapture", cancel);
      window.removeEventListener("keydown", onKeyDown);
      unregister();
      if (handle.hasPointerCapture(pointerId))
        handle.releasePointerCapture(pointerId);
    }
    const unregister = trackLayerInteraction(layerId, cancel);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
    handle.addEventListener("lostpointercapture", cancel);
    window.addEventListener("keydown", onKeyDown);
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
      removeListeners();
      unregister();
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
    function removeListeners() {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
    }
    let unregister: () => void = () => {};
    unregister = trackLayerInteraction(layer.id, () => {
      removeListeners();
      unregister();
      setProject(gesture.cancel());
    });
  }

  function beginTextEditing(layerId: string) {
    setSelectedLayerId(layerId);
    startTextEditing(layerId);
    setActiveMenu("Properties");
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

  function finishTextColorInteraction(restoreFocus = true) {
    textColorEdit.blur();
    if (restoreFocus) textEditor.current?.focus();
    else textEditor.current?.commit();
  }

  function cancelTextEditing() {
    resetTextEditing();
  }

  function onViewportPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (placingText || event.button !== 0) return;
    if (!imageCrop && event.target instanceof Node &&
      !canvasRef.current?.contains(event.target)) {
      for (const layerId of [...layerInteractions.current.keys()]) {
        cancelLayerInteractions(layerId);
      }
      textEditor.current?.commit();
      resetTextEditing();
      setSelectedLayerId(undefined);
      setSnapGuides([]);
    }
    const viewport = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = view.panX;
    const originY = view.panY;
    viewport.setPointerCapture(event.pointerId);

    function updateCropPan(panX: number, panY: number) {
      setImageCrop((current) => current ? {
        ...current,
        view: { ...current.view, panX, panY },
      } : current);
    }

    function onMove(move: globalThis.PointerEvent) {
      if (move.buttons === 0 || move.pointerId !== event.pointerId) return;
      if (imageCrop) {
        updateCropPan(originX + move.clientX - startX, originY + move.clientY - startY);
        return;
      }
      setProject((current) =>
        beginUndoableEdit(current).preview({
          type: "pan-viewport",
          panX: originX + move.clientX - startX,
          panY: originY + move.clientY - startY,
        }),
      );
    }

    function onUp(up: globalThis.PointerEvent) {
      if (up.pointerId !== event.pointerId) return;
      removeListeners();
      if (imageCrop) {
        updateCropPan(
          up.type === "pointercancel" ? originX : originX + up.clientX - startX,
          up.type === "pointercancel" ? originY : originY + up.clientY - startY,
        );
        return;
      }
      if (up.type === "pointercancel") {
        setProject((current) => ({ ...current, panX: originX, panY: originY }));
        return;
      }
      const panX = originX + up.clientX - startX;
      const panY = originY + up.clientY - startY;
      setProject((current) =>
        beginUndoableEdit({ ...current, panX: originX, panY: originY }).finish({
          type: "pan-viewport",
          panX,
          panY,
        }),
      );
    }

    viewport.addEventListener("pointermove", onMove);
    viewport.addEventListener("pointerup", onUp);
    viewport.addEventListener("pointercancel", onUp);
    function removeListeners() {
      viewport.removeEventListener("pointermove", onMove);
      viewport.removeEventListener("pointerup", onUp);
      viewport.removeEventListener("pointercancel", onUp);
      if (viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }
    }
  }

  function onLayerPointerDown(
    event: PointerEvent<HTMLDivElement>,
    layer: {
      id: string;
      kind: "image" | "text" | "rectangle";
      x: number;
      y: number;
    },
  ) {
    event.stopPropagation();
    if (imageCrop) return;
    if (placingText) {
      placeTextBox(event);
      return;
    }
    if (layer.kind === "text" && editingTextLayerId === layer.id) {
      event.preventDefault();
    }
    setSelectedLayerId(layer.id);
    setActiveMenu("Properties");
    const element = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = layer.x;
    const originY = layer.y;
    const zoom = project.zoom;
    const gesture = beginUndoableEdit(project);
    element.setPointerCapture(event.pointerId);
    const frame = presentProject(presentationProject, measureDomText)
      .find((candidate) => candidate.id === layer.id)?.frame;

    function position(move: globalThis.PointerEvent) {
      const x = originX + (move.clientX - startX) / zoom;
      const y = originY + (move.clientY - startY) / zoom;
      if (!move.shiftKey && frame &&
        (move.clientX !== startX || move.clientY !== startY)) {
        return snapLayerPosition(
          { x, y },
          frame,
          { width: project.canvasWidth, height: project.canvasHeight },
          { canvas: canvasSnapping, grid: gridSnapping, spacing: gridSpacing, padding: snapPadding, zoom },
        );
      }
      return { x, y, guides: [] };
    }

    function onMove(move: globalThis.PointerEvent) {
      if (move.buttons === 0) return;
      const { x, y, guides } = position(move);
      setSnapGuides(guides);
      setProject(
        gesture.preview({
          type: "move-layer",
          layerId: layer.id,
          x,
          y,
        }),
      );
    }

    function onUp(up: globalThis.PointerEvent) {
      removeListeners();
      unregister();
      setSnapGuides([]);
      if (up.type === "pointercancel") {
        setProject(gesture.cancel());
        return;
      }
      const { x, y } = position(up);
      setProject(
        gesture.finish({
          type: "move-layer",
          layerId: layer.id,
          x,
          y,
        }),
      );
    }

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);
    function removeListeners() {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
    }
    let unregister: () => void = () => {};
    unregister = trackLayerInteraction(layer.id, () => {
      removeListeners();
      unregister();
      setSnapGuides([]);
      setProject(gesture.cancel());
    });
  }

  useEffect(() => {
    setWidth(String(project.canvasWidth));
    setHeight(String(project.canvasHeight));
  }, [project.canvasWidth, project.canvasHeight]);

  useEffect(() => {
    if (activeMenu === "Properties") toolPanelRef.current?.scrollTo(0, 0);
  }, [activeMenu, selectedLayerId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (imageCrop) {
        if (event.key === "Escape") {
          event.preventDefault();
          setImageCrop(undefined);
        }
        return;
      }
      if (event.key === "Escape" && placingText) {
        event.preventDefault();
        cancelTextPlacement();
        return;
      }
      if (
        event.target instanceof HTMLElement &&
        (event.target.matches(
          "input, textarea, select, button:not(.layer-select), [contenteditable='true']",
        ) ||
          event.target.closest("#tools-panel") ||
          (event.target.closest("#layers-panel") &&
            !event.target.matches(".layer-select")))
      ) {
        return;
      }

      if (
        selectedLayerId &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        deleteSelectedLayer();
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
  }, [selectedLayerId, placingText, imageCrop]);

  const layerActions: LayerActions = {
    select: (layerId) => {
      setSelectedLayerId(layerId);
      setActiveMenu("Properties");
    },
    reorder: (layerId, targetIndex) =>
      setProject((current) => reorderLayer(current, layerId, targetIndex)),
    rename: (layerId, name) =>
      setProject((current) => renameLayer(current, layerId, name)),
    setVisibility: (layerId, visible) =>
      setProject((current) => setLayerVisibility(current, layerId, visible)),
    beginOpacityEdit: (layerId) =>
      beginControlEdit((opacity) => ({
        type: "set-layer-opacity",
        layerId,
        opacity,
      })),
  };

  return (
    <div className="app grid grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)_28px] h-screen text-editor">
      <header className="editor-chrome col-span-full min-w-0 bg-chrome z-1" inert={imageCrop ? true : undefined}>
        <div className="menu-row flex min-h-[56px] items-center px-[18px] gap-[14px] border-b-[1px] [border-bottom-style:solid] border-b-stroke">
          <span className="app-title flex items-center gap-[10px] pr-[12px] text-editor-strong text-[13px] font-bold whitespace-nowrap">
            <span className="brand-mark"><EditorIcon name="layers" /></span>
            <span>Screenshot editor<small className="brand-caption">Local workbench</small></span>
          </span>
          <div className="project-actions">
            <button type="button" aria-label="Open project" onClick={() => void openProjectFile()}>
              Open
            </button>
            <button
              type="button"
              aria-label="Save project"
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
              Save
            </button>
          </div>
          <label className="appearance-control ml-auto flex flex-none items-center gap-[6px] text-muted text-[12px]">
            <span>Appearance</span>
            <select
              aria-label="Appearance"
              value={appearance}
              onChange={(event) =>
                onAppearanceChange(event.target.value as AppearancePreference)
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <button
            type="button"
            className="primary-export"
            onClick={() => {
              void saveCurrentExport().then(
                () => setExportError(undefined),
                (error: unknown) => setExportError(
                  error instanceof Error ? error.message : "The image could not be exported.",
                ),
              );
            }}
          >
            <EditorIcon name="export" /> Export {exportFormat.toUpperCase()}
          </button>
        </div>
        <div className="main-toolbar flex flex-wrap items-center gap-y-[6px] gap-x-[12px] py-[7px] px-[12px] border-b-[1px] [border-bottom-style:solid] border-b-stroke bg-panel">
          <div className="toolbar-group">
            <button
              type="button"
              disabled={!selectedLayer}
              onClick={duplicateSelectedLayer}
            >
              <EditorIcon name="duplicate" /> Duplicate layer
            </button>
            <button
              type="button"
              disabled={!selectedLayer}
              onClick={() => deleteSelectedLayer()}
            >
              <EditorIcon name="delete" /> Delete layer
            </button>
          </div>
          <div className="toolbar-group">
            <button type="button" onClick={() => setProject(undo)} disabled={project.past.length === 0}>
              <EditorIcon name="undo" /> Undo
            </button>
            <button type="button" onClick={() => setProject(redo)} disabled={project.future.length === 0}>
              <EditorIcon name="redo" /> Redo
            </button>
          </div>
          <div className="toolbar-group zoom-group gap-0">
            <button type="button" aria-label="Zoom out" onClick={() => changeZoom(project.zoom / 1.25)}>−</button>
            <span className="zoom-value">{Math.round(project.zoom * 100)}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => changeZoom(project.zoom * 1.25)}>+</button>
            <button type="button" className="fit-button" aria-label="Fit canvas to stage" onClick={fitCanvas}>Fit</button>
          </div>
          <div className="toolbar-group toolbar-end ml-auto">
            <button type="button" aria-label="Show grid" aria-pressed={gridVisible}
              onClick={() => setGridVisible((visible) => !visible)}>Grid</button>
            <button type="button" aria-label="Snap to grid" aria-pressed={gridSnapping}
              title="Snap layer drags and text placement. Hold Shift to bypass."
              onClick={() => setGridSnapping((snapping) => !snapping)}>Snap</button>
            <button type="button" aria-label="Snap to canvas" aria-pressed={canvasSnapping}
              title="Snap to canvas center, edges, and padding. Hold Shift to bypass."
              onClick={() => setCanvasSnapping((snapping) => !snapping)}>Guides</button>
            <button
              type="button"
              onClick={() => {
                setActiveMenu("Stitch");
                setPlacingText(false);
                setToolsPanelOpen(true);
              }}
            >
              Stitch
            </button>
            <button
              type="button"
              aria-controls="tools-panel"
              aria-expanded={toolsPanelOpen}
              onClick={() => setToolsPanelOpen((open) => !open)}
            >
              {toolsPanelOpen ? "Hide inspector" : "Inspector"}
            </button>
            <button
              type="button"
              aria-controls="layers-panel"
              aria-expanded={layersPanelOpen}
              onClick={() => setLayersPanelOpen((open) => !open)}
            >
              {layersPanelOpen ? "Hide layers" : "Layers"}
            </button>
          </div>
        </div>
        {importError || projectFileError || exportError ? (
          <div className="workspace-errors py-[5px] px-[12px] text-error text-[12px] border-b-[1px] [border-bottom-style:solid] border-b-stroke" role="alert">
            {[importError, projectFileError, exportError].filter(Boolean).join(" · ")}
          </div>
        ) : null}
      </header>

      <nav className="tool-rail col-start-1 row-start-2 flex w-[52px] flex-col items-center gap-[8px] py-[14px] bg-chrome" aria-label="Editor tools" inert={imageCrop ? true : undefined}>
        <button type="button" title="Select" aria-label="Select" aria-pressed={!placingText} onClick={() => setPlacingText(false)}><EditorIcon name="select" /></button>
        <button type="button" title="Crop image" aria-label="Crop image" disabled={!selectedImageLayer} onClick={startImageCrop}><EditorIcon name="crop" /></button>
        <button type="button" title="Add text" aria-label="Add text" aria-pressed={placingText} onClick={() => {
          setActiveMenu("Chat");
          setToolsPanelOpen(true);
          setPlacingText(false);
          requestAnimationFrame(() => chatDraftRef.current?.focus());
        }}><EditorIcon name="text" /></button>
        <button
          type="button"
          title="Add rectangle"
          aria-label="Add rectangle"
          onClick={insertRectangle}
        >
          <EditorIcon name="rectangle" />
        </button>
        <button type="button" title="Import image" aria-label="Import image" onClick={() => void importImage()}><EditorIcon name="image" /></button>
      </nav>

      {toolsPanelOpen || layersPanelOpen ? (
        <div className={`editor-dock col-start-3 row-start-2 grid min-h-0 w-[var(--dock-width)] bg-panel ${toolsPanelOpen && layersPanelOpen ? "grid-rows-[minmax(0,1fr)_minmax(180px,30%)]" : "grid-rows-1"}`}>
      {toolsPanelOpen ? (
        <aside className="tool-panel min-h-0 min-w-0 overflow-auto bg-panel" id="tools-panel" ref={toolPanelRef} aria-label="Inspector" inert={imageCrop ? true : undefined}>
          <nav className="menu-tabs sticky top-0 z-1 grid grid-cols-4 border-b-[1px] [border-bottom-style:solid] border-b-stroke bg-chrome" role="tablist" aria-label="Inspector views">
            {TOOL_MENUS.map((menu) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeMenu === menu}
                aria-controls="active-tool-panel"
                className={activeMenu === menu ? "active" : ""}
                key={menu}
                onClick={() => {
                  setActiveMenu(menu);
                  if (menu !== "Chat") setPlacingText(false);
                }}
              >
                {menu}
              </button>
            ))}
          </nav>
          <div id="active-tool-panel" role="tabpanel" aria-label={`${activeMenu} tools`}>
          {activeMenu === "Chat" ? (
            <div className="chat-draft grid gap-[12px]">
              <span className="panel-heading w-full text-editor-strong text-[13px] font-bold">Draft chat</span>
              <p>Type or paste chat lines, then place them on the canvas.</p>
              <label>
                Chat text
                <textarea
                  ref={chatDraftRef}
                  aria-label="Chat draft"
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  placeholder="John Smith says: Hello."
                  rows={7}
                />
              </label>
              <button type="button" onClick={() => setChatDraft(SAMPLE_CHAT)}>
                Try a sample
              </button>
              <button
                type="button"
                className="chat-place-action"
                disabled={!hasDraftText || placingText}
                onClick={() => {
                  setPlacingText(true);
                  setWelcomeDismissed(true);
                }}
              >
                Place on canvas
              </button>
              {placingText ? (
                <>
                  <p>Click the canvas to place this text, or cancel to keep the draft.</p>
                  <button
                    type="button"
                    onClick={cancelTextPlacement}
                  >
                    Cancel placement
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
          {activeMenu === "Export" ? (
            <div className="control-group flex flex-wrap gap-[8px] items-end">
              <span className="panel-heading w-full text-editor-strong text-[13px] font-bold">Export settings</span>
              <p className="tool-hint">
                PNG and WebP keep transparent backgrounds. JPG uses the chosen
                solid background, or #111827 for transparent projects. Stitch
                uses each saved project's background.
              </p>
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
              <span className="tool-hint inline-flex min-h-[34px] items-center self-end text-muted text-[12px]">
                PNG stays sharp and can be transparent. JPG is opaque. Lower
                quality makes JPG and WebP smaller.
              </span>
            </div>
          ) : null}

          {activeMenu === "Stitch" ? (
            <div className="control-group flex flex-wrap gap-[8px] items-end stitch-panel w-full">
              <button type="button" onClick={() => void addStitchScreens()}>
                Add screens
              </button>
              <ol className="stitch-list grid gap-[6px] w-full m-0 p-0 list-none">
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
              <span className="tool-hint inline-flex min-h-[34px] items-center self-end text-muted text-[12px]">
                Add saved screens and order them from top to bottom. Export uses
                the format and quality selected under Export.
              </span>
              {stitchError ? <p className="import-error">{stitchError}</p> : null}
            </div>
          ) : null}

          {activeMenu === "Properties" ? (
            <>
              <details className="canvas-settings group" open={!selectedLayer}>
                <summary aria-label="Canvas settings" className="flex cursor-pointer items-center gap-[8px] py-[4px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                  <span className="inline-block group-open:rotate-90" aria-hidden="true">›</span>
                  Canvas
                  <span className="ml-auto tracking-normal">{project.canvasWidth} × {project.canvasHeight}</span>
                </summary>
              <form className="control-group flex flex-wrap gap-[8px] items-end" onSubmit={applyTypedSize}>
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
              </details>

              <div className="control-group flex flex-wrap gap-[8px] items-end">
                <label>
                  Canvas background
                  <select
                    aria-label="Canvas background"
                    value={project.canvasBackground.kind}
                    onChange={(event) =>
                      changeCanvasBackground(
                        event.target.value === "solid"
                          ? { kind: "solid", color: "#ffffff" }
                          : { kind: "transparent" },
                      )
                    }
                  >
                    <option value="transparent">Transparent</option>
                    <option value="solid">Solid color</option>
                  </select>
                </label>
                <label>
                  Background color
                  <input
                    aria-label="Canvas background color"
                    type="color"
                    disabled={project.canvasBackground.kind === "transparent"}
                    value={project.canvasBackground.kind === "solid"
                      ? project.canvasBackground.color : "#ffffff"}
                    onChange={(event) => changeCanvasBackground({
                      kind: "solid", color: event.target.value,
                    })}
                  />
                </label>
              </div>

              <div className="control-group flex flex-wrap gap-[8px] items-end">
                <label>
                  Grid spacing (px)
                  <input
                    key={gridSpacing}
                    type="number"
                    min="1"
                    max="512"
                    step="1"
                    aria-label="Grid spacing"
                    defaultValue={gridSpacing}
                    onBlur={(event) => {
                      const spacing = Number(event.currentTarget.value);
                      if (Number.isInteger(spacing) && spacing >= 1 && spacing <= 512) {
                        setGridSpacing(spacing);
                      } else event.currentTarget.value = String(gridSpacing);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        event.currentTarget.value = String(gridSpacing);
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </label>
                <label>
                  Snap padding (px)
                  <input
                    key={snapPadding}
                    type="number"
                    min="0"
                    max="512"
                    step="1"
                    aria-label="Snap padding"
                    defaultValue={snapPadding}
                    onBlur={(event) => {
                      const padding = Number(event.currentTarget.value);
                      if (event.currentTarget.value.trim() && Number.isInteger(padding) && padding >= 0 && padding <= 512) {
                        setSnapPadding(padding);
                      } else event.currentTarget.value = String(snapPadding);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        event.currentTarget.value = String(snapPadding);
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </label>
                <p className="tool-hint">Grid and guides are editing aids, not part of your export. Guides snap to canvas center, edges, and padding. Hold Shift while dragging to bypass snapping.</p>
              </div>

              {selectedLayer ? (
                <>
                  <div className="tool-divider w-full h-[1px] my-[8px] mx-0 bg-stroke" />
                  <span className="panel-heading w-full text-editor-strong text-[13px] font-bold">
                    {selectedLayer.kind === "image" ? "Image" : selectedLayer.kind === "rectangle" ? "Rectangle" : "Text"} properties
                  </span>
                  <SelectedLayerControls
                    key={selectedLayer.id}
                    layer={selectedLayer}
                    index={project.layers.findIndex((layer) => layer.id === selectedLayer.id)}
                    layerCount={project.layers.length}
                    actions={layerActions}
                  />
                </>
              ) : (
                <p className="tool-hint inline-flex min-h-[34px] items-center self-end text-muted text-[12px]">
                  {placingText
                    ? "Click the canvas to place the text box."
                    : "Select an image or text layer to edit its properties."}
                </p>
              )}

              {selectedImageLayer ? (
                <>
                  <div className="tool-divider w-full h-[1px] my-[8px] mx-0 bg-stroke" />
                  <ImagePositionControls
                      key={`position-${selectedImageLayer.id}`}
                      layer={selectedImageLayer}
                      onPosition={(axis, value) => {
                        setProject((current) => {
                          const layer = current.layers.find(
                            (candidate) =>
                              candidate.id === selectedImageLayer.id,
                          );
                          if (!layer) return current;
                          return moveLayer(
                            current,
                            layer.id,
                            axis === "x" ? value : layer.x,
                            axis === "y" ? value : layer.y,
                          );
                        });
                      }}
                    />
                    <div className="tool-divider w-full h-[1px] my-[8px] mx-0 bg-stroke" />
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
                  <div className="tool-divider w-full h-[1px] my-[8px] mx-0 bg-stroke" />
                  <CropControls
                    layer={selectedImageLayer}
                    onCrop={(crop) =>
                      setProject((current) =>
                        cropImageLayer(current, selectedImageLayer.id, crop),
                      )
                    }
                  />
                </>
              ) : null}

              {selectedRectangleLayer ? (
                <RectangleControls
                  key={selectedRectangleLayer.id}
                  layer={selectedRectangleLayer}
                  onEdit={(changes) =>
                    setProject((current) =>
                      editRectangleLayer(current, selectedRectangleLayer.id, changes),
                    )
                  }
                />
              ) : null}

              {selectedTextLayer ? (
                <>
                  <div className="tool-divider w-full h-[1px] my-[8px] mx-0 bg-stroke" />
                <div className="composer w-full min-w-0">
                  <TextControls
                    key={selectedTextLayer.id}
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
                </>
              ) : null}
            </>
          ) : null}

          </div>
        </aside>
      ) : null}
      {layersPanelOpen ? (
        <LayersPanel
          layers={project.layers}
          selectedLayerId={selectedLayerId}
          actions={layerActions}
          inert={imageCrop ? true : undefined}
        />
      ) : null}
        </div>
      ) : null}

      <div
        className={`viewport relative col-start-2 row-start-2 flex-1 min-w-0 min-h-0 overflow-hidden cursor-grab bg-app touch-none${placingText ? " placing-text" : ""}`}
        ref={viewportRef}
        onPointerDown={onViewportPointerDown}
        onDragOver={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          event.preventDefault();
          const file = transferredImage(event.dataTransfer);
          const item = Array.from(event.dataTransfer.items).find(
            (candidate) => candidate.kind === "file" &&
              (!candidate.type || candidate.type.startsWith("image/")),
          );
          const valid = !imageCrop && (
            file
              ? Boolean(supportedImageFormat(file.name, file.type))
              : Boolean(item && (!item.type || supportedImageFormat("", item.type)))
          );
          event.dataTransfer.dropEffect = imageCrop ? "none" : "copy";
          setImageDropActive(valid);
        }}
        onDragLeave={(event) => {
          if (
            !(event.relatedTarget instanceof Node) ||
            !event.currentTarget.contains(event.relatedTarget)
          ) setImageDropActive(false);
        }}
        onDrop={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          event.preventDefault();
          setImageDropActive(false);
          if (imageCrop) return;
          const file = transferredImage(event.dataTransfer);
          if (file) void receiveImage(file);
          else setImportError(UNSUPPORTED_IMAGE_MESSAGE);
        }}
      >
        {imageDropActive ? (
          <div className="image-drop-target absolute inset-[16px] z-20 flex flex-col items-center justify-center gap-[8px] border-[2px] border-dashed border-accent rounded-[12px] bg-panel text-editor text-[24px] pointer-events-none" role="status">
            Drop screenshot here
            <span>Only the first image is imported.</span>
          </div>
        ) : null}
        {imageCrop ? (
          <div className="image-crop-toolbar" role="toolbar" aria-label="Crop actions" onPointerDown={(event) => event.stopPropagation()}>
            <div>
              <strong>Crop image</strong>
              <span role="status">{imageCrop.crop.width} × {imageCrop.crop.height} px</span>
            </div>
            <span className="inline-flex items-center gap-[6px]">
              <button type="button" aria-label="Zoom out crop" onClick={() => zoomImageCrop(1 / 1.25)}>−</button>
              <output className="min-w-[40px] text-center text-[12px]">{Math.round(view.zoom * 100)}%</output>
              <button type="button" aria-label="Zoom in crop" onClick={() => zoomImageCrop(1.25)}>+</button>
              <button type="button" aria-label="Fit image for crop" onClick={fitImageCrop}>Fit image</button>
            </span>
            <button type="button" onClick={() => setImageCrop(undefined)}>Cancel</button>
            <button type="button" className="primary-action" autoFocus onClick={applyImageCrop}>Apply</button>
          </div>
        ) : null}
        {!welcomeDismissed && project.layers.length === 0 ? (
          <section
            className="welcome-screen"
            aria-label="Start a project"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="welcome-card">
              <span className="welcome-eyebrow text-muted text-[11px] font-bold tracking-[0.12em] uppercase">New canvas</span>
              <h1>Start here</h1>
              <p>Choose a screenshot, paste an image, or drop one here. Only the first image is imported. You can also open a saved project or start blank.</p>
              <div className="welcome-actions grid gap-[8px] mt-[22px]">
                <button type="button" className="welcome-primary" onClick={() => void importImage()}>
                  Choose screenshot
                </button>
                <button type="button" onClick={() => void openProjectFile()}>
                  Open project
                </button>
                <button type="button" onClick={() => setWelcomeDismissed(true)}>
                  Start blank
                </button>
              </div>
            </div>
          </section>
        ) : null}
        <div
          className="canvas-anchor"
          style={{
            width: project.canvasWidth * view.zoom,
            height: project.canvasHeight * view.zoom,
          }}
        >
        <div
          className={`canvas${imageCrop ? " cropping-image" : ""}`}
          ref={canvasRef}
          onPointerDown={(event) => {
            if (!placingText) return;
            event.stopPropagation();
            placeTextBox(event);
          }}
          style={{
            width: project.canvasWidth,
            height: project.canvasHeight,
            transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
          }}
        >
          <div
            className="canvas-content absolute inset-0 overflow-hidden"
            style={{ backgroundColor: project.canvasBackground.kind === "solid"
              ? project.canvasBackground.color : undefined }}
          >
            {presentProject(presentationProject, measureDomText).map((layer) => {
              if (layer.kind === "image") {
                const styles = imageLayerStyles(layer);
                return (
                  <div
                    className={`canvas-layer absolute cursor-move touch-none image-layer overflow-hidden${selectedLayerId === layer.id ? " selected" : ""}`}
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

              if (layer.kind === "rectangle") {
                return (
                  <div
                    key={layer.id}
                    title={layer.name}
                    className={`canvas-layer absolute cursor-move touch-none rectangle-layer${selectedLayerId === layer.id ? " selected" : ""}`}
                    style={{
                      left: layer.frame.x,
                      top: layer.frame.y,
                      width: layer.frame.width,
                      height: layer.frame.height,
                      backgroundColor: layer.fill,
                      opacity: layer.opacity,
                    }}
                    onPointerDown={(event) =>
                      onLayerPointerDown(event, {
                        id: layer.id,
                        kind: layer.kind,
                        x: layer.frame.x,
                        y: layer.frame.y,
                      })
                    }
                  />
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
                  className={`canvas-layer absolute cursor-move touch-none text-layer${selectedLayerId === layer.id ? " selected" : ""}${editingTextLayerId === layer.id ? " editing" : ""}`}
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
                          className={`text-resize-handle absolute z-2 w-[10px] h-[10px] bg-white border-[1px] border-solid border-accent rounded-[1px] ${corner}`}
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
          </div>
          {gridVisible && !imageCrop ? (
            <div
              className="canvas-grid absolute inset-0 z-1 pointer-events-none"
              aria-hidden="true"
              style={{ backgroundSize: `${gridSpacing}px ${gridSpacing}px` }}
            />
          ) : null}
          {selectedImageLayer?.visible && !imageCrop && !placingText ? (
              <ImageResizeHandles
                layer={selectedImageLayer}
                zoom={project.zoom}
                onStart={(event, corner) =>
                  resizeImage(event, selectedImageLayer.id, corner)
                }
              />
            ) : null}
          {!imageCrop && snapGuides.map((guide) => (
            <div
              key={guide.axis}
              className={`snap-guide ${guide.axis === "x" ? "vertical" : "horizontal"}`}
              aria-hidden="true"
              style={guide.axis === "x"
                ? { left: guide.position, top: 0, height: project.canvasHeight, borderLeftWidth: 1 / project.zoom }
                : { left: 0, top: guide.position, width: project.canvasWidth, borderTopWidth: 1 / project.zoom }}
            >
              <span style={{ transform: `scale(${1 / project.zoom})` }}>{guide.label}</span>
            </div>
          ))}
            {imageCrop ? (
            <ImageCrop
              layer={imageCrop.layer}
              crop={imageCrop.crop}
              zoom={view.zoom}
              onChange={(crop) => setImageCrop((current) => current ? { ...current, crop } : current)}
            />
          ) : null}
          <span className="canvas-size">
            {project.canvasWidth}×{project.canvasHeight}
          </span>
        </div>
        </div>
      </div>
      <footer className="editor-status col-span-full flex items-center justify-between px-[16px] font-mono text-[10px] text-muted bg-chrome">
        <span><span className="local-indicator" aria-hidden="true" /> Local project · Nothing uploaded</span>
        <span>{project.layers.length} {project.layers.length === 1 ? "layer" : "layers"}　/　{project.canvasWidth} × {project.canvasHeight}　/　{Math.round(project.zoom * 100)}%</span>
      </footer>
    </div>
  );
}
