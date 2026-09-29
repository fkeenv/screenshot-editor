import { canvasFont } from "./canvas-text";
import type {
  ImageLayerPresentation,
  MeasureText,
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
}
