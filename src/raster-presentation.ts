import type { ImageLayerPresentation } from "./presentation";

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
