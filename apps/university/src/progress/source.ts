/**
 * This shell's answer to the shared progress questions.
 *
 * This file is a read model on top of the shared cloud-backed ProgressPort,
 * so a world map, an island or a settlement can ask the same questions the
 * authoring shell asks. `university.progress.v2` is only the browser cache and
 * offline outbox.
 *
 * Two losses live here, and they are named rather than papered over.
 *
 * The stored key is `studyId/courseId/lessonId`, so `completionOf` deliberately
 * ignores `ref.unitId`. Two lessons that reused a lesson id across units would
 * share one row of progress, and each would show the other's completion. The
 * document cannot defend itself after that projection; the course producer
 * and recovery/delivery input gate therefore reject the duplicate before it
 * reaches this read model.
 *
 * The shared document carries the read-confirmation fact separately from
 * exercise progress. A pre-migration row with progress 1 is treated as a
 * completed legacy record; new rows must carry both facts.
 */
import { progressSourceOf, type ProgressSource } from "@pieai/university-core";

import { progressPort } from "./store";

export function progressSource(): ProgressSource {
  return progressSourceOf(progressPort);
}
