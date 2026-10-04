import type { ActivityFamily, LearningActivitySpec } from "@pieai/university-core";
import { getFoundationFamily } from "./foundation-difficulty.js";
import { getSortFamily } from "./sort-difficulty.js";

/** Difficulty fixtures for the three retained native lab activities. */
export function getExampleFamily(activity: LearningActivitySpec): ActivityFamily {
  switch (activity.kind) {
    case "sort":
      return getSortFamily(activity);
    case "connect":
    case "tune":
      return getFoundationFamily(activity);
    case "primm":
      throw new Error("PRIMM lessons do not use lab difficulty families");
  }
}
