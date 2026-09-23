/**
 * What the course path puts on the overlay: one kind icon per lesson stone.
 *
 * Unit names used to float here too, at the middle of the unit's stones inside
 * the window, pushed off the road — so the name moved whenever the live stone
 * did and landed beside whichever icon was nearest, where it read as a lesson
 * name in the wrong place. The owner called it out (V5 R59, 2026-09-23); a
 * unit's name now lives in the card and the course panel, not on the island.
 *
 * This is only the set of things, bounded by a window around the live stone.
 * One projector (LabelProbe) decides where they sit and whether they are
 * visible. Unbounded, a 41-lesson course projected 47 sprites that collided
 * 215 times in the far field, because the ones behind the fog still asked
 * for a box. The window is the same argument as v3's 「收敛规则：三格窗」:
 * what is on screen has to stop growing before the content does.
 */
import * as THREE from "three";

import { PATH_KIND_ICON, PATH_KIND_LABEL, type PathNodeKind } from "../course/path-language";

/** The fields courseSprites reads. LessonPlacement satisfies this. */
export interface PathLesson {
  readonly unitId: string;
  readonly unitTitle: string;
  readonly lessonId: string;
  readonly chars: number;
  readonly position: THREE.Vector3;
  readonly state: "done" | "live" | "idle" | "locked";
  readonly kind: PathNodeKind;
}

export interface PathSprite {
  readonly id: string;
  /** The lesson represented by an interactive kind icon, when there is one. */
  readonly lessonId?: string;
  readonly position: THREE.Vector3;
  readonly text: string;
  readonly label?: string;
  readonly role: "icon";
  readonly locked?: boolean;
}

/**
 * Stones either side of the live one. Wider than the five readable nodes so
 * an icon does not pop in at the edge of what you can already see. The live
 * stone is the avatar's ground, so its duplicate kind icon is intentionally
 * omitted; the DOM "开始" label and the avatar already identify that node.
 */
export const SPRITE_WINDOW = 8;

/** A wall of 4,900 characters should be a bigger step before it is entered. */
export function stoneRadius(chars: number): number {
  return 1.5 + Math.min(chars, 5000) / 3600;
}

export function courseSprites(lessons: readonly PathLesson[]): PathSprite[] {
  const currentIndex = Math.max(
    0,
    lessons.findIndex((lesson) => lesson.state === "live"),
  );
  const inWindow = (index: number) => Math.abs(index - currentIndex) <= SPRITE_WINDOW;

  const icons: PathSprite[] = lessons
    .filter((lesson, index) => inWindow(index) && lesson.state !== "live")
    .map((lesson) => {
      const radius = stoneRadius(lesson.chars);
      return {
        id: `kind:${lesson.lessonId}`,
        lessonId: lesson.lessonId,
        role: "icon" as const,
        text: PATH_KIND_ICON[lesson.kind],
        label: PATH_KIND_LABEL[lesson.kind],
        locked: lesson.state === "locked",
        position: lesson.position.clone().setY(lesson.position.y + Math.max(1.05, radius * 0.5)),
      };
    });

  return icons;
}
