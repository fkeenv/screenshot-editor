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
  visible: boolean;
  opacity: number;
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
  do: { label: "/do", color: "#c2a3da" },
  say: { label: "Say / shout", color: "#f1f1f1" },
  low: { label: "Low", color: "#adadad" },
  whisper: { label: "Whisper", color: "#eda841" },
  phone: { label: "Phone speech", color: "#fbf724" },
  transaction: { label: "Item given / money", color: "#56d64b" },
  inventory: { label: "Inventory", color: "#ffff00" },
  radio: { label: "Radio", color: "#ece3a7" },
  hq: { label: "HQ", color: "#006eff" },
  phoneNotice: { label: "Phone notice", color: "#ffff00" },
  intercom: { label: "Intercom / CK blue", color: "#3896f3" },
  characterKill: { label: "CK red", color: "#f00000" },
} as const;

function inferredLineColor(line: string): string | undefined {
  const message = line.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, "");
  const characterName =
    "(?:[\\p{L}][\\p{L}'-]*(?: |_)[\\p{L}][\\p{L}'-]*|Mask(?:_[\\p{L}\\p{N}]+)+)";
  const rules: [RegExp, string][] = [
    [
      /^\*\s.+\(\(\s*.+?\s*\)\)\*?$/u,
      TEXT_COLOR_PRESETS.do.color,
    ],
    [/^(?:\*|>)\s+/u, TEXT_COLOR_PRESETS.me.color],
    [
      /^(?:You paid \$|.+ paid you \$|You have (?:given|shown) .+\byour\b)/iu,
      TEXT_COLOR_PRESETS.transaction.color,
    ],
    [
      /^(?:You took \d+ .+ from\b|Info:\s*You took\b|You've just taken\b|You (?:equipped|unequipped|dropped)\b)/iu,
      TEXT_COLOR_PRESETS.inventory.color,
    ],
    [/^\*\*\s*\[S:\s*.+?\]/iu, TEXT_COLOR_PRESETS.radio.color],
    [/^(?:\*\*\s*)?\[HQ\]|^HQ:/iu, TEXT_COLOR_PRESETS.hq.color],
    [/^\[PHONE\]/u, TEXT_COLOR_PRESETS.phoneNotice.color],
    [/^\[INTERCOM\]|^Intercom:/iu, TEXT_COLOR_PRESETS.intercom.color],
    [/^\[(?:Character kill|CK)\]/iu, TEXT_COLOR_PRESETS.characterKill.color],
    [
      /(?:\bsays \[(?:low)\]|\bsays quietly\b|\bmurmurs\b)/iu,
      TEXT_COLOR_PRESETS.low.color,
    ],
    [
      /(?:\bwhispers(?: to \d+ people)?\b|\bsays whispers\b)/iu,
      TEXT_COLOR_PRESETS.whisper.color,
    ],
    [
      /(?:\bsays \((?:cell)?phone\):|\bsays on the phone\b|^\(Phone - Loudspeaker\))/iu,
      TEXT_COLOR_PRESETS.phone.color,
    ],
    [
      /\bshouts(?: \(to .+?\))?:/iu,
      TEXT_COLOR_PRESETS.say.color,
    ],
    [/\bsays(?: \(to .+?\))?(?::|\s)/iu, TEXT_COLOR_PRESETS.say.color],
    [new RegExp(`^(?:\\* )?${characterName} `, "u"), TEXT_COLOR_PRESETS.me.color],
  ];
  return rules.find(([pattern]) => pattern.test(message))?.[1];
}

export type RichTextNode = {
  type: string;
  text?: string;
  marks?: { type: string; attrs?: { color?: string | null } }[];
  content?: RichTextNode[];
};

export function contentToDocument(content: TextContent): RichTextNode {
  const lines = content.text.split("\n");
  let lineStart = 0;

  return {
    type: "doc",
    content: lines.map((line) => {
      const lineEnd = lineStart + line.length;
      const runs = content.colorRuns.filter(
        (run) => run.end > lineStart && run.start < lineEnd,
      );
      const points = new Set([0, line.length]);
      for (const run of runs) {
        points.add(Math.max(0, run.start - lineStart));
        points.add(Math.min(line.length, run.end - lineStart));
      }
      const boundaries = [...points].sort((left, right) => left - right);
      const nodes: RichTextNode[] = [];
      for (let index = 0; index < boundaries.length - 1; index += 1) {
        const start = boundaries[index];
        const end = boundaries[index + 1];
        if (start === undefined || end === undefined || start === end) continue;
        const color = runs.find(
          (run) =>
            run.start <= lineStart + start && run.end >= lineStart + end,
        )?.color;
        nodes.push({
          type: "text",
          text: line.slice(start, end),
          ...(color
            ? { marks: [{ type: "textStyle", attrs: { color } }] }
            : {}),
        });
      }
      lineStart = lineEnd + 1;
      return nodes.length > 0
        ? { type: "paragraph", content: nodes }
        : { type: "paragraph" };
    }),
  };
}

export function documentToContent(document: RichTextNode): TextContent {
  let text = "";
  const colorRuns: TextColorRun[] = [];
  for (const [index, paragraph] of (document.content ?? []).entries()) {
    if (index > 0) text += "\n";
    for (const node of paragraph.content ?? []) {
      if (!node.text) continue;
      const start = text.length;
      text += node.text;
      const color = node.marks?.find((mark) => mark.type === "textStyle")
        ?.attrs?.color;
      if (color) colorRuns.push({ start, end: text.length, color });
    }
  }
  const merged = mergeColorRuns(colorRuns);
  const colorRunsAcrossLines: TextColorRun[] = [];
  for (const run of merged) {
    const previous = colorRunsAcrossLines.at(-1);
    if (
      previous &&
      previous.color === run.color &&
      text.slice(previous.end, run.start) === "\n"
    ) {
      previous.end = run.end;
    } else {
      colorRunsAcrossLines.push({ ...run });
    }
  }
  return { text, colorRuns: colorRunsAcrossLines };
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
  visible: boolean;
  opacity: number;
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
  const colorCode = /!?\{#?([0-9a-f]{6}|[0-9a-f]{3})\}/gi;
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
    const hex = match[1].toLowerCase();
    activeColor = `#${
      hex.length === 3
        ? [...hex].map((character) => character.repeat(2)).join("")
        : hex
    }`;
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

function updateMatchingLayer(
  project: Project,
  layerId: string,
  matches: (layer: Layer) => boolean,
  update: (layer: Layer) => Layer,
  recordHistory = true,
): Project {
  let changed = false;
  const layers = project.layers.map((layer) => {
    if (layer.id !== layerId || !matches(layer)) return layer;
    const next = update(layer);
    changed = changed || next !== layer;
    return next;
  });

  if (!changed) return project;

  return recordHistory
    ? commit(project, { ...snapshot(project), layers })
    : { ...project, layers };
}

function updateLayer<K extends Layer["kind"]>(
  project: Project,
  layerId: string,
  kind: K,
  update: (layer: Extract<Layer, { kind: K }>) => Layer,
  recordHistory = true,
): Project {
  return updateMatchingLayer(
    project,
    layerId,
    (layer) => layer.kind === kind,
    (layer) => update(layer as Extract<Layer, { kind: K }>),
    recordHistory,
  );
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

function nextLayerName(project: Project, baseName: string): string {
  const names = new Set(project.layers.map((layer) => layer.name));
  if (!names.has(baseName)) return baseName;

  let copyNumber = 1;
  while (names.has(`${baseName} (${copyNumber})`)) copyNumber += 1;
  return `${baseName} (${copyNumber})`;
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
    name: nextLayerName(project, image.name),
    visible: true,
    opacity: 1,
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

export function addTextLayer(
  project: Project,
  id: string,
  position: { x: number; y: number } = { x: 32, y: 32 },
): Project {
  const layer: TextLayer = {
    id,
    kind: "text",
    name: nextLayerName(project, "Text"),
    visible: true,
    opacity: 1,
    text: "Text",
    colorRuns: [],
    x: position.x,
    y: position.y,
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

export function resizeTextLayer(
  project: Project,
  layerId: string,
  x: number,
  wrapWidth: number,
): Project {
  let changed = false;
  const layers = project.layers.map((layer) => {
    if (layer.id !== layerId || layer.kind !== "text") return layer;
    if (layer.x === x && layer.wrapWidth === wrapWidth) return layer;
    changed = true;
    return { ...layer, x, wrapWidth };
  });
  return changed ? commit(project, { ...snapshot(project), layers }) : project;
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

export function reorderLayer(
  project: Project,
  layerId: string,
  targetIndex: number,
): Project {
  const currentIndex = project.layers.findIndex(
    (layer) => layer.id === layerId,
  );
  if (currentIndex < 0 || !Number.isFinite(targetIndex)) return project;
  const destination = clamp(
    Math.trunc(targetIndex),
    0,
    project.layers.length - 1,
  );
  if (currentIndex === destination) return project;

  const layers = [...project.layers];
  const [layer] = layers.splice(currentIndex, 1);
  if (!layer) return project;
  layers.splice(destination, 0, layer);
  return commit(project, { ...snapshot(project), layers });
}

export function setLayerVisibility(
  project: Project,
  layerId: string,
  visible: boolean,
): Project {
  return updateAnyLayer(project, layerId, (layer) =>
    layer.visible === visible ? layer : { ...layer, visible },
  );
}

export function renameLayer(
  project: Project,
  layerId: string,
  name: string,
): Project {
  return updateAnyLayer(project, layerId, (layer) =>
    layer.name === name ? layer : { ...layer, name },
  );
}

export function setLayerOpacity(
  project: Project,
  layerId: string,
  opacity: number,
): Project {
  return updateLayerOpacity(project, layerId, opacity, true);
}

export function previewLayerOpacity(
  project: Project,
  layerId: string,
  opacity: number,
): Project {
  return updateLayerOpacity(project, layerId, opacity, false);
}

function updateLayerOpacity(
  project: Project,
  layerId: string,
  opacity: number,
  recordHistory: boolean,
): Project {
  const normalizedOpacity = clamp(opacity, 0, 1);
  return updateAnyLayer(
    project,
    layerId,
    (layer) =>
      layer.opacity === normalizedOpacity
        ? layer
        : { ...layer, opacity: normalizedOpacity },
    recordHistory,
  );
}

export function finishLayerOpacity(
  project: Project,
  layerId: string,
  previousOpacity: number,
): Project {
  const finalOpacity = project.layers.find(
    (layer) => layer.id === layerId,
  )?.opacity;
  if (finalOpacity === undefined || finalOpacity === previousOpacity) {
    return project;
  }

  const beforeGesture = previewLayerOpacity(project, layerId, previousOpacity);
  return setLayerOpacity(beforeGesture, layerId, finalOpacity);
}

function updateAnyLayer(
  project: Project,
  layerId: string,
  update: (layer: Layer) => Layer,
  recordHistory = true,
): Project {
  return updateMatchingLayer(
    project,
    layerId,
    () => true,
    update,
    recordHistory,
  );
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
