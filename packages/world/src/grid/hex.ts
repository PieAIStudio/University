/**
 * Small, renderer-free axial hex helpers.
 *
 * The map uses pointy-top axial coordinates. Keeping the coordinate system
 * here, instead of in a Three.js component, makes route and topology rules
 * cheap to test and safe to move to a worker later.
 */

export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;

export const HEX_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
] as const;

export function hexKey(cell: HexCoord): string {
  return `${cell.q},${cell.r}`;
}

export function hexNeighbor(cell: HexCoord, direction: HexDirection): HexCoord {
  const offset = HEX_DIRECTIONS[direction];
  return { q: cell.q + offset.q, r: cell.r + offset.r };
}

export function hexNeighbors(cell: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map((_, direction) => hexNeighbor(cell, direction as HexDirection));
}

export function hexDistance(first: HexCoord, second: HexCoord): number {
  const dq = first.q - second.q;
  const dr = first.r - second.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/** Pointy-top axial projection. `size` is the centre-to-corner radius. */
export function hexToWorld(
  cell: HexCoord,
  size: number,
): { readonly x: number; readonly z: number } {
  return {
    x: size * Math.sqrt(3) * (cell.q + cell.r / 2),
    z: size * 1.5 * cell.r,
  };
}

export function hexRing(center: HexCoord, radius: number): HexCoord[] {
  if (radius === 0) return [{ ...center }];
  const start = {
    q: center.q + HEX_DIRECTIONS[4]!.q * radius,
    r: center.r + HEX_DIRECTIONS[4]!.r * radius,
  };
  const cells: HexCoord[] = [];
  let current = start;
  for (const direction of HEX_DIRECTIONS) {
    for (let step = 0; step < radius; step += 1) {
      cells.push(current);
      current = {
        q: current.q + direction.q,
        r: current.r + direction.r,
      };
    }
  }
  return cells;
}

export function hexSpiral(center: HexCoord, radius: number): HexCoord[] {
  const cells = [{ ...center }];
  for (let ring = 1; ring <= radius; ring += 1) cells.push(...hexRing(center, ring));
  return cells;
}
