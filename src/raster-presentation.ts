import { canvasFont } from "./canvas-text";
import type {
  ImageLayerPresentation,
  MeasureText,
  RectangleLayerPresentation,
  TextLayerPresentation,
} from "./presentation";

export type ImageDrawContext = {
  globalAlpha: number;
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
};

export function drawImageLayer(
  context: ImageDrawContext,
  source: CanvasImageSource,
  image: ImageLayerPresentation,
) {
  context.globalAlpha = image.opacity;
  context.drawImage(
    source,
    image.crop.x,
    image.crop.y,
    image.crop.width,
    image.crop.height,
    image.frame.x,
    image.frame.y,
    image.frame.width,
    image.frame.height,
  );
  context.globalAlpha = 1;
}

export type TextDrawContext = {
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  shadowColor?: string;
  globalAlpha: number;
  fillStyle: string;
  strokeStyle: string;
  font: string;
  textBaseline: CanvasTextBaseline;
  lineWidth: number;
  lineJoin: CanvasLineJoin;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
};

export function drawRectangleLayer(
  context: {
    globalAlpha: number;
    fillStyle: string;
    fillRect(x: number, y: number, width: number, height: number): void;
  },
  rectangle: RectangleLayerPresentation,
) {
  context.globalAlpha = rectangle.opacity;
  context.fillStyle = rectangle.fill;
  context.fillRect(
    rectangle.frame.x,
    rectangle.frame.y,
    rectangle.frame.width,
    rectangle.frame.height,
  );
  context.globalAlpha = 1;
}

type TextMeasureContext = {
  font: string;
  measureText(text: string): { width: number };
};

export function measureRasterText(
  context: TextMeasureContext,
): MeasureText {
  return (font, text) => {
    context.font = canvasFont(font);
    return context.measureText(text).width;
  };
}

export function drawTextLayer(
  context: TextDrawContext,
  text: TextLayerPresentation,
) {
  context.globalAlpha = text.opacity;
  context.font = canvasFont(text.font);
  context.textBaseline = "top";
  context.lineWidth = text.outline.width;
  context.strokeStyle = text.outline.color;
  context.lineJoin = "round";
  context.shadowOffsetX = text.shadow?.offsetX ?? 0;
  context.shadowOffsetY = text.shadow?.offsetY ?? 0;
  context.shadowBlur = text.shadow?.blur ?? 0;
  context.shadowColor = text.shadow?.color ?? "transparent";

  for (const line of text.lines) {
    for (const segment of line.segments) {
      const x = text.frame.x + segment.offset;
      const y = text.frame.y + line.y;
      if (text.outline.width > 0) context.strokeText(segment.text, x, y);
      context.fillStyle = segment.color;
      context.fillText(segment.text, x, y);
    }
  }

  context.globalAlpha = 1;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = 0;
  context.shadowColor = "transparent";
}
