import { translate } from "../i18n/index.js";
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Keep the scheduler's result understandable on a small learner-facing control. */
export function reviewIntervalLabel(intervalMs: number): string {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0)
    return translate("ui.review.reviewinterval.copy.马上");
  if (intervalMs < MINUTE_MS) return translate("ui.review.reviewinterval.copy.马上");
  if (intervalMs < HOUR_MS) {
    return translate("ui.review.reviewinterval.copy.value0-分钟", {
      value0: Math.max(1, Math.round(intervalMs / MINUTE_MS)),
    });
  }
  if (intervalMs < DAY_MS) {
    return translate("ui.review.reviewinterval.copy.value0-小时", {
      value0: Math.max(1, Math.round(intervalMs / HOUR_MS)),
    });
  }
  return translate("ui.review.reviewinterval.copy.value0-天", {
    value0: Math.max(1, Math.round(intervalMs / DAY_MS)),
  });
}
