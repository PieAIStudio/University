/**
 * The course scene's labels and camera, as functions of the road.
 *
 * The delivery shell had all of this inline and the authoring shell had none
 * of it — so clicking an island in one campus opened a course you could walk,
 * and in the other it skipped the course entirely and dropped you into a
 * lesson. Not a styling difference: a whole level of the product existed in
 * one shell and not the other, and the only reason was that the composition
 * lived in an app file where the second shell could not reach it.
 */
import { courseSprites } from "../labels/path-overlay.js";
import { renderTier } from "../sky/tier.js";
import type { Course } from "./course.js";
import type { LessonPlacement, Marker } from "../Maps.js";

// The front-side eye is deliberately close: the avatar is the subject, while
// a short local look-ahead lets the road occupy the upper half of the shot.
const COURSE_CAMERA_FRONT = 19;
const COURSE_CAMERA_HEIGHT = 13;
const COURSE_TARGET_BACK = 2;
const COURSE_TARGET_HEIGHT = 3;
const COURSE_PATH_LOOK_AHEAD = 0.8;
const COURSE_EDGE_AZIMUTH = Math.PI / 4;
const COURSE_EDGE_TARGET_HEIGHT_DESKTOP = 0.5;
const COURSE_EDGE_PROBE_FRACTIONS = [0.55, 0.8, 1] as const;

export interface CourseFrameOptions {
  /** The stage tier that owns the DOM safe area around the canvas. */
  readonly tier?: "desktop" | "mobile";
}

/**
 * A course the way a screen holds it, as the shape the scene places.
 *
 * The two shells carry a course in two different records — the delivery shell
 * loads a package with the prose in it, the authoring shell loads a summary
 * from its own API — and the scene only needs ids, titles and how long each
 * lesson is. `contentChars` is that length, and it is a required field on the
 * summary for exactly this reason: it sets the size of the stone, so a shell
 * that could not supply it would draw the same course with different stones.
 */
export function worldCourse(view: {
  readonly id: string;
  readonly units: readonly {
    readonly id: string;
    readonly title: string;
    readonly lessons: readonly {
      readonly id: string;
      readonly title: string;
      readonly contentChars: number;
      readonly contentRevision: number;
      readonly exerciseIds: readonly string[];
      readonly exerciseIdsComplete?: boolean;
    }[];
  }[];
}): Course {
  return {
    id: view.id,
    units: view.units.map((unit) => ({
      id: unit.id,
      title: unit.title,
      lessons: unit.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        // `placeCourse` only reads `content.length`, and a string of the right
        // length is the honest way to say "this is how long it is" without
        // dragging the prose into a package that has no business holding it.
        content: " ".repeat(Math.max(0, lesson.contentChars)),
        contentRevision: lesson.contentRevision,
        exerciseIds: lesson.exerciseIds,
        ...(lesson.exerciseIdsComplete === false ? { exerciseIdsComplete: false } : {}),
        exercises: lesson.exerciseIds.map((id) => ({ id })),
        cards: [],
      })),
    })),
  };
}

/**
 * Where the eye stands on a course road.
 *
 * Both ends of the shot are anchored to the live stone rather than to the
 * height of a later stone: stand on its +Z/front side, aim just behind and
 * above its ground plane, then take a bounded step along the local road
 * tangent. The small step puts the road in the upper half without chasing the
 * next stone around a bend or turning the live control out of view.
 *
 * The eye and the target share a lateral position, which is the whole reason
 * this is worth a comment. An earlier shot aimed at a damped fraction of the
 * *absolute* x four stones ahead, on the theory that following only half the
 * road's swing would keep the curve from cancelling. On a serpentine road that
 * is not a small nudge: at lesson six of 「在开始之前」 the stone four ahead sits
 * 17 units to the other side, the target went with it, the camera yawed 15°,
 * and the live stone — the only button on the screen — was projected to
 * x=1115 of 1440, underneath the right-hand rail, where Chrome refused to
 * click it because a paragraph of the today panel was on top. Measured, by G2
 * failing on the campus whose learner had got six lessons in.
 *
 * The look-ahead is local, not a fixed world-facing bearing. That distinction
 * matters on the serpentine course: at the start and at the middle the next
 * lesson points in different lateral directions, and a fixed x/z offset would
 * make one of those views throw the road out of frame.
 *
 * Only the distance and the bearing survive: `Controls` pins the tilt and
 * recomputes the eye from (target, distance, bearing) on the next frame, so
 * the height here is an arrival pose rather than a second camera rule.
 */
function pathLookAhead(
  lessons: readonly LessonPlacement[],
  liveIndex: number,
): { readonly x: number; readonly z: number } {
  const live = lessons[liveIndex];
  if (!live) return { x: 0, z: 0 };
  const next = lessons[liveIndex + 1];
  const previous = lessons[liveIndex - 1];
  const neighbour = next ?? previous;
  if (!neighbour) return { x: 0, z: 0 };
  const direction = next
    ? {
        x: neighbour.position.x - live.position.x,
        z: neighbour.position.z - live.position.z,
      }
    : {
        x: live.position.x - neighbour.position.x,
        z: live.position.z - neighbour.position.z,
      };
  const length = Math.hypot(direction.x, direction.z);
  if (length <= Number.EPSILON) return { x: 0, z: 0 };
  return {
    x: (direction.x / length) * COURSE_PATH_LOOK_AHEAD,
    z: (direction.z / length) * COURSE_PATH_LOOK_AHEAD,
  };
}

function pointInsideOutline(
  point: { readonly x: number; readonly z: number },
  outline: readonly { readonly x: number; readonly z: number }[],
): boolean {
  if (outline.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
    const current = outline[index]!;
    const before = outline[previous]!;
    const crosses =
      current.z > point.z !== before.z > point.z &&
      point.x <
        ((before.x - current.x) * (point.z - current.z)) / (before.z - current.z) + current.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function outlineCentroid(outline: readonly { readonly x: number; readonly z: number }[]) {
  if (outline.length < 3) return { x: 0, z: 0 };
  let twiceArea = 0;
  let x = 0;
  let z = 0;
  for (let index = 0; index < outline.length; index += 1) {
    const current = outline[index]!;
    const next = outline[(index + 1) % outline.length]!;
    const cross = current.x * next.z - next.x * current.z;
    twiceArea += cross;
    x += (current.x + next.x) * cross;
    z += (current.z + next.z) * cross;
  }
  if (Math.abs(twiceArea) <= Number.EPSILON) return { x: 0, z: 0 };
  return { x: x / (3 * twiceArea), z: z / (3 * twiceArea) };
}

/**
 * The first stone can sit on a headland. If the local view vector leaves the
 * authored coastline, its forward half is water no matter how carefully the
 * tangent was sampled. Three probes make that a geometric decision rather
 * than a first-index exception: a view is recovered only when most of its
 * useful reach is outside the island.
 */
function looksOutToWater(live: LessonPlacement, lookAt: { x: number; z: number }): boolean {
  const outline = live.blueprint?.outline;
  if (!outline || outline.length < 3) return false;
  const direction = { x: lookAt.x - live.position.x, z: lookAt.z - live.position.z };
  const length = Math.hypot(direction.x, direction.z);
  if (length <= Number.EPSILON) return false;
  direction.x /= length;
  direction.z /= length;
  const reach = Math.min(12, Math.max(6, live.blueprint.bounds.maxHalf * 0.38));
  const outside = COURSE_EDGE_PROBE_FRACTIONS.reduce((count, fraction) => {
    const probe = {
      x: live.position.x + direction.x * reach * fraction,
      z: live.position.z + direction.z * reach * fraction,
    };
    return count + (pointInsideOutline(probe, outline) ? 0 : 1);
  }, 0);
  return outside >= 2;
}

/**
 * Turn around the live avatar toward the side that contains more island.
 * Both candidates stay on the avatar's +Z/front hemisphere; choosing the one
 * whose eye is closer to the outline centroid makes the rule work for either
 * lateral edge without baking a course-specific sign into the camera.
 */
function edgeAzimuth(
  live: LessonPlacement,
  lookAt: { readonly x: number; readonly z: number },
): number {
  const center = outlineCentroid(live.blueprint?.outline ?? []);
  const horizontalOffset = COURSE_CAMERA_FRONT + COURSE_TARGET_BACK;
  const candidates = [-COURSE_EDGE_AZIMUTH, COURSE_EDGE_AZIMUTH];
  const score = (azimuth: number) => {
    const eye = {
      x: lookAt.x + Math.sin(azimuth) * horizontalOffset,
      z: lookAt.z + Math.cos(azimuth) * horizontalOffset,
    };
    return Math.hypot(eye.x - center.x, eye.z - center.z);
  };
  return score(candidates[0]!) <= score(candidates[1]!) ? candidates[0]! : candidates[1]!;
}

export function frameCourse(
  lessons: readonly LessonPlacement[],
  options: CourseFrameOptions = {},
): {
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
} | null {
  const found = lessons.findIndex((lesson) => lesson.state === "live");
  const liveIndex = found < 0 ? 0 : found;
  const live = lessons[liveIndex];
  if (!live) return null;
  const ahead = pathLookAhead(lessons, liveIndex);
  const baseLookAt = {
    x: live.position.x + ahead.x,
    z: live.position.z - COURSE_TARGET_BACK + ahead.z,
  };
  const edgeRecovery = looksOutToWater(live, baseLookAt);
  const tier = options.tier ?? renderTier();
  const targetHeight =
    edgeRecovery && tier === "desktop" ? COURSE_EDGE_TARGET_HEIGHT_DESKTOP : COURSE_TARGET_HEIGHT;
  const azimuth = edgeRecovery ? edgeAzimuth(live, baseLookAt) : 0;
  const horizontalOffset = COURSE_CAMERA_FRONT + COURSE_TARGET_BACK;
  const targetY = live.position.y + targetHeight;
  return {
    // The ordinary shot stays on the +Z side of the road. When the local view
    // is mostly outside the real coastline, the edge recovery turns only
    // around the avatar: the chosen side is still in the +Z/front hemisphere,
    // but the island body now occupies the forward half instead of the sea.
    cameraFrom: [
      baseLookAt.x + Math.sin(azimuth) * horizontalOffset,
      targetY + COURSE_CAMERA_HEIGHT - COURSE_TARGET_HEIGHT,
      baseLookAt.z + Math.cos(azimuth) * horizontalOffset,
    ],
    lookAt: [baseLookAt.x, targetY, baseLookAt.z],
  };
}

export interface CourseMarkerOptions {
  /**
   * What a lesson stone does when chosen. Omitted while a lesson is already
   * open — the stones are still drawn and still named, but choosing one from
   * inside the reader would be choosing where you already are.
   */
  readonly onPick?: ((lesson: LessonPlacement) => void) | undefined;
}

/**
 * Every label on a course island: the unit signs and icons the path layer
 * produces, then one per lesson stone.
 */
export function courseMarkers(
  lessons: readonly LessonPlacement[],
  options: CourseMarkerOptions = {},
): readonly Marker[] {
  const fromPath: Marker[] = courseSprites(lessons).map((sprite) => {
    const lesson = sprite.lessonId
      ? lessons.find((candidate) => candidate.lessonId === sprite.lessonId)
      : undefined;
    const activate = options.onPick && lesson ? () => options.onPick?.(lesson) : undefined;
    return {
      id: sprite.id,
      position: sprite.position,
      text: sprite.text,
      kind: sprite.role === "icon" ? ("icon" as const) : ("unit" as const),
      pinned: sprite.role === "icon",
      origin: sprite.role === "unit" ? ("start" as const) : ("center" as const),
      locked: sprite.locked,
      label: sprite.label,
      weight: sprite.role === "unit" ? 2 : undefined,
      ...(activate ? { activate } : {}),
    };
  });

  return [
    ...fromPath,
    ...lessons.map((lesson) => ({
      id: lesson.lessonId,
      /*
        A low lift, because the tilt is shallow. At seventy-four degrees a
        world-space unit of height travels a long way up the screen, and the
        bubble that was lifted clear of its own stone arrived next to the
        following one — pointing at the wrong lesson is worse than sitting a
        little close to the right one.
      */
      position: lesson.position.clone().setY(lesson.position.y + 1.7),
      /*
        Not the lesson title. Forty-one Chinese titles down one road all
        truncate, and the stone you are standing on only has to say 「开始」 —
        what it is called belongs to the card that opens when you choose it.
      */
      text: lesson.state === "live" ? "开始" : lesson.lessonTitle,
      kind: "lesson" as const,
      quiet: lesson.state !== "live",
      weight: lesson.state === "live" ? 3 : 0,
      ...(options.onPick ? { activate: () => options.onPick?.(lesson) } : {}),
    })),
  ];
}

/** The stone the road opens on, or null in a course with nothing to open. */
export function liveLesson(lessons: readonly LessonPlacement[]): LessonPlacement | null {
  return lessons.find((lesson) => lesson.state === "live") ?? lessons[0] ?? null;
}
