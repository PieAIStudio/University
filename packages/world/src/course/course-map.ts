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
import type { Course } from "./course.js";
import type { LessonPlacement, Marker } from "../Maps.js";

const COURSE_CAMERA_FRONT = 48;
const COURSE_CAMERA_HEIGHT = 22;

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
 * Both ends of the shot are anchored to real stones rather than to hand-tuned
 * offsets: stand in front of the live one, aim at the road four lessons ahead.
 * With the top-to-bottom road, the learner's marker recedes above the target
 * while the next stones descend toward the viewer. That makes "the live stone
 * is in frame with the road below it" a property of the geometry instead of a
 * number somebody guessed.
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
 * Sharing x costs nothing the shot wanted: the eye still slides sideways with
 * the road as the learner advances, so the walk still feels like a road, and
 * looking straight down the axis makes the curve ahead *more* visible rather
 * than less, because the frame no longer turns with it.
 *
 * Only the distance and the bearing survive: `Controls` pins the tilt and
 * recomputes the eye from (target, distance, bearing) on the next frame, so
 * the height here is discarded.
 */
export function frameCourse(lessons: readonly LessonPlacement[]): {
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
} | null {
  const found = lessons.findIndex((lesson) => lesson.state === "live");
  const liveIndex = found < 0 ? 0 : found;
  const live = lessons[liveIndex];
  if (!live) return null;
  const ahead = lessons[Math.min(liveIndex + 4, lessons.length - 1)] ?? live;
  return {
    // The eye stays on the +Z side of the road. That is the kit avatar's front
    // side, so the learner can read the face rather than the back of the head.
    cameraFrom: [
      live.position.x,
      live.position.y + COURSE_CAMERA_HEIGHT,
      live.position.z + COURSE_CAMERA_FRONT,
    ],
    lookAt: [live.position.x, ahead.position.y + 1.8, ahead.position.z],
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
  const fromPath: Marker[] = courseSprites(lessons).map((sprite) => ({
    id: sprite.id,
    position: sprite.position,
    text: sprite.text,
    kind: sprite.role === "icon" ? ("icon" as const) : ("unit" as const),
    pinned: sprite.role === "icon",
    origin: sprite.role === "unit" ? ("start" as const) : ("center" as const),
    locked: sprite.locked,
    label: sprite.label,
    weight: sprite.role === "unit" ? 2 : undefined,
  }));

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
