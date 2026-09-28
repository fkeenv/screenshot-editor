import { createCanvas, loadImage } from "@napi-rs/canvas";
import { expect, test } from "vitest";
import {
  addImageLayer,
  moveLayer,
  openProject,
  setCanvasSize,
  type Project,
} from "./editor";
import { createExportRuntime } from "./export";
import { createNodeExportRuntime } from "./test/createNodeExportRuntime";

const exportRuntime = createNodeExportRuntime();

test("stitch requires at least two saved screens", async () => {
  await expect(
    exportRuntime.exportStitch([screen(255, 0, 0)], {
      format: "png",
      quality: 80,
    }),
  ).rejects.toThrow("Choose at least two saved screens to export a stitch.");
});

test("stitch reports export failures at its own interface", async () => {
  const failingRuntime = createExportRuntime({
    initializeCodecs: () => Promise.reject(new Error("Codecs are unavailable.")),
    createRaster() {
      throw new Error("Raster creation should not run before codec setup.");
    },
    loadImage() {
      throw new Error("Image loading should not run before codec setup.");
    },
  });

  await expect(
    failingRuntime.exportStitch(
      [screen(255, 0, 0), screen(0, 0, 255)],
      { format: "png", quality: 80 },
    ),
  ).rejects.toThrow("The stitch could not be exported. Codecs are unavailable.");
});

test("stitch exports the chosen screen order as one tall png", async () => {
  const exported = await exportRuntime.exportStitch(
    [screen(0, 0, 255), screen(255, 0, 0)],
    { format: "png", quality: 80 },
  );

  expect(exported.mediaType).toBe("image/png");
  const image = await pixelsFromBytes(exported.bytes);
  expect(image.width).toBe(1);
  expect(image.height).toBe(2);
  expect(Array.from(image.data)).toEqual([0, 0, 255, 255, 255, 0, 0, 255]);
});

function screen(
  red: number,
  green: number,
  blue: number,
  width = 1,
  height = 1,
): Project {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = `rgb(${red} ${green} ${blue})`;
  context.fillRect(0, 0, width, height);
  return addImageLayer(setCanvasSize(openProject(), width, height), {
    id: `image-${red}-${green}-${blue}`,
    name: "Screen",
    source: `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`,
    format: "image/png",
    width,
    height,
  });
}

async function pixelsFromBytes(bytes: Uint8Array) {
  const image = await loadImage(Buffer.from(bytes));
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  return {
    width: image.width,
    height: image.height,
    data: context.getImageData(0, 0, image.width, image.height).data,
  };
}

test("stitch stacks each finished screen inside its canvas", async () => {
  const hanging = moveLayer(screen(0, 0, 255), "image-0-0-255", 0, 1);
  const below = setCanvasSize(openProject(), 1, 1);
  const stitched = await exportRuntime.exportStitch([hanging, below], {
    format: "png",
    quality: 80,
  });
  const image = await pixelsFromBytes(stitched.bytes);

  expect(image.width).toBe(1);
  expect(image.height).toBe(2);
  expect(Array.from(image.data)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
});

test("stitch is as wide as the widest screen", async () => {
  const stitched = await exportRuntime.exportStitch(
    [screen(255, 0, 0, 2, 1), screen(0, 0, 255, 1, 1)],
    { format: "png", quality: 80 },
  );
  const image = await pixelsFromBytes(stitched.bytes);

  expect(image.width).toBe(2);
  expect(image.height).toBe(2);
  expect(Array.from(image.data)).toEqual([
    255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0,
  ]);
});

test("the tall result exports as a jpeg and a webp", async () => {
  const screens = [screen(255, 0, 0), screen(0, 0, 255)];
  const jpeg = await exportRuntime.exportStitch(screens, {
    format: "jpeg",
    quality: 80,
  });
  const webp = await exportRuntime.exportStitch(screens, {
    format: "webp",
    quality: 80,
    lossless: true,
  });

  expect(jpeg.mediaType).toBe("image/jpeg");
  expect(Array.from(jpeg.bytes.slice(0, 2))).toEqual([0xff, 0xd8]);
  expect(webp.mediaType).toBe("image/webp");
  const jpegImage = await loadImage(Buffer.from(jpeg.bytes));
  const webpImage = await loadImage(Buffer.from(webp.bytes));
  expect(jpegImage.width).toBe(1);
  expect(jpegImage.height).toBe(2);
  expect(webpImage.width).toBe(1);
  expect(webpImage.height).toBe(2);
});
