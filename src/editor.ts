export type ImageFormat =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "image/bmp";

const IMAGE_FORMATS = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
]);

const IMAGE_FORMAT_BY_EXTENSION: Record<string, ImageFormat> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
};

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
  return extension ? IMAGE_FORMAT_BY_EXTENSION[extension] : undefined;
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
): Project {
  let changed = false;
  const layers = project.layers.map((layer) => {
    if (layer.id !== layerId) return layer;
    const next = update(layer);
    changed = changed || next !== layer;
    return next;
  });

  return changed ? commit(project, { ...snapshot(project), layers }) : project;
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

export function cropImageLayer(
  project: Project,
  layerId: string,
  crop: ImageLayer["crop"],
): Project {
  return updateImageLayer(project, layerId, (layer) =>
    layer.crop.x === crop.x &&
    layer.crop.y === crop.y &&
    layer.crop.width === crop.width &&
    layer.crop.height === crop.height
      ? layer
      : { ...layer, crop },
  );
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
