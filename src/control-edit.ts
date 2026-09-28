import { useRef } from "react";

export type ControlEdit = {
  preview(value: number): void;
  finish(): void;
  cancel(): void;
};

export type ControlEditLifetime = {
  pointerDown(): void;
  pointerUp(): void;
  pointerCancel(): void;
  keyDown(key: string): void;
  keyUp(key: string): void;
  blur(): void;
  preview(value: number): void;
  changeEnd(): void;
};

export function createControlEditLifetime(
  beginEdit: () => ControlEdit,
): ControlEditLifetime {
  let activeEdit: ControlEdit | undefined;
  let input: "pointer" | "keyboard" | undefined;

  function begin(nextInput?: typeof input) {
    activeEdit ??= beginEdit();
    input ??= nextInput;
    return activeEdit;
  }

  function finish() {
    const edit = activeEdit;
    activeEdit = undefined;
    input = undefined;
    edit?.finish();
  }

  function cancel() {
    const edit = activeEdit;
    activeEdit = undefined;
    input = undefined;
    edit?.cancel();
  }

  return {
    pointerDown: () => void begin("pointer"),
    pointerUp: finish,
    pointerCancel: cancel,
    keyDown: (key) =>
      key === "Escape" ? cancel() : void begin("keyboard"),
    keyUp: (key) => (key === "Escape" ? cancel() : finish()),
    blur: finish,
    preview: (value) => begin().preview(value),
    changeEnd: () => {
      if (input !== "keyboard") finish();
    },
  };
}

export function useControlEditLifetime(
  beginEdit: () => ControlEdit,
): ControlEditLifetime {
  const beginEditRef = useRef(beginEdit);
  beginEditRef.current = beginEdit;
  const lifetime = useRef<ControlEditLifetime | undefined>(undefined);
  lifetime.current ??= createControlEditLifetime(() => beginEditRef.current());
  return lifetime.current;
}
