import type { ProgressDocument } from "@pieai/university-core";

/** Only the two inputs read by ProgressSource.completionOf invalidate a map.
 * Preferences clone the account document too; they must not rebake geometry.
 * This is a read-model dependency key, not a second progress store or verdict.
 */
export function courseCompletionRevision(progress: ProgressDocument): string {
  return JSON.stringify([progress.lessons, progress.exerciseAttempts]);
}
