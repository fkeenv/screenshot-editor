import { useRef } from "react";

export type ControlEdit<Value = number> = {
  preview(value: Value): void;
  finish(): void;
  cancel(): void;
};

export type ControlEditLifetime<Value = number> = {
  pointerDown(): void;
  pointerUp(): void;
  pointerCancel(): void;
  keyDown(key: string): void;
  keyUp(key: string): void;
  blur(): void;
  preview(value: Value): void;
  changeEnd(): void;
};

export function createControlEditLifetime<Value = number>(
  beginEdit: () => ControlEdit<Value>,
): ControlEditLifetime<Value> {
  let activeEdit: ControlEdit<Value> | undefined;
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

export function useControlEditLifetime<Value = number>(
  beginEdit: () => ControlEdit<Value>,
): ControlEditLifetime<Value> {
  const beginEditRef = useRef(beginEdit);
  beginEditRef.current = beginEdit;
  const lifetime = useRef<ControlEditLifetime<Value> | undefined>(undefined);
  lifetime.current ??= createControlEditLifetime(() => beginEditRef.current());
  return lifetime.current;
}
