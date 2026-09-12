/** Model-space bank profile, not a terrain field. Its outer skirt is seated
 * against actual course triangles by the landscape plan. A broad rear slope,
 * short exposed cliff and low talus replace the old extruded polygon stumps.
 */
const columns = [-1, -0.81, -0.61, -0.57, -0.53, -0.49, -0.25, 0.06, 0.36, 0.63, 0.88, 1] as const;
// Talus, exposed face, narrow mineral bevel, grassy shoulder, then the uphill
// back. The flanks have their own short faces; this is a shelf, not a dome.
// A broad soil shoulder, not a narrow crest descending into two roof-like
// ramps. The short 0.81→0.87 transition is a physical turf lip; the long
// near-level seat belongs to grass and the outer fall to bare rock.
const lifts = [0, 0.035, 0.12, 0.73, 0.81, 0.87, 0.9, 0.92, 0.9, 0.83, 0.1, 0] as const;
const rows = [-0.75, -0.66, -0.6, -0.36, -0.3, -0.24, 0.1, 0.16, 0.22, 0.56, 0.63, 0.72] as const;
// Three unequal shoulders along the strike. Closely paired rows give actual
// terrace breaks instead of a single rounded bunker or repeated green posts.
const crossLifts = [0, 0.035, 0.61, 0.64, 0.67, 0.95, 1, 0.96, 0.73, 0.67, 0.04, 0] as const;

export const COURSE_ROCK_BANK_COLUMNS = columns.length;
export const COURSE_ROCK_BANK_ROWS = rows.length;
export const COURSE_ROCK_BANK_TRIANGLES =
  (columns.length - 1) * (rows.length - 1) * 4 + (columns.length + rows.length - 2) * 4;

export const COURSE_ROCK_BANK_POINTS = rows.flatMap((z, row) => {
  const width = [0.25, 0.5, 0.71, 0.84, 0.86, 0.9, 0.9, 0.86, 0.84, 0.69, 0.45, 0.22][row]!;
  const joint = [0, 0.01, 0.075, 0.06, 0.015, -0.04, -0.025, 0.035, 0.09, 0.06, 0.01, 0][row]!;
  return columns.map((x, column) => {
    const front = Math.max(0, Math.min(1, (-x - 0.05) / 0.45));
    const back = [0, 0.035, 0.78, 0.9, 0.93, 0.97, 1, 0.97, 0.91, 0.79, 0.04, 0][row]!;
    return {
      x: (x + joint * (1 - x * x)) * width,
      z,
      // Terrace breaks stop at the exposed shoulder. Carrying every step
      // through the entire bank made three manufactured parallel roof ridges.
      lift: lifts[column]! * (back + (crossLifts[row]! - back) * front),
      // The flank is mineral, not green paint flowing down a rounded cap.
      turf:
        [0, 0, 0, 0, 0.05, 1, 1, 1, 1, 0.95, 0.08, 0][column]! *
        [0, 0, 0.12, 0.9, 0.85, 1, 1, 0.9, 0.88, 0.2, 0, 0][row]!,
    };
  });
});

interface RockSurfaceSite {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly height: number;
  readonly turn: number;
  readonly groundRange: readonly [number, number];
  readonly groundHeights?: readonly number[];
}

/** Shared model datums for both the emitted top and its small plant seats.
 * This is not a new navigable heightfield: only this reserved rock owns it.
 */
export function courseRockTopPoints(site: RockSurfaceSite) {
  const cosine = Math.cos(site.turn),
    sine = Math.sin(site.turn);
  return COURSE_ROCK_BANK_POINTS.map((p, i) => ({
    x: site.x + (p.x * cosine - p.z * sine) * site.radius,
    y: (site.groundHeights?.[i] ?? site.groundRange[0]) + site.height * p.lift - 0.02,
    z: site.z + (p.x * sine + p.z * cosine) * site.radius,
  }));
}

export function sampleCourseRockTop(
  points: ReturnType<typeof courseRockTopPoints>,
  x: number,
  z: number,
): number | null {
  for (let row = 0; row < rows.length - 1; row++)
    for (let col = 0; col < columns.length - 1; col++) {
      const a = row * columns.length + col,
        b = a + 1,
        c = a + columns.length,
        d = c + 1;
      for (const [i, j, k] of [
        [a, c, b],
        [b, c, d],
      ]) {
        const p = points[i!]!,
          q = points[j!]!,
          r = points[k!]!;
        const det = (q.z - r.z) * (p.x - r.x) + (r.x - q.x) * (p.z - r.z);
        if (Math.abs(det) < 1e-12) continue;
        const u = ((q.z - r.z) * (x - r.x) + (r.x - q.x) * (z - r.z)) / det;
        const v = ((r.z - p.z) * (x - r.x) + (p.x - r.x) * (z - r.z)) / det;
        const w = 1 - u - v;
        if (Math.min(u, v, w) >= -1e-8) return u * p.y + v * q.y + w * r.y;
      }
    }
  return null;
}
