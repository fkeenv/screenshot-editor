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

export type TextLayer = {
  id: string;
  kind: "text";
  name: string;
  text: string;
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
  return updateLayer(project, layerId, "text", (layer) => ({
    ...layer,
    ...changes,
  }));
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
