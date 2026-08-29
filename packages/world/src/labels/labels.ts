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

export type LabelAnchor = "center" | "start" | "aside";

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
   * `start` is a left-aligned name growing toward the path;
   * `aside` is a follow card sitting beside a point, never on it.
   */
  readonly anchor?: LabelAnchor;
  /**
   * Extra pixels between the anchor and an `aside` box. A name sits on its
   * point; a card has to sit off the island that point belongs to, or it
   * covers the thing it is about.
   */
  readonly clearance?: number;
  /**
   * Drawn on top of everything, and reserving nothing.
   *
   * The enter-course card used to claim a box like any other label, so opening
   * it shoved the names of neighbouring islands sideways — click one island and
   * three unrelated titles jump. Those names are about islands the card is not
   * about; moving them to protect an opaque panel that would have covered them
   * harmlessly is motion with no information in it.
   *
   * So an overlay is placed but not negotiated with. It still has to fit on
   * screen and still sits beside its own island rather than on it — those are
   * about the card being readable and about not hiding its own subject. It just
   * no longer pushes, and is no longer pushed.
   */
  readonly overlay?: boolean;
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
/**
 * How far an `aside` card sits off the projected peak.
 *
 * A caption may sit on its point; a follow card that did the same would
 * cover the island it is naming, which is the click target the card exists
 * to confirm. Fifty-six pixels keeps a 260px panel off a typical course
 * island at the world-map default zoom.
 */
export const FOLLOW_CLEARANCE = 56;

interface Slot {
  readonly x: number;
  readonly y: number;
}

/** Keep a side card's vertical centre inside the viewport when possible. */
function asideSideY(candidate: LabelCandidate, viewport: LabelViewport, gap: number): number {
  const minY = candidate.height / 2 + gap;
  const maxY = viewport.height - candidate.height / 2 - gap;
  // An oversized card is allowed to intersect the viewport, but its side
  // slot still needs a stable centre rather than an impossible clamp range.
  if (maxY < minY) return viewport.height / 2;
  return Math.min(Math.max(candidate.y, minY), maxY);
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
function slotsFor(
  candidate: LabelCandidate,
  gap: number,
  viewport?: LabelViewport,
): readonly Slot[] {
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
  if (candidate.anchor === "aside") {
    // A follow card is the same problem as a name — a screen-space box that
    // must not leave the frame and must not sit on its point — with one
    // different preference: beside, never covering. Right first because that
    // is the direction a line of Chinese continues toward; left is the flip
    // when the right edge would clip. Vertical nudges come before "below",
    // because below is the island the card is about.
    const clearance = candidate.clearance ?? FOLLOW_CLEARANCE;
    const offsetX = width / 2 + gap + clearance;
    const nudgeY = height / 2 + gap;
    const sideY = viewport ? asideSideY(candidate, viewport, gap) : y;
    return [
      { x: x + offsetX, y: sideY },
      { x: x - offsetX, y: sideY },
      { x: x + offsetX, y: y - nudgeY * 0.45 },
      { x: x - offsetX, y: y - nudgeY * 0.45 },
      { x: x + offsetX, y: y + nudgeY * 0.45 },
      { x: x - offsetX, y: y + nudgeY * 0.45 },
      { x, y: y + nudgeY },
      { x, y: y - nudgeY },
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

/**
 * Extra vertical slots are a fallback for a label boxed in by chrome and
 * neighbouring names. The common path keeps the original four-slot search;
 * only a crowded candidate pays for this wider search.
 */
function additionalVerticalSlots(candidate: LabelCandidate, gap: number): readonly Slot[] {
  if (candidate.anchor === "aside") return [];
  const step = candidate.height + gap;
  const baseY = candidate.anchor === "start" ? candidate.y : candidate.y - candidate.height / 2;
  const offsets = [-1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8];
  return offsets.map((offset) => ({ x: candidate.x, y: baseY + offset * step }));
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

export interface LabelViewport {
  readonly width: number;
  readonly height: number;
}

export interface LabelPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Move a label which would be hidden by chrome to the nearest readable slot.
 *
 * Quiet labels are deliberately not candidates for `placeLabels`: making all
 * forty-one lesson names negotiate space would turn the map back into a list.
 * They still need a safe focused position, though. This small boundary pass
 * only runs for a quiet label whose home box intersects an opaque chrome box;
 * it first crosses the boundary, then tries the closest vertical nudges that
 * do not cover an already placed label.
 *
 * The caller supplies the chrome box in stage coordinates. Keeping the
 * geometry here makes the rule deterministic and leaves DOM measurement in
 * the frame owner, where the browser is available.
 */
export function clampLabelOutOfChrome(
  candidate: Pick<LabelCandidate, "x" | "y" | "width" | "height" | "anchor">,
  chrome: LabelBox | null,
  viewport: LabelViewport,
  options?: {
    /** Space between the label and the opaque boundary. */
    readonly chromeGap?: number;
    /** Space between this focused label and visible labels. */
    readonly labelGap?: number;
    readonly reserved?: readonly LabelBox[];
  },
): LabelPosition {
  const anchor = candidate.anchor ?? "center";
  const home = { x: candidate.x, y: candidate.y };
  if (!chrome) return home;

  const homeBox = labelBox(home, candidate.width, candidate.height, anchor);
  if (!boxesOverlap(homeBox, chrome, 0)) return home;

  const chromeGap = options?.chromeGap ?? 8;
  const labelGap = options?.labelGap ?? 4;
  const horizontalSlots =
    anchor === "start"
      ? [{ x: chrome.right + chromeGap }, { x: chrome.left - chromeGap - candidate.width }]
      : [
          { x: chrome.right + chromeGap + candidate.width / 2 },
          { x: chrome.left - chromeGap - candidate.width / 2 },
        ];
  const verticalStep = candidate.height + chromeGap;
  const verticalOffsets = [0];
  for (let index = 1; index <= Math.ceil(viewport.height / verticalStep) + 1; index += 1) {
    verticalOffsets.push(index * verticalStep, -index * verticalStep);
  }

  const slots = horizontalSlots.flatMap((horizontal) =>
    verticalOffsets.map((offset) => ({ x: horizontal.x, y: candidate.y + offset })),
  );
  const readable = slots
    .map((slot) => ({ slot, box: labelBox(slot, candidate.width, candidate.height, anchor) }))
    .filter(({ box }) => fitsInViewport(box, viewport))
    .filter(({ box }) => !boxesOverlap(box, chrome, 0))
    .filter(
      ({ box }) =>
        !(options?.reserved ?? []).some((reserved) => boxesOverlap(box, reserved, labelGap)),
    )
    .sort((left, right) => {
      const leftDistance =
        Math.abs(left.slot.x - candidate.x) + Math.abs(left.slot.y - candidate.y);
      const rightDistance =
        Math.abs(right.slot.x - candidate.x) + Math.abs(right.slot.y - candidate.y);
      return leftDistance - rightDistance;
    });

  // A desktop rail always leaves room on one side for a lesson title. The
  // fallback keeps the boundary guarantee if a future chrome layout consumes
  // every readable, non-overlapping slot; the label may cover a label, but it
  // will not be put back underneath the opaque chrome.
  const boundaryOnly = slots
    .map((slot) => ({ slot, box: labelBox(slot, candidate.width, candidate.height, anchor) }))
    .filter(({ box }) => fitsInViewport(box, viewport))
    .filter(({ box }) => !boxesOverlap(box, chrome, 0))
    .sort((left, right) => {
      const leftDistance =
        Math.abs(left.slot.x - candidate.x) + Math.abs(left.slot.y - candidate.y);
      const rightDistance =
        Math.abs(right.slot.x - candidate.x) + Math.abs(right.slot.y - candidate.y);
      return leftDistance - rightDistance;
    });

  return readable[0]?.slot ?? boundaryOnly[0]?.slot ?? home;
}

function intersectsViewport(rect: LabelBox, viewport: LabelViewport): boolean {
  return (
    rect.left < viewport.width && rect.right > 0 && rect.top < viewport.height && rect.bottom > 0
  );
}

/**
 * Fully inside the frame, not merely touching it.
 *
 * Placement used to ask only whether the box intersected the viewport, which
 * is a different question from whether anyone can read it. Measured at 375
 * wide: 《读懂一段逻辑》 was placed from x=293 to x=411 — it intersects, so it
 * passed, and 36px of the name hung off the right edge, unreadable and
 * unclickable. The `left` slot beside it was free the whole time.
 *
 * Because the slot list already offers down / right / left, requiring
 * containment does not lose the label — it moves it to the side that fits,
 * which is what the four slots were for.
 *
 * A box wider or taller than the viewport itself can satisfy no containment
 * test. Hiding it would drop a name for being long rather than for being in
 * the way, so for that case only, touching remains the best available answer.
 */
function fitsInViewport(rect: LabelBox, viewport: LabelViewport): boolean {
  if (rect.right - rect.left > viewport.width || rect.bottom - rect.top > viewport.height) {
    return intersectsViewport(rect, viewport);
  }
  return (
    rect.left >= 0 &&
    rect.top >= 0 &&
    rect.right <= viewport.width &&
    rect.bottom <= viewport.height
  );
}

function clampedOverlaySlot(candidate: LabelCandidate, viewport: LabelViewport, gap: number): Slot {
  const x =
    candidate.width + gap * 2 >= viewport.width
      ? viewport.width / 2
      : Math.min(
          Math.max(candidate.x, candidate.width / 2 + gap),
          viewport.width - candidate.width / 2 - gap,
        );
  const y =
    candidate.height + gap * 2 >= viewport.height
      ? viewport.height / 2
      : Math.min(
          Math.max(candidate.y, candidate.height / 2 + gap),
          viewport.height - candidate.height / 2 - gap,
        );
  return { x, y };
}

function anchorOnScreen(candidate: LabelCandidate, viewport: LabelViewport): boolean {
  return (
    candidate.x >= 0 &&
    candidate.y >= 0 &&
    candidate.x <= viewport.width &&
    candidate.y <= viewport.height
  );
}

export function placeLabels(
  candidates: readonly LabelCandidate[],
  viewport: LabelViewport,
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
    let didPlace = false;
    const slotGroups = [
      slotsFor(candidate, gap, viewport),
      additionalVerticalSlots(candidate, gap),
    ];
    for (const slots of slotGroups) {
      for (const slot of slots) {
        const rect = labelBox(slot, width, height, anchor);
        // An offset that leaves the frame is not a placement: it would spend a
        // maxVisible slot on a name nobody can read.
        if (!fitsInViewport(rect, viewport)) continue;
        if (!candidate.overlay) {
          if (occupied.some((other) => boxesOverlap(rect, other, gap))) continue;
          occupied.push(rect);
        }
        placed[index] = { id: candidate.id, x: slot.x, y: slot.y, visible: true };
        visibleCount += 1;
        didPlace = true;
        break;
      }
      if (didPlace) break;
    }

    if (!placed[index]!.visible && candidate.overlay && anchor === "aside") {
      /*
        A long follow card can exhaust every beside/vertical slot on a phone.
        It is scrollable by CSS, so a final viewport clamp keeps the control
        present and readable instead of turning a real selection into nothing.
        Overlay cards are allowed to cover the map; they do not reserve space.
      */
      const slot = clampedOverlaySlot(candidate, viewport, gap);
      placed[index] = { id: candidate.id, x: slot.x, y: slot.y, visible: true };
      visibleCount += 1;
    }
  }

  return placed;
}
