export type PickedFile = {
  name: string;
  bytes: Uint8Array;
  mediaType?: string;
};

export type OpenDialogRequest = {
  kind: "images" | "projects";
  multiple: boolean;
};

export type SaveDialogRequest = {
  kind: "project" | "image";
  filename: string;
  bytes: Uint8Array;
  mediaType: string;
};

export type FileDialogAdapter = {
  open(request: OpenDialogRequest): Promise<PickedFile[]>;
  save(request: SaveDialogRequest): Promise<boolean>;
};

export type FileWorkflow = {
  importImages(): Promise<PickedFile[]>;
  openProjects(options?: { multiple?: boolean }): Promise<PickedFile[]>;
  saveProject(serialized: string): Promise<boolean>;
  saveExport(exported: {
    bytes: Uint8Array;
    mediaType: string;
    filename: string;
  }): Promise<boolean>;
};

export function createFileWorkflow(dialogs: FileDialogAdapter): FileWorkflow {
  return {
    importImages() {
      return dialogs.open({ kind: "images", multiple: false });
    },
    openProjects(options) {
      return dialogs.open({
        kind: "projects",
        multiple: options?.multiple ?? false,
      });
    },
    saveProject(serialized) {
      return dialogs.save({
        kind: "project",
        filename: "untitled.screenshot-project.json",
        bytes: new TextEncoder().encode(serialized),
        mediaType: "application/json",
      });
    },
    saveExport(exported) {
      return dialogs.save({
        kind: "image",
        filename: exported.filename,
        bytes: exported.bytes,
        mediaType: exported.mediaType,
      });
    },
  };
}

function chooseFiles(request: OpenDialogRequest): Promise<PickedFile[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept =
      request.kind === "images"
        ? ".jpg,.jpeg,.png,.webp,.gif,.bmp,image/jpeg,image/png,image/webp,image/gif,image/bmp"
        : ".screenshot-project.json,application/json";
    input.multiple = request.multiple;
    input.addEventListener(
      "change",
      () => {
        const selected = Array.from(input.files ?? []);
        void Promise.all(
          selected.map(async (file) => ({
            name: file.name,
            mediaType: file.type,
            bytes: new Uint8Array(await file.arrayBuffer()),
          })),
        ).then(resolve, reject);
      },
      { once: true },
    );
    input.addEventListener("cancel", () => resolve([]), { once: true });
    input.click();
  });
}

function downloadFile(request: SaveDialogRequest): Promise<boolean> {
  const copy = new Uint8Array(request.bytes.byteLength);
  copy.set(request.bytes);
  const blob = new Blob([copy.buffer], { type: request.mediaType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = request.filename;
  link.click();
  URL.revokeObjectURL(url);
  return Promise.resolve(true);
}

const browserDialogs: FileDialogAdapter = {
  open: chooseFiles,
  save: downloadFile,
};

declare global {
  interface Window {
    screenshotEditorFiles?: FileDialogAdapter;
  }
}

export function fileWorkflowForWindow(window: Window): FileWorkflow {
  return createFileWorkflow(window.screenshotEditorFiles ?? browserDialogs);
}
