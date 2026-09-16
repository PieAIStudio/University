import type { ActivityFamily, LearningActivitySpec } from "@pieai/university-core";
import { getFoundationFamily } from "./foundation-difficulty.js";
import { getWorkflowFamily } from "./workflow-difficulty.js";
import { getQualityFamily } from "./quality-difficulty.js";
import { getSortFamily } from "./sort-difficulty.js";
import { getContrastFamily } from "./contrast-difficulty.js";
import { getWeighFamily } from "./weigh-difficulty.js";

/*
  The play lab's own fixtures, expanded to three tiers from one example.

  This is not how a lesson gets its levels, and the distinction matters. A
  lesson authors each level as a real payload and ties them together with
  `family`; `groupActivityLevels` reads those. These fixtures exist because the
  lab has one example per game and still wants to demonstrate all three tiers.

  The note here used to say a course author could not supply levels at all,
  which was true until `family` was added to `LessonActivitySchema` — the
  missing field that had left `selectActivityLevel` with one call site, this
  one, for a year.
*/
export function getExampleFamily(activity: LearningActivitySpec): ActivityFamily {
  switch (activity.kind) {
    case "interaction-path":
      throw new Error("Interaction paths are authored lesson sequences, not difficulty families");
    case "ai-context":
    case "ai-agent":
      return getWorkflowFamily(activity);
    case "ai-eval":
    case "ai-repair":
      return getQualityFamily(activity);
    case "contrast":
      return getContrastFamily(activity);
    case "weigh":
      return getWeighFamily(activity);
    case "sort":
      /*
        This used to throw. The note said the tiers were authoring work rather
        than a fallback, which was true and stayed true for as long as `sort`
        was also missing from the lab's mode list — so the throw was
        unreachable, and the page quietly offered ten of the eleven games.
        `LearningPlayLab.test.tsx` now holds the list against the wire enum, so
        the two cannot drift apart again without something going red.
      */
      return getSortFamily(activity);
    default:
      return getFoundationFamily(activity);
  }
}
