/**
 * The arc the learner's avatar travels when it moves to another node.
 *
 * The maths lives here, apart from the frame loop, because the thing worth
 * checking is the shape of the motion — that it leaves the ground, comes back
 * to it, and lands exactly on the target — and none of that needs a renderer.
 *
 * The hop is deliberately free of cost to the learner. Picking an island does
 * not open the lesson; it opens the card that offers to. So the hop plays over
 * a step the learner was going to take anyway, and never sits between a click
 * and the thing the click asked for. If a future caller wants to hop *and*
 * navigate at once, it must start the navigation immediately and let the hop
 * run alongside it — never wait for `done`.
 */

/** Short enough to read as a reaction rather than a cutscene. */
export const HOP_DURATION_MS = 420;

/**
 * The measurable product promise for map travel: the existing hop plus eight
 * visible frames of scheduling tolerance. It is still shorter than reading
 * the course card that appears on the same click.
 */
export const FAST_TRAVEL_UPPER_BOUND_MS = HOP_DURATION_MS + 120;

/** Relative to the distance travelled, so a short move is a small hop. */
const ARC_RATIO = 0.28;
const MIN_ARC = 0.35;
const MAX_ARC = 1.6;

export interface HopPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface HopPose {
  /**
   * Where the marker meets the ground. The arc is reported separately because
   * the two halves belong to different things: a ring painted on the ground
   * follows this, and only the body rises by `lift`.
   */
  readonly position: HopPoint;
  /** Height above `position`, zero at both ends of the hop. */
  readonly lift: number;
  /** Vertical scale multiplier: <1 crouches for takeoff, >1 stretches in flight. */
  readonly stretch: number;
  readonly done: boolean;
}

/**
 * Ease-out on the ground track so the avatar commits to the landing rather
 * than drifting into it. The arc itself stays a plain parabola against linear
 * time, which keeps the apex in the middle of the jump where the eye expects.
 */
function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function arcHeightFor(from: HopPoint, to: HopPoint): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dz);
  return Math.min(MAX_ARC, Math.max(MIN_ARC, distance * ARC_RATIO));
}

/**
 * `elapsed` beyond the duration, or a learner who asked for reduced motion,
 * both land on the target exactly. Never approximately: a marker that settles
 * a few centimetres off its stone reads as a bug for the rest of the session.
 */
export function hopPose(input: {
  readonly from: HopPoint;
  readonly to: HopPoint;
  readonly elapsedMs: number;
  readonly reducedMotion?: boolean;
}): HopPose {
  const { from, to, elapsedMs, reducedMotion = false } = input;
  if (reducedMotion || elapsedMs >= HOP_DURATION_MS || HOP_DURATION_MS <= 0) {
    return { position: { ...to }, lift: 0, stretch: 1, done: true };
  }
  const t = Math.max(0, elapsedMs) / HOP_DURATION_MS;
  const travelled = easeOut(t);
  return {
    position: {
      x: from.x + (to.x - from.x) * travelled,
      y: from.y + (to.y - from.y) * travelled,
      z: from.z + (to.z - from.z) * travelled,
    },
    lift: arcHeightFor(from, to) * 4 * t * (1 - t),
    stretch: stretchAt(t),
    done: false,
  };
}

/**
 * Squash before the ground is left and again as it is met, stretch at the top.
 * The two contacts are what make a jump legible; without them the avatar looks
 * like it is being carried rather than jumping.
 */
function stretchAt(t: number): number {
  if (t < 0.18) return 1 - 0.22 * (t / 0.18);
  if (t > 0.86) return 1 - 0.18 * ((t - 0.86) / 0.14);
  const air = (t - 0.18) / 0.68;
  return 1 + 0.16 * Math.sin(air * Math.PI);
}
