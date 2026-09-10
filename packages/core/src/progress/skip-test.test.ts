import { describe, expect, it } from "vitest";

import { compileAnswerKey } from "../grading/answer-key.js";
import {
  isUnitProven,
  judgeSkipAnswer,
  openedLessonIds,
  pickSkipTest,
  provenLessonIds,
  skipTestCandidates,
  SKIP_TEST_SIZE,
} from "./skip-test.js";
import { createMemoryPersistence } from "./memory.js";
import { createProgressPort } from "./port.js";
import { isLessonComplete } from "./contract.js";

const factual = compileAnswerKey("先处理再比像不像");
/** Nine characters of prose. Tier one cannot settle it, so nor may the test. */
const prose = compileAnswerKey("因为它把两边都变成了可以互相比较的东西");

function lesson(id: string, keys: readonly (ReturnType<typeof compileAnswerKey> | undefined)[]) {
  return {
    id,
    exercises: keys.map((answerKey, index) => ({
      id: `${id}-e${index}`,
      prompt: `${id} 第 ${index} 问`,
      ...(answerKey ? { answerKey } : {}),
    })),
  };
}

describe("skip test candidates", () => {
  it("keeps only the exercises tier one can settle on its own", () => {
    const candidates = skipTestCandidates([
      lesson("a", [factual]),
      lesson("b", [prose]),
      lesson("c", [undefined]),
      lesson("d", [factual]),
    ]);
    expect(candidates.map((candidate) => candidate.lessonId)).toEqual(["a", "d"]);
  });

  /*
    The reason this matters is money, and it is the whole reason the skip test
    grades outside the grading port. A prose answer is `undecided` at tier one,
    and the only thing that can settle it is the metered tier — which would
    charge a learner for the privilege of skipping work they already know. A
    question tier one cannot decide must therefore never be drawn, and the way
    to keep that true is to check the predicate rather than the intention.
  */
  it("never draws a question that would have to be sent to a paid grader", () => {
    const candidates = skipTestCandidates([lesson("a", [prose, prose, prose])]);
    expect(candidates).toEqual([]);
    expect(pickSkipTest(candidates)).toEqual([]);
  });

  it("refuses an exercise whose prompt is blank", () => {
    const candidates = skipTestCandidates([
      { id: "a", exercises: [{ id: "a-e0", prompt: "   ", answerKey: factual }] },
    ]);
    expect(candidates).toEqual([]);
  });
});

describe("drawing three questions", () => {
  it("spreads across lessons before taking a second question from one", () => {
    const candidates = skipTestCandidates([
      lesson("a", [factual, factual, factual]),
      lesson("b", [factual]),
      lesson("c", [factual]),
    ]);
    const drawn = pickSkipTest(candidates, { pick: () => 0 });
    expect(drawn).toHaveLength(SKIP_TEST_SIZE);
    expect(new Set(drawn.map((question) => question.lessonId))).toEqual(new Set(["a", "b", "c"]));
  });

  /*
    A one-lesson unit is allowed to fill the sitting from that lesson: testing
    it at all is better than declining, and the sample is honest about what it
    covers because there is only one thing to cover.
  */
  it("falls back to a second question from the same lesson when there is no other", () => {
    const candidates = skipTestCandidates([lesson("a", [factual, factual, factual])]);
    const drawn = pickSkipTest(candidates, { pick: () => 0 });
    expect(drawn).toHaveLength(SKIP_TEST_SIZE);
    expect(new Set(drawn.map((question) => question.exerciseId)).size).toBe(SKIP_TEST_SIZE);
  });

  it("returns fewer than three rather than repeating a question", () => {
    const candidates = skipTestCandidates([lesson("a", [factual]), lesson("b", [factual])]);
    const drawn = pickSkipTest(candidates, { pick: () => 0 });
    expect(drawn).toHaveLength(2);
  });

  /*
    `pick` is injected so this can be asserted at all. A draw that always took
    the first candidate and a draw that is really random look identical from
    the outside, and the design's whole claim is that the questions are drawn
    from the unit rather than fixed.
  */
  it("actually consults the draw rather than taking the first of everything", () => {
    const candidates = skipTestCandidates([
      lesson("a", [factual]),
      lesson("b", [factual]),
      lesson("c", [factual]),
      lesson("d", [factual]),
    ]);
    const first = pickSkipTest(candidates, { pick: () => 0 }).map((q) => q.lessonId);
    const last = pickSkipTest(candidates, { pick: (length) => length - 1 }).map((q) => q.lessonId);
    expect(first).not.toEqual(last);
  });
});

describe("judging one answer", () => {
  it("passes the reference answer and a sentence containing it", () => {
    expect(judgeSkipAnswer("先处理再比像不像", factual)).toBe("correct");
    expect(judgeSkipAnswer("我觉得是先处理再比像不像。", factual)).toBe("correct");
  });

  it("fails a wrong answer", () => {
    expect(judgeSkipAnswer("只检查照片文字", factual)).toBe("wrong");
  });

  /*
    `undecided` must never read as `correct`. It arrives from a blank answer and
    from a near miss on a key too long to judge by substring, and both of those
    are "we do not know" — a product that turns "we do not know" into a skipped
    lesson has told the learner something false about themselves.

    The second case is why `skipTestCandidates` filters at all: tier one still
    passes a prose answer typed out character for character, so a long key looks
    decidable right up until somebody paraphrases it.
  */
  it("treats an undecidable verdict as not proven rather than as proven", () => {
    expect(judgeSkipAnswer("   ", factual)).toBe("unanswered");
    expect(judgeSkipAnswer("因为两边都变成了能比较的东西", prose)).toBe("unanswered");
  });
});

describe("what a sitting proves", () => {
  const unit = ["a", "b", "c", "d", "e", "f"];

  it("proves the whole unit when all three are right", () => {
    const proven = provenLessonIds(unit, [
      { lessonId: "a", verdict: "correct" },
      { lessonId: "b", verdict: "correct" },
      { lessonId: "c", verdict: "correct" },
    ]);
    expect(proven).toEqual(unit);
    expect(isUnitProven(unit, new Set(proven))).toBe(true);
  });

  it("opens only the lesson behind the wrong answer", () => {
    const results = [
      { lessonId: "a", verdict: "correct" as const },
      { lessonId: "b", verdict: "wrong" as const },
      { lessonId: "c", verdict: "correct" as const },
    ];
    expect(provenLessonIds(unit, results)).toEqual(["a", "c", "d", "e", "f"]);
    expect(openedLessonIds(results)).toEqual(["b"]);
    expect(isUnitProven(unit, new Set(provenLessonIds(unit, results)))).toBe(false);
  });

  /*
    The floor the design does not state, and the reason it needs one. Read
    「错一道只打开那一节」 as a per-question rule and a learner who answered
    nothing correctly still skips the three lessons the sample never touched.
    Two wrong is not a near miss; it is the sample failing.
  */
  it("proves nothing when more than one answer is wrong", () => {
    expect(
      provenLessonIds(unit, [
        { lessonId: "a", verdict: "wrong" },
        { lessonId: "b", verdict: "wrong" },
        { lessonId: "c", verdict: "correct" },
      ]),
    ).toEqual([]);
    expect(
      provenLessonIds(unit, [
        { lessonId: "a", verdict: "wrong" },
        { lessonId: "b", verdict: "wrong" },
        { lessonId: "c", verdict: "wrong" },
      ]),
    ).toEqual([]);
  });

  it("proves nothing while a question is still unanswered", () => {
    expect(
      provenLessonIds(unit, [
        { lessonId: "a", verdict: "correct" },
        { lessonId: "b", verdict: "correct" },
        { lessonId: "c", verdict: "unanswered" },
      ]),
    ).toEqual([]);
  });
});

describe("proving a lesson is not learning it", () => {
  /*
    V5 §12 决定 E, asserted as the negative fact it is: a card that was never
    dropped. A test that only checked `provenLessonKeys()` would pass with the
    proof also silently completing the lesson, so this asserts what must NOT
    have happened — no card in the queue, no completion, nothing due tomorrow.
  */
  it("puts no card in the review queue and completes no lesson", () => {
    const port = createProgressPort({ persistence: createMemoryPersistence() });
    port.markLessonsProven({
      studyId: "browser-ai",
      courseId: "search-your-own-photos",
      unitId: "how-it-understands-a-sentence",
      lessonIds: ["how-does-it-find-a-dog-on-a-beach", "what-a-number-list-is"],
    });

    expect([...port.provenLessonKeys()]).toEqual([
      "browser-ai/search-your-own-photos/how-does-it-find-a-dog-on-a-beach",
      "browser-ai/search-your-own-photos/what-a-number-list-is",
    ]);
    expect(port.dueCards(Date.now() + 1000 * 60 * 60 * 48)).toEqual([]);
    expect(port.dueTomorrow()).toBe(0);
    expect(Object.keys(port.snapshot().cards)).toEqual([]);
    expect(Object.keys(port.snapshot().lessons)).toEqual([]);
    expect(Object.keys(port.snapshot().exerciseAttempts)).toEqual([]);

    const completion =
      port.snapshot().lessons[
        "browser-ai/search-your-own-photos/how-does-it-find-a-dog-on-a-beach"
      ];
    expect(completion).toBeUndefined();
    expect(
      isLessonComplete({
        exercisesPassed: false,
        readConfirmed: false,
      }),
    ).toBe(false);
  });

  it("keeps the first proof rather than restamping it on a retake", () => {
    const port = createProgressPort({ persistence: createMemoryPersistence() });
    const input = {
      studyId: "browser-ai",
      courseId: "search-your-own-photos",
      unitId: "how-it-understands-a-sentence",
      lessonIds: ["how-does-it-find-a-dog-on-a-beach"],
    };
    port.markLessonsProven({ ...input, provenAt: 1_000 });
    port.markLessonsProven({ ...input, provenAt: 9_000 });
    expect(
      port.snapshot().provenLessons[
        "browser-ai/search-your-own-photos/how-does-it-find-a-dog-on-a-beach"
      ]?.provenAt,
    ).toBe(1_000);
  });

  it("survives a reload through the document, and remembers the unit it came from", () => {
    const persistence = createMemoryPersistence();
    const first = createProgressPort({ persistence });
    first.markLessonsProven({
      studyId: "browser-ai",
      courseId: "search-your-own-photos",
      unitId: "how-it-understands-a-sentence",
      lessonIds: ["how-does-it-find-a-dog-on-a-beach"],
      provenAt: 1_000,
    });
    const reloaded = createProgressPort({ persistence });
    const record =
      reloaded.snapshot().provenLessons[
        "browser-ai/search-your-own-photos/how-does-it-find-a-dog-on-a-beach"
      ];
    expect(record?.unitId).toBe("how-it-understands-a-sentence");
    expect(record?.provenAt).toBe(1_000);
  });
});
