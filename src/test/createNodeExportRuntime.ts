import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createExportRuntime } from "../export";

const require = createRequire(import.meta.url);

export function createNodeExportRuntime(onInitialize?: () => void) {
  return createExportRuntime({
    createRaster(width, height) {
      return createCanvas(width, height) as never;
    },
    loadImage(source) {
      return loadImage(source) as never;
    },
    async initializeCodecs() {
      onInitialize?.();
      const { default: encodePng, init: initPng } = await import(
        "@jsquash/png/encode"
      );
      const { default: encodeJpeg, init: initJpeg } = await import(
        "@jsquash/jpeg/encode"
      );
      const { default: encodeWebp, init: initWebp } = await import(
        "@jsquash/webp/encode"
      );
      await initPng(
        await readFile(
          require.resolve("@jsquash/png/codec/pkg/squoosh_png_bg.wasm"),
        ),
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
      return { encodePng, encodeJpeg, encodeWebp };
    },
  });
}
