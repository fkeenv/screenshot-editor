type Snapshot = {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;
};

export type Project = Snapshot & {
  past: Snapshot[];
  future: Snapshot[];
};

function snapshot(project: Project): Snapshot {
  return {
    canvasWidth: project.canvasWidth,
    canvasHeight: project.canvasHeight,
    zoom: project.zoom,
    panX: project.panX,
    panY: project.panY,
  };
}

function commit(project: Project, next: Snapshot): Project {
  return {
    ...next,
    past: [...project.past, snapshot(project)],
    future: [],
  };
}

export function openProject(): Project {
  return {
    canvasWidth: 800,
    canvasHeight: 600,
    zoom: 1,
    panX: 0,
    panY: 0,
    past: [],
    future: [],
  };
}

export function setCanvasSize(
  project: Project,
  canvasWidth: number,
  canvasHeight: number,
): Project {
  return commit(project, { ...snapshot(project), canvasWidth, canvasHeight });
}

export function setView(
  project: Project,
  zoom: number,
  panX: number,
  panY: number,
): Project {
  return commit(project, { ...snapshot(project), zoom, panX, panY });
}

export function undo(project: Project): Project {
  const previous = project.past.at(-1);
  if (!previous) return project;

  return {
    ...previous,
    past: project.past.slice(0, -1),
    future: [snapshot(project), ...project.future],
  };
}

export function redo(project: Project): Project {
  const next = project.future[0];
  if (!next) return project;

  return {
    ...next,
    past: [...project.past, snapshot(project)],
    future: project.future.slice(1),
  };
}
