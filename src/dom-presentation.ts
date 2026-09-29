import type { ImageLayerPresentation } from "./presentation";

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
