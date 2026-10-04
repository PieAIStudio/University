import { describe, expect, it } from "vitest";
import { primmStepsFixture } from "../learning-play/fixtures/primm-steps.js";
import { choiceRoundsFromLesson } from "./choices.js";
import type { GameLesson } from "./rounds.js";
import { spotRoundsFromLesson } from "./spots.js";

const step = {
  kind: "choose",
  id: "check",
  title: "怎样核对？",
  answerId: "source",
  after: "对照出处。",
  options: [
    { id: "name", label: "只看名字", after: "名字不能替代出处。" },
    { id: "source", label: "对照出处", after: "出处支持这句话。" },
    { id: "smooth", label: "只看通顺", after: "通顺不代表事实正确。" },
  ],
};
const withSteps = (steps: readonly unknown[]): GameLesson => ({
  id: "l",
  title: "课",
  activities: [{ ...primmStepsFixture, steps }],
});

describe("retained PRIMM island-game projections", () => {
  it("projects an authored answer and every option's reason without changing them", () => {
    expect(choiceRoundsFromLesson(withSteps([step]))[0]?.items[0]).toEqual({
      id: "check",
      text: "怎样核对？",
      options: step.options.map(({ id, label }) => ({ id, label })),
      bestId: "source",
      why: "出处支持这句话。",
      whyNot: { name: "名字不能替代出处。", smooth: "通顺不代表事实正确。" },
    });
  });
  it("drops incomplete explanations instead of inventing a reason", () => {
    expect(
      choiceRoundsFromLesson(
        withSteps([
          {
            ...step,
            options: step.options.map((option) =>
              option.id === "name" ? { id: option.id, label: option.label } : option,
            ),
          },
        ]),
      ),
    ).toEqual([]);
  });
  it("projects the same grade into one targeted spot round", () => {
    const round = spotRoundsFromLesson(withSteps([step]))[0];
    expect(round?.question).toBe(step.title);
    expect(round?.items).toEqual(
      step.options.map((option) => ({
        id: option.id,
        text: option.label,
        target: option.id === "source",
        why: option.after,
      })),
    );
  });
  it("never turns an ungraded prediction or live-answer search into an answer key", () => {
    const lesson: GameLesson = { id: "l", title: "课", activities: [primmStepsFixture] };
    expect(choiceRoundsFromLesson(lesson)).toEqual([]);
    expect(spotRoundsFromLesson(lesson)).toEqual([]);
  });
});
