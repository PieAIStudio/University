/**
 * Where a peer's chip sits on the overlay, as an id the projector can find.
 *
 * The world map knows courses; the course path knows lessons. A friend is
 * only allowed the lighter layer (online, which course), so they never
 * get a lesson anchor — putting them on a stone would leak the thing the
 * relation is supposed to hide.
 */
import type { PresencePeer } from "@pieai/university-core";

export type PresenceSurface = "world" | "course";

export function presenceAnchorId(peer: PresencePeer, surface: PresenceSurface): string | null {
  const location = peer.location;
  if (!location) return null;
  if (surface === "world") {
    if (!location.courseId) return null;
    return `course:${location.studyId ?? "_"}/${location.courseId}`;
  }
  if (peer.relation !== "group") return null;
  if (!location.lessonId) return null;
  return `lesson:${location.lessonId}`;
}

export function presenceViewKey(view: {
  readonly kind: string;
  readonly studyId?: string;
  readonly courseId?: string;
  readonly lessonId?: string;
}): string {
  if (view.kind === "world") return "world";
  if (view.kind === "course" && view.studyId && view.courseId) {
    return `course:${view.studyId}/${view.courseId}`;
  }
  if (view.kind === "lesson" && view.studyId && view.courseId && view.lessonId) {
    return `lesson:${view.studyId}/${view.courseId}/${view.lessonId}`;
  }
  return view.kind;
}
