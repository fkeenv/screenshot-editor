import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { beforeAll, expect, test } from "vitest";
import {
  addImageLayer,
  moveLayer,
  openProject,
  setCanvasSize,
  type Project,
} from "./editor";
import {
  exportFlattened,
  prepareExportCodecs,
  prepareExportEnvironment,
} from "./export";
import { stitchProjects } from "./stitch";

const require = createRequire(import.meta.url);

beforeAll(async () => {
  prepareExportEnvironment({
    createRaster(width, height) {
      return createCanvas(width, height) as never;
    },
    loadImage(source) {
      return loadImage(source) as never;
    },
  });
  const { init: initPng } = await import("@jsquash/png/encode");
  const { init: initJpeg } = await import("@jsquash/jpeg/encode");
  const { init: initWebp } = await import("@jsquash/webp/encode");
  prepareExportCodecs(async () => {
    await initPng(
      await readFile(require.resolve("@jsquash/png/codec/pkg/squoosh_png_bg.wasm")),
    );
    await initJpeg({
      wasmBinary: await readFile(
        require.resolve("@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm"),
      ),
    });
    await initWebp({
      wasmBinary: await readFile(
        require.resolve("@jsquash/webp/codec/enc/webp_enc_simd.wasm"),
      ),
    });
  });
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

async function pixels(project: Project) {
  const exported = await exportFlattened(project, { format: "png", quality: 80 });
  const image = await loadImage(Buffer.from(exported.bytes));
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
  const image = await pixels(await stitchProjects([hanging, below]));

  expect(image.width).toBe(1);
  expect(image.height).toBe(2);
  expect(Array.from(image.data)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
});

test("stitch places screens in one column", async () => {
  const stitched = await stitchProjects([screen(255, 0, 0), screen(0, 0, 255)]);
  const image = await pixels(stitched);

  expect(image.width).toBe(1);
  expect(image.height).toBe(2);
  expect(Array.from(image.data)).toEqual([255, 0, 0, 255, 0, 0, 255, 255]);
});

test("stitch follows the chosen screen order", async () => {
  const stitched = await stitchProjects([screen(0, 0, 255), screen(255, 0, 0)]);
  const image = await pixels(stitched);

  expect(Array.from(image.data)).toEqual([0, 0, 255, 255, 255, 0, 0, 255]);
});

test("stitch is as wide as the widest screen", async () => {
  const stitched = await stitchProjects([
    screen(255, 0, 0, 2, 1),
    screen(0, 0, 255, 1, 1),
  ]);
  const image = await pixels(stitched);

  expect(image.width).toBe(2);
  expect(image.height).toBe(2);
  expect(Array.from(image.data)).toEqual([
    255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0,
  ]);
});

test("the tall result exports as a jpeg and a webp", async () => {
  const stitched = await stitchProjects([screen(255, 0, 0), screen(0, 0, 255)]);

  const jpeg = await exportFlattened(stitched, { format: "jpeg", quality: 80 });
  const webp = await exportFlattened(stitched, {
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
