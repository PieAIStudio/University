import { describe, expect, it } from "vitest";

import {
  boxesOverlap,
  clampLabelOutOfChrome,
  labelBox,
  placeLabels,
  type LabelCandidate,
  type LabelPlacement,
} from "./labels";

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
  it("moves a quiet label across chrome and around a visible label", () => {
    const chrome = { left: 16, top: 16, right: 92, bottom: 584 };
    const reserved = [{ left: 100, top: 260, right: 320, bottom: 284 }];
    const position = clampLabelOutOfChrome(
      { x: 40, y: 272, width: 220, height: 20 },
      chrome,
      VIEW,
      { reserved },
    );
    const box = labelBox(position, 220, 20);

    expect(box.left).toBe(100);
    expect(boxesOverlap(box, chrome, 0)).toBe(false);
    expect(reserved.some((other) => boxesOverlap(box, other, 4))).toBe(false);
    expect(position.y).toBeGreaterThan(272);
  });

  it("leaves a label alone when it is outside chrome", () => {
    const position = clampLabelOutOfChrome(
      { x: 400, y: 200, width: 80, height: 20 },
      { left: 16, top: 16, right: 92, bottom: 584 },
      VIEW,
    );

    expect(position).toEqual({ x: 400, y: 200 });
  });

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

  it("keeps a name off a reserved icon box", () => {
    const icon = { left: 160, top: 190, right: 240, bottom: 230 };
    const placed = placeLabels([candidate({ id: "name", x: 200, y: 210, z: 0.2 })], VIEW, {
      reserved: [icon],
    });
    const name = byId(placed, "name");
    expect(name.visible).toBe(true);
    const size = { width: 80, height: 20 };
    const box = {
      left: name.x - size.width / 2,
      top: name.y - size.height / 2,
      right: name.x + size.width / 2,
      bottom: name.y + size.height / 2,
    };
    const gap = 4;
    const clash =
      box.left < icon.right + gap &&
      box.right + gap > icon.left &&
      box.top < icon.bottom + gap &&
      box.bottom + gap > icon.top;
    expect(clash).toBe(false);
  });

  it("keeps a name off the mobile HUD when the path flips toward the viewer", () => {
    const phone = { width: 375, height: 812 } as const;
    // LabelProbe and the chrome reader use stage-local coordinates. On the
    // real phone shot the HUD is 14–183px down inside a stage that starts
    // below the top bar.
    const hud = { left: 14, top: 14, right: 361, bottom: 183 };
    const placed = placeLabels(
      [candidate({ id: "first-island", x: 220, y: 190, width: 220, height: 24 })],
      phone,
      { reserved: [hud] },
    );
    const name = byId(placed, "first-island");
    expect(name.visible).toBe(true);
    const box = labelBox({ x: name.x, y: name.y }, 220, 24);
    expect(boxesOverlap(box, hud, 4)).toBe(false);
  });

  it("sits an aside card to the right of its island, not on top of it", () => {
    const placed = placeLabels(
      [
        candidate({
          id: "card",
          x: 280,
          y: 300,
          width: 260,
          height: 160,
          anchor: "aside",
          clearance: 56,
        }),
      ],
      VIEW,
    );
    const card = byId(placed, "card");
    expect(card.visible).toBe(true);
    expect(card.x).toBeGreaterThan(280);
    const box = {
      left: card.x - 130,
      top: card.y - 80,
      right: card.x + 130,
      bottom: card.y + 80,
    };
    expect(box.left).toBeGreaterThanOrEqual(280);
    expect(280 >= box.left && 280 <= box.right && 300 >= box.top && 300 <= box.bottom).toBe(false);
  });

  it("flips an aside card around a reserved box on its preferred side", () => {
    // Island far enough from both edges that left and right both fit; a
    // reserved box occupies the preferred (right) slot, so the card must
    // take the left one rather than hiding.
    const reserved = { left: 460, top: 220, right: 720, bottom: 380 };
    const placed = placeLabels(
      [
        candidate({
          id: "card",
          x: 400,
          y: 300,
          width: 260,
          height: 160,
          anchor: "aside",
          clearance: 56,
        }),
      ],
      VIEW,
      { reserved: [reserved] },
    );
    const card = byId(placed, "card");
    expect(card.visible).toBe(true);
    expect(card.x).toBeLessThan(400);
  });

  it("does not move a name because an overlay card opened on top of it", () => {
    // Item the boss caught: click one island and the titles of neighbouring
    // islands slid away to make room for the card. The card is opaque and on
    // top; covering a name costs nothing, and moving one costs the reader the
    // belief that a name is attached to its island.
    const names = [
      candidate({ id: "left", x: 300, y: 300 }),
      candidate({ id: "right", x: 460, y: 320 }),
    ];
    const withoutCard = placeLabels(names, VIEW);
    const withCard = placeLabels(
      [
        ...names,
        candidate({
          id: "card",
          x: 380,
          y: 300,
          width: 260,
          height: 160,
          anchor: "aside",
          clearance: 56,
          weight: 100,
          overlay: true,
        }),
      ],
      VIEW,
    );
    for (const id of ["left", "right"]) {
      expect(byId(withCard, id)).toEqual(byId(withoutCard, id));
    }
    expect(byId(withCard, "card").visible).toBe(true);
  });

  it("shows an overlay card even where every slot is already taken", () => {
    // A card that hides because a study badge got there first is a click that
    // produced nothing. It is allowed to cover the badge.
    const placed = placeLabels(
      [
        candidate({
          id: "card",
          x: 400,
          y: 300,
          width: 260,
          height: 160,
          anchor: "aside",
          overlay: true,
        }),
      ],
      VIEW,
      { reserved: [{ left: 0, top: 0, right: VIEW.width, bottom: VIEW.height }] },
    );
    expect(byId(placed, "card").visible).toBe(true);
  });

  it("keeps a tall overlay card inside a narrow viewport when no beside slot fits", () => {
    const phone = { width: 390, height: 552 } as const;
    const placed = placeLabels(
      [
        candidate({
          id: "card",
          x: 171,
          y: 248,
          width: 320,
          height: 528,
          anchor: "aside",
          clearance: 56,
          overlay: true,
        }),
      ],
      phone,
    );
    const card = byId(placed, "card");
    const box = labelBox({ x: card.x, y: card.y }, 320, 528);

    expect(card.visible).toBe(true);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(phone.width);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(phone.height);
  });

  it("flips an aside card to the left when the island is on the right edge", () => {
    const placed = placeLabels(
      [
        candidate({
          id: "card",
          x: 760,
          y: 300,
          width: 260,
          height: 160,
          anchor: "aside",
          clearance: 56,
        }),
      ],
      VIEW,
    );
    const card = byId(placed, "card");
    expect(card.visible).toBe(true);
    expect(card.x).toBeLessThan(760);
    expect(card.x - 130).toBeGreaterThanOrEqual(0);
    expect(card.x + 130).toBeLessThanOrEqual(VIEW.width);
    const box = {
      left: card.x - 130,
      top: card.y - 80,
      right: card.x + 130,
      bottom: card.y + 80,
    };
    expect(760 >= box.left && 760 <= box.right && 300 >= box.top && 300 <= box.bottom).toBe(false);
  });

  it("places a start-anchored name at its projected point, not above it", () => {
    const placed = placeLabels(
      [candidate({ id: "unit", x: 120, y: 180, width: 100, height: 16, anchor: "start" })],
      VIEW,
    );
    const unit = byId(placed, "unit");
    expect(unit.visible).toBe(true);
    expect(unit.x).toBe(120);
    expect(unit.y).toBe(180);
  });

  /*
    Measured on a real phone-width map, not imagined: 《读懂一段逻辑》 sat at
    x=293 on a 375-wide screen and was placed running to x=411. Intersecting
    the frame is not the same as being readable inside it.
  */
  it("never places a name that hangs off the edge of a phone screen", () => {
    const phone = { width: 375, height: 812 } as const;
    const placed = placeLabels(
      [candidate({ id: "course", x: 352, y: 400, width: 118, height: 22 })],
      phone,
    );
    const course = byId(placed, "course");
    expect(course.visible).toBe(true);
    expect(course.x - 118 / 2).toBeGreaterThanOrEqual(0);
    expect(course.x + 118 / 2).toBeLessThanOrEqual(phone.width);
  });

  it("still shows a name too wide for the screen rather than dropping it", () => {
    const narrow = { width: 100, height: 600 } as const;
    const placed = placeLabels(
      [candidate({ id: "wide", x: 50, y: 300, width: 260, height: 20 })],
      narrow,
    );
    expect(byId(placed, "wide").visible).toBe(true);
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
