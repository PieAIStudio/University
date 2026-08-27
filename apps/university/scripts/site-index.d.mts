export interface LessonRef {
  readonly studyId: string;
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
}

export interface SiteIndex {
  readonly lessonCount: number;
  readonly locations: readonly string[];
  readonly robots: string;
  readonly sitemap: string;
}

export function lessonRefsForShelf(shelf: unknown): LessonRef[];
export function buildSiteIndex(
  shelf: unknown,
  options: {
    readonly publicOrigin: string;
    readonly pathForLesson: (ref: LessonRef) => string;
  },
): SiteIndex;
