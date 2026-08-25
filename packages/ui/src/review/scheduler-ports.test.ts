import { describe, expect, it } from "vitest";
import {
  createMemoryPersistence,
  createProgressPort,
  type CardProgress,
  type LexiconEntry,
  type ProgressPort,
} from "@pieai/university-core";

import type { CardBody, ContentPort } from "../content/port.js";
import type { CourseReviewCardLocator, LessonView } from "../view/lesson-view.js";
import { cardKeyOf, createReviewCardPort, createVocabularyReviewPort } from "./scheduler-ports.js";

const CARD: CourseReviewCardLocator = {
  kind: "course-card",
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: "you-already-know-apps",
  cardId: "app-is-a-program",
  front: "App 是什么？",
  contentRevision: 1,
};

function shelf(body: Partial<CardBody> = {}): ContentPort {
  return {
    knownStudies: null,
    studies(): Promise<never> {
      throw new Error("not asked for in these tests");
    },
    notes(): Promise<never> {
      throw new Error("not asked for in these tests");
    },
    noteEvidenceBase(): string {
      throw new Error("not asked for in these tests");
    },
    shelf(): Promise<never> {
      throw new Error("not asked for in these tests");
    },
    lesson(): Promise<LessonView> {
      throw new Error("not asked for in these tests");
    },
    exercise(): Promise<never> {
      throw new Error("not asked for in these tests");
    },
    async card() {
      return { front: CARD.front, back: "一段在跑的程序", contentRevision: 1, ...body };
    },
  };
}

function enrolled(): ProgressPort {
  const progress = createProgressPort({ persistence: createMemoryPersistence() });
  const card: CardProgress = {
    cardKey: cardKeyOf(CARD),
    studyId: CARD.studyId,
    courseId: CARD.courseId,
    lessonId: CARD.lessonId,
    dueAt: Date.now() - 1000,
    fsrs: {
      due: new Date(Date.now() - 1000).toISOString(),
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: 0,
    },
  };
  progress.importCard(card);
  return progress;
}

describe("one review card port for both campuses", () => {
  it("hands back the side the shelf holds, and records the answer that was risked first", async () => {
    const progress = enrolled();
    const port = createReviewCardPort(shelf(), progress);

    const revealed = await port.reveal(CARD, {
      commandId: "11111111-1111-4111-8111-111111111111",
      contentRevision: 1,
      answer: "一段程序",
    });

    expect(revealed.back).toBe("一段在跑的程序");
    // The attempt is written before the back is shown, which is the whole
    // point of answering first — see RetrievalAttemptRecord.
    expect(progress.retrievalAttempts(cardKeyOf(CARD))).toHaveLength(1);
    expect(progress.retrievalAttempts(cardKeyOf(CARD))[0]?.answer).toBe("一段程序");
  });

  it("shows at most the last three answers beside the card", async () => {
    const progress = enrolled();
    const port = createReviewCardPort(shelf(), progress);
    for (let index = 0; index < 5; index += 1) {
      await port.reveal(CARD, {
        commandId: `1111111${index}-1111-4111-8111-111111111111`,
        contentRevision: 1,
        answer: `第 ${index} 次`,
      });
    }
    const last = await port.reveal(CARD, {
      commandId: "22222222-2222-4222-8222-222222222222",
      contentRevision: 1,
      answer: "最后一次",
    });
    expect(last.priorAttempts).toHaveLength(3);
  });

  it("refuses a card whose lesson has been edited under the schedule", async () => {
    // The authoring campus can rewrite a lesson mid-schedule. Answering the new
    // back against the old front is worse than asking for a reload.
    const port = createReviewCardPort(shelf({ contentRevision: 4 }), enrolled());
    await expect(
      port.reveal(CARD, {
        commandId: "33333333-3333-4333-8333-333333333333",
        contentRevision: 1,
        answer: "",
      }),
    ).rejects.toThrow(/复习卡内容已更新/);
  });

  it("says the same thing in both campuses about a card neither can serve", async () => {
    // These two messages used to differ only in 「本地端」 and 「在线端」, which
    // told a learner nothing about what had happened.
    const port = createReviewCardPort(shelf(), enrolled());
    const knowledge = {
      kind: "knowledge-card",
      studyId: "turing-pact",
      noteId: "session-boundary",
      cardId: "session-boundary-card",
      front: "",
      contentRevision: 1,
    } as const;
    await expect(
      port.reveal(knowledge, { commandId: "x", contentRevision: 1, answer: "" }),
    ).rejects.toThrow(/这类复习卡/);
    await expect(port.rate(knowledge, 3)).rejects.toThrow(/这类复习卡/);
  });

  it("schedules the next sitting through the shared document", async () => {
    const progress = enrolled();
    const port = createReviewCardPort(shelf(), progress);
    const before = progress.snapshot().cards[cardKeyOf(CARD)]?.dueAt ?? 0;
    const rated = await port.rate(CARD, 3);
    expect(Date.parse(rated.dueAt)).toBeGreaterThan(before);
  });

  it("refuses to invent a due date for a card the document does not hold", async () => {
    const port = createReviewCardPort(
      shelf(),
      createProgressPort({
        persistence: createMemoryPersistence(),
      }),
    );
    await expect(port.rate(CARD, 3)).rejects.toThrow(/没有写入云端缓存/);
  });
});

const WORD: LexiconEntry = {
  senseId: "state.ui",
  headword: "state",
  phonetic: "/steɪt/",
  partOfSpeech: "noun",
  gloss: "状态：界面此刻必须记住的信息",
  usage: "读到「状态」时问：这份信息是谁在改，谁在看？",
  track: "technical",
};

describe("one vocabulary port for both campuses", () => {
  it("offers only words that are learning and actually due", async () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    progress.importWord({
      senseId: WORD.senseId,
      stage: "learning",
      dueAt: Date.now() - 1000,
      lapses: 0,
      fsrs: null,
    });
    progress.importWord({
      senseId: "later.ui",
      stage: "learning",
      dueAt: Date.now() + 86_400_000,
      lapses: 0,
      fsrs: null,
    });
    progress.importWord({
      senseId: "known.ui",
      stage: "familiar",
      dueAt: Date.now() - 1000,
      lapses: 0,
      fsrs: null,
    });

    const port = createVocabularyReviewPort(progress, [WORD]);
    const loaded = await port.load();
    expect(loaded.due.map((entry) => entry.senseId)).toEqual([WORD.senseId]);
  });

  it("leaves out a due word the injected lexicon cannot describe", async () => {
    // The word list belongs to a build, not to this package. A sense the build
    // does not carry has no card to show, and a blank card is worse than none.
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    progress.importWord({
      senseId: "missing.ui",
      stage: "learning",
      dueAt: Date.now() - 1000,
      lapses: 0,
      fsrs: null,
    });
    const port = createVocabularyReviewPort(progress, [WORD]);
    expect((await port.load()).due).toHaveLength(0);
  });

  it("writes the grade into the same document the cards live in", async () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    progress.importWord({
      senseId: WORD.senseId,
      stage: "learning",
      dueAt: Date.now() - 1000,
      lapses: 0,
      fsrs: null,
    });
    const before = progress.snapshot().words[WORD.senseId]?.dueAt ?? 0;
    await createVocabularyReviewPort(progress, [WORD]).rate(WORD.senseId, 3);
    expect(progress.snapshot().words[WORD.senseId]?.dueAt ?? 0).toBeGreaterThan(before);
  });
});
