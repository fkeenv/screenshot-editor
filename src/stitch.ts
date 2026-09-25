import type { ImageLayer, Project } from "./editor";
import { exportFlattened } from "./export";

export async function stitchProjects(projects: Project[]): Promise<Project> {
  const screens = await Promise.all(
    projects.map(async (project) => {
      const exported = await exportFlattened(project, {
        format: "png",
        quality: 100,
      });
      return {
        width: project.canvasWidth,
        height: project.canvasHeight,
        source: bytesToDataUrl(exported.bytes, exported.mediaType),
      };
    }),
  );
  let offsetY = 0;
  const layers: ImageLayer[] = screens.map((screen, index) => {
    const layer: ImageLayer = {
      id: `screen-${index + 1}`,
      kind: "image",
      name: `Screen ${index + 1}`,
      visible: true,
      opacity: 1,
      source: screen.source,
      format: "image/png",
      naturalWidth: screen.width,
      naturalHeight: screen.height,
      x: 0,
      y: offsetY,
      scale: 1,
      crop: { x: 0, y: 0, width: screen.width, height: screen.height },
    };
    offsetY += screen.height;
    return layer;
  });

  return {
    canvasWidth: Math.max(...screens.map((screen) => screen.width)),
    canvasHeight: offsetY,
    zoom: 1,
    panX: 0,
    panY: 0,
    layers,
    past: [],
    future: [],
  };
}

function bytesToDataUrl(bytes: Uint8Array, mediaType: string): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${mediaType};base64,${btoa(binary)}`;
}
