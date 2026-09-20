import { expect, it } from "vitest";
import { layoutTargetLabels } from "./label-layout.js";

it("separates three converging targets on phone and desktop without moving anchors", () => {
  for (const width of [292, 362, 750])
    for (const height of [570, 650]) {
      const items = [0, 1, 2].map((id) => ({
        id,
        targetX: width / 2 + id * 7,
        targetY: 275 + id * 4,
        width: 118,
        height: 72,
        priority: id,
      }));
      const result = layoutTargetLabels(items, width, height);
      for (const p of result) {
        expect(p.x).toBeGreaterThanOrEqual(8);
        expect(p.x + p.width).toBeLessThanOrEqual(width - 8);
        expect(p.y).toBeGreaterThanOrEqual(8);
        expect(p.y + p.height).toBeLessThan(height - 64);
        expect(p.targetX).toBe(items[p.id]!.targetX);
        expect(p.targetY).toBe(items[p.id]!.targetY);
      }
      for (let i = 0; i < result.length; i++)
        for (let j = i + 1; j < result.length; j++) {
          const a = result[i]!,
            b = result[j]!;
          expect(
            a.x < b.x + b.width &&
              a.x + a.width > b.x &&
              a.y < b.y + b.height &&
              a.y + a.height > b.y,
          ).toBe(false);
        }
    }
});
