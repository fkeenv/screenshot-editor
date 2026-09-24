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

type Snapshot = {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  layers: ImageLayer[];
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

function updateImageLayer(
  project: Project,
  layerId: string,
  update: (layer: ImageLayer) => ImageLayer,
  recordHistory = true,
): Project {
  let changed = false;
  const layers = project.layers.map((layer) => {
    if (layer.id !== layerId) return layer;
    const next = update(layer);
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

export function moveImageLayer(
  project: Project,
  layerId: string,
  x: number,
  y: number,
): Project {
  return updateImageLayer(project, layerId, (layer) =>
    layer.x === x && layer.y === y ? layer : { ...layer, x, y },
  );
}

export function scaleImageLayer(
  project: Project,
  layerId: string,
  scale: number,
): Project {
  return updateImageLayer(project, layerId, (layer) =>
    layer.scale === scale ? layer : { ...layer, scale },
  );
}

export function previewImageScale(
  project: Project,
  layerId: string,
  scale: number,
): Project {
  return updateImageLayer(
    project,
    layerId,
    (layer) => (layer.scale === scale ? layer : { ...layer, scale }),
    false,
  );
}

export function finishImageScale(
  project: Project,
  layerId: string,
  previousScale: number,
): Project {
  const finalScale = project.layers.find((layer) => layer.id === layerId)?.scale;
  if (finalScale === undefined || finalScale === previousScale) return project;

  const beforeGesture = previewImageScale(project, layerId, previousScale);
  return scaleImageLayer(beforeGesture, layerId, finalScale);
}

export function fitImageLayerToCanvas(
  project: Project,
  layerId: string,
): Project {
  const layer = project.layers.find((candidate) => candidate.id === layerId);
  if (!layer) return project;

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
  return updateImageLayer(project, layerId, (layer) => {
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
