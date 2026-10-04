import { withInterfaceLocale } from "../../test-support/interface-locale.js";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  LessonActivityKindSchema,
  isValidSortActivity,
  type ActivityKind,
} from "@pieai/university-core";
import { FOUNDATION_MODES, getLabExamples } from "./LearningPlayLab.js";
import { LearningActivity } from "./LearningActivity.js";
import { getExampleFamily } from "./difficulty-examples.js";

describe("the play lab offers every game that exists", () => {
  it("lists every kind the wire enum accepts", () => {
    const declared = LessonActivityKindSchema.options.filter((kind) => kind !== "primm");
    expect(declared.filter((kind) => !FOUNDATION_MODES.includes(kind))).toEqual([]);
  });

  it("offers nothing the wire enum does not know about", () => {
    expect(
      FOUNDATION_MODES.filter((kind) => !LessonActivityKindSchema.options.includes(kind)),
    ).toEqual([]);
  });

  it("has a playable fixture at all three tiers for every kind it offers", () => {
    const examples = getLabExamples();
    for (const kind of FOUNDATION_MODES as readonly ActivityKind[]) {
      const forKind = examples.filter((example) => example.kind === kind);
      expect(forKind.length, kind).toBeGreaterThan(0);
      for (const example of forKind)
        expect(Object.keys(getExampleFamily(example).levels).sort()).toEqual([
          "challenge",
          "intro",
          "practice",
        ]);
    }
  });

  it("hands the sort engine three boards it agrees are solvable", () => {
    for (const example of getLabExamples().filter((item) => item.kind === "sort"))
      for (const task of Object.values(getExampleFamily(example).levels))
        expect(isValidSortActivity(task)).toBe(true);
  });

  it("draws a board for every kind the shelf offers", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    for (const kind of FOUNDATION_MODES) {
      const activity = getLabExamples().find((item) => item.kind === kind)!;
      const family = getExampleFamily(activity);
      const container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);
      try {
        await act(async () =>
          root.render(
            withInterfaceLocale(
              <LearningActivity activity={family.levels.intro} onResult={() => undefined} />,
            ),
          ),
        );
        const board = container.querySelector(".learning-activity__game");
        expect(board, kind).not.toBeNull();
        expect((board?.textContent ?? "").trim().length, kind).toBeGreaterThan(0);
      } finally {
        await act(async () => root.unmount());
        container.remove();
      }
    }
  });
});
