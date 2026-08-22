/**
 * Screen-space names for the course map.
 *
 * LabelProbe already projects forty-one lesson titles into the DOM. What it
 * cannot do is decide which of those titles a learner can actually read: it
 * keeps the nearest N by depth, and the survivors still sit on top of each
 * other. Depth is also the wrong key for the one name that must survive — the
 * lesson the learner is standing on can lose to a closer neighbour.
 *
 * This module is only that decision. It does not touch the DOM, the camera or
 * a frame loop, so the same pose produces the same layout every time. A
 * per-frame writer can lose that property the moment it reaches for random
 * jitter or a live layout measurement; we do not.
 */

export type LabelAnchor = "center" | "start";

export interface LabelBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface LabelCandidate {
  readonly id: string;
  /** Screen-pixel anchor the 3D projection already computed. */
  readonly x: number;
  readonly y: number;
  /** NDC depth; smaller is closer to the camera. */
  readonly z: number;
  /** Pixel size of the label itself. */
  readonly width: number;
  readonly height: number;
  /** Larger wins. The lesson the learner is standing on. */
  readonly weight?: number;
  /**
   * Where (x, y) sits on the box. `center` is a caption over a point;
   * `start` is a left-aligned name growing toward the path.
   */
  readonly anchor?: LabelAnchor;
}

export interface LabelPlacement {
  readonly id: string;
  /**
   * Screen-pixel centre of the placed label — the same number LabelProbe
   * already writes into a `translate()`, so wiring this in does not invent a
   * second coordinate convention.
   */
  readonly x: number;
  readonly y: number;
  /** Caller hides the node when this is false. */
  readonly visible: boolean;
}

const DEFAULT_MAX_VISIBLE = 12;
const DEFAULT_GAP = 4;

interface Slot {
  readonly x: number;
  readonly y: number;
}

/**
 * Four centres around one anchor.
 *
 * Above is not an offset: the name is a caption, and a caption that covers the
 * island steals the click the island exists to receive. The other three are
 * translations of that same box — down, then right, then left — so a collision
 * still keeps the name next to its island rather than searching the frame.
 *
 * Down before the sides because a name that stays on the island's vertical is
 * still obviously about that island. Right before left because that is the
 * direction a line of Chinese or English continues toward; a name to the left
 * of its point reads as belonging to whatever is further left.
 */
function slotsFor(candidate: LabelCandidate, gap: number): readonly Slot[] {
  const { x, y, width, height } = candidate;
  const stepX = width + gap;
  const stepY = height + gap;
  if (candidate.anchor === "start") {
    return [
      { x, y },
      { x, y: y + stepY },
      { x: x + stepX, y },
      { x: x - stepX, y },
    ];
  }
  const aboveY = y - height / 2;
  return [
    { x, y: aboveY },
    { x, y: aboveY + stepY },
    { x: x + stepX, y: aboveY },
    { x: x - stepX, y: aboveY },
  ];
}

export function labelBox(
  slot: Slot,
  width: number,
  height: number,
  anchor: LabelAnchor = "center",
): LabelBox {
  if (anchor === "start") {
    return {
      left: slot.x,
      top: slot.y - height / 2,
      right: slot.x + width,
      bottom: slot.y + height / 2,
    };
  }
  return {
    left: slot.x - width / 2,
    top: slot.y - height / 2,
    right: slot.x + width / 2,
    bottom: slot.y + height / 2,
  };
}

/** Exact-gap contact is allowed; that *is* the minimum spacing. */
export function boxesOverlap(a: LabelBox, b: LabelBox, gap: number): boolean {
  return (
    a.left < b.right + gap &&
    a.right + gap > b.left &&
    a.top < b.bottom + gap &&
    a.bottom + gap > b.top
  );
}

function intersectsViewport(
  rect: LabelBox,
  viewport: { readonly width: number; readonly height: number },
): boolean {
  return (
    rect.left < viewport.width && rect.right > 0 && rect.top < viewport.height && rect.bottom > 0
  );
}

function anchorOnScreen(
  candidate: LabelCandidate,
  viewport: { readonly width: number; readonly height: number },
): boolean {
  return (
    candidate.x >= 0 &&
    candidate.y >= 0 &&
    candidate.x <= viewport.width &&
    candidate.y <= viewport.height
  );
}

export function placeLabels(
  candidates: readonly LabelCandidate[],
  viewport: { readonly width: number; readonly height: number },
  options?: {
    readonly maxVisible?: number;
    readonly gap?: number;
    /** Already-claimed boxes (pinned icons). Names must go around them. */
    readonly reserved?: readonly LabelBox[];
  },
): readonly LabelPlacement[] {
  const maxVisible = options?.maxVisible ?? DEFAULT_MAX_VISIBLE;
  const gap = options?.gap ?? DEFAULT_GAP;

  const placed: LabelPlacement[] = candidates.map((candidate) => {
    const home = slotsFor(candidate, gap)[0]!;
    return { id: candidate.id, x: home.x, y: home.y, visible: false };
  });

  const occupied: LabelBox[] = options?.reserved ? [...options.reserved] : [];
  let visibleCount = 0;

  const order = candidates.map((candidate, index) => ({ candidate, index }));
  order.sort((left, right) => {
    const weightDelta = (right.candidate.weight ?? 0) - (left.candidate.weight ?? 0);
    if (weightDelta !== 0) return weightDelta;
    const depthDelta = left.candidate.z - right.candidate.z;
    if (depthDelta !== 0) return depthDelta;
    // Equal weight and depth keep input order so a reshuffle of equals cannot
    // flip which name survives from one call to the next.
    return left.index - right.index;
  });

  for (const { candidate, index } of order) {
    if (!anchorOnScreen(candidate, viewport)) continue;
    if (visibleCount >= maxVisible) continue;

    const { width, height } = candidate;
    const anchor = candidate.anchor ?? "center";
    for (const slot of slotsFor(candidate, gap)) {
      const rect = labelBox(slot, width, height, anchor);
      // An offset that leaves the frame is not a placement: it would spend a
      // maxVisible slot on a name nobody can read.
      if (!intersectsViewport(rect, viewport)) continue;
      if (occupied.some((other) => boxesOverlap(rect, other, gap))) continue;
      occupied.push(rect);
      placed[index] = { id: candidate.id, x: slot.x, y: slot.y, visible: true };
      visibleCount += 1;
      break;
    }
  }

  return placed;
}
