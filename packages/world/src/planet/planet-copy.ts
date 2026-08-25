/**
 * The only "introduction" a study is allowed to have on this page.
 *
 * `imported.json` carries `studyId` / `title` / `defaultCourseId` / `courses`
 * and nothing else — there is no summary field. A slogan written here would
 * be fiction, and fiction on a course picker is how a page starts lying
 * about a library it has not read.
 *
 * The long-term fix is an authored `summary` on the study, written in
 * `apps/local` and published with the rest of the package. Until that
 * exists, the intro is a fold of counts and the course titles already in
 * the graph, in teaching order.
 */

export interface PlanetStudy {
  readonly id: string;
  readonly title: string;
  readonly courseCount: number;
  readonly lessonCount: number;
  readonly lessonsDone: number;
  /** Course names in teaching order. Used as the introduction, not decoration. */
  readonly courseTitles: readonly string[];
}

/**
 * How big a series is. Size only — where you stand in it is `studyStage`.
 *
 * This used to end with 「没开始」 or 「学了 3/60 节」 as well, and once the row
 * grew a stage chip and a progress bar the same fact was on screen three times
 * in three shapes. A row that says one thing three times reads as a row with
 * nothing to say.
 */
export function studyCounts(study: PlanetStudy): string {
  return `${study.courseCount} 门课 · ${study.lessonCount} 节`;
}

/**
 * Where a series stands, in one word.
 *
 * The list used to say only how many courses and lessons a series holds, so
 * five rows of very similar numbers were the entire basis for choosing one —
 * and the one fact that actually decides it, whether you are already partway
 * into a series, was the one fact missing. Three states, because a fourth
 * ("nearly done") would be a judgement about a number the reader can already
 * see on the bar beside it.
 */
export type StudyStage = "not-started" | "learning" | "done";

export function studyStage(study: PlanetStudy): StudyStage {
  if (study.lessonCount > 0 && study.lessonsDone >= study.lessonCount) return "done";
  return study.lessonsDone > 0 ? "learning" : "not-started";
}

export const STUDY_STAGE_LABEL: Record<StudyStage, string> = {
  "not-started": "没开始",
  learning: "学习中",
  done: "已学完",
};

/** Whole percent, floored, so 99.6% never reads as a finished series. */
export function studyPercent(study: PlanetStudy): number {
  if (study.lessonCount <= 0) return 0;
  return Math.floor((study.lessonsDone / study.lessonCount) * 100);
}

export function studyCourseList(
  study: PlanetStudy,
  visible = 4,
): {
  readonly shown: readonly string[];
  readonly rest: number;
  readonly restLabel: string | null;
} {
  const shown = study.courseTitles.slice(0, visible);
  const rest = Math.max(0, study.courseTitles.length - shown.length);
  return {
    shown,
    rest,
    restLabel: rest > 0 ? `还有 ${rest} 门` : null,
  };
}
