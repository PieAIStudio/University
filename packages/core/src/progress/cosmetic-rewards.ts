import { CONCEPT_HEADS } from "../concepts/heads.js";
import { learningSegments } from "../map-nodes/segments.js";
import { HEAD_START_CONCEPTS, knowledgeSetConceptIds } from "./knowledge-cards.js";
import { learningDomainOfStudy } from "../domain/learning-domain.js";
import { challengeWonEventId } from "./goals.js";
import type { LessonProgressSnapshot } from "./contract.js";

/** The map and the metadata producer share the same positional chest rule. */
export function lessonRewardTier(
  index: number,
  total: number,
  endsSegment: boolean,
): "wood" | "rare" | "legendary" {
  if (index < 0 || index >= total) return "wood";
  return index === total - 1 ? "legendary" : endsSegment ? "rare" : "wood";
}
export interface CosmeticRewardReference {
  readonly lessonKey: string;
  readonly unitId: string;
  readonly contentRevision: number;
  readonly exerciseIds: readonly string[];
  readonly perfect?: true;
  readonly reviewCardRevisions?: Readonly<Record<string, number>>;
}
export interface CosmeticRewardRule {
  readonly id: string;
  readonly kind: "chest" | "set" | "set-shining" | "challenge";
  readonly itemId?: string;
  readonly eventId?: string;
  readonly packs?: 1 | 2 | 3;
  readonly perfectPacks?: 1 | 2 | 3;
  readonly perfectItemId?: string;
  readonly requirements: readonly (readonly CosmeticRewardReference[])[];
}
export interface CosmeticRewardCourse {
  readonly studyId: string;
  readonly id: string;
  readonly isDefault?: boolean;
  readonly units: readonly {
    readonly id: string;
    readonly title: string;
    readonly lessons: readonly (LessonProgressSnapshot & {
      readonly id: string;
      readonly conceptIds?: readonly string[];
      readonly reviewCardRevisions?: Readonly<Record<string, number>>;
    })[];
  }[];
}
export function courseChallengeEventId(
  studyId: string,
  courseId: string,
  segmentId: string,
): string {
  return challengeWonEventId(`${studyId}/${courseId}/opportunity:challenge:${segmentId}`);
}

/** Called by the existing course producer, never by a learner to authorize a
 * draw. Output contains only identities and revision/exercise metadata; no
 * answers, prose, AI decisions or additional content production. */
export function cosmeticRewardRules(
  courses: readonly CosmeticRewardCourse[],
): readonly CosmeticRewardRule[] {
  const rules: CosmeticRewardRule[] = [];
  const known = new Set(CONCEPT_HEADS.map((head) => head.id));
  const starters = new Set<string>(HEAD_START_CONCEPTS);
  const occurrences = new Map<string, CosmeticRewardReference[]>();
  const memoryOccurrences = new Map<string, CosmeticRewardReference[]>();
  const shaped = courses.map((course) => {
    const lessons = course.units.flatMap((unit) =>
      unit.lessons.map((lesson) => {
        if (
          lesson.exerciseIdsComplete === false ||
          !Number.isInteger(lesson.contentRevision) ||
          lesson.contentRevision < 1
        )
          throw new Error("cosmetic reward metadata needs the complete current lesson shape");
        const ref: CosmeticRewardReference = {
          lessonKey: `${course.studyId}/${course.id}/${lesson.id}`,
          unitId: unit.id,
          contentRevision: lesson.contentRevision,
          exerciseIds: [...lesson.exerciseIds],
        };
        for (const id of new Set(lesson.conceptIds ?? [])) {
          if (!known.has(id)) continue;
          const refs = occurrences.get(id) ?? [];
          refs.push(ref);
          occurrences.set(id, refs);
          const memory = memoryOccurrences.get(id) ?? [];
          memory.push({ ...ref, reviewCardRevisions: { ...lesson.reviewCardRevisions } });
          memoryOccurrences.set(id, memory);
        }
        return { ...lesson, unitId: unit.id, ref };
      }),
    );
    return { course, lessons };
  });
  for (const { course, lessons } of shaped) {
    const segments = learningSegments(course);
    const ends = new Set(segments.map((segment) => segment.lastIndex));
    for (const [index, lesson] of lessons.entries()) {
      const tier = lessonRewardTier(index, lessons.length, ends.has(index));
      // An ordinary wood chest earns a pack only when an all-first-try finish
      // upgrades it to blue. It is not a second award on a later revision.
      rules.push({
        id: `lesson:${lesson.ref.lessonKey}`,
        kind: "chest",
        packs: tier === "legendary" ? 3 : 1,
        ...(tier === "rare" ? { perfectItemId: "avatar-beanie" } : {}),
        requirements: [[{ ...lesson.ref, ...(tier === "wood" ? { perfect: true as const } : {}) }]],
      });
    }
    for (const segment of segments) {
      const members = lessons.slice(segment.firstIndex, segment.lastIndex + 1);
      rules.push({
        id: `gate:${course.studyId}/${course.id}/${segment.id}`,
        kind: "chest",
        packs: 1,
        perfectPacks: 3,
        itemId: "avatar-beanie",
        requirements: members.map((lesson) => [lesson.ref]),
      });
      rules.push({
        id: `challenge:${course.studyId}/${course.id}/${segment.id}`,
        kind: "challenge",
        eventId: courseChallengeEventId(course.studyId, course.id, segment.id),
        packs: 1,
        itemId: "avatar-beanie",
        requirements: [],
      });
      const concepts = knowledgeSetConceptIds(
        members.flatMap((lesson) => lesson.conceptIds ?? []),
        known,
        {
          domainId: learningDomainOfStudy(course.studyId),
          isDefault: course.isDefault === true,
          ordinal: segment.ordinal,
        },
      );
      if (!concepts.length) continue;
      rules.push({
        id: `set:${course.studyId}/${course.id}/${segment.id}`,
        kind: "set",
        itemId: "avatar-set-band",
        requirements: concepts.filter((id) => !starters.has(id)).map((id) => occurrences.get(id)!),
      });
      rules.push({
        id: `set-shining:${course.studyId}/${course.id}/${segment.id}`,
        kind: "set-shining",
        itemId: "back-set-crown",
        // An unlinked gift cannot be declared remembered. Empty alternatives
        // keep that explicit on the server rather than dropping the condition.
        requirements: concepts.map((id) => memoryOccurrences.get(id) ?? []),
      });
    }
  }
  if (new Set(rules.map((rule) => rule.id)).size !== rules.length)
    throw new Error("duplicate cosmetic reward identity");
  return rules;
}
