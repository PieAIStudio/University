const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Keep the scheduler's result understandable on a small learner-facing control. */
export function reviewIntervalLabel(intervalMs: number): string {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return "马上";
  if (intervalMs < MINUTE_MS) return "马上";
  if (intervalMs < HOUR_MS) {
    return `${Math.max(1, Math.round(intervalMs / MINUTE_MS))} 分钟`;
  }
  if (intervalMs < DAY_MS) {
    return `${Math.max(1, Math.round(intervalMs / HOUR_MS))} 小时`;
  }
  return `${Math.max(1, Math.round(intervalMs / DAY_MS))} 天`;
}
