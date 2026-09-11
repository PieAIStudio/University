import type { ActivityFamily, LearningActivitySpec } from "@pieai/university-core";
import { getFoundationFamily } from "./foundation-difficulty.js";
import { getWorkflowFamily } from "./workflow-difficulty.js";
import { getQualityFamily } from "./quality-difficulty.js";
import { getSortFamily } from "./sort-difficulty.js";
import { getContrastFamily } from "./contrast-difficulty.js";
import { getWeighFamily } from "./weigh-difficulty.js";

/*
  Only the play lab's own fixtures are expanded here.

  Not 「course authors supply explicit families」, which is what this line used
  to say and is not something a course author can do: `LessonActivitySchema`
  stores one payload and a `difficulty` label, and has no family field at all.
  A lesson's board is fixed at the tier its author chose (ADR-0010).
*/
export function getExampleFamily(activity: LearningActivitySpec): ActivityFamily {
  switch (activity.kind) {
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
