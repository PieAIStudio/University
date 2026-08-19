/**
 * How thoroughly a lesson expands its optional detail blocks.
 *
 * This is a way of reading, not a fact about the course, so the preference
 * lives in the browser rather than in the learner database. Default standard:
 * a lesson must read exactly as it did before anybody opts into more detail.
 */

export type DetailMode = "standard" | "all";

const DETAIL_MODE_KEY = "university-local.detail-mode";

export function readDetailMode(): DetailMode {
  try {
    return window.localStorage.getItem(DETAIL_MODE_KEY) === "all" ? "all" : "standard";
  } catch {
    return "standard";
  }
}

export function writeDetailMode(mode: DetailMode): void {
  try {
    window.localStorage.setItem(DETAIL_MODE_KEY, mode);
  } catch {
    // A browser with storage disabled still gets the switch, just not the memory.
  }
}
