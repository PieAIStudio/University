import {
  isLessonComplete,
  lessonRefKey,
  type LessonProgressSnapshot,
  type LessonRef,
  type ProgressSource,
} from "../progress/contract.js";
import { mistakesOf } from "../progress/mistakes.js";
import type { ExerciseAttemptRecord, ProgressDocument } from "../ports/progress.js";
import { DETERMINISTIC_GRADER_HOST } from "../ports/grading.js";
import {
  skipTestCandidates,
  judgeSkipAnswer,
  type SkipTestCandidate,
} from "../progress/skip-test.js";

export interface PracticeCourse {
  readonly studyId: string;
  readonly id: string;
  readonly title: string;
  readonly units: readonly {
    readonly id: string;
    readonly lessons: readonly (LessonProgressSnapshot & {
      readonly id: string;
      readonly title: string;
    })[];
  }[];
}
export interface PracticeLesson {
  readonly locator: LessonRef;
  readonly courseTitle: string;
  readonly title: string;
  readonly number: number;
  readonly snapshot: LessonProgressSnapshot;
}
export interface LessonPracticeQuestion extends SkipTestCandidate {
  readonly id: string;
  readonly locator: LessonRef;
  readonly courseTitle: string;
  readonly lessonTitle: string;
  readonly lessonNumber: number;
  readonly contentRevision: number;
  readonly previousMistake: boolean;
}
export interface PracticeLessonBody {
  readonly id: string;
  readonly contentRevision: number;
  readonly exercises: readonly {
    readonly id: string;
    readonly prompt: string;
    readonly contentRevision: number;
    readonly answerKey?: SkipTestCandidate["answerKey"];
    readonly options?: SkipTestCandidate["options"];
  }[];
}

/** Only a current, fully completed level enters practice. A proof alone,
 * stale reading or unavailable exercise metadata cannot borrow its questions. */
export function completedPracticeLessons(
  courses: readonly PracticeCourse[],
  source: ProgressSource,
): readonly PracticeLesson[] {
  return courses.flatMap((course) => {
    let number = 0;
    return course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) => {
        number++;
        const locator = {
          studyId: course.studyId,
          courseId: course.id,
          unitId: unit.id,
          lessonId: lesson.id,
        };
        return isLessonComplete(source.completionOf(locator, lesson))
          ? [{ locator, title: lesson.title, courseTitle: course.title, number, snapshot: lesson }]
          : [];
      }),
    );
  });
}

/** Reuse the native exercise and its existing deterministic key. There is no
 * second bank, generated answer, model call or lesson-completion write here. */
export function lessonPracticeQuestions(
  lessons: readonly { readonly ref: PracticeLesson; readonly body: PracticeLessonBody }[],
  document: ProgressDocument,
): readonly LessonPracticeQuestion[] {
  const seen = new Set<string>();
  const result: LessonPracticeQuestion[] = [];
  for (const { ref, body } of lessons) {
    if (body.id !== ref.locator.lessonId || body.contentRevision !== ref.snapshot.contentRevision)
      continue;
    const declared = new Set(ref.snapshot.exerciseIds);
    for (const question of skipTestCandidates([{ id: body.id, exercises: body.exercises }])) {
      if (!declared.has(question.exerciseId)) continue;
      const exercise = body.exercises.find((entry) => entry.id === question.exerciseId)!;
      if (!Number.isSafeInteger(exercise.contentRevision) || exercise.contentRevision < 1) continue;
      const id = `${lessonRefKey(ref.locator)}\0${question.exerciseId}\0${exercise.contentRevision}`;
      if (seen.has(id)) continue;
      seen.add(id);
      result.push({
        ...question,
        id,
        locator: ref.locator,
        courseTitle: ref.courseTitle,
        lessonTitle: ref.title,
        lessonNumber: ref.number,
        contentRevision: exercise.contentRevision,
        previousMistake: false,
      });
    }
  }
  const revisions = new Map(
    result.map((question) => [
      `${lessonRefKey(question.locator)}\0${question.exerciseId}`,
      question.contentRevision,
    ]),
  );
  const mistakes = new Set(
    mistakesOf(document, (locator, exerciseId) =>
      revisions.get(`${lessonRefKey(locator)}\0${exerciseId}`),
    )
      .filter((mistake) => !mistake.corrected)
      .map(
        (mistake) =>
          `${lessonRefKey(mistake.locator)}\0${mistake.exerciseId}\0${mistake.contentRevision}`,
      ),
  );
  return result
    .map((question) => ({ ...question, previousMistake: mistakes.has(question.id) }))
    .sort((a, b) => Number(b.previousMistake) - Number(a.previousMistake));
}

/** Freeze each round. A grade updates the shared mistake book without
 * reshuffling the question under an unfinished answer. Mistakes always lead;
 * other questions are shuffled by an injectable random source. */
export function pickLessonPractice(
  questions: readonly LessonPracticeQuestion[],
  random: () => number = Math.random,
): readonly LessonPracticeQuestion[] {
  const mistakes = questions.filter((question) => question.previousMistake);
  const rest = questions.filter((question) => !question.previousMistake);
  for (let i = rest.length - 1; i > 0; i--) {
    const sample = random();
    const j = Number.isFinite(sample) ? Math.min(i, Math.max(0, Math.floor(sample * (i + 1)))) : 0;
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  return [...mistakes, ...rest];
}

/** An unchanged native question identity, with an explicit practice purpose.
 * The caller binds the operation to the current account before recording it. */
export function lessonPracticeAttempt(
  question: LessonPracticeQuestion,
  answer: string,
  commandId: string,
  now: number,
): ExerciseAttemptRecord | null {
  const verdict = judgeSkipAnswer(answer, question.answerKey);
  if (verdict === "unanswered" || !commandId || !Number.isFinite(new Date(now).getTime()))
    return null;
  const occurredAt = new Date(now).toISOString();
  const passed = verdict === "correct";
  return {
    purpose: "practice",
    commandId,
    locator: question.locator,
    exerciseId: question.exerciseId,
    contentRevision: question.contentRevision,
    answer,
    score: passed ? 1 : 0,
    maxScore: 1,
    occurredAt,
    hostGrade: {
      outcome: passed ? "pass" : "fail",
      passed,
      evaluation: "",
      extensions: [],
      host: DETERMINISTIC_GRADER_HOST,
      learnerAnswer: answer,
      occurredAt,
    },
  };
}
