import type { Project, TextLayer, TextShadow } from "./editor";

export type Rectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageLayerPresentation = {
  kind: "image";
  id: string;
  name: string;
  source: string;
  opacity: number;
  crop: Rectangle;
  frame: Rectangle;
  content: Rectangle;
};

export type TextFontPresentation = {
  family: string;
  size: number;
  weight: 400 | 700;
};

export type TextSegmentPresentation = {
  text: string;
  color: string;
  offset: number;
  width: number;
};

export type TextLinePresentation = {
  y: number;
  segments: TextSegmentPresentation[];
};

export type TextLayerPresentation = {
  kind: "text";
  id: string;
  name: string;
  opacity: number;
  frame: Rectangle;
  font: TextFontPresentation;
  lineHeight: number;
  outline: { width: number; color: string };
  shadow?: TextShadow;
  lines: TextLinePresentation[];
};

export type RectangleLayerPresentation = {
  kind: "rectangle";
  id: string;
  name: string;
  opacity: number;
  fill: string;
  frame: Rectangle;
};

export type LayerPresentation =
  | ImageLayerPresentation
  | TextLayerPresentation
  | RectangleLayerPresentation;

export type MeasureText = (
  font: TextFontPresentation,
  text: string,
) => number;

export function presentProject(
  project: Project,
  measureText: MeasureText,
): LayerPresentation[] {
  return project.layers.flatMap((layer): LayerPresentation[] => {
    if (!layer.visible) return [];
    if (layer.kind === "text") return [presentTextLayer(layer, measureText)];
    if (layer.kind === "rectangle") {
      return [{
        kind: layer.kind,
        id: layer.id,
        name: layer.name,
        opacity: layer.opacity,
        fill: layer.fill,
        frame: { x: layer.x, y: layer.y, width: layer.width, height: layer.height },
      }];
    }

    return [
      {
        kind: layer.kind,
        id: layer.id,
        name: layer.name,
        source: layer.source,
        opacity: layer.opacity,
        crop: { ...layer.crop },
        frame: {
          x: layer.x,
          y: layer.y,
          width: layer.crop.width * layer.scale,
          height: layer.crop.height * layer.scale,
        },
        content: {
          x: layer.crop.x === 0 ? 0 : -layer.crop.x * layer.scale,
          y: layer.crop.y === 0 ? 0 : -layer.crop.y * layer.scale,
          width: layer.naturalWidth * layer.scale,
          height: layer.naturalHeight * layer.scale,
        },
      },
    ];
  });
}

function presentTextLayer(
  layer: TextLayer,
  measureText: MeasureText,
): TextLayerPresentation {
  const font = presentFont(layer);
  const lineHeight = layer.fontSize * layer.lineSpacing;
  const ranges = layoutLines(
    layer.text,
    Math.max(1, layer.wrapWidth),
    (text) => measureText(font, text),
  );
  const lines = ranges.map((range, index) => ({
    y: index * lineHeight,
    segments: presentSegments(layer, range, font, measureText),
  }));

  return {
    kind: layer.kind,
    id: layer.id,
    name: layer.name,
    opacity: layer.opacity,
    frame: {
      x: layer.x,
      y: layer.y,
      width: layer.wrapWidth,
      height: lines.length * lineHeight,
    },
    font,
    lineHeight,
    outline: { width: layer.outlineWidth, color: layer.outlineColor },
    ...(layer.shadow ? { shadow: layer.shadow } : {}),
    lines,
  };
}

function presentFont(layer: TextLayer): TextFontPresentation {
  return {
    family: layer.fontFamily,
    size: layer.fontSize,
    weight: layer.bold ? 700 : 400,
  };
}

function layoutLines(
  text: string,
  wrapWidth: number,
  measureText: (text: string) => number,
): { start: number; end: number }[] {
  const lines: { start: number; end: number }[] = [];
  let lineStart = 0;
  for (let index = 0; index <= text.length; index += 1) {
    if (index !== text.length && text[index] !== "\n") continue;
    lines.push(...wrapRange(text, lineStart, index, wrapWidth, measureText));
    lineStart = index + 1;
  }
  return lines;
}

function wrapRange(
  text: string,
  start: number,
  end: number,
  wrapWidth: number,
  measureText: (text: string) => number,
): { start: number; end: number }[] {
  const lines: { start: number; end: number }[] = [];
  let cursor = start;
  while (cursor < end) {
    let fit = cursor;
    let breakAt = -1;
    for (let index = cursor; index < end; index += 1) {
      if (measureText(text.slice(cursor, index + 1)) > wrapWidth) break;
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

function presentSegments(
  layer: TextLayer,
  range: { start: number; end: number },
  font: TextFontPresentation,
  measureText: MeasureText,
): TextSegmentPresentation[] {
  const segments: TextSegmentPresentation[] = [];
  let cursor = range.start;
  let offset = 0;
  while (cursor < range.end) {
    const color = textColor(layer, cursor);
    let next = cursor + 1;
    while (next < range.end && textColor(layer, next) === color) next += 1;
    const text = layer.text.slice(cursor, next);
    const width = measureText(font, text);
    segments.push({ text, color, offset, width });
    cursor = next;
    offset += width;
  }
  return segments;
}

function textColor(layer: TextLayer, index: number): string {
  return (
    layer.colorRuns.find((run) => index >= run.start && index < run.end)?.color ??
    "#ffffff"
  );
}
