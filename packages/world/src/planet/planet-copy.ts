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

export function studyCounts(study: PlanetStudy): string {
  const progress =
    study.lessonsDone <= 0 ? "没开始" : `学了 ${study.lessonsDone}/${study.lessonCount} 节`;
  return `${study.courseCount} 门课 · ${study.lessonCount} 节 · ${progress}`;
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
