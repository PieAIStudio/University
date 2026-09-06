/**
 * Convex clipping of one surface's triangles onto another's, in the XZ plane.
 *
 * The course terrain and its soil route are two different triangulations of the
 * same height field, and that is the whole problem this file exists to remove.
 * A ribbon vertex placed at the rendered terrain's height is only correct *at
 * that vertex*: between two of its own vertices the ribbon interpolates along
 * its own edges while the ground interpolates along the lattice's edges, so the
 * two linear functions cross. Measured on `turing-pact/foundations-before-zero`
 * on 2026-09-06, 22.7% of the route sat below the ground it was drawn on, by up
 * to 0.194 units, and no vertical lift small enough to look flush could hide it.
 *
 * The fix is to stop interpolating twice. Every route polygon is cut against
 * the terrain triangles it actually overlaps, and every vertex of every piece
 * takes its height from the barycentric interpolation of the one terrain
 * triangle that contains it. The route is then the rendered ground displaced by
 * a constant, which cannot cross it at any point, not only at the vertices.
 *
 * Nothing here knows about islands, routes or colour. It is convex polygon
 * clipping plus a bounded bucket index, kept in one file so the arithmetic that
 * has to be right is readable in one place.
 */

/**
 * A triangle of some surface: plan position in XZ, height in Y.
 *
 * `i0`/`i1`/`i2` are the triangle's vertex indices in the buffer it came from,
 * or -1 when the triangle is a free-standing one built for clipping. They are
 * carried because a clipped piece needs more than a height from the ground it
 * landed on — it needs the ground's *shading*, and that lives on those three
 * vertices.
 */
export interface SurfaceTriangle {
  readonly x0: number;
  readonly z0: number;
  readonly y0: number;
  readonly x1: number;
  readonly z1: number;
  readonly y1: number;
  readonly x2: number;
  readonly z2: number;
  readonly y2: number;
  readonly i0: number;
  readonly i1: number;
  readonly i2: number;
}

/** A point in the clipping plane. */
export interface PlanPoint {
  readonly x: number;
  readonly z: number;
}

/**
 * Twice the signed area of a plan polygon, positive when the winding is
 * counter-clockwise in the (x, z) axes as written.
 *
 * Sign convention, because it is the one thing here that is easy to get
 * backwards: a triangle whose face normal is +Y has a *negative* value from
 * this function. `(B-A) x (C-A)` for A=(0,0), B=(1,0), C=(0,1) is (0,-1,0), and
 * that same triangle measures +1 here. `upwardWinding` is the only place that
 * fact needs to be remembered.
 */
export function doubleSignedAreaXZ(points: readonly PlanPoint[]): number {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    total += current.x * next.z - next.x * current.z;
  }
  return total;
}

/** The same ring, ordered so a fan over it carries a +Y face normal. */
export function upwardWinding(points: readonly PlanPoint[]): readonly PlanPoint[] {
  return doubleSignedAreaXZ(points) > 0 ? [...points].reverse() : points;
}

/**
 * Barycentric weights of (x, z) against a triangle's plan projection.
 *
 * Returns `null` for a degenerate triangle rather than dividing by zero; the
 * caller drops that candidate, which is correct — a triangle with no plan area
 * covers no part of the route.
 */
export function barycentricXZ(
  triangle: SurfaceTriangle,
  x: number,
  z: number,
): readonly [number, number, number] | null {
  const denominator =
    (triangle.z1 - triangle.z2) * (triangle.x0 - triangle.x2) +
    (triangle.x2 - triangle.x1) * (triangle.z0 - triangle.z2);
  if (Math.abs(denominator) < 1e-12) return null;
  const first =
    ((triangle.z1 - triangle.z2) * (x - triangle.x2) +
      (triangle.x2 - triangle.x1) * (z - triangle.z2)) /
    denominator;
  const second =
    ((triangle.z2 - triangle.z0) * (x - triangle.x2) +
      (triangle.x0 - triangle.x2) * (z - triangle.z2)) /
    denominator;
  return [first, second, 1 - first - second];
}

/** Height of the triangle's own plane at (x, z). Outside the triangle it extrapolates. */
export function heightOnTriangle(triangle: SurfaceTriangle, x: number, z: number): number | null {
  const weights = barycentricXZ(triangle, x, z);
  if (!weights) return null;
  return triangle.y0 * weights[0] + triangle.y1 * weights[1] + triangle.y2 * weights[2];
}

function edgeSide(ax: number, az: number, bx: number, bz: number, px: number, pz: number): number {
  return (bx - ax) * (pz - az) - (bz - az) * (px - ax);
}

/**
 * Sutherland–Hodgman: the part of `subject` that lies inside `clip`.
 *
 * Both polygons must be convex. `clip` is a triangle, `subject` starts as a
 * triangle and grows to at most six vertices, so the loop is bounded by six
 * points times three edges regardless of the island.
 */
export function clipPolygonToTriangleXZ(
  subject: readonly PlanPoint[],
  clip: SurfaceTriangle,
): readonly PlanPoint[] {
  const clipRing = upwardWinding([
    { x: clip.x0, z: clip.z0 },
    { x: clip.x1, z: clip.z1 },
    { x: clip.x2, z: clip.z2 },
  ]);
  // `upwardWinding` leaves the ring clockwise in the (x, z) axes as written, so
  // "inside" is the side with a non-positive `edgeSide`.
  let output = upwardWinding(subject);
  for (let edge = 0; edge < clipRing.length && output.length > 0; edge += 1) {
    const from = clipRing[edge]!;
    const to = clipRing[(edge + 1) % clipRing.length]!;
    const input = output;
    const next: PlanPoint[] = [];
    for (let index = 0; index < input.length; index += 1) {
      const current = input[index]!;
      const following = input[(index + 1) % input.length]!;
      const currentSide = edgeSide(from.x, from.z, to.x, to.z, current.x, current.z);
      const followingSide = edgeSide(from.x, from.z, to.x, to.z, following.x, following.z);
      const currentInside = currentSide <= 0;
      const followingInside = followingSide <= 0;
      if (currentInside) next.push(current);
      if (currentInside !== followingInside) {
        const span = currentSide - followingSide;
        if (Math.abs(span) > 1e-15) {
          const amount = currentSide / span;
          next.push({
            x: current.x + (following.x - current.x) * amount,
            z: current.z + (following.z - current.z) * amount,
          });
        }
      }
    }
    output = next;
  }
  return output;
}

/**
 * A bounded plan-space bucket index over one surface's triangles.
 *
 * The alternative was a per-route-polygon scan of every terrain triangle, which
 * is ~2,000 x ~10,000 on a 41-lesson island. A uniform grid sized to the
 * lattice's own spacing keeps each query to the handful of triangles that can
 * possibly overlap, and the whole structure is built once per terrain mesh.
 */
export interface SurfaceTriangleIndex {
  readonly triangles: readonly SurfaceTriangle[];
  /** Indices into `triangles` whose plan bounds overlap the query box. */
  readonly candidates: (
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
  ) => readonly number[];
}

export function buildSurfaceTriangleIndex(
  triangles: readonly SurfaceTriangle[],
  cellSize: number,
): SurfaceTriangleIndex {
  const size = Math.max(1e-3, cellSize);
  const buckets = new Map<string, number[]>();
  const key = (column: number, row: number): string => `${column}:${row}`;
  const bounds = (triangle: SurfaceTriangle) => ({
    minX: Math.min(triangle.x0, triangle.x1, triangle.x2),
    maxX: Math.max(triangle.x0, triangle.x1, triangle.x2),
    minZ: Math.min(triangle.z0, triangle.z1, triangle.z2),
    maxZ: Math.max(triangle.z0, triangle.z1, triangle.z2),
  });
  triangles.forEach((triangle, index) => {
    const box = bounds(triangle);
    const fromColumn = Math.floor(box.minX / size);
    const toColumn = Math.floor(box.maxX / size);
    const fromRow = Math.floor(box.minZ / size);
    const toRow = Math.floor(box.maxZ / size);
    for (let column = fromColumn; column <= toColumn; column += 1) {
      for (let row = fromRow; row <= toRow; row += 1) {
        const at = key(column, row);
        const bucket = buckets.get(at);
        if (bucket) bucket.push(index);
        else buckets.set(at, [index]);
      }
    }
  });
  return {
    triangles,
    candidates(minX, minZ, maxX, maxZ) {
      const found: number[] = [];
      const seen = new Set<number>();
      const fromColumn = Math.floor(minX / size);
      const toColumn = Math.floor(maxX / size);
      const fromRow = Math.floor(minZ / size);
      const toRow = Math.floor(maxZ / size);
      for (let column = fromColumn; column <= toColumn; column += 1) {
        for (let row = fromRow; row <= toRow; row += 1) {
          const bucket = buckets.get(key(column, row));
          if (!bucket) continue;
          for (const index of bucket) {
            if (seen.has(index)) continue;
            seen.add(index);
            found.push(index);
          }
        }
      }
      return found;
    },
  };
}
