/**
 * Which way the close-up camera looks from, so a tent, a tree or a landmark
 * does not stand between it and the learner (V7 station 4).
 *
 * The map keeps one heading, and the close-up starts from it so the island does
 * not swing round; when that line of sight crosses something standing, it turns
 * the least it has to. "Standing" is the island's own footprint list
 * (`courseStandingFootprints`), the same circles every planner already keeps
 * clear of, so this needs no raycast against thousands of grass blades.
 */

export interface Footprint {
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

export interface Point2 {
  readonly x: number;
  readonly z: number;
}

/** Degrees tried either side of the side-on heading, nearest first; never a swing round. */
export const CLOSE_UP_TURNS = [0, 20, -20, 35, -35, 50, -50] as const;
/** Only tents, landmarks and big trees hide a learner; bushes and rocks do not. */
const TALL_ENOUGH = 0.8;

/** Whether the segment a→b passes through the circle, away from both ends. */
function crosses(a: Point2, b: Point2, circle: Footprint): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length2 = dx * dx + dz * dz || 1;
  const t = ((circle.x - a.x) * dx + (circle.z - a.z) * dz) / length2;
  if (t <= 0.08 || t >= 0.92) return false;
  const px = a.x + dx * t - circle.x;
  const pz = a.z + dz * t - circle.z;
  return px * px + pz * pz < circle.r * circle.r;
}

/**
 * The unit heading (from the look point toward the camera, on the ground) that
 * sees `subjects` past the fewest standing things. It starts side-on to the
 * two subjects — so the avatar and the chest or monster both show their faces
 * rather than one standing behind the other — on the side the map already
 * looks from, so the island does not swing round.
 */
export function chooseCloseUpHeading({
  home,
  look,
  reach,
  subjects,
  obstacles,
}: {
  /** The map camera's heading, look point → eye, on the ground. */
  readonly home: Point2;
  readonly look: Point2;
  /** Ground distance from the look point to the eye. */
  readonly reach: number;
  readonly subjects: readonly Point2[];
  readonly obstacles: readonly Footprint[];
}): Point2 {
  const tall = obstacles.filter((circle) => circle.r >= TALL_ENOUGH);
  const [a, b] = subjects;
  let base = Math.atan2(home.x, home.z);
  if (a && b) {
    const along = { x: b.x - a.x, z: b.z - a.z };
    if (Math.hypot(along.x, along.z) > 1e-3) {
      // The side-on normal that faces the way the map already looks from.
      const normal = { x: -along.z, z: along.x };
      const sign = normal.x * home.x + normal.z * home.z >= 0 ? 1 : -1;
      base = Math.atan2(normal.x * sign, normal.z * sign);
    }
  }
  let best: { heading: Point2; blocked: number } | null = null;
  for (const turn of CLOSE_UP_TURNS) {
    const angle = base + (turn * Math.PI) / 180;
    const heading = { x: Math.sin(angle), z: Math.cos(angle) };
    const eye = { x: look.x + heading.x * reach, z: look.z + heading.z * reach };
    const blocked = tall.filter((circle) =>
      subjects.some((subject) => crosses(eye, subject, circle)),
    ).length;
    if (blocked === 0) return heading;
    if (!best || blocked < best.blocked) best = { heading, blocked };
  }
  return best!.heading;
}
