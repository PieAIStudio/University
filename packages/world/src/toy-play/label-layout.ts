export interface TargetLabel {
  id: number;
  targetX: number;
  targetY: number;
  width: number;
  height: number;
  priority: number;
}
export interface PlacedLabel extends TargetLabel {
  x: number;
  y: number;
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const overlaps = (a: PlacedLabel, b: PlacedLabel) =>
  a.x < b.x + b.width + 8 &&
  a.x + a.width + 8 > b.x &&
  a.y < b.y + b.height + 8 &&
  a.y + a.height + 8 > b.y;

/** At most three readable DOM labels. Leaders retain the actual target anchors.
 * Closest targets get first placement; text never shrinks to hide collisions. */
export function layoutTargetLabels(
  items: readonly TargetLabel[],
  width: number,
  height: number,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  for (const item of [...items].sort((a, b) => b.priority - a.priority || a.id - b.id)) {
    const label: PlacedLabel = {
      ...item,
      x: clamp(item.targetX - item.width / 2, 8, width - item.width - 8),
      y: clamp(item.targetY - item.height - 16, 44, height - item.height - 64),
    };
    for (let pass = 0; pass < placed.length + 1; pass++) {
      const clashes = placed.filter((p) => overlaps(label, p));
      if (!clashes.length) break;
      label.y = Math.min(...clashes.map((p) => p.y)) - label.height - 8;
    }
    if (label.y < 44) {
      label.y = 44;
      label.x = clamp(
        item.targetX < width / 2 ? width - item.width - 8 : 8,
        8,
        width - item.width - 8,
      );
      for (let pass = 0; pass < placed.length + 1; pass++) {
        const clashes = placed.filter((p) => overlaps(label, p));
        if (!clashes.length) break;
        label.y = Math.max(...clashes.map((p) => p.y + p.height)) + 8;
      }
    }
    placed.push(label);
  }
  return placed;
}
