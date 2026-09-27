import { LEAGUE_TIERS, badgesFor, emptyProgress } from "@pieai/university-core";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { emblemImageKey } from "./emblem-images.js";
import { BADGE_LOOKS, RANK_LOOKS } from "./emblem-looks.js";
import { buildBadgeEmblem, buildRankEmblem, type Emblem } from "./emblems.js";

/** Drawn triangles, outlines included: each emblem is rendered once to an image. */
function triangles(emblem: Emblem): number {
  let count = 0;
  emblem.group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    count += (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
  });
  return count;
}

function colours(emblem: Emblem): Set<string> {
  const found = new Set<string>();
  emblem.group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (material.color && material.side !== THREE.BackSide)
      found.add(material.color.getHexString());
  });
  return found;
}

describe("the emblems", () => {
  it("give every badge core knows a look of its own, and no look to a badge it does not", () => {
    const ids = badgesFor(emptyProgress()).map((badge) => badge.id);
    expect(Object.keys(BADGE_LOOKS).sort()).toEqual([...ids].sort());
  });

  it("give every rank on the ladder a look", () => {
    expect(Object.keys(RANK_LOOKS).sort()).toEqual(LEAGUE_TIERS.map((tier) => tier.id).sort());
  });

  it("grow wings from gold up, and a crown only at the top", () => {
    const wings = LEAGUE_TIERS.map((tier) => {
      const emblem = buildRankEmblem(tier.id);
      const count = emblem.wings.length;
      emblem.dispose();
      return count;
    });
    expect(wings).toEqual([0, 0, 0, 2, 2]);
  });

  it("draw a locked badge in grey rather than its family colour", () => {
    const earned = buildBadgeEmblem("streak-7");
    const locked = buildBadgeEmblem("streak-7", { locked: true });
    // The streak family's face is orange; locked, no orange is left.
    expect(colours(earned).has("ff6b3d")).toBe(true);
    expect(colours(locked).has("ff6b3d")).toBe(false);
    earned.dispose();
    locked.dispose();
  });

  it("stay cheap enough to draw a wall of them in one pass", () => {
    const all = [
      ...LEAGUE_TIERS.map((tier) => buildRankEmblem(tier.id)),
      ...Object.keys(BADGE_LOOKS).map((id) => buildBadgeEmblem(id)),
    ];
    const most = Math.max(...all.map(triangles));
    for (const emblem of all) emblem.dispose();
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThan(60_000);
  });

  it("cache an image per emblem, state and size", () => {
    const keys = new Set([
      emblemImageKey("badge", "streak-7"),
      emblemImageKey("badge", "streak-7", { locked: true }),
      emblemImageKey("badge", "streak-7", { size: 64 }),
      emblemImageKey("rank", "gold"),
    ]);
    expect(keys.size).toBe(4);
    expect(emblemImageKey("badge", "streak-7")).toBe(emblemImageKey("badge", "streak-7", {}));
  });
});
