/**
 * Where the camera goes to show one avatar as a bust, on a square canvas.
 *
 * Pure, and separate from the component, because the two bugs this had were
 * both arithmetic and neither was visible in a screenshot until it was very
 * visible: a fixed camera showed a coloured dot, and a height-only fit put the
 * camera inside the creature's own shoulder.
 */
export interface BustBounds {
  /** Overall width of the built avatar. */
  readonly w: number;
  /** Overall height. */
  readonly h: number;
  /** Top of the avatar, in the same units. */
  readonly maxY: number;
}

/**
 * The slice of the creature the shot contains, from the top down.
 *
 * A head crop was the obvious choice and it is wrong for this avatar: seen
 * from behind — which is how the signed-out one spends most of its life — a
 * head alone is a featureless oval at any size. With the shoulders in frame
 * the silhouette is a creature, and the turn reads as a turn.
 */
export const BUST_SLICE = 0.7;

/** A little air around the top and lower face without turning the bust into a distant shot. */
export const BUST_PADDING = 1.2;

export function frameBust(bounds: BustBounds, fovDegrees: number) {
  const slice = Math.max(bounds.h * BUST_SLICE, 0.01);
  const centreY = bounds.maxY - slice * 0.5;
  /*
    Both axes, not just height. The canvas is square, so the shot has to
    contain a sphere around the slice — and the guest bunny is 1.43 tall and
    1.10 wide, which means a height-only fit gives a 0.71-wide view of a
    1.10-wide body. That is not a tight crop, it is being inside the model.
  */
  const radius = Math.max(slice, bounds.w) * 0.5;
  const distance = (radius / Math.tan((fovDegrees * Math.PI) / 360)) * BUST_PADDING;
  return { centreY, distance };
}
