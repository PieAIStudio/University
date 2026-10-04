import { PrimmSteps } from "./PrimmSteps.js";
import type { PrimmLessonProps } from "./primm-types.js";

export type { PrimmLessonProps, RunPrimm, PrimmWork, PrimmEvaluation } from "./primm-types.js";

/** The only shipped PRIMM lesson surface: version 3 one-action steps. */
export function PrimmLesson(props: PrimmLessonProps) {
  return <PrimmSteps {...props} />;
}
