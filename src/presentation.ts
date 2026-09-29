import type { Project, TextLayer } from "./editor";

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

export type LayerPresentation = ImageLayerPresentation | TextLayer;

export function presentProject(project: Project): LayerPresentation[] {
  return project.layers.flatMap((layer): LayerPresentation[] => {
    if (!layer.visible) return [];
    if (layer.kind === "text") return [layer];

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
