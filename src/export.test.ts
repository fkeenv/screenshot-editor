import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { beforeAll, expect, test } from "vitest";
import {
  addImageLayer,
  addTextLayer,
  editTextLayer,
  moveLayer,
  openProject,
  setCanvasSize,
  setLayerOpacity,
  setLayerVisibility,
  setView,
} from "./editor";
import {
  exportFlattened,
  prepareExportCodecs,
  prepareExportEnvironment,
} from "./export";

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

async function readPixels(bytes: Uint8Array) {
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

test("export produces a png of the canvas", async () => {
  let project = setCanvasSize(openProject(), 4, 2);
  project = setView(project, 3, 12, -8);

  const exported = await exportFlattened(project, {
    format: "png",
    quality: 80,
  });

  expect(exported.mediaType).toBe("image/png");
  const image = await readPixels(exported.bytes);
  expect(image.width).toBe(4);
  expect(image.height).toBe(2);
  expect(Array.from(image.data)).toEqual(Array(32).fill(0));
});

test("export produces a jpeg and a webp of the canvas", async () => {
  const project = setCanvasSize(openProject(), 3, 2);

  const jpeg = await exportFlattened(project, { format: "jpeg", quality: 80 });
  const webp = await exportFlattened(project, { format: "webp", quality: 80 });

  expect(jpeg.mediaType).toBe("image/jpeg");
  expect(webp.mediaType).toBe("image/webp");
  expect(Array.from(jpeg.bytes.slice(0, 2))).toEqual([0xff, 0xd8]);
  expect(Array.from(webp.bytes.slice(0, 4))).toEqual([
    0x52, 0x49, 0x46, 0x46,
  ]);
  expect(Array.from(webp.bytes.slice(8, 12))).toEqual([
    0x57, 0x45, 0x42, 0x50,
  ]);
  const jpegImage = await readPixels(jpeg.bytes);
  const webpImage = await readPixels(webp.bytes);
  expect(jpegImage.width).toBe(3);
  expect(jpegImage.height).toBe(2);
  expect(webpImage.width).toBe(3);
  expect(webpImage.height).toBe(2);
});

function solidPng(red: number, green: number, blue: number): string {
  const canvas = createCanvas(1, 1);
  const context = canvas.getContext("2d");
  context.fillStyle = `rgb(${red} ${green} ${blue})`;
  context.fillRect(0, 0, 1, 1);
  return `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`;
}

test("export paints an image layer onto the canvas", async () => {
  let project = setCanvasSize(openProject(), 2, 2);
  project = addImageLayer(project, {
    id: "image-1",
    name: "Red",
    source: solidPng(255, 0, 0),
    format: "image/png",
    width: 1,
    height: 1,
  });
  project = moveLayer(project, "image-1", 1, 0);

  const exported = await exportFlattened(project, { format: "png", quality: 80 });
  const image = await readPixels(exported.bytes);

  expect(Array.from(image.data.slice(4, 8))).toEqual([255, 0, 0, 255]);
  expect(Array.from(image.data.slice(0, 4))).toEqual([0, 0, 0, 0]);
});

function noisyPng(size: number): string {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  const image = context.getImageData(0, 0, size, size);
  let state = 99;
  for (let index = 0; index < image.data.length; index += 4) {
    state = (state * 1664525 + 1013904223) >>> 0;
    image.data[index] = state & 255;
    state = (state * 1664525 + 1013904223) >>> 0;
    image.data[index + 1] = state & 255;
    state = (state * 1664525 + 1013904223) >>> 0;
    image.data[index + 2] = state & 255;
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`;
}

test("lowering quality makes the jpeg and webp smaller", async () => {
  let project = setCanvasSize(openProject(), 48, 48);
  project = addImageLayer(project, {
    id: "image-1",
    name: "Noise",
    source: noisyPng(48),
    format: "image/png",
    width: 48,
    height: 48,
  });

  const jpegHigh = await exportFlattened(project, { format: "jpeg", quality: 80 });
  const jpegLow = await exportFlattened(project, { format: "jpeg", quality: 20 });
  const webpHigh = await exportFlattened(project, {
    format: "webp",
    quality: 80,
    lossless: false,
  });
  const webpLow = await exportFlattened(project, {
    format: "webp",
    quality: 20,
    lossless: false,
  });

  expect(jpegLow.bytes.length).toBeLessThan(jpegHigh.bytes.length);
  expect(webpLow.bytes.length).toBeLessThan(webpHigh.bytes.length);
});

test("lossless png and webp keep the full image", async () => {
  let project = setCanvasSize(openProject(), 32, 32);
  project = addImageLayer(project, {
    id: "image-1",
    name: "Noise",
    source: noisyPng(32),
    format: "image/png",
    width: 32,
    height: 32,
  });

  const png = await exportFlattened(project, { format: "png", quality: 20 });
  const lossless = await exportFlattened(project, {
    format: "webp",
    quality: 20,
    lossless: true,
  });
  const lossy = await exportFlattened(project, {
    format: "webp",
    quality: 20,
    lossless: false,
  });
  const pngPixels = Array.from((await readPixels(png.bytes)).data);
  const losslessPixels = Array.from((await readPixels(lossless.bytes)).data);
  const lossyPixels = Array.from((await readPixels(lossy.bytes)).data);

  expect(losslessPixels).toEqual(pngPixels);
  expect(lossyPixels).not.toEqual(pngPixels);
});

test("a transparent png keeps empty canvas transparent and a jpeg stays opaque", async () => {
  const project = setCanvasSize(openProject(), 2, 2);
  const png = await readPixels(
    (await exportFlattened(project, { format: "png", quality: 80 })).bytes,
  );
  const jpeg = await readPixels(
    (await exportFlattened(project, { format: "jpeg", quality: 80 })).bytes,
  );

  expect(Array.from(png.data)).toEqual(Array(16).fill(0));
  for (let index = 0; index < jpeg.data.length; index += 4) {
    expect(jpeg.data[index]).toBeGreaterThanOrEqual(16);
    expect(jpeg.data[index]).toBeLessThanOrEqual(18);
    expect(jpeg.data[index + 1]).toBeGreaterThanOrEqual(23);
    expect(jpeg.data[index + 1]).toBeLessThanOrEqual(25);
    expect(jpeg.data[index + 2]).toBeGreaterThanOrEqual(38);
    expect(jpeg.data[index + 2]).toBeLessThanOrEqual(40);
    expect(jpeg.data[index + 3]).toBe(255);
  }
});

test("hidden layers are left out and opacity is kept", async () => {
  let project = setCanvasSize(openProject(), 1, 1);
  project = addImageLayer(project, {
    id: "image-1",
    name: "Red",
    source: solidPng(255, 0, 0),
    format: "image/png",
    width: 1,
    height: 1,
  });
  project = setLayerOpacity(project, "image-1", 0.5);

  const faded = await readPixels(
    (await exportFlattened(project, { format: "png", quality: 80 })).bytes,
  );
  expect(Array.from(faded.data)).toEqual([255, 0, 0, 128]);

  project = setLayerVisibility(project, "image-1", false);
  const hidden = await readPixels(
    (await exportFlattened(project, { format: "png", quality: 80 })).bytes,
  );
  expect(Array.from(hidden.data)).toEqual([0, 0, 0, 0]);
});

test("an upper image covers a lower image", async () => {
  let project = setCanvasSize(openProject(), 1, 1);
  project = addImageLayer(project, {
    id: "image-1",
    name: "Blue",
    source: solidPng(0, 0, 255),
    format: "image/png",
    width: 1,
    height: 1,
  });
  project = addImageLayer(project, {
    id: "image-2",
    name: "Red",
    source: solidPng(255, 0, 0),
    format: "image/png",
    width: 1,
    height: 1,
  });

  const image = await readPixels(
    (await exportFlattened(project, { format: "png", quality: 80 })).bytes,
  );
  expect(Array.from(image.data)).toEqual([255, 0, 0, 255]);
});

test("export paints colored text", async () => {
  let project = setCanvasSize(openProject(), 80, 40);
  project = addTextLayer(project, "text-1", { x: 0, y: 0 });
  project = editTextLayer(project, "text-1", {
    text: "M",
    colorRuns: [{ start: 0, end: 1, color: "#ff00ff" }],
    fontFamily: "Arial",
    fontSize: 32,
    bold: true,
    outlineWidth: 0,
    wrapWidth: 80,
  });

  const image = await readPixels(
    (await exportFlattened(project, { format: "png", quality: 80 })).bytes,
  );
  const painted = [];
  for (let index = 0; index < image.data.length; index += 4) {
    const red = image.data[index] ?? 0;
    const green = image.data[index + 1] ?? 0;
    const blue = image.data[index + 2] ?? 0;
    const alpha = image.data[index + 3] ?? 0;
    if (red > 200 && blue > 200 && green < 40 && alpha > 200) painted.push(index);
  }
  expect(painted.length).toBeGreaterThan(0);
});
