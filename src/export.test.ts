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
  setCanvasBackground,
  setLayerOpacity,
  setLayerVisibility,
  setView,
} from "./editor";
import {
  exportFlattened,
  exportStitch,
  prepareExportCodecs,
  prepareExportEnvironment,
} from "./export";

const require = createRequire(import.meta.url);

test.each(["png", "webp"] as const)(
  "%s stitch preserves each project's background and transparent padding",
  async (format) => {
    const red = setCanvasBackground(setCanvasSize(openProject(), 2, 1), {
      kind: "solid",
      color: "#ff0000",
    });
    const transparent = setCanvasSize(openProject(), 4, 1);
    const blue = setCanvasBackground(setCanvasSize(openProject(), 1, 1), {
      kind: "solid",
      color: "#0000ff",
    });
    const image = await readPixels(
      (
        await exportStitch([red, transparent, blue], {
          format,
          quality: 100,
          lossless: true,
        })
      ).bytes,
    );
    expect(Array.from(image.data)).toEqual([
      255,
      0,
      0,
      255,
      255,
      0,
      0,
      255,
      ...Array(8).fill(0),
      ...Array(16).fill(0),
      0,
      0,
      255,
      255,
      ...Array(12).fill(0),
    ]);
  },
);

test("JPEG stitch uses each solid background and the fallback for transparent screens and padding", async () => {
  const red = setCanvasBackground(setCanvasSize(openProject(), 8, 16), {
    kind: "solid",
    color: "#ff0000",
  });
  const transparent = setCanvasSize(openProject(), 16, 16);
  const blue = setCanvasBackground(setCanvasSize(openProject(), 16, 16), {
    kind: "solid",
    color: "#0000ff",
  });
  const image = await readPixels(
    (
      await exportStitch([red, transparent, blue], {
        format: "jpeg",
        quality: 100,
      })
    ).bytes,
  );
  function pixel(x: number, y: number) {
    return Array.from(image.data.slice((y * 16 + x) * 4, (y * 16 + x) * 4 + 4));
  }
  for (const [actual, expected] of [
    [pixel(3, 8), [255, 0, 0, 255]],
    [pixel(12, 8), [17, 24, 39, 255]],
    [pixel(8, 24), [17, 24, 39, 255]],
    [pixel(8, 40), [0, 0, 255, 255]],
  ]) {
    expected.forEach((channel, index) =>
      expect(actual[index]).toBeCloseTo(channel, -1),
    );
  }
});

test.each(["png", "webp", "jpeg"] as const)(
  "%s uses a saved solid canvas background instead of preview colors",
  async (format) => {
    const project = setCanvasBackground(setCanvasSize(openProject(), 2, 2), {
      kind: "solid",
      color: "#ff0000",
    });
    const image = await readPixels(
      (await exportFlattened(project, { format, quality: 100, lossless: true }))
        .bytes,
    );
    for (let offset = 0; offset < image.data.length; offset += 4) {
      expect(image.data[offset]).toBeGreaterThanOrEqual(253);
      expect(image.data[offset + 1]).toBeLessThanOrEqual(2);
      expect(image.data[offset + 2]).toBeLessThanOrEqual(2);
      expect(image.data[offset + 3]).toBe(255);
    }
  },
);

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

test("stitch exports saved screens in order as one tall image", async () => {
  let red = setCanvasSize(openProject(), 2, 1);
  red = addImageLayer(red, {
    id: "red",
    name: "Red",
    source: solidPng(255, 0, 0),
    format: "image/png",
    width: 1,
    height: 1,
  });
  let blue = setCanvasSize(openProject(), 1, 2);
  blue = addImageLayer(blue, {
    id: "blue",
    name: "Blue",
    source: solidPng(0, 0, 255),
    format: "image/png",
    width: 1,
    height: 1,
  });

  const exported = await exportStitch([red, blue], {
    format: "png",
    quality: 80,
  });
  const image = await readPixels(exported.bytes);

  expect({ width: image.width, height: image.height }).toEqual({
    width: 2,
    height: 3,
  });
  expect(Array.from(image.data.slice(0, 4))).toEqual([255, 0, 0, 255]);
  expect(Array.from(image.data.slice(8, 12))).toEqual([0, 0, 255, 255]);
});

test("stitch needs at least two saved screens", async () => {
  await expect(
    exportStitch([openProject()], { format: "png", quality: 80 }),
  ).rejects.toThrow("Choose at least two saved screens");
});

test("stitch clips each screen to the bounds of its saved canvas", async () => {
  let red = setCanvasSize(openProject(), 1, 1);
  red = addImageLayer(red, {
    id: "red",
    name: "Red",
    source: solidPng(255, 0, 0),
    format: "image/png",
    width: 1,
    height: 1,
  });
  let overflow = setCanvasSize(openProject(), 1, 1);
  overflow = addImageLayer(overflow, {
    id: "overflow",
    name: "Overflow",
    source: solidPng(0, 0, 255),
    format: "image/png",
    width: 1,
    height: 1,
  });
  overflow = moveLayer(overflow, "overflow", 0, -1);

  const exported = await exportStitch([red, overflow], {
    format: "png",
    quality: 80,
  });
  const image = await readPixels(exported.bytes);

  expect(Array.from(image.data.slice(0, 4))).toEqual([255, 0, 0, 255]);
  expect(Array.from(image.data.slice(4, 8))).toEqual([0, 0, 0, 0]);
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

test.each(["png", "webp"] as const)(
  "%s flat and stitch exports keep transparent source pixels and layer opacity without preview colors",
  async (format) => {
    const source = createCanvas(2, 1);
    const context = source.getContext("2d");
    const pixels = context.createImageData(2, 1);
    pixels.data.set([255, 0, 0, 128, 0, 0, 255, 255]);
    context.putImageData(pixels, 0, 0);
    let project = addImageLayer(setCanvasSize(openProject(), 4, 2), {
      id: "translucent",
      name: "Transparent image",
      source: source.toDataURL(),
      format: "image/png",
      width: 2,
      height: 1,
    });
    project = setLayerOpacity(project, "translucent", 0.5);
    const expected = [255, 0, 0, 64, 0, 0, 255, 128, ...Array(24).fill(0)];
    const options = { format, quality: 80, lossless: true };
    const flat = await readPixels(
      (await exportFlattened(project, options)).bytes,
    );
    expect(Array.from(flat.data)).toEqual(expected);
    const stitched = await readPixels(
      (await exportStitch([project, project], options)).bytes,
    );
    expect(stitched.height).toBe(4);
    expect(Array.from(stitched.data)).toEqual([...expected, ...expected]);
  },
);

test("JPEG stitch retains its opaque flattening background rather than preview colors", async () => {
  const project = setCanvasSize(openProject(), 2, 2);
  const stitched = await readPixels(
    (await exportStitch([project, project], { format: "jpeg", quality: 80 }))
      .bytes,
  );
  expect(stitched.height).toBe(4);
  for (let index = 0; index < stitched.data.length; index += 4) {
    expect(stitched.data[index]).toBeGreaterThanOrEqual(16);
    expect(stitched.data[index]).toBeLessThanOrEqual(18);
    expect(stitched.data[index + 1]).toBeGreaterThanOrEqual(23);
    expect(stitched.data[index + 1]).toBeLessThanOrEqual(25);
    expect(stitched.data[index + 2]).toBeGreaterThanOrEqual(38);
    expect(stitched.data[index + 2]).toBeLessThanOrEqual(40);
    expect(stitched.data[index + 3]).toBe(255);
  }
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

test("export paints colored and outlined text", async () => {
  let project = setCanvasSize(openProject(), 80, 40);
  project = addTextLayer(project, "text-1", { x: 0, y: 0 });
  project = editTextLayer(project, "text-1", {
    text: "M",
    colorRuns: [{ start: 0, end: 1, color: "#ff00ff" }],
    fontFamily: "Arial",
    fontSize: 32,
    bold: true,
    outlineWidth: 2,
    outlineColor: "#000000",
    wrapWidth: 80,
  });

  const image = await readPixels(
    (await exportFlattened(project, { format: "png", quality: 80 })).bytes,
  );
  const painted = [];
  const outlined = [];
  for (let index = 0; index < image.data.length; index += 4) {
    const red = image.data[index] ?? 0;
    const green = image.data[index + 1] ?? 0;
    const blue = image.data[index + 2] ?? 0;
    const alpha = image.data[index + 3] ?? 0;
    if (red > 200 && blue > 200 && green < 40 && alpha > 200) painted.push(index);
    if (red < 40 && green < 40 && blue < 40 && alpha > 100) outlined.push(index);
  }
  expect(painted.length).toBeGreaterThan(0);
  expect(outlined.length).toBeGreaterThan(0);
});
