import { useEffect, useState } from "react";
import type { RectangleLayer, RectangleLayerEdit } from "./editor";

function GeometryField({
  field,
  value,
  onEdit,
}: {
  field: "x" | "y" | "width" | "height";
  value: number;
  onEdit: (changes: RectangleLayerEdit) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const label = field.length === 1 ? field.toUpperCase() : field;

  function commit() {
    const next = Number(draft);
    if (
      draft.trim() &&
      Number.isFinite(next) &&
      (field === "x" || field === "y" || next > 0)
    ) {
      if (next !== value) onEdit({ [field]: next });
      setDraft(String(next));
    } else setDraft(String(value));
  }

  return (
    <label>
      {label.charAt(0).toUpperCase() + label.slice(1)}
      <input
        type="number"
        step="any"
        min={field === "width" || field === "height" ? 1 : undefined}
        aria-label={`Rectangle ${label}`}
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

export function RectangleControls({
  layer,
  onEdit,
}: {
  layer: RectangleLayer;
  onEdit: (changes: RectangleLayerEdit) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-[12px] mt-[12px]">
      <h3 className="property-section-title">Rectangle</h3>
      <label className="col-span-2">
        Fill color
        <input
          type="color"
          aria-label="Rectangle fill color"
          value={layer.fill}
          onChange={(event) => onEdit({ fill: event.target.value })}
        />
      </label>
      {(["x", "y", "width", "height"] as const).map((field) => (
        <GeometryField
          key={field}
          field={field}
          value={layer[field]}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
