import encodeJpeg from "@jsquash/jpeg/encode";
import encodePng from "@jsquash/png/encode";
import encodeWebp from "@jsquash/webp/encode";
import type { Project } from "./editor";
import { presentProject, type ImageLayerPresentation } from "./presentation";
import {
  drawImageLayer,
  drawTextLayer,
  measureRasterText,
} from "./raster-presentation";

export type ExportFormat = "png" | "jpeg" | "webp";

export type ExportOptions = {
  format: ExportFormat;
  quality: number;
  lossless?: boolean;
};

export type ExportedImage = {
  bytes: Uint8Array;
  mediaType: string;
};

const MEDIA_TYPE: Record<ExportFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const JPEG_BACKGROUND = "#111827";

type DrawContext = {
  globalAlpha: number;
  fillStyle: string;
  strokeStyle: string;
  font: string;
  textBaseline: CanvasTextBaseline;
  lineWidth: number;
  lineJoin: CanvasLineJoin;
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  drawImage(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  save(): void;
  restore(): void;
  beginPath(): void;
  rect(x: number, y: number, width: number, height: number): void;
  clip(): void;
  getImageData(x: number, y: number, width: number, height: number): ImageData;
};

type Raster = {
  getContext(kind: "2d"): DrawContext | null;
};

type ExportEnvironment = {
  createRaster(width: number, height: number): Raster | Promise<Raster>;
  loadImage(source: string): Promise<CanvasImageSource>;
};

let startCodecs: (() => Promise<void>) | undefined;
let codecsReady: Promise<void> | undefined;
let environment: ExportEnvironment | undefined;

export function prepareExportCodecs(start: () => Promise<void>) {
  startCodecs = start;
  codecsReady = undefined;
}

export function prepareExportEnvironment(next: ExportEnvironment) {
  environment = next;
}

async function ensureCodecs() {
  if (!startCodecs) return;
  codecsReady ??= startCodecs();
  await codecsReady;
}

async function createRaster(width: number, height: number): Promise<Raster> {
  if (environment) return environment.createRaster(width, height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas as Raster;
}

export async function exportFlattened(
  project: Project,
  options: ExportOptions,
): Promise<ExportedImage> {
  await ensureCodecs();
  const raster = await createRaster(project.canvasWidth, project.canvasHeight);
  const context = raster.getContext("2d");
  if (!context) throw new Error("The canvas could not be exported.");
  if (project.canvasBackground.kind === "solid" || options.format === "jpeg") {
    context.fillStyle = project.canvasBackground.kind === "solid"
      ? project.canvasBackground.color : JPEG_BACKGROUND;
    context.fillRect(0, 0, project.canvasWidth, project.canvasHeight);
  }
  await paintLayers(context, project);
  const image = context.getImageData(
    0,
    0,
    project.canvasWidth,
    project.canvasHeight,
  );
  const bytes = await encodeRaster(image, options);
  return { bytes, mediaType: MEDIA_TYPE[options.format] };
}

export async function exportStitch(
  projects: Project[],
  options: ExportOptions,
): Promise<ExportedImage> {
  if (projects.length < 2) {
    throw new Error("Choose at least two saved screens to export a stitch.");
  }

  await ensureCodecs();
  const width = Math.max(...projects.map((project) => project.canvasWidth));
  const height = projects.reduce(
    (total, project) => total + project.canvasHeight,
    0,
  );
  const raster = await createRaster(width, height);
  const context = raster.getContext("2d");
  if (!context) throw new Error("The stitch could not be exported.");
  if (options.format === "jpeg") {
    context.fillStyle = JPEG_BACKGROUND;
    context.fillRect(0, 0, width, height);
  }

  let offsetY = 0;
  for (const project of projects) {
    context.save();
    context.beginPath();
    context.rect(0, offsetY, project.canvasWidth, project.canvasHeight);
    context.clip();
    try {
      if (project.canvasBackground.kind === "solid") {
        context.fillStyle = project.canvasBackground.color;
        context.fillRect(0, offsetY, project.canvasWidth, project.canvasHeight);
      }
      await paintLayers(context, project, offsetY);
    } finally {
      context.restore();
    }
    offsetY += project.canvasHeight;
  }

  const image = context.getImageData(0, 0, width, height);
  const bytes = await encodeRaster(image, options);
  return { bytes, mediaType: MEDIA_TYPE[options.format] };
}

async function paintLayers(
  context: DrawContext,
  project: Project,
  offsetY = 0,
) {
  const layers = presentProject(project, measureRasterText(context));
  for (const layer of layers) {
    const positioned = {
      ...layer,
      frame: { ...layer.frame, y: layer.frame.y + offsetY },
    };
    if (positioned.kind === "image") await paintImage(context, positioned);
    else drawTextLayer(context, positioned);
  }
}

async function paintImage(
  context: DrawContext,
  layer: ImageLayerPresentation,
) {
  const image = await loadSource(layer.source);
  drawImageLayer(context, image, layer);
}

async function loadSource(source: string): Promise<CanvasImageSource> {
  if (environment) return environment.loadImage(source);

  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be exported."));
    image.src = source;
  });
}

function clampQuality(quality: number): number {
  if (!Number.isFinite(quality)) return 80;
  return Math.min(100, Math.max(1, Math.round(quality)));
}

async function encodeRaster(
  image: ImageData,
  options: ExportOptions,
): Promise<Uint8Array> {
  const quality = clampQuality(options.quality);
  if (options.format === "jpeg") {
    return new Uint8Array(await encodeJpeg(image, { quality }));
  }
  if (options.format === "webp") {
    return new Uint8Array(
      await encodeWebp(image, {
        quality,
        lossless: options.lossless ? 1 : 0,
        exact: options.lossless ? 1 : 0,
      }),
    );
  }
  return new Uint8Array(await encodePng(image));
}
