/**
 * The published lesson, folded into the read model the shared reader already
 * speaks.
 *
 * A published package is one immutable snapshot, but the lesson's
 * `contentRevision` still identifies which source version that snapshot is.
 * The shared reader and progress document must see that number so a read
 * confirmation is bound to the version the learner actually opened.
 */
import { translate } from "@pieai/university-ui/i18n.js";
import {
  assembleLessonIndex,
  backlinksOf,
  parseLessonLinks,
  resolveEvidenceAnchors,
  resolveLessonLinks,
  resolveTermLinks,
  termRangeOf,
  type LessonCompletion,
} from "@pieai/university-core";
import { lessonProgressOf, type LessonView } from "@pieai/university-ui/view/lesson-view.js";

import { isRepositoryAnchor } from "../content/library";
import type { Course, Lesson } from "../content/library";
import { languageLayerFor, LEXICON } from "./language";

export const ONLINE_CONTENT_REVISION = 1;

const LEXICON_BY_ID = new Map(LEXICON.map((entry) => [entry.senseId, entry]));

export function assembleLessonView(input: {
  readonly course: Course;
  readonly lesson: Lesson;
  readonly studyId: string;
  readonly unitId: string;
  readonly completion: LessonCompletion;
  readonly progress: {
    readonly progress: number;
    readonly completedAt: number | null;
    readonly attempts: number;
    readonly readConfirmed?: boolean;
    readonly readConfirmedRevision?: number;
  };
}): LessonView {
  const { course, lesson, unitId, progress, completion } = input;
  const contentRevision = lesson.contentRevision;
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
  /*
    Only repository citations pin a lesson to a commit. A 通用课 cites public
    pages, so it has no pinned commit at all — and `commits.length === 1` below
    would otherwise be satisfied by a single `undefined` and print 「这节课钉在
    undefined 的版本」.
  */
  const repositoryEvidence = lesson.evidence.filter(isRepositoryAnchor);
  const commits = [...new Set(repositoryEvidence.map((item) => item.sourceCommit))];
  return {
    lesson: {
      id: lesson.id,
      title: lesson.title,
      contentRevision,
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
      /*
        Both kinds, in their original order. `evidenceIndex` on a resolved
        anchor indexes into this list and the reader opens that entry, so
        filtering the public-page citations out here would renumber every
        repository citation after one of them. A citation with no path simply
        never covers a `[[evidence:path:line]]` marker — which is the truth,
        stated rather than arranged for.
      */
      evidenceAnchors: resolveEvidenceAnchors(
        lesson.content,
        lesson.evidence.map((item) =>
          isRepositoryAnchor(item)
            ? { sourcePath: item.sourcePath, lineStart: item.lineStart, lineEnd: item.lineEnd }
            : { sourcePath: undefined },
        ),
      ),
      termAnchors: resolveTermLinks(parsed, LEXICON_BY_ID).map(termRangeOf),
      progress: lessonProgressOf(progress, completion, contentRevision, lesson.exercises.length),
      evidence: lesson.evidence.map((item) =>
        isRepositoryAnchor(item)
          ? {
              kind: item.kind,
              sourcePath: item.sourcePath,
              lineStart: item.lineStart,
              lineEnd: item.lineEnd,
              sourceCommit: item.sourceCommit,
              nodeIds: [],
              note: item.note ?? null,
            }
          : {
              kind: item.kind,
              sourceUrl: item.sourceUrl,
              sourceTitle: item.sourceTitle,
              sourceAuthority: item.sourceAuthority,
              note: item.note ?? null,
            },
      ),
      assets: lesson.assets ?? [],
      exercises: lesson.exercises.map((exercise) => ({
        id: exercise.id,
        kind: exercise.kind,
        title: exercise.title ?? translate("app.lesson.assembleview.copy.自检"),
        prompt: exercise.prompt,
        contentRevision,
      })),
      cards: lesson.cards.map((card) => ({
        id: card.id,
        kind: card.kind,
        front: card.front,
        contentRevision,
      })),
    },
  };
}
