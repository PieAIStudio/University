import { useMemo } from "react";

import { mistakesOf, type ProgressDocument } from "@pieai/university-core";

/** Project the shared progress document into the two mistake-list values. */
export function useMistakeSummary(progress: ProgressDocument) {
  const mistakes = useMemo(() => mistakesOf(progress), [progress]);
  const uncorrectedMistakeCount = useMemo(
    () => mistakes.filter((mistake) => !mistake.corrected).length,
    [mistakes],
  );

  return { mistakes, uncorrectedMistakeCount };
}
