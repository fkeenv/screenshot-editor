import { useEffect, useState } from "react";
import type { ImageLayer } from "./editor";

function PositionField({
  axis,
  value,
  onCommit,
}: {
  axis: "x" | "y";
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  function commit() {
    const next = Number(draft);
    if (draft.trim() && Number.isFinite(next)) {
      if (next !== value) onCommit(next);
      setDraft(String(next));
    } else {
      setDraft(String(value));
    }
  }

  return (
    <label>
      {axis.toUpperCase()}
      <input
        aria-label={`Image ${axis.toUpperCase()}`}
        type="number"
        step="any"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setDraft(String(value));
          }
        }}
      />
    </label>
  );
}

export function ImagePositionControls({
  layer,
  onPosition,
}: {
  layer: ImageLayer;
  onPosition: (axis: "x" | "y", value: number) => void;
}) {
  return (
    <div className="control-group image-position-control">
      <span>Position (px)</span>
      <div className="position-fields">
        {(["x", "y"] as const).map((axis) => (
          <PositionField
            key={axis}
            axis={axis}
            value={layer[axis]}
            onCommit={(value) => onPosition(axis, value)}
          />
        ))}
      </div>
    </div>
  );
}
