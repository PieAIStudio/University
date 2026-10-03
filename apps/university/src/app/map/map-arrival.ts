/**
 * What happens once the map has arrived: the splash is done, the scene drew
 * its frame and the data it stands on is in. Before that, a camera move lands
 * on an empty sea and an invitation points at nothing.
 */
import { useEffect, useRef, type RefObject } from "react";
import {
  lessonRefKey,
  type IdentityStatus,
  type LessonRef,
  type ProgressDocument,
  type View,
} from "@pieai/university-core";
import type { LessonPlacement } from "@pieai/university-world/Maps.js";
import type { MapViewportCommands } from "@pieai/university-world/WorldMapCanvas.js";
import { progressPort } from "../../progress/store";
import { isWelcomeEntry } from "../journey/welcome-policy";

interface FrameOnceOptions {
  readonly guideUser: string;
  readonly sceneAttempt: number;
  readonly splashReady: boolean;
  readonly lessons: readonly LessonPlacement[];
  readonly mapCommands: RefObject<MapViewportCommands | null>;
}

/**
 * Frame one lesson stone, once per learner, scene attempt and target. Framing
 * the real stone rather than the ordinary road's look-ahead point keeps its
 * chest above the guide's bottom card even on a narrow phone. No scenery moves.
 */
export function useFrameLessonOnce(
  target: LessonRef | null,
  { guideUser, sceneAttempt, splashReady, lessons, mapCommands }: FrameOnceOptions,
) {
  const framed = useRef<string | null>(null);
  useEffect(() => {
    if (!target) {
      framed.current = null;
      return;
    }
    const key = `${guideUser}:${sceneAttempt}:${lessonRefKey(target)}`;
    if (!splashReady || framed.current === key) return;
    const stone = lessons.find((lesson) => lesson.lessonId === target.lessonId);
    if (!stone || !mapCommands.current) return;
    framed.current = key;
    mapCommands.current.focus(stone.position.toArray());
  }, [target, guideUser, sceneAttempt, splashReady, lessons]);
}

interface ContinueOnReturnOptions {
  readonly viewKind: View["kind"];
  readonly admissionPending: boolean;
  readonly splashReady: boolean;
  readonly identityStatus: IdentityStatus;
  readonly welcomeVisible: boolean;
  readonly todayLesson: LessonRef | null | undefined;
  readonly progress: ProgressDocument;
  readonly continueAt: (lesson: LessonRef) => void;
}

/**
 * A returning learner who comes in at the front door is offered today's
 * lesson once (V7 return), after their own record has finished syncing. Any
 * other first route, or a first-time learner, is left where they arrived.
 */
export function useContinueOnReturn({
  viewKind,
  admissionPending,
  splashReady,
  identityStatus,
  welcomeVisible,
  todayLesson,
  progress,
  continueAt,
}: ContinueOnReturnOptions) {
  const returnEntry = useRef(
    typeof location !== "undefined" && isWelcomeEntry(new URL(location.href)),
  );
  useEffect(() => {
    if (!returnEntry.current) return;
    if (viewKind !== "world") {
      returnEntry.current = false;
      return;
    }
    if (admissionPending || !splashReady || identityStatus.kind === "pending") return;
    const owner =
      identityStatus.kind === "signed_in" || identityStatus.kind === "anonymous"
        ? identityStatus.user.id
        : null;
    if (progressPort.syncState().userId !== owner) return;
    if (progressPort.syncState().status === "syncing") return;
    returnEntry.current = false;
    if (welcomeVisible || !todayLesson || Object.keys(progress.lessons).length === 0) return;
    continueAt(todayLesson);
  }, [
    viewKind,
    admissionPending,
    splashReady,
    identityStatus,
    welcomeVisible,
    todayLesson,
    progress,
    continueAt,
  ]);
}
