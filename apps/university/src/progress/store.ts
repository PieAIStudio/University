/**
 * What the learner has done, kept in the shared cloud document with a durable
 * browser cache/outbox for disconnected work.
 *
 * Sign-in is optional. Without an account this file behaves exactly as it
 * did when the bytes only lived in `university.progress.v2`: learn, review,
 * streak, all of it. With an account the same document is merged onto the
 * remote row so a second machine does not wipe the first. The merge lives in
 * `@pieai/university-core`; the product-specific Supabase adapter lives
 * beside the account boundary.
 *
 * The localStorage adapter used to live in this file. Copying those eighteen
 * lines into the authoring shell would have given it a document by lunchtime,
 * and given the next person two try/catch blocks to keep in step. The
 * adapter and the port assembly now live in `@pieai/university-ui/progress`,
 * next to the other browser stores; this file is still the process singleton
 * the rest of the delivery shell already imports, so those relative paths do
 * not have to move with it — and so `App.tsx` can keep importing from here
 * while other work is in that file.
 *
 * Card scheduling is not decided here. It comes from
 * `@pieai/university-core`, which is real FSRS with recorded parameters, and
 * is the same function the authoring shell calls.
 *
 * What stays local is the offline queue, not the account's source of truth.
 */
import {
  type LessonDocumentKey,
  lessonKey,
  type ProgressPort,
  type ProgressRemoteStore,
} from "@pieai/university-core";
import { createBrowserProgressPort } from "@pieai/university-ui/progress/store.js";

import { swimmerCoreClient } from "../account/identity";
import { createSupabaseProgressRemoteStore } from "../account/progress-remote";

export { lessonKey };

export const progressPort: ProgressPort = createBrowserProgressPort();
export const progressRemoteStore: ProgressRemoteStore | null = swimmerCoreClient
  ? createSupabaseProgressRemoteStore(swimmerCoreClient)
  : null;

export function subscribe(listener: () => void): () => void {
  return progressPort.subscribe(listener);
}

export function snapshot() {
  return progressPort.snapshot();
}

export function advanceLesson(key: LessonDocumentKey, progress: number) {
  progressPort.advanceLesson(key, progress);
}

export function dueCards(asOf = Date.now()) {
  return progressPort.dueCards(asOf);
}

export function vocabularyStates() {
  return progressPort.vocabularyStates();
}

export function resetAll() {
  progressPort.resetAll();
}
