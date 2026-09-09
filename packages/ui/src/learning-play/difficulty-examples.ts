import type { ActivityFamily, LearningActivitySpec } from "@pieai/university-core";
import { getFoundationFamily } from "./foundation-difficulty.js";
import { getWorkflowFamily } from "./workflow-difficulty.js";
import { getQualityFamily } from "./quality-difficulty.js";

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
        Lessons may embed `sort`; the lab's curated three-tier fixtures do not
        include it yet. Inventing tiers here would put a showcase on screen that
        nobody designed, and the family contract wants a real task difference at
        each tier plus a runnable solution — that is authoring work, not a
        fallback. Unreachable in practice: the lab only ever passes its own
        fixtures, and this branch exists so the type stops pretending otherwise.
      */
      throw new Error("sort has no curated lab family yet");
    default:
      return getFoundationFamily(activity);
  }
}
