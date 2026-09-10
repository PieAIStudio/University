import { unmetPrerequisites, type ProgressDocument } from "@pieai/university-core";
import type { CourseNode } from "@pieai/university-world/course.js";
import { useCallback, useMemo } from "react";

import { progressPort } from "../progress/store.js";

/**
 * Everything the skip test and the prerequisite notice need from `App`.
 *
 * It lives in its own file for the same reason `useCourseProgress` does: `App`
 * is where every lane of work meets, so anything that can be a hook instead of
 * fifty inline lines there is one fewer place two branches have to be merged.
 * Nothing here is App-specific — it is three readings of the progress document
 * and the course graph, and it is testable without standing up the shell.
 */
interface SkipTestOptions {
  readonly nodes: readonly CourseNode[] | null;
  readonly progress: ProgressDocument;
  readonly courseProgress: (node: CourseNode) => number;
}

/** Named courses a learner has not finished, in the order the author listed. */
export type UnmetPrerequisites = readonly {
  readonly courseId: string;
  readonly title: string;
}[];

export function useSkipTest({ nodes, progress, courseProgress }: SkipTestOptions) {
  /*
    The one write a skip test makes, and the only one it is allowed to make.
    `markLessonsProven` deliberately has no companion here — no `advanceLesson`,
    no `dropCards` — because 「证明过」 must not become 「学过」 (V5 §12 决定 E).
  */
  const markUnitProven = useCallback(
    (studyId: string, courseId: string, unitId: string, lessonIds: readonly string[]) => {
      progressPort.markLessonsProven({ studyId, courseId, unitId, lessonIds });
    },
    [],
  );

  /*
    Every lesson a skip test has proved, read off the same subscribed document
    the rest of the screen reads. Not `progressPort.provenLessonKeys()` called
    directly: that is a snapshot, and a unit that had just been proved would
    keep offering its test until something else happened to re-render.
  */
  const provenLessonKeys = useMemo(
    () => new Set(Object.keys(progress.provenLessons ?? {})),
    [progress.provenLessons],
  );

  /*
    What a course assumes and the learner has not done — one reading of the
    graph, shared with the map's lighting through `unmetPrerequisites`. Named
    courses rather than a count, because 决定 C asks the product to 「说明它假定
    你已经会了什么」 and a number does not.
  */
  const unmetFor = useCallback(
    (
      node: { readonly prerequisiteCourseIds?: readonly string[] } | null,
      studyId: string,
    ): UnmetPrerequisites => {
      if (!node) return [];
      const sameStudy = (nodes ?? []).filter((peer) => peer.studyId === studyId);
      return unmetPrerequisites(
        node,
        sameStudy.map((peer) => ({ courseId: peer.courseId, title: peer.title })),
        (courseId) => {
          const peer = sameStudy.find((candidate) => candidate.courseId === courseId);
          return peer !== undefined && courseProgress(peer) >= 1;
        },
      );
    },
    [nodes, courseProgress],
  );

  return { markUnitProven, provenLessonKeys, unmetFor };
}
