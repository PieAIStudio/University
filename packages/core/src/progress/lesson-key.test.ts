import { describe, expect, it } from "vitest";

import { lessonRefKey } from "./contract.js";
import { lessonKey, lessonKeyOf } from "./document.js";
import { createProgressPort } from "./port.js";
import { createMemoryPersistence, createMemoryRemoteStore } from "./memory.js";

const REF = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: "you-already-know-apps",
} as const;

describe("naming a lesson", () => {
  it("keeps the document's key and the shared key visibly different", () => {
    /*
      Both are correct and they are not interchangeable. The document keys a
      lesson by study/course/lesson; a shared surface names it by
      study/course/unit/lesson so the string can be parsed back into a locator.
      This test exists because the two were passed to the same function.
    */
    expect(lessonKeyOf(REF)).toBe("turing-pact/foundations-before-zero/you-already-know-apps");
    expect(lessonRefKey(REF)).toBe(
      "turing-pact/foundations-before-zero/what-is-an-app/you-already-know-apps",
    );
    expect(lessonKeyOf(REF)).not.toBe(lessonRefKey(REF));
  });

  it("builds the same key from a locator as from three ids", () => {
    expect(lessonKeyOf(REF)).toBe(lessonKey(REF.studyId, REF.courseId, REF.lessonId));
  });

  it("reads back a read confirmation written from a locator", () => {
    /*
      The regression this file is named for.

      `confirmLessonRead` took a pre-built string, and the reader ports built it
      with `lessonRefKey` while every reader of the document looked it up with
      `lessonKey`. Two valid strings, one document, no error — the confirmation
      landed in a row nobody read. What a learner saw was that the confirm
      button never changed, the settlement never came, and the lesson could not
      be finished in either shell.

      So the assertion is deliberately end-to-end in miniature: confirm the way
      a port confirms, read the way a screen reads, and require that they meet.
    */
    const port = createProgressPort({
      persistence: createMemoryPersistence(),
      remote: createMemoryRemoteStore(),
    });

    port.confirmLessonRead(lessonKeyOf(REF), 1);

    const state = port.lessonState(lessonKey(REF.studyId, REF.courseId, REF.lessonId));
    expect(state.readConfirmed).toBe(true);
    expect(state.readConfirmedRevision).toBe(1);
  });
});
