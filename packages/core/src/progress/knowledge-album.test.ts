import { describe, expect, it } from "vitest";
import type { ConceptHead } from "../domain/concept.js";
import { emptyProgress } from "./document.js";
import type { CardProgress } from "../ports/progress.js";
import { knowledgeAlbum, knowledgeRevealOrder, type AlbumCourse } from "./knowledge-album.js";
import type { ProgressSource } from "./contract.js";

const heads: readonly ConceptHead[] = ["prompt", "ai-basics", "hallucination", "frontend"].map(
  (id) => ({
    id,
    zh: id,
    en: id,
    tagline: id,
    group: "test",
    category: id === "frontend" ? "frontend" : "ai",
  }),
);
const course: AlbumCourse = {
  studyId: "s",
  domainId: "ai-foundations",
  id: "c",
  title: "Course",
  isDefault: true,
  units: [
    {
      id: "u",
      title: "Unit",
      lessons: [
        {
          id: "l",
          contentRevision: 2,
          exerciseIds: ["q"],
          conceptIds: ["prompt", "hallucination", "hallucination", "unknown"],
          reviewCardRevisions: { review: 2 },
        },
        { id: "next", contentRevision: 1, exerciseIds: [], conceptIds: [] },
      ],
    },
  ],
};
const source: ProgressSource = {
  completionOf: () => ({ readConfirmed: true, exercisesPassed: true }),
};
const doc = () => emptyProgress();
const review = (patch: Partial<CardProgress> = {}): CardProgress => ({
  cardKey: "s/c/l/review",
  studyId: "s",
  courseId: "c",
  unitId: "u",
  lessonId: "l",
  contentRevision: 2,
  kind: "course-card",
  dueAt: 0,
  fsrs: {
    due: "2026-01-01T00:00:00.000Z",
    stability: 21,
    difficulty: 5,
    elapsed_days: 21,
    scheduled_days: 21,
    learning_steps: 0,
    reps: 3,
    lapses: 0,
    state: 2,
  },
  ...patch,
});

describe("the knowledge album is a projection, never a second learner store", () => {
  it("starts with exactly two real gifts, without creating lessons or scheduler cards", () => {
    const document = doc();
    const before = JSON.stringify(document);
    const album = knowledgeAlbum(heads, [], source, document);
    expect(album.cards.filter((card) => card.collected).map((card) => card.head.id)).toEqual([
      "prompt",
      "ai-basics",
    ]);
    expect(album.cards.every((card) => card.tier === "new")).toBe(true);
    expect(JSON.stringify(document)).toBe(before);
    expect(album.coursesFinished).toBe(0);
  });
  it("uses only registered authored concepts, de-duplicates them and keeps the whole catalogue", () => {
    const album = knowledgeAlbum(heads, [course], source, doc());
    expect(album.cards).toHaveLength(heads.length);
    expect(album.cards.find((card) => card.head.id === "hallucination")?.collected).toBe(true);
    expect(album.sets[0]?.conceptIds).toEqual(["ai-basics", "prompt", "hallucination"]);
    expect(album.sets[0]?.complete).toBe(true);
    expect(album.lessonsWithoutConcepts).toBe(1);
  });
  it("requires current-revision reading AND passed exercises, not proof or aggregate progress", () => {
    for (const completion of [
      { readConfirmed: false, exercisesPassed: true },
      { readConfirmed: true, exercisesPassed: false },
    ]) {
      const album = knowledgeAlbum(
        heads,
        [course],
        { completionOf: () => completion, provenOf: () => true },
        doc(),
      );
      expect(album.cards.find((card) => card.head.id === "hallucination")?.collected).toBe(false);
      expect(album.coursesFinished).toBe(0);
    }
  });
  it("uses current lesson review history for the frame, without borrowing another account or lesson", () => {
    const document = doc();
    document.cards.r = review();
    const card = knowledgeAlbum(heads, [course], source, document).cards.find(
      (item) => item.head.id === "hallucination",
    )!;
    expect(card.tier).toBe("shining");
    expect(card.reviewKeys).toEqual(["s/c/l/review"]);
    expect(
      knowledgeAlbum(heads, [course], source, doc()).cards.find(
        (item) => item.head.id === "hallucination",
      )?.tier,
    ).toBe("new");
  });
  it.each([
    { studyId: "other" },
    { courseId: "other" },
    { lessonId: "other" },
    { unitId: "other" },
    { contentRevision: 1 },
    { contentRevision: undefined },
    { kind: "recap-card" as const },
  ])("does not upgrade from unrelated, old or self-written review state: %j", (patch) => {
    const document = doc();
    document.cards.r = review(patch);
    expect(
      knowledgeAlbum(heads, [course], source, document).cards.find(
        (item) => item.head.id === "hallucination",
      )?.tier,
    ).toBe("new");
  });
  it("matches a review's own declared revision rather than the containing lesson's version", () => {
    const revised: AlbumCourse = {
      ...course,
      units: [
        {
          ...course.units[0]!,
          lessons: [
            {
              ...course.units[0]!.lessons[0]!,
              contentRevision: 12,
              reviewCardRevisions: { review: 7 },
            },
          ],
        },
      ],
    };
    const document = doc();
    const tier = () =>
      knowledgeAlbum(heads, [revised], source, document).cards.find(
        (card) => card.head.id === "hallucination",
      )!.tier;
    document.cards.r = review({ contentRevision: 7 });
    expect(tier()).toBe("shining");
    document.cards.r = review({ contentRevision: 12 });
    expect(tier()).toBe("new");
    document.cards.r = review({ contentRevision: 7, cardKey: "s/c/l/retired" });
    expect(tier()).toBe("new");
  });
  it("keeps the collected concept but does not guess memory when the source cannot report card versions", () => {
    const document = doc();
    document.cards.r = review();
    const missing = {
      ...course,
      units: [
        {
          ...course.units[0]!,
          lessons: [{ ...course.units[0]!.lessons[0]!, reviewCardRevisions: undefined }],
        },
      ],
    };
    const card = knowledgeAlbum(heads, [missing], source, document).cards.find(
      (item) => item.head.id === "hallucination",
    )!;
    expect(card.collected).toBe(true);
    expect(card.tier).toBe("new");
    expect(card.reviewKeys).toEqual([]);
  });
  it("does not invent a complete two-card road set when the author supplied no concept links", () => {
    const missing: AlbumCourse = {
      ...course,
      units: [
        {
          ...course.units[0]!,
          lessons: course.units[0]!.lessons.map((lesson) => ({ ...lesson, conceptIds: [] })),
        },
      ],
    };
    const album = knowledgeAlbum(heads, [missing], source, doc());
    expect(album.sets).toEqual([]);
    expect(album.cards.filter((card) => card.collected)).toHaveLength(2);
  });
  it("counts whole courses and distinct completed starting paths, not the number of stored keys", () => {
    const album = knowledgeAlbum(
      heads,
      [
        course,
        { ...course, id: "second", isDefault: false },
        { ...course, studyId: "other", domainId: "programming" },
      ],
      source,
      doc(),
    );
    expect(album.coursesFinished).toBe(3);
    expect(album.pathsFinished).toBe(2);
    expect(knowledgeAlbum(heads, [{ ...course, units: [] }], source, doc()).coursesFinished).toBe(
      0,
    );
  });
  it("reveals rarest last and preserves source order between equal tiers", () => {
    const cards = knowledgeAlbum(heads, [course], source, doc()).cards;
    const original = [
      { ...cards[0]!, tier: "shining" as const },
      cards[1]!,
      { ...cards[2]!, tier: "known" as const },
      cards[3]!,
    ];
    expect(knowledgeRevealOrder(original).map((card) => card.head.id)).toEqual([
      "ai-basics",
      "frontend",
      "hallucination",
      "prompt",
    ]);
    expect(original[0]?.head.id).toBe("prompt");
  });
});
