/**
 * The published lesson, folded into the read model the shared reader already
 * speaks.
 *
 * Delivery never had `contentRevision` on the wire: a published package is
 * one snapshot. The shared reader still asks for a number, so this is 1 —
 * not because the lesson is on its first draft, but because this shell has
 * exactly one edition of it.
 */
import {
  assembleLessonIndex,
  backlinksOf,
  parseLessonLinks,
  resolveEvidenceAnchors,
  resolveLessonLinks,
  resolveTermLinks,
  termRangeOf,
} from "@pieai/university-core";
import type { LessonProgress, LessonView } from "@pieai/university-ui/view/lesson-view.js";

import type { Course, Lesson } from "../content/library";
import { languageLayerFor, LEXICON } from "./language";

export const ONLINE_CONTENT_REVISION = 1;

const LEXICON_BY_ID = new Map(LEXICON.map((entry) => [entry.senseId, entry]));

export function assembleLessonView(input: {
  readonly course: Course;
  readonly lesson: Lesson;
  readonly studyId: string;
  readonly unitId: string;
  readonly progress: { readonly progress: number; readonly completedAt: number | null };
}): LessonView {
  const { course, lesson, unitId, progress } = input;
  const parsed = parseLessonLinks(lesson.content);
  const index = assembleLessonIndex(
    course.units.flatMap((unit) =>
      unit.lessons.map((item) => ({
        courseId: course.id,
        unitId: unit.id,
        lessonId: item.id,
        title: item.title,
        content: item.content,
        sections: [],
      })),
    ),
  );
  const from = { courseId: course.id, unitId, lessonId: lesson.id };
  const language = languageLayerFor(lesson.content);
  const commits = [...new Set(lesson.evidence.map((item) => item.sourceCommit))];
  const completed = progress.progress >= 1;

  return {
    lesson: {
      id: lesson.id,
      title: lesson.title,
      contentRevision: ONLINE_CONTENT_REVISION,
      content: lesson.content,
      sections: lesson.sections ?? [],
      language,
      links: resolveLessonLinks(parsed, index, from).map((item) =>
        item.kind === "resolved"
          ? {
              start: item.link.start,
              end: item.link.end,
              label: item.link.label,
              target: item.target,
            }
          : {
              start: item.link.start,
              end: item.link.end,
              label: item.link.label,
              target: null,
            },
      ),
      backlinks: backlinksOf(index, from),
      ...(commits.length === 1 ? { pinnedCommit: { commit: commits[0]! } } : {}),
      evidenceAnchors: resolveEvidenceAnchors(lesson.content, lesson.evidence),
      termAnchors: resolveTermLinks(parsed, LEXICON_BY_ID).map(termRangeOf),
      progress: lessonProgressOf(progress, completed),
      evidence: lesson.evidence.map((item) => ({
        kind: item.kind,
        sourcePath: item.sourcePath,
        lineStart: item.lineStart,
        lineEnd: item.lineEnd,
        sourceCommit: item.sourceCommit,
        nodeIds: [],
        note: item.note ?? null,
      })),
      assets: lesson.assets ?? [],
      exercises: lesson.exercises.map((exercise) => ({
        id: exercise.id,
        kind: exercise.kind,
        title: exercise.title ?? "自检",
        prompt: exercise.prompt,
        contentRevision: ONLINE_CONTENT_REVISION,
      })),
      cards: lesson.cards.map((card) => ({
        id: card.id,
        kind: card.kind,
        front: card.front,
        contentRevision: ONLINE_CONTENT_REVISION,
      })),
    },
  };
}

function lessonProgressOf(
  progress: { readonly progress: number; readonly completedAt: number | null },
  completed: boolean,
): LessonProgress | null {
  if (progress.progress === 0 && progress.completedAt === null) return null;
  return {
    contentRevision: ONLINE_CONTENT_REVISION,
    status: completed ? "completed" : "in-progress",
    progress: progress.progress,
    updatedAt: new Date(progress.completedAt ?? Date.now()).toISOString(),
    readConfirmed: completed,
  };
}
