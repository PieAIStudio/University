import { describe, expect, it } from "vitest";

import { isValidSortActivity, type ActivityKind } from "@pieai/university-core";
import { LessonActivityKindSchema } from "@pieai/university-core/domain/schemas.js";

import { AI_MODES, FOUNDATION_MODES } from "./LearningPlayLab.js";
import { getExampleFamily } from "./difficulty-examples.js";
import { getBaseExamples } from "./base-examples.js";
import { extraExamples } from "./extra-examples.js";
import { getProgramExamples } from "./program-examples.js";
import { getSortExamples } from "./sort-examples.js";
import { getAIBriefExamples } from "./ai-brief-examples.js";
import { getAIWorkflowExamples } from "./ai-workflow-examples.js";
import { getAIQualityExamples } from "./ai-quality-examples.js";

/*
  `/play-lab` is the one page whose whole purpose is 「every game, try it」, and
  a game missing from it is missing silently: the page renders, the other ten
  work, and only somebody who already knew there were eleven would notice.

  So the list is checked against the wire enum rather than against itself. That
  enum is the same list a stored lesson is validated through — the one `sort`
  was also missing from, which is how three finished lessons read as a backlog
  for a day — so the two halves now go stale together or not at all.
*/
describe("the play lab offers every game that exists", () => {
  const offered = new Set<string>([...FOUNDATION_MODES, ...AI_MODES]);

  it("lists every kind the wire enum accepts", () => {
    const declared = LessonActivityKindSchema.options;
    expect([...declared].filter((kind) => !offered.has(kind))).toEqual([]);
  });

  it("offers nothing the wire enum does not know about", () => {
    const declared = new Set<string>(LessonActivityKindSchema.options);
    expect([...offered].filter((kind) => !declared.has(kind))).toEqual([]);
  });

  /*
    A name on the shelf with no fixture behind it is the same defect wearing a
    different shape: the mode button renders, and choosing it throws or shows an
    empty board. Every offered kind must have at least one example, and every
    example must expand into the three difficulty tiers the page switches
    between.
  */
  it("has a playable fixture at all three tiers for every kind it offers", () => {
    const examples = [
      ...getBaseExamples(),
      ...extraExamples(),
      ...getProgramExamples(),
      ...getSortExamples(),
      ...getAIBriefExamples(),
      ...getAIWorkflowExamples(),
      ...getAIQualityExamples(),
    ];
    for (const kind of offered as ReadonlySet<ActivityKind>) {
      const forKind = examples.filter((example) => example.kind === kind);
      expect(forKind.length, `${kind} 在试玩页上有按钮，却没有任何示例`).toBeGreaterThan(0);
      for (const example of forKind) {
        const family = getExampleFamily(example);
        expect(Object.keys(family.levels).sort(), `${example.id} 的三档`).toEqual([
          "challenge",
          "intro",
          "practice",
        ]);
      }
    }
  });

  /*
    A tier the engine refuses is a mode button that opens a broken board, and
    `sort` has three rules that are easy to break while curating tiers: at least
    two bins, at least as many items as bins, and no bin that nothing ever lands
    in. The last one is the reason the challenge tier adds its fourth bin and
    the item for it in the same step — an always-empty option is one the reader
    can eliminate without understanding anything.
  */
  it("hands the sort engine three boards it agrees are solvable", () => {
    for (const example of getSortExamples()) {
      const family = getExampleFamily(example);
      for (const [level, task] of Object.entries(family.levels)) {
        expect(task.kind).toBe("sort");
        expect(isValidSortActivity(task as never), `${example.id} 的 ${level} 档`).toBe(true);
      }
    }
  });
});
