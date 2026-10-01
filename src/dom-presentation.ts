import { canvasFont } from "./canvas-text";
import type {
  ImageLayerPresentation,
  MeasureText,
  TextLayerPresentation,
} from "./presentation";

let measurementContext: CanvasRenderingContext2D | null | undefined;

export const measureDomText: MeasureText = (font, text) => {
  if (measurementContext === undefined) {
    measurementContext = document.createElement("canvas").getContext("2d");
  }
  if (!measurementContext) throw new Error("Text measurement is not available.");
  measurementContext.font = canvasFont(font);
  return measurementContext.measureText(text).width;
};

export function imageLayerStyles(image: ImageLayerPresentation) {
  return {
    frame: {
      left: image.frame.x,
      top: image.frame.y,
      width: image.frame.width,
      height: image.frame.height,
      opacity: image.opacity,
    },
    content: {
      left: image.content.x,
      top: image.content.y,
      width: image.content.width,
      height: image.content.height,
    },
  };
}

export function textLayerStyles(text: TextLayerPresentation) {
  return {
    frame: {
      left: text.frame.x,
      top: text.frame.y,
      width: text.frame.width,
      minHeight: text.frame.height,
      fontFamily: text.font.family,
      fontSize: text.font.size,
      fontWeight: text.font.weight,
      lineHeight: `${text.lineHeight}px`,
      WebkitTextStroke: `${text.outline.width}px ${text.outline.color}`,
      ...(text.shadow ? {
        textShadow: `${text.shadow.offsetX}px ${text.shadow.offsetY}px ${text.shadow.blur}px ${text.shadow.color}`,
      } : {}),
      opacity: text.opacity,
      overflowWrap: "normal" as const,
      whiteSpace: "pre" as const,
    },
    line: { height: text.lineHeight, whiteSpace: "pre" as const },
  };
}
