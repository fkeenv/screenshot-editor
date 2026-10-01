export function snapToGrid(value: number, spacing: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(spacing) || spacing <= 0) {
    return value;
  }
  return Math.round(value / spacing) * spacing || 0;
}
