/**
 * What the learner has done, kept on this machine first.
 *
 * Sign-in is optional. Without an account this file behaves exactly as it
 * did when the bytes only lived in `university.progress.v2`: learn, review,
 * streak, all of it. With an account the same document is merged onto the
 * remote row so a second machine does not wipe the first. The merge lives in
 * `@pieai/university-core`; this file is the browser adapter — localStorage
 * for persistence, and a remote only when a session actually exists.
 *
 * Card scheduling is not decided here. It comes from
 * `@pieai/university-core`, which is real FSRS with recorded parameters, and
 * is the same function the authoring shell calls.
 *
 * What stays local-first is where the state is kept, not how it is computed.
 */
import {
  createProgressPort,
  PROGRESS_STORAGE_KEY,
  type ProgressPort,
  type RatingName,
} from "@pieai/university-core";

function browserPersistence() {
  return {
    read(): string | null {
      try {
        return localStorage.getItem(PROGRESS_STORAGE_KEY);
      } catch {
        return null;
      }
    },
    write(raw: string) {
      try {
        localStorage.setItem(PROGRESS_STORAGE_KEY, raw);
      } catch {
        // Private browsing, or a full quota. Losing the write is survivable;
        // throwing in the middle of a lesson is not.
      }
    },
  };
}

export const progressPort: ProgressPort = createProgressPort({
  persistence: browserPersistence(),
});

export function subscribe(listener: () => void): () => void {
  return progressPort.subscribe(listener);
}

export function snapshot() {
  return progressPort.snapshot();
}

export const lessonKey = (studyId: string, courseId: string, lessonId: string) =>
  `${studyId}/${courseId}/${lessonId}`;

export function lessonState(key: string) {
  return progressPort.lessonState(key);
}

export function advanceLesson(key: string, progress: number) {
  progressPort.advanceLesson(key, progress);
}

export function dropCards(
  studyId: string,
  courseId: string,
  lessonId: string,
  cardIds: readonly string[],
) {
  progressPort.dropCards(studyId, courseId, lessonId, cardIds);
}

export function dueCards(asOf = Date.now()) {
  return progressPort.dueCards(asOf);
}

export function dueTomorrow() {
  return progressPort.dueTomorrow();
}

export function gradeCard(cardKey: string, rating: RatingName) {
  progressPort.gradeCard(cardKey, rating);
}

export function stageWord(senseId: string, stage: "learning" | "familiar" | "paused") {
  progressPort.stageWord(senseId, stage);
}

export function vocabularyStates() {
  return progressPort.vocabularyStates();
}

export function wordStages() {
  return progressPort.wordStages();
}

export function resetAll() {
  progressPort.resetAll();
}
