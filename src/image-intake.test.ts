// @vitest-environment jsdom
import { expect, test } from "vitest";
import { prepareImageImport, transferredImage } from "./image-intake";

test("unsupported images are rejected before changing the project", async () => {
  await expect(
    prepareImageImport(
      new File(["svg"], "drawing.svg", { type: "image/svg+xml" }),
    ),
  ).rejects.toThrow("Choose a JPG, PNG, WebP, GIF, or BMP image.");
});

test("transfer selects the first image, not unrelated files or a later supported image", () => {
  const text = new File(["note"], "note.txt", { type: "text/plain" });
  const svg = new File(["svg"], "first.svg", { type: "image/svg+xml" });
  const png = new File(["png"], "second.png", { type: "image/png" });
  expect(
    transferredImage({ files: [text, svg, png] } as unknown as DataTransfer),
  ).toBe(svg);
  expect(
    transferredImage({ files: [text] } as unknown as DataTransfer),
  ).toBeUndefined();
  expect(
    transferredImage({
      files: [new File(["png"], "unnamed.png")],
    } as unknown as DataTransfer)?.name,
  ).toBe("unnamed.png");
});

test("clipboard file items work when the files list is empty", () => {
  const image = new File(["png"], "Clipboard.png", { type: "image/png" });
  const transfer = {
    files: [],
    items: [
      { kind: "string", getAsFile: () => null },
      { kind: "file", getAsFile: () => image },
    ],
  } as unknown as DataTransfer;
  expect(transferredImage(transfer)).toBe(image);
});
