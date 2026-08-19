import { describe, expect, it } from "vitest";

import { placeLabels, type LabelCandidate, type LabelPlacement } from "./labels";

const VIEW = { width: 800, height: 600 } as const;

function candidate(partial: Partial<LabelCandidate> & Pick<LabelCandidate, "id">): LabelCandidate {
  return {
    x: 200,
    y: 200,
    z: 0.2,
    width: 80,
    height: 20,
    ...partial,
  };
}

function byId(placed: readonly LabelPlacement[], id: string): LabelPlacement {
  const found = placed.find((entry) => entry.id === id);
  expect(found).toBeDefined();
  return found as LabelPlacement;
}

function boxesClash(
  left: LabelPlacement,
  right: LabelPlacement,
  leftSize: Pick<LabelCandidate, "width" | "height">,
  rightSize: Pick<LabelCandidate, "width" | "height">,
  gap: number,
): boolean {
  const a = {
    left: left.x - leftSize.width / 2,
    top: left.y - leftSize.height / 2,
    right: left.x + leftSize.width / 2,
    bottom: left.y + leftSize.height / 2,
  };
  const b = {
    left: right.x - rightSize.width / 2,
    top: right.y - rightSize.height / 2,
    right: right.x + rightSize.width / 2,
    bottom: right.y + rightSize.height / 2,
  };
  return (
    a.left < b.right + gap &&
    a.right + gap > b.left &&
    a.top < b.bottom + gap &&
    a.bottom + gap > b.top
  );
}

describe("placeLabels", () => {
  it("keeps one of two overlapping names at the preferred slot and moves or hides the other", () => {
    const near = candidate({ id: "near", z: 0.1 });
    const far = candidate({ id: "far", z: 0.4 });
    const placed = placeLabels([near, far], VIEW);
    const kept = byId(placed, "near");
    const other = byId(placed, "far");

    expect(kept.visible).toBe(true);
    expect(kept.x).toBe(near.x);
    expect(kept.y).toBe(near.y - near.height / 2);

    if (other.visible) {
      expect(other.x === kept.x && other.y === kept.y).toBe(false);
      expect(boxesClash(kept, other, near, far, 4)).toBe(false);
    } else {
      expect(other.visible).toBe(false);
    }
  });

  it("hides a candidate whose anchor sits outside the viewport", () => {
    const placed = placeLabels(
      [candidate({ id: "off", x: -200, y: 80 }), candidate({ id: "on", x: 120, y: 80, z: 0.3 })],
      VIEW,
    );
    expect(byId(placed, "off").visible).toBe(false);
    expect(byId(placed, "on").visible).toBe(true);
  });

  it("lets a heavier label win even when it is farther away", () => {
    const here = candidate({ id: "here", z: 0.9, weight: 10 });
    const neighbour = candidate({ id: "neighbour", z: 0.1, weight: 1 });
    const placed = placeLabels([neighbour, here], VIEW);
    const winner = byId(placed, "here");

    expect(winner.visible).toBe(true);
    expect(winner.x).toBe(here.x);
    expect(winner.y).toBe(here.y - here.height / 2);
  });

  it("hides overflow once maxVisible is reached", () => {
    const candidates = [
      candidate({ id: "a", x: 120, y: 160, z: 0.1 }),
      candidate({ id: "b", x: 360, y: 160, z: 0.2 }),
      candidate({ id: "c", x: 600, y: 160, z: 0.3 }),
    ];
    const placed = placeLabels(candidates, VIEW, { maxVisible: 2 });
    expect(placed.filter((entry) => entry.visible).map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(byId(placed, "c").visible).toBe(false);
  });

  it("returns the same placements for the same input", () => {
    const candidates = [
      candidate({ id: "here", x: 240, y: 180, z: 0.5, weight: 8 }),
      candidate({ id: "near", x: 250, y: 184, z: 0.2 }),
      candidate({ id: "off", x: 900, y: 40, z: 0.1 }),
    ];
    const options = { maxVisible: 8, gap: 6 } as const;
    expect(placeLabels(candidates, VIEW, options)).toEqual(placeLabels(candidates, VIEW, options));
  });

  it("keeps a 41-lesson pile readable: visible labels never intersect", () => {
    const candidates: LabelCandidate[] = Array.from({ length: 41 }, (_, index) => ({
      id: `lesson-${index}`,
      x: 360 + (index % 4) * 22,
      y: 240 + Math.floor(index / 4) * 16,
      z: 0.15 + index * 0.002,
      width: 88,
      height: 18,
    }));
    const byCandidate = new Map(candidates.map((entry) => [entry.id, entry]));
    const placed = placeLabels(candidates, VIEW);
    const visible = placed.filter((entry) => entry.visible);

    expect(placed).toHaveLength(41);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThanOrEqual(12);

    for (let i = 0; i < visible.length; i += 1) {
      for (let j = i + 1; j < visible.length; j += 1) {
        const left = visible[i]!;
        const right = visible[j]!;
        const leftSize = byCandidate.get(left.id)!;
        const rightSize = byCandidate.get(right.id)!;
        expect(boxesClash(left, right, leftSize, rightSize, 4)).toBe(false);
      }
    }
  });
});
