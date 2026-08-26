import { describe, expect, it } from "vitest";

import { createMemoryPersistence, createMemoryRemoteStore } from "./memory.js";
import { parseProgress, recapCardKeyOf, RECAP_CARD_ID } from "./document.js";
import { createProgressPort } from "./port.js";

const LOCATOR = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: "you-already-know-apps",
} as const;

function tomorrow(): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date.getTime() + 1;
}

describe("learner recap cards", () => {
  it("stores one virtual card and its first answer in the progress document", () => {
    const persistence = createMemoryPersistence();
    const progress = createProgressPort({ persistence });
    const commandId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    progress.createRecapCard({
      locator: LOCATOR,
      contentRevision: 3,
      commandId,
      answer: "我会先把界面和服务端分开看。",
    });

    const cardKey = recapCardKeyOf(LOCATOR);
    expect(progress.recapCard(LOCATOR)).toMatchObject({
      cardKey,
      kind: "recap-card",
      studyId: LOCATOR.studyId,
      courseId: LOCATOR.courseId,
      unitId: LOCATOR.unitId,
      lessonId: LOCATOR.lessonId,
      contentRevision: 3,
    });
    expect(cardKey.endsWith(`/${RECAP_CARD_ID}`)).toBe(true);
    expect(progress.retrievalAttempts(cardKey)).toEqual([
      expect.objectContaining({
        commandId,
        cardKey,
        contentRevision: 3,
        answer: "我会先把界面和服务端分开看。",
        durationMs: 0,
        usedHint: false,
      }),
    ]);

    // The command retry and a second click cannot create a second card or
    // silently replace the first answer.
    progress.createRecapCard({
      locator: LOCATOR,
      contentRevision: 3,
      commandId,
      answer: "不应覆盖首次复述。",
    });
    progress.createRecapCard({
      locator: LOCATOR,
      contentRevision: 3,
      commandId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      answer: "同一课只保留一张卡。",
    });

    expect(Object.keys(progress.snapshot().cards)).toEqual([cardKey]);
    expect(progress.retrievalAttempts(cardKey)).toHaveLength(1);
    expect(parseProgress(persistence.raw()).cards[cardKey]?.kind).toBe("recap-card");
  });

  it("enters tomorrow's queue and then becomes due", () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    progress.createRecapCard({
      locator: LOCATOR,
      contentRevision: 1,
      commandId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      answer: "先写一遍自己的理解。",
    });

    expect(progress.dueCards(Date.now())).toHaveLength(0);
    expect(progress.dueCards(tomorrow()).map((card) => card.kind)).toEqual(["recap-card"]);
  });

  it("travels with the cloud learner document to another device", async () => {
    const remote = createMemoryRemoteStore();
    const userId = "memory:ada@example.com";
    const phone = createProgressPort({ persistence: createMemoryPersistence() });
    phone.createRecapCard({
      locator: LOCATOR,
      contentRevision: 2,
      commandId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      answer: "这是学习者自己的云端复述。",
    });

    await phone.bindAccount(userId, remote);

    const laptop = createProgressPort({ persistence: createMemoryPersistence() });
    await laptop.bindAccount(userId, remote);

    expect(laptop.recapCard(LOCATOR)).toMatchObject({
      kind: "recap-card",
      contentRevision: 2,
    });
    expect(laptop.retrievalAttempts(recapCardKeyOf(LOCATOR))[0]?.answer).toBe(
      "这是学习者自己的云端复述。",
    );
  });
});
