import type { ConceptHead } from "../domain/concept.js";
import type { CardProgress, ProgressDocument } from "../ports/progress.js";
import { learningSegments } from "../map-nodes/segments.js";
import {
  isLessonComplete,
  lessonRefKey,
  type LessonRef,
  type LessonProgressSnapshot,
  type ProgressSource,
} from "./contract.js";
import {
  HEAD_START_CONCEPTS,
  knowledgeSetConceptIds,
  knowledgeCardTier,
  type KnowledgeCardTier,
} from "./knowledge-cards.js";

export interface AlbumCourse {
  readonly studyId: string;
  readonly domainId: string;
  readonly id: string;
  readonly title: string;
  readonly isDefault: boolean;
  readonly units: readonly {
    readonly id: string;
    readonly title: string;
    readonly lessons: readonly (LessonProgressSnapshot & {
      readonly id: string;
      readonly conceptIds?: readonly string[];
      /** The card revision is independent of the lesson revision. */
      readonly reviewCardRevisions?: Readonly<Record<string, number>>;
    })[];
  }[];
}

export interface KnowledgeAlbumCard {
  readonly head: ConceptHead;
  readonly collected: boolean;
  /** Gifted access is not a read confirmation, XP, a review or mastery. */
  readonly starter: boolean;
  readonly tier: KnowledgeCardTier;
  readonly lessons: readonly {
    readonly locator: LessonRef;
    readonly number: number;
    readonly complete: boolean;
  }[];
  /** Existing scheduler identities only; the album creates no scheduler cards. */
  readonly reviewKeys: readonly string[];
  readonly domainIds: readonly string[];
}

export interface KnowledgeAlbumSet {
  readonly id: string;
  readonly studyId: string;
  readonly domainId: string;
  readonly courseId: string;
  readonly courseTitle: string;
  readonly ordinal: number;
  readonly conceptIds: readonly string[];
  readonly collected: number;
  readonly shining: number;
  readonly complete: boolean;
}

export interface KnowledgeAlbum {
  readonly cards: readonly KnowledgeAlbumCard[];
  readonly sets: readonly KnowledgeAlbumSet[];
  readonly coursesFinished: number;
  readonly pathsFinished: number;
  /** A published source with no links is not an empty learner record. */
  readonly lessonsWithoutConcepts: number;
}

/** Read-only projection of authored links and the one learner document.
 * Frame tier is a lesson-level memory indicator: it uses current-revision
 * course review cards from completed lessons naming this concept. It does not
 * pretend each concept has an independently assessed scheduler card. */
export function knowledgeAlbum(
  heads: readonly ConceptHead[],
  courses: readonly AlbumCourse[],
  source: ProgressSource,
  document: Pick<ProgressDocument, "cards">,
): KnowledgeAlbum {
  const byId = new Map(
    heads.map((head) => [
      head.id,
      {
        head,
        starter: (HEAD_START_CONCEPTS as readonly string[]).includes(head.id),
        lessons: [] as { locator: LessonRef; number: number; complete: boolean }[],
        reviews: [] as CardProgress[],
        domainIds: new Set<string>(head.category === "ai" ? ["ai-foundations"] : ["programming"]),
      },
    ]),
  );
  const cardsByLesson = new Map<string, CardProgress[]>();
  for (const card of Object.values(document.cards)) {
    if (card.kind === "recap-card") continue;
    const key = `${card.studyId}/${card.courseId}/${card.lessonId}`;
    const own = cardsByLesson.get(key) ?? [];
    own.push(card);
    cardsByLesson.set(key, own);
  }
  const setInputs: Omit<KnowledgeAlbumSet, "collected" | "shining" | "complete">[] = [];
  const known = new Set(byId.keys());
  const finishedPaths = new Set<string>();
  let coursesFinished = 0;
  let lessonsWithoutConcepts = 0;
  for (const course of courses) {
    const completed = new Set<string>();
    const conceptsByLesson = new Map<string, readonly string[]>();
    let number = 0;
    for (const unit of course.units) {
      for (const lesson of unit.lessons) {
        number++;
        const locator = {
          studyId: course.studyId,
          courseId: course.id,
          unitId: unit.id,
          lessonId: lesson.id,
        };
        const complete = isLessonComplete(source.completionOf(locator, lesson));
        if (complete) completed.add(lessonRefKey(locator));
        const concepts = [...new Set(lesson.conceptIds ?? [])].filter((id) => byId.has(id));
        if (lesson.conceptIds?.length === 0) lessonsWithoutConcepts++;
        conceptsByLesson.set(lesson.id, concepts);
        const reviewPrefix = `${course.studyId}/${course.id}/${lesson.id}/`;
        const reviews = (
          cardsByLesson.get(`${course.studyId}/${course.id}/${lesson.id}`) ?? []
        ).filter((card) => {
          if (!card.cardKey.startsWith(reviewPrefix) || (card.unitId && card.unitId !== unit.id))
            return false;
          const id = card.cardKey.slice(reviewPrefix.length);
          const revisions = lesson.reviewCardRevisions;
          return (
            revisions !== undefined &&
            Object.hasOwn(revisions, id) &&
            Number.isSafeInteger(revisions[id]) &&
            revisions[id]! > 0 &&
            card.contentRevision === revisions[id]
          );
        });
        for (const id of concepts) {
          const entry = byId.get(id)!;
          entry.lessons.push({ locator, number, complete });
          entry.domainIds.add(course.domainId);
          if (complete) entry.reviews.push(...reviews);
        }
      }
    }
    if (number > 0 && completed.size === number) {
      coursesFinished++;
      if (course.isDefault) finishedPaths.add(course.domainId);
    }
    for (const segment of learningSegments(course)) {
      const concepts = knowledgeSetConceptIds(
        segment.lessonIds.flatMap((id) => conceptsByLesson.get(id) ?? []),
        known,
        { domainId: course.domainId, isDefault: course.isDefault, ordinal: segment.ordinal },
      );
      if (!concepts.length) continue;
      setInputs.push({
        id: `${course.studyId}/${course.id}/${segment.id}`,
        studyId: course.studyId,
        domainId: course.domainId,
        courseId: course.id,
        courseTitle: course.title,
        ordinal: segment.ordinal,
        conceptIds: concepts,
      });
    }
  }
  const cards = [...byId.values()].map(
    ({ head, starter, lessons, reviews, domainIds }): KnowledgeAlbumCard => ({
      head,
      starter,
      lessons,
      collected: starter || lessons.some((lesson) => lesson.complete),
      tier: knowledgeCardTier(reviews),
      reviewKeys: [...new Set(reviews.map((card) => card.cardKey))],
      domainIds: [...domainIds],
    }),
  );
  const projected = new Map(cards.map((card) => [card.head.id, card]));
  return {
    cards,
    sets: setInputs.map((set) => {
      const collected = set.conceptIds.filter((id) => projected.get(id)?.collected).length;
      return {
        ...set,
        collected,
        shining: set.conceptIds.filter((id) => projected.get(id)?.tier === "shining").length,
        complete: collected === set.conceptIds.length,
      };
    }),
    coursesFinished,
    pathsFinished: finishedPaths.size,
    lessonsWithoutConcepts,
  };
}

/** Stable low-to-high reveal order; authored order breaks ties. */
export function knowledgeRevealOrder(
  cards: readonly KnowledgeAlbumCard[],
): readonly KnowledgeAlbumCard[] {
  const rank: Record<KnowledgeCardTier, number> = { new: 0, known: 1, shining: 2 };
  return [...cards].sort((a, b) => rank[a.tier] - rank[b.tier]);
}
