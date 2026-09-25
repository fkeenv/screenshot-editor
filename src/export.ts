import encodeJpeg from "@jsquash/jpeg/encode";
import encodePng from "@jsquash/png/encode";
import encodeWebp from "@jsquash/webp/encode";
import type { ImageLayer, Project, TextLayer } from "./editor";

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
  if (options.format === "jpeg") {
    context.fillStyle = JPEG_BACKGROUND;
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

async function paintLayers(context: DrawContext, project: Project) {
  for (const layer of project.layers) {
    if (!layer.visible) continue;
    if (layer.kind === "image") await paintImage(context, layer);
    else paintText(context, layer);
  }
}

function paintText(context: DrawContext, layer: TextLayer) {
  context.globalAlpha = layer.opacity;
  context.font = canvasFont(layer);
  context.textBaseline = "top";
  context.lineWidth = layer.outlineWidth;
  context.strokeStyle = layer.outlineColor;
  context.lineJoin = "round";
  const lineHeight = layer.fontSize * layer.lineSpacing;
  const lines = layoutLines(context, layer.text, Math.max(1, layer.wrapWidth));
  lines.forEach((line, index) => {
    drawLine(
      context,
      layer,
      line.start,
      line.end,
      layer.x,
      layer.y + index * lineHeight,
    );
  });
  context.globalAlpha = 1;
}

function canvasFont(layer: TextLayer): string {
  const family = layer.fontFamily.includes(" ")
    ? `"${layer.fontFamily.replaceAll('"', "")}"`
    : layer.fontFamily;
  return `${layer.bold ? 700 : 400} ${layer.fontSize}px ${family}, sans-serif`;
}

function layoutLines(
  context: DrawContext,
  text: string,
  wrapWidth: number,
): { start: number; end: number }[] {
  const lines: { start: number; end: number }[] = [];
  let lineStart = 0;
  for (let index = 0; index <= text.length; index += 1) {
    if (index !== text.length && text[index] !== "\n") continue;
    lines.push(...wrapRange(context, text, lineStart, index, wrapWidth));
    lineStart = index + 1;
  }
  return lines;
}

function wrapRange(
  context: DrawContext,
  text: string,
  start: number,
  end: number,
  wrapWidth: number,
): { start: number; end: number }[] {
  const lines: { start: number; end: number }[] = [];
  let cursor = start;
  while (cursor < end) {
    let fit = cursor;
    let breakAt = -1;
    for (let index = cursor; index < end; index += 1) {
      const width = context.measureText(text.slice(cursor, index + 1)).width;
      if (width > wrapWidth) break;
      fit = index + 1;
      if (text[index] === " ") breakAt = index + 1;
    }
    if (fit === cursor) fit = cursor + 1;
    else if (fit < end && breakAt > cursor) fit = breakAt;
    lines.push({ start: cursor, end: fit });
    cursor = fit;
  }
  if (start === end) lines.push({ start, end });
  return lines;
}

function drawLine(
  context: DrawContext,
  layer: TextLayer,
  start: number,
  end: number,
  x: number,
  y: number,
) {
  let cursor = start;
  let drawX = x;
  while (cursor < end) {
    const color = textColor(layer, cursor);
    let next = cursor + 1;
    while (next < end && textColor(layer, next) === color) next += 1;
    const segment = layer.text.slice(cursor, next);
    if (layer.outlineWidth > 0) context.strokeText(segment, drawX, y);
    context.fillStyle = color;
    context.fillText(segment, drawX, y);
    drawX += context.measureText(segment).width;
    cursor = next;
  }
}

function textColor(layer: TextLayer, index: number): string {
  return (
    layer.colorRuns.find((run) => index >= run.start && index < run.end)?.color ??
    "#ffffff"
  );
}

async function paintImage(context: DrawContext, layer: ImageLayer) {
  const image = await loadSource(layer.source);
  context.globalAlpha = layer.opacity;
  context.drawImage(
    image,
    layer.crop.x,
    layer.crop.y,
    layer.crop.width,
    layer.crop.height,
    layer.x,
    layer.y,
    layer.crop.width * layer.scale,
    layer.crop.height * layer.scale,
  );
  context.globalAlpha = 1;
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
