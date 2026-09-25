const IMAGE_FORMAT_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
} as const;

export type ImageFormat =
  (typeof IMAGE_FORMAT_BY_EXTENSION)[keyof typeof IMAGE_FORMAT_BY_EXTENSION];

const IMAGE_FORMATS = new Set<string>(Object.values(IMAGE_FORMAT_BY_EXTENSION));

export const SUPPORTED_IMAGE_ACCEPT = [
  ...Object.keys(IMAGE_FORMAT_BY_EXTENSION).map((extension) => `.${extension}`),
  ...IMAGE_FORMATS,
].join(",");

export type ImageLayer = {
  id: string;
  kind: "image";
  name: string;
  source: string;
  format: ImageFormat;
  naturalWidth: number;
  naturalHeight: number;
  x: number;
  y: number;
  scale: number;
  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type TextColorRun = {
  start: number;
  end: number;
  color: string;
};

export type TextContent = {
  text: string;
  colorRuns: TextColorRun[];
};

export const TEXT_COLOR_PRESETS = {
  me: { label: "/me", color: "#c2a3da" },
  do: { label: "/do", color: "#800000" },
  say: { label: "Say", color: "#ffffff" },
  low: { label: "Low", color: "#d0d0d0" },
  whisper: { label: "Whisper", color: "#ffff00" },
  phone: { label: "Phone", color: "#ffff99" },
  itemMoney: { label: "Item / money", color: "#33aa33" },
} as const;

function inferredLineColor(line: string): string | undefined {
  const characterName = "[\\p{L}][\\p{L}'-]*(?: |_)[\\p{L}][\\p{L}'-]*";
  const rules: [RegExp, string][] = [
    [new RegExp(`^\\* .+ \\(\\(${characterName}\\)\\)$`, "u"), TEXT_COLOR_PRESETS.do.color],
    [/^\[(?:item|money)\]/i, TEXT_COLOR_PRESETS.itemMoney.color],
    [
      new RegExp(`^(?:\\[phone\\] )?${characterName} (?:says on the phone\\b|says \\(phone\\))`, "iu"),
      TEXT_COLOR_PRESETS.phone.color,
    ],
    [/^\[phone\]/i, TEXT_COLOR_PRESETS.phone.color],
    [
      new RegExp(`^${characterName} (?:says quietly|murmurs)\\b`, "u"),
      TEXT_COLOR_PRESETS.low.color,
    ],
    [new RegExp(`^${characterName} whispers\\b`, "u"), TEXT_COLOR_PRESETS.whisper.color],
    [new RegExp(`^${characterName} says\\b`, "u"), TEXT_COLOR_PRESETS.say.color],
    [new RegExp(`^(?:\\* )?${characterName} `, "u"), TEXT_COLOR_PRESETS.me.color],
  ];
  return rules.find(([pattern]) => pattern.test(line))?.[1];
}

function mergeColorRuns(runs: TextColorRun[]): TextColorRun[] {
  const merged: TextColorRun[] = [];
  for (const run of [...runs].sort((left, right) => left.start - right.start)) {
    if (run.end <= run.start) continue;
    const previous = merged.at(-1);
    if (previous && previous.end === run.start && previous.color === run.color) {
      previous.end = run.end;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

function normalizeTextRange(
  textLength: number,
  selectionStart: number,
  selectionEnd: number,
): [start: number, end: number] {
  return [
    clamp(Math.min(selectionStart, selectionEnd), 0, textLength),
    clamp(Math.max(selectionStart, selectionEnd), 0, textLength),
  ];
}

export function colorTextRange(
  content: TextContent,
  selectionStart: number,
  selectionEnd: number,
  color: string,
): TextContent {
  const [start, end] = normalizeTextRange(
    content.text.length,
    selectionStart,
    selectionEnd,
  );
  if (start === end) return content;

  const colorRuns = content.colorRuns.flatMap((run) => {
    if (run.end <= start || run.start >= end) return [run];
    const remaining: TextColorRun[] = [];
    if (run.start < start) remaining.push({ ...run, end: start });
    if (run.end > end) remaining.push({ ...run, start: end });
    return remaining;
  });
  colorRuns.push({ start, end, color: color.toLowerCase() });

  return { ...content, colorRuns: mergeColorRuns(colorRuns) };
}

export function replaceTextRange(
  content: TextContent,
  selectionStart: number,
  selectionEnd: number,
  rawText: string,
): TextContent {
  const [start, end] = normalizeTextRange(
    content.text.length,
    selectionStart,
    selectionEnd,
  );
  const replacement = parseColoredText(rawText);
  const replacementEnd = start + replacement.text.length;
  const offset = replacement.text.length - (end - start);
  const colorRuns = content.colorRuns.flatMap((run) => {
    if (run.end <= start) return [run];
    if (run.start >= end) {
      return [{ ...run, start: run.start + offset, end: run.end + offset }];
    }

    const remaining: TextColorRun[] = [];
    if (run.start < start) remaining.push({ ...run, end: start });
    if (run.end > end) {
      remaining.push({
        ...run,
        start: replacementEnd,
        end: run.end + offset,
      });
    }
    return remaining;
  });

  if (replacement.colorRuns.length > 0) {
    colorRuns.push(
      ...replacement.colorRuns.map((run) => ({
        ...run,
        start: run.start + start,
        end: run.end + start,
      })),
    );
  } else if (replacement.text.length > 0) {
    const inherited = content.colorRuns.find(
      (run) => run.start <= start && run.end >= start,
    );
    if (inherited) {
      colorRuns.push({
        start,
        end: replacementEnd,
        color: inherited.color,
      });
    }
  }

  return {
    text:
      content.text.slice(0, start) +
      replacement.text +
      content.text.slice(end),
    colorRuns: mergeColorRuns(colorRuns),
  };
}

export type TextLayer = {
  id: string;
  kind: "text";
  name: string;
  text: string;
  colorRuns: TextColorRun[];
  x: number;
  y: number;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  outlineWidth: number;
  outlineColor: string;
  lineSpacing: number;
  wrapWidth: number;
};

export type Layer = ImageLayer | TextLayer;

export type TextLayerEdit = Partial<
  Pick<
    TextLayer,
    | "text"
    | "colorRuns"
    | "fontFamily"
    | "fontSize"
    | "bold"
    | "outlineWidth"
    | "outlineColor"
    | "lineSpacing"
    | "wrapWidth"
  >
>;

type Snapshot = {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  layers: Layer[];
};

export type Project = Snapshot & {
  past: Snapshot[];
  future: Snapshot[];
};

export function parseColoredText(rawText: string): TextContent {
  const colorCode = /\{([0-9a-f]{6})\}/gi;
  const colorRuns: TextColorRun[] = [];
  let text = "";
  let sourceIndex = 0;
  let activeColor: string | undefined;

  for (const match of rawText.matchAll(colorCode)) {
    const segment = rawText.slice(sourceIndex, match.index);
    const start = text.length;
    text += segment;
    if (activeColor && segment.length > 0) {
      colorRuns.push({ start, end: text.length, color: activeColor });
    }
    activeColor = `#${match[1].toLowerCase()}`;
    sourceIndex = match.index + match[0].length;
  }

  const tail = rawText.slice(sourceIndex);
  const start = text.length;
  text += tail;
  if (activeColor && tail.length > 0) {
    colorRuns.push({ start, end: text.length, color: activeColor });
  }

  let lineStart = 0;
  for (const line of text.split("\n")) {
    const lineEnd = lineStart + line.length;
    const hasExplicitColor = colorRuns.some(
      (run) => run.start < lineEnd && run.end > lineStart,
    );
    if (!hasExplicitColor && line.length > 0) {
      const color = inferredLineColor(line);
      if (color) colorRuns.push({ start: lineStart, end: lineEnd, color });
    }
    lineStart = lineEnd + 1;
  }

  colorRuns.sort((left, right) => left.start - right.start);
  return { text, colorRuns };
}

export function supportedImageFormat(
  fileName: string,
  mimeType: string,
): ImageFormat | undefined {
  const normalizedType = mimeType.toLowerCase();
  if (IMAGE_FORMATS.has(normalizedType)) {
    return normalizedType as ImageFormat;
  }

  const extension = fileName.split(".").at(-1)?.toLowerCase();
  return extension
    ? (IMAGE_FORMAT_BY_EXTENSION as Record<string, ImageFormat>)[extension]
    : undefined;
}

function snapshot(project: Project): Snapshot {
  return {
    canvasWidth: project.canvasWidth,
    canvasHeight: project.canvasHeight,
    zoom: project.zoom,
    panX: project.panX,
    panY: project.panY,
    layers: project.layers,
  };
}

function commit(project: Project, next: Snapshot): Project {
  return {
    ...next,
    past: [...project.past, snapshot(project)],
    future: [],
  };
}

function updateLayer<K extends Layer["kind"]>(
  project: Project,
  layerId: string,
  kind: K,
  update: (layer: Extract<Layer, { kind: K }>) => Layer,
  recordHistory = true,
): Project {
  let changed = false;
  const layers = project.layers.map((layer) => {
    if (layer.id !== layerId || layer.kind !== kind) return layer;
    const next = update(layer as Extract<Layer, { kind: K }>);
    changed = changed || next !== layer;
    return next;
  });

  if (!changed) return project;

  return recordHistory
    ? commit(project, { ...snapshot(project), layers })
    : { ...project, layers };
}

function clamp(value: number, min: number, max: number): number {
  const finiteValue = Number.isFinite(value) ? value : min;
  return Math.min(Math.max(finiteValue, min), max);
}

export function openProject(): Project {
  return {
    canvasWidth: 800,
    canvasHeight: 600,
    zoom: 1,
    panX: 0,
    panY: 0,
    layers: [],
    past: [],
    future: [],
  };
}

export function addImageLayer(
  project: Project,
  image: {
    id: string;
    name: string;
    source: string;
    format: ImageFormat;
    width: number;
    height: number;
  },
): Project {
  const layer: ImageLayer = {
    id: image.id,
    kind: "image",
    name: image.name,
    source: image.source,
    format: image.format,
    naturalWidth: image.width,
    naturalHeight: image.height,
    x: 0,
    y: 0,
    scale: 1,
    crop: { x: 0, y: 0, width: image.width, height: image.height },
  };

  return commit(project, {
    ...snapshot(project),
    layers: [...project.layers, layer],
  });
}

export function addTextLayer(project: Project, id: string): Project {
  const layer: TextLayer = {
    id,
    kind: "text",
    name: "Text",
    text: "Text",
    colorRuns: [],
    x: 32,
    y: 32,
    fontFamily: "Arial",
    fontSize: 24,
    bold: false,
    outlineWidth: 2,
    outlineColor: "#000000",
    lineSpacing: 1.2,
    wrapWidth: 400,
  };

  return commit(project, {
    ...snapshot(project),
    layers: [...project.layers, layer],
  });
}

export function editTextLayer(
  project: Project,
  layerId: string,
  changes: TextLayerEdit,
): Project {
  return updateLayer(project, layerId, "text", (layer) => {
    const changed = (Object.keys(changes) as (keyof TextLayerEdit)[]).some(
      (property) => changes[property] !== layer[property],
    );
    return changed ? { ...layer, ...changes } : layer;
  });
}

export function moveLayer(
  project: Project,
  layerId: string,
  x: number,
  y: number,
): Project {
  let changed = false;
  const layers = project.layers.map((layer) => {
    if (layer.id !== layerId || (layer.x === x && layer.y === y)) return layer;
    changed = true;
    return { ...layer, x, y };
  });

  return changed ? commit(project, { ...snapshot(project), layers }) : project;
}

export function nudgeLayer(
  project: Project,
  layerId: string,
  deltaX: number,
  deltaY: number,
): Project {
  const layer = project.layers.find((candidate) => candidate.id === layerId);
  return layer
    ? moveLayer(project, layerId, layer.x + deltaX, layer.y + deltaY)
    : project;
}

export function scaleImageLayer(
  project: Project,
  layerId: string,
  scale: number,
): Project {
  return updateLayer(project, layerId, "image", (layer) =>
    layer.scale === scale ? layer : { ...layer, scale },
  );
}

export function previewImageScale(
  project: Project,
  layerId: string,
  scale: number,
): Project {
  return updateLayer(
    project,
    layerId,
    "image",
    (layer) => (layer.scale === scale ? layer : { ...layer, scale }),
    false,
  );
}

export function finishImageScale(
  project: Project,
  layerId: string,
  previousScale: number,
): Project {
  const finalScale = project.layers.find(
    (layer): layer is ImageLayer =>
      layer.id === layerId && layer.kind === "image",
  )?.scale;
  if (finalScale === undefined || finalScale === previousScale) return project;

  const beforeGesture = previewImageScale(project, layerId, previousScale);
  return scaleImageLayer(beforeGesture, layerId, finalScale);
}

export function fitImageLayerToCanvas(
  project: Project,
  layerId: string,
): Project {
  const layer = project.layers.find((candidate) => candidate.id === layerId);
  if (!layer || layer.kind !== "image") return project;

  const scale = Math.min(
    project.canvasWidth / layer.crop.width,
    project.canvasHeight / layer.crop.height,
  );
  return scaleImageLayer(project, layerId, scale);
}

export function cropImageLayer(
  project: Project,
  layerId: string,
  crop: ImageLayer["crop"],
): Project {
  return updateLayer(project, layerId, "image", (layer) => {
    const right = layer.crop.x + layer.crop.width;
    const bottom = layer.crop.y + layer.crop.height;
    const x = clamp(crop.x, layer.crop.x, right - 1);
    const y = clamp(crop.y, layer.crop.y, bottom - 1);
    const nextCrop = {
      x,
      y,
      width: clamp(crop.width, 1, right - x),
      height: clamp(crop.height, 1, bottom - y),
    };

    return layer.crop.x === nextCrop.x &&
      layer.crop.y === nextCrop.y &&
      layer.crop.width === nextCrop.width &&
      layer.crop.height === nextCrop.height
      ? layer
      : { ...layer, crop: nextCrop };
  });
}

export function setCanvasSize(
  project: Project,
  canvasWidth: number,
  canvasHeight: number,
): Project {
  return commit(project, { ...snapshot(project), canvasWidth, canvasHeight });
}

export function setView(
  project: Project,
  zoom: number,
  panX: number,
  panY: number,
): Project {
  return commit(project, { ...snapshot(project), zoom, panX, panY });
}

export function undo(project: Project): Project {
  const previous = project.past.at(-1);
  if (!previous) return project;

  return {
    ...previous,
    past: project.past.slice(0, -1),
    future: [snapshot(project), ...project.future],
  };
}

export function redo(project: Project): Project {
  const next = project.future[0];
  if (!next) return project;

  return {
    ...next,
    past: [...project.past, snapshot(project)],
    future: project.future.slice(1),
  };
}
