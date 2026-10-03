import type { ProgressDocument } from "@pieai/university-core";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";
import { useMemo } from "react";

type CourseOf = (studyId: string, courseId: string) => CourseView | null;

interface ProfileStatsOptions {
  readonly progress: ProgressDocument;
  readonly courseOf: CourseOf;
}

export function useProfileStats({ progress, courseOf }: ProfileStatsOptions) {
  const profileStats = useMemo(() => {
    let lessonsCompleted = 0;
    let passagesRead = 0;
    for (const [key, lesson] of Object.entries(progress.lessons)) {
      if (lesson.completedAt == null && lesson.progress < 1) continue;
      lessonsCompleted += 1;
      const [studyId, courseId, lessonId] = key.split("/");
      if (!studyId || !courseId || !lessonId) continue;
      const found = courseOf(studyId, courseId)
        ?.units.flatMap((unit) => unit.lessons)
        .find((entry) => entry.id === lessonId);
      /*
        Zero where the shelf cannot count citations, which is the authoring
        build — its API sends a summary, not a body. That build has always
        reported 0 here; it now reports 0 for a stated reason.
      */
      passagesRead += found?.evidenceCount ?? 0;
    }
    /*
      A course counts as finished only when every lesson in it is, which needs
      the course's own shape rather than the progress document alone — the
      document knows what was completed, not how many there were to complete.
      `peekCourse` returns only what has already been loaded, so this is the
      count among courses the learner has actually opened; a course they
      finished on another device and never opened here does not appear until
      it loads, which under-counts rather than over-counts.
    */
    const byCourse = new Map<string, Set<string>>();
    for (const [key, lesson] of Object.entries(progress.lessons)) {
      if (lesson.completedAt == null && lesson.progress < 1) continue;
      const [studyId, courseId, lessonId] = key.split("/");
      if (!studyId || !courseId || !lessonId) continue;
      const at = `${studyId}/${courseId}`;
      const done = byCourse.get(at) ?? new Set<string>();
      done.add(lessonId);
      byCourse.set(at, done);
    }
    let coursesFinished = 0;
    for (const [at, done] of byCourse) {
      const [studyId, courseId] = at.split("/");
      const shape = studyId && courseId ? courseOf(studyId, courseId) : null;
      if (!shape) continue;
      const total = shape.units.reduce((sum, unit) => sum + unit.lessons.length, 0);
      if (total > 0 && done.size >= total) coursesFinished += 1;
    }

    return { lessonsCompleted, passagesRead, coursesFinished };
  }, [progress, courseOf]);

  return profileStats;
}
