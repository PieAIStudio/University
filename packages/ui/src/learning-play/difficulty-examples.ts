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
    default:
      return getFoundationFamily(activity);
  }
}
