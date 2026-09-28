import { expect, test, vi } from "vitest";
import { createControlEditLifetime } from "./control-edit";

test("repeated keyboard changes finish as one control edit on keyup", () => {
  const preview = vi.fn();
  const finish = vi.fn();
  const beginEdit = vi.fn(() => ({
    preview,
    finish,
    cancel: vi.fn(),
  }));
  const lifetime = createControlEditLifetime(beginEdit);

  lifetime.keyDown("ArrowRight");
  lifetime.preview(0.6);
  lifetime.changeEnd();
  lifetime.keyDown("ArrowRight");
  lifetime.preview(0.7);
  lifetime.changeEnd();

  expect(beginEdit).toHaveBeenCalledTimes(1);
  expect(preview.mock.calls).toEqual([[0.6], [0.7]]);
  expect(finish).not.toHaveBeenCalled();

  lifetime.keyUp("ArrowRight");
  expect(finish).toHaveBeenCalledTimes(1);
});
