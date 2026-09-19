/** Course opportunities are derived from authored order, never added as lessons. */
export type MapLearningKind = "personal" | "challenge" | "checkpoint";

export interface LearningSegment {
  readonly id: string;
  readonly unitId: string;
  readonly unitTitle: string;
  readonly ordinal: number;
  readonly lessonIds: readonly string[];
  readonly firstIndex: number;
  readonly lastIndex: number;
  readonly anchorLessonId: string;
}

export interface SegmentCourse {
  readonly units: readonly {
    readonly id: string;
    readonly title: string;
    readonly lessons: readonly { readonly id: string }[];
  }[];
}

/** Balanced 3–5-lesson blocks; a genuinely short unit stays short, not padded.
 * E.g. six lessons become 3+3, not 5+1. Never bridge unrelated units. */
export function learningSegments(course: SegmentCourse): readonly LearningSegment[] {
  const result: LearningSegment[] = [];
  let courseIndex = 0;
  for (const unit of course.units) {
    const count = unit.lessons.length;
    if (!count) continue;
    const groups = Math.ceil(count / 5);
    const size = Math.floor(count / groups);
    const larger = count % groups;
    let unitIndex = 0;
    for (let group = 0; group < groups; group += 1) {
      const lessons = unit.lessons.slice(unitIndex, unitIndex + size + (group < larger ? 1 : 0));
      const last = lessons.at(-1)!;
      result.push({
        id: `${unit.id}--${lessons[0]!.id}--${last.id}`,
        unitId: unit.id,
        unitTitle: unit.title,
        ordinal: result.length + 1,
        lessonIds: lessons.map((lesson) => lesson.id),
        firstIndex: courseIndex + unitIndex,
        lastIndex: courseIndex + unitIndex + lessons.length - 1,
        anchorLessonId: last.id,
      });
      unitIndex += lessons.length;
    }
    courseIndex += count;
  }
  return result;
}

export function learningNodeId(segment: LearningSegment, kind: MapLearningKind): string {
  return `opportunity:${kind}:${segment.id}`;
}

/** Display a few nearby nodes while retaining every segment in the accessible list. */
export function nearestLearningSegment(
  segments: readonly LearningSegment[],
  nextLessonId: string | undefined,
): LearningSegment | undefined {
  return (
    segments.find((segment) => segment.lessonIds.includes(nextLessonId ?? "")) ?? segments.at(-1)
  );
}
