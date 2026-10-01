import { supportedImageFormat, type ImageFormat } from "./editor";
import type { PickedFile } from "./file-workflow";

export const UNSUPPORTED_IMAGE_MESSAGE =
  "Choose a JPG, PNG, WebP, GIF, or BMP image.";

export function transferredImage(transfer: DataTransfer): File | undefined {
  const files = Array.from(transfer.files ?? []);
  if (!files.length) {
    for (const item of Array.from(transfer.items ?? [])) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files.find(
    (file) =>
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif|bmp|svg|avif|heic|tiff?)$/i.test(file.name),
  );
}

export async function prepareImageImport(file: PickedFile | File) {
  const format = supportedImageFormat(
    file.name,
    file instanceof File ? file.type : (file.mediaType ?? ""),
  );
  if (!format) throw new Error(UNSUPPORTED_IMAGE_MESSAGE);
  const blob =
    file instanceof File
      ? file.slice(0, file.size, format)
      : new Blob([new Uint8Array(file.bytes).buffer], { type: format });
  return new Promise<{
    name: string;
    format: ImageFormat;
    source: string;
    width: number;
    height: number;
  }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("The image could not be read."));
        return;
      }
      const source = reader.result;
      const image = new Image();
      image.onerror = () =>
        reject(new Error("The image could not be decoded."));
      image.onload = () => {
        if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
          reject(new Error("The image could not be decoded."));
          return;
        }
        resolve({
          name: file.name || `Screenshot.${format.slice(6)}`,
          format,
          source,
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };
      image.src = source;
    };
    reader.readAsDataURL(blob);
  });
}
