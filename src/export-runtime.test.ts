import { createCanvas, loadImage } from "@napi-rs/canvas";
import { expect, test } from "vitest";
import { openProject } from "./editor";
import { createExportRuntime } from "./export";
import { createNodeExportRuntime } from "./test/createNodeExportRuntime";

function failingRuntime(message: string) {
  return createExportRuntime({
    initializeCodecs: () => Promise.reject(new Error(message)),
    createRaster() {
      throw new Error("Raster creation should not run before codec setup.");
    },
    loadImage() {
      throw new Error("Image loading should not run before codec setup.");
    },
  });
}

test("export runtimes keep codec failures isolated", async () => {
  const first = failingRuntime("First runtime could not start codecs.");
  const second = failingRuntime("Second runtime could not start codecs.");
  const options = { format: "png", quality: 80 } as const;

  await expect(first.exportFlattened(openProject(), options)).rejects.toThrow(
    "First runtime could not start codecs.",
  );
  await expect(second.exportFlattened(openProject(), options)).rejects.toThrow(
    "Second runtime could not start codecs.",
  );
});

test("an export runtime initializes its codecs once", async () => {
  let initializationCount = 0;
  const runtime = createNodeExportRuntime(() => {
    initializationCount += 1;
  });
  const options = { format: "png", quality: 80 } as const;

  const first = await runtime.exportFlattened(openProject(), options);
  const second = await runtime.exportFlattened(openProject(), options);

  expect(initializationCount).toBe(1);
  expect(first.mediaType).toBe("image/png");
  expect(Array.from(first.bytes.slice(0, 8))).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  expect(second.mediaType).toBe("image/png");
});

test("an export runtime caches a synchronous codec failure", async () => {
  let initializationCount = 0;
  const runtime = createExportRuntime({
    initializeCodecs() {
      initializationCount += 1;
      throw new Error("Codec setup failed synchronously.");
    },
    createRaster() {
      throw new Error("Raster creation should not run before codec setup.");
    },
    loadImage() {
      throw new Error("Image loading should not run before codec setup.");
    },
  });
  const options = { format: "png", quality: 80 } as const;

  await expect(runtime.exportFlattened(openProject(), options)).rejects.toThrow(
    "Codec setup failed synchronously.",
  );
  await expect(runtime.exportFlattened(openProject(), options)).rejects.toThrow(
    "Codec setup failed synchronously.",
  );
  expect(initializationCount).toBe(1);
});

function runtimeWithPngByte(byte: number) {
  return createExportRuntime({
    async initializeCodecs() {
      return {
        encodePng: async () => new Uint8Array([byte]),
        encodeJpeg: async () => new Uint8Array([byte]),
        encodeWebp: async () => new Uint8Array([byte]),
      };
    },
    createRaster(width, height) {
      return createCanvas(width, height) as never;
    },
    loadImage(source) {
      return loadImage(source) as never;
    },
  });
}

test("export runtimes use their own codec adapters", async () => {
  const first = runtimeWithPngByte(17);
  const second = runtimeWithPngByte(29);
  const options = { format: "png", quality: 80 } as const;

  expect(
    Array.from((await first.exportFlattened(openProject(), options)).bytes),
  ).toEqual([17]);
  expect(
    Array.from((await second.exportFlattened(openProject(), options)).bytes),
  ).toEqual([29]);
});
