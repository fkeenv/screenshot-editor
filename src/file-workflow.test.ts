import { expect, test, vi } from "vitest";
import {
  createFileWorkflow,
  type FileDialogAdapter,
} from "./file-workflow";

function adapter(): FileDialogAdapter {
  return {
    open: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(true),
  };
}

test("image imports use the image dialog", async () => {
  const dialogs = adapter();
  const files = createFileWorkflow(dialogs);

  await files.importImages();

  expect(dialogs.open).toHaveBeenCalledWith({
    kind: "images",
    multiple: false,
  });
});

test("stitch selection opens several project files in their chosen order", async () => {
  const dialogs = adapter();
  vi.mocked(dialogs.open).mockResolvedValue([
    { name: "second.screenshot-project.json", bytes: new Uint8Array([2]) },
    { name: "first.screenshot-project.json", bytes: new Uint8Array([1]) },
  ]);
  const files = createFileWorkflow(dialogs);

  const chosen = await files.openProjects({ multiple: true });

  expect(chosen.map((file) => file.name)).toEqual([
    "second.screenshot-project.json",
    "first.screenshot-project.json",
  ]);
  expect(dialogs.open).toHaveBeenCalledWith({
    kind: "projects",
    multiple: true,
  });
});

test("project and image saves carry Windows-friendly filenames and bytes", async () => {
  const dialogs = adapter();
  const files = createFileWorkflow(dialogs);

  await files.saveProject("saved project");
  await files.saveExport({
    bytes: new Uint8Array([1, 2, 3]),
    mediaType: "image/webp",
    filename: "stitch.webp",
  });

  expect(dialogs.save).toHaveBeenNthCalledWith(1, {
    kind: "project",
    filename: "untitled.screenshot-project.json",
    bytes: new TextEncoder().encode("saved project"),
    mediaType: "application/json",
  });
  expect(dialogs.save).toHaveBeenNthCalledWith(2, {
    kind: "image",
    filename: "stitch.webp",
    bytes: new Uint8Array([1, 2, 3]),
    mediaType: "image/webp",
  });
});
