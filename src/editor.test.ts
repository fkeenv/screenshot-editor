import { expect, test } from "vitest";
import { openProject, redo, setCanvasSize, setView, undo } from "./editor";

test("a new project opens on a canvas with a visible size", () => {
  const project = openProject();

  expect(project.canvasWidth).toBe(800);
  expect(project.canvasHeight).toBe(600);
});

test("choosing 1150×600 changes the canvas", () => {
  const project = setCanvasSize(openProject(), 1150, 600);

  expect(project.canvasWidth).toBe(1150);
  expect(project.canvasHeight).toBe(600);
});

test("typing a custom width and height changes the canvas", () => {
  const project = setCanvasSize(openProject(), 640, 480);

  expect(project.canvasWidth).toBe(640);
  expect(project.canvasHeight).toBe(480);
});

test("zoom and pan change the view and leave the canvas size unchanged", () => {
  const sized = setCanvasSize(openProject(), 1150, 600);
  const project = setView(sized, 2, 40, -15);

  expect(project.zoom).toBe(2);
  expect(project.panX).toBe(40);
  expect(project.panY).toBe(-15);
  expect(project.canvasWidth).toBe(1150);
  expect(project.canvasHeight).toBe(600);
});

test("undo and redo restore the previous canvas size and view", () => {
  const resized = setCanvasSize(openProject(), 1150, 600);
  const viewed = setView(resized, 2, 10, 20);

  const afterViewUndo = undo(viewed);
  expect(afterViewUndo.zoom).toBe(1);
  expect(afterViewUndo.panX).toBe(0);
  expect(afterViewUndo.panY).toBe(0);
  expect(afterViewUndo.canvasWidth).toBe(1150);
  expect(afterViewUndo.canvasHeight).toBe(600);

  const afterSizeUndo = undo(afterViewUndo);
  expect(afterSizeUndo.canvasWidth).toBe(800);
  expect(afterSizeUndo.canvasHeight).toBe(600);

  const redone = redo(afterSizeUndo);
  expect(redone.canvasWidth).toBe(1150);
  expect(redone.canvasHeight).toBe(600);
  expect(redone.zoom).toBe(1);
});
