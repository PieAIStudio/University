import { expect, it } from "vitest";
import { createMemoryPersistence } from "./memory.js";
import { createProgressPort } from "./port.js";

it("filters unavailable course cards from both due counts without deleting any history", () => {
  let available = false;
  const port = createProgressPort({
    persistence: createMemoryPersistence(),
    isReviewCardAvailable: () => available,
  });
  port.dropCards("retired-study", "old-course", "old-lesson", ["old-card"]);
  const before = port.snapshot().cards;
  const due = Object.values(before)[0]!.dueAt;
  expect(port.dueCards(due)).toEqual([]);
  expect(port.dueTomorrow()).toBe(0);
  expect(port.snapshot().cards).toEqual(before);
  available = true;
  expect(port.dueCards(due)).toHaveLength(1);
  expect(port.dueTomorrow()).toBe(1);
});
