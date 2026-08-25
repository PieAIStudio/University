import { seeded } from "./island/random.js";

export interface CloudPuff {
  readonly position: readonly [number, number, number];
  readonly scale: number;
}

/** Deterministic cloud sea, kept below the visible turf and shoreline. */
export function cloudPuffs(extent: number, mobile: boolean, level: number): CloudPuff[] {
  const random = seeded(`cloud-sea/${mobile ? "mobile" : "desktop"}`);
  const count = mobile ? 18 : 64;
  const radius = extent * 2.4;
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    return {
      position: [
        Math.cos(angle) * distance,
        level - random() * 1.6,
        Math.sin(angle) * distance,
      ] as const,
      // Big enough to read as weather, small enough not to masquerade as a
      // second island when the world map is zoomed out.
      scale: 3.2 + random() * 3.8,
    };
  });
}
