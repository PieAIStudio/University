import type { ActivityFamily, LearningActivitySpec } from "@pieai/university-core";
import { getFoundationFamily } from "./foundation-difficulty.js";
import { getWorkflowFamily } from "./workflow-difficulty.js";
import { getQualityFamily } from "./quality-difficulty.js";
import { getSortFamily } from "./sort-difficulty.js";

/** Only the lab's curated fixtures are expanded here. Course authors supply explicit families. */
export function getExampleFamily(activity: LearningActivitySpec): ActivityFamily {
  switch (activity.kind) {
    case "ai-context":
    case "ai-agent":
      return getWorkflowFamily(activity);
    case "ai-eval":
    case "ai-repair":
      return getQualityFamily(activity);
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
