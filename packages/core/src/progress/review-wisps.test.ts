import { describe, expect, it } from "vitest";

import type { ProgressDocument } from "../ports/progress.js";
import { emptyProgress } from "./document.js";
import { lessonsWithDueCards } from "./review-wisps.js";

const NOW = Date.UTC(2026, 8, 28, 12);

function card(lessonId: string, dueAt: number, courseId = "c"): ProgressDocument["cards"][string] {
  return {
    cardKey: `${lessonId}:${dueAt}`,
    studyId: "s",
    courseId,
    lessonId,
    dueAt,
    fsrs: {} as ProgressDocument["cards"][string]["fsrs"],
  };
}

describe("review wisps", () => {
  it("come back to the lessons on this course whose cards are due now", () => {
    const document = emptyProgress();
    document.cards = {
      a: card("l1", NOW - 1),
      b: card("l1", NOW + 86_400_000),
      c: card("l2", NOW + 86_400_000),
      d: card("l3", NOW - 5, "other-course"),
    };
    expect([...lessonsWithDueCards(document, { studyId: "s", courseId: "c" }, NOW)]).toEqual([
      "l1",
    ]);
    expect(
      lessonsWithDueCards(document, { studyId: "s", courseId: "c" }, NOW + 86_400_000).size,
    ).toBe(2);
  });
});
