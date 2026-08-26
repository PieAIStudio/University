/**
 * Authoring's ContentPort: the loopback server that reads the disk.
 *
 * What was saved a second ago is on screen now, which is the whole reason this
 * mode exists. Behaviour is the contract: changing a path or a field here is
 * changing what 4317 has always answered, and that is a product change.
 */
import {
  isSafeId,
  lessonKey,
  lessonKeyOf,
  lessonRefKey,
  progressSourceOf,
  type LessonRef,
  type ProgressPort,
} from "@pieai/university-core";
import {
  cardContentPath,
  exerciseContentPath,
  lessonPath,
  readJson,
} from "@pieai/university-ui/api/client.js";
import type {
  CardBody,
  ContentPort,
  Shelf,
  MistakeExercise,
} from "@pieai/university-ui/content/port.js";
import type {
  BootstrapData,
  CourseReviewCardLocator,
  CourseView,
  LessonView,
  RecapReviewCardLocator,
  StudyView,
} from "@pieai/university-ui/view/lesson-view.js";
import { lessonProgressOf } from "@pieai/university-ui/view/lesson-view.js";

/**
 * Ids reach a path join on the far side of this fetch.
 *
 * The address parser deliberately does not enforce a shape — a published id is
 * authored upstream and this side does not get to assume it is a slug. The
 * adapter that turns one into a filesystem question does, because that is where
 * `..` stops being a strange name and becomes a directory traversal.
 */
function guard(locator: LessonRef): void {
  const unsafe = [locator.studyId, locator.courseId, locator.unitId, locator.lessonId].find(
    (id) => !isSafeId(id),
  );
  if (unsafe !== undefined) throw new Error(`这节课的地址不对：${unsafe}`);
}

/**
 * The authoring server's opening payload, fetched once per document.
 *
 * Held here rather than in the app because three separate things need it — the
 * shelf, the request token every state-changing call carries, and the
 * workbench's own counters — and three fetches of one endpoint is three answers
 * that can disagree with each other by a few hundred milliseconds.
 */
let opening: Promise<BootstrapData> | null = null;

export function localBootstrap(): Promise<BootstrapData> {
  opening ??= fetchBootstrap();
  return opening;
}

/** Re-read after an authoring action changed what is on disk. */
export function refreshLocalBootstrap(): Promise<BootstrapData> {
  opening = fetchBootstrap();
  return opening;
}

async function fetchBootstrap(): Promise<BootstrapData> {
  return readLocalJson<BootstrapData>("/api/bootstrap");
}

async function readLocalJson<T>(url: string): Promise<T> {
  try {
    return await readJson<T>(await fetch(url));
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    throw new Error(`${url}: ${message}`);
  }
}

export function createLocalContentPort(options: {
  /** The shared document, for the one-time import of the old SQLite projection. */
  readonly progress: ProgressPort;
}): ContentPort {
  const exerciseIdsByLesson = new Map<string, readonly string[] | null>();
  const source = progressSourceOf(options.progress);
  return {
    // Nothing is known before the loopback server answers. The screen says so
    // rather than painting a capsule with no series in it, which is what the
    // two campuses looked different for.
    knownStudies: null,

    async studies() {
      // `/api/bootstrap` names the shelf without reading a single lesson.
      const boot = await localBootstrap();
      return boot.studies.map((study) => ({ id: study.id, title: study.title }));
    },

    async shelf(): Promise<Shelf> {
      const boot = await localBootstrap();
      const lessonRequests = concurrencyGate(8);
      const studies = await Promise.all(
        boot.studies.map(async (summary) => {
          const view = await readLocalJson<StudyView>(
            `/api/studies/${encodeURIComponent(summary.id)}`,
          );
          importLegacyProgress(view, options.progress);
          const courses = await Promise.all(
            view.courses.map((course) =>
              enrichCourseExerciseIds(
                summary.id,
                course,
                options.progress,
                exerciseIdsByLesson,
                lessonRequests,
              ),
            ),
          );
          return {
            id: view.study.id,
            title: view.study.title,
            /*
              The server's own `progress` fields are dropped on the way out.
              They were this campus's answer to 「这一关学完了吗」 and the
              document is the product's answer; carrying both is how one campus
              lights a stone the other leaves dark. `importLegacyProgress`
              above is the bridge that makes dropping them safe.
            */
            courses: courses.map((course) => ({
              ...course,
              units: course.units.map((unit) => ({
                ...unit,
                lessons: unit.lessons.map((lesson) =>
                  withExerciseSnapshot(
                    { ...lesson, progress: null },
                    lessonRefKey({
                      studyId: summary.id,
                      courseId: course.id,
                      unitId: unit.id,
                      lessonId: lesson.id,
                    }),
                    exerciseIdsByLesson,
                  ),
                ),
              })),
            })),
          };
        }),
      );
      return { studies };
    },

    async lesson(locator, requestOptions) {
      guard(locator);
      const view = await readJson<LessonView>(
        await fetch(
          lessonPath(locator),
          requestOptions?.signal ? { signal: requestOptions.signal } : {},
        ),
      );
      exerciseIdsByLesson.set(
        lessonRefKey(locator),
        (view.lesson.exercises ?? []).map((exercise) => exercise.id),
      );
      importLegacyLessonRecords(view, locator, options.progress);
      const state = options.progress.lessonState(lessonKeyOf(locator));
      const exercises = view.lesson.exercises;
      const completion = source.completionOf(locator, {
        contentRevision: view.lesson.contentRevision,
        exerciseIds: exercises?.map((exercise) => exercise.id) ?? [],
        ...(exercises ? {} : { exerciseIdsComplete: false }),
      });
      return {
        ...view,
        lesson: {
          ...view.lesson,
          progress: lessonProgressOf(
            state,
            completion,
            view.lesson.contentRevision,
            exercises?.length ?? 0,
          ),
        },
      };
    },

    async exercise(locator, exerciseId): Promise<MistakeExercise> {
      guard(locator);
      if (!isSafeId(exerciseId)) throw new Error(`这道题的地址不对：${exerciseId}`);
      return readJson<MistakeExercise>(await fetch(exerciseContentPath(locator, exerciseId)));
    },

    async card(card: CourseReviewCardLocator | RecapReviewCardLocator) {
      guard(card);
      if (card.kind === "recap-card") {
        return {
          front: card.front,
          back: null,
          contentRevision: card.contentRevision,
        } satisfies CardBody;
      }
      return readJson<CardBody>(await fetch(cardContentPath(card)));
    },

    async notes(studyId: string) {
      if (!isSafeId(studyId)) throw new Error(`这个项目的地址不对：${studyId}`);
      const view = await readJson<StudyView>(
        await fetch(`/api/studies/${encodeURIComponent(studyId)}`),
      );
      return view.notes;
    },

    noteEvidenceBase(studyId: string, noteId: string) {
      return `/api/studies/${encodeURIComponent(studyId)}/notes/${encodeURIComponent(noteId)}`;
    },
  };
}

/**
 * The shelf endpoint deliberately carries shape, not lesson bodies. The
 * authoring server's summary predates current-version exercise progress and
 * exposes only the count, so this adapter fills the missing stable ids from
 * the existing lesson route. The delivery shelf already carries them and
 * therefore never pays for these requests.
 */
async function enrichCourseExerciseIds(
  studyId: string,
  course: CourseView,
  progress: ProgressPort,
  exerciseIdsByLesson: Map<string, readonly string[] | null>,
  request: <T>(task: () => Promise<T>) => Promise<T>,
): Promise<CourseView> {
  const units = await Promise.all(
    course.units.map(async (unit) => ({
      ...unit,
      lessons: await Promise.all(
        unit.lessons.map(async (lesson) => {
          const locator: LessonRef = {
            studyId,
            courseId: course.id,
            unitId: unit.id,
            lessonId: lesson.id,
          };
          const key = lessonRefKey(locator);
          if (lesson.exerciseCount === 0) {
            exerciseIdsByLesson.set(key, []);
            return lesson;
          }
          const state = progress.lessonState(
            lessonKey(locator.studyId, locator.courseId, locator.lessonId),
          );
          const currentRead =
            state.readConfirmed === true &&
            (state.readConfirmedRevision === undefined ||
              state.readConfirmedRevision === lesson.contentRevision);
          const legacyComplete = state.readConfirmed === undefined && state.progress >= 1;
          if (!currentRead && !legacyComplete) {
            exerciseIdsByLesson.set(key, null);
            return lesson;
          }
          if (legacyComplete && !currentRead) {
            // Legacy completion is authoritative for this pre-migration row;
            // no exercise list is needed to keep it complete.
            exerciseIdsByLesson.set(key, []);
            return lesson;
          }
          guard(locator);
          const view = await request(() => readLocalJson<LessonView>(lessonPath(locator)));
          exerciseIdsByLesson.set(
            key,
            view.lesson.exercises.map((exercise) => exercise.id),
          );
          importLegacyLessonRecords(view, locator, progress);
          return {
            ...lesson,
            exerciseIds: view.lesson.exercises.map((exercise) => exercise.id),
          };
        }),
      ),
    })),
  );
  return { ...course, units };
}

function withExerciseSnapshot(
  lesson: CourseView["units"][number]["lessons"][number],
  key: string,
  exerciseIdsByLesson: Map<string, readonly string[] | null>,
): CourseView["units"][number]["lessons"][number] {
  const shaped = { ...lesson };
  Object.defineProperty(shaped, "exerciseIds", {
    configurable: true,
    enumerable: true,
    get: () => exerciseIdsByLesson.get(key) ?? [],
  });
  Object.defineProperty(shaped, "exerciseIdsComplete", {
    configurable: true,
    enumerable: true,
    get: () => exerciseIdsByLesson.has(key) && exerciseIdsByLesson.get(key) !== null,
  });
  return shaped;
}

/** Keep a large local shelf from opening hundreds of filesystem reads at once. */
function concurrencyGate(limit: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0;
  const waiting: (() => void)[] = [];

  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

/**
 * Move the old per-study SQLite read model into the shared document on sight.
 *
 * The server still owns authoring content and the clipboard host workflow. It
 * stopped owning the learner's cross-device standing when both campuses bound
 * to one cloud row, and this is the one place that crosses back over the local
 * HTTP boundary to fetch what was recorded before that.
 */
function importLegacyLessonRecords(
  view: LessonView,
  locator: LessonRef,
  progress: ProgressPort,
): void {
  const local = view.lesson.progress;
  const key = lessonKey(locator.studyId, locator.courseId, locator.lessonId);
  if (local && local.progress > progress.lessonState(key).progress) {
    progress.advanceLesson(key, local.progress);
  }
  if (local?.readConfirmed) progress.confirmLessonRead(key, local.contentRevision);
  /*
    The host's verdict is written to disk by the CLI, not by this browser, so
    the only way it reaches the shared document is on the next read of the
    lesson. Without this the clipboard workflow would grade an exercise and the
    document would never hear about it.
  */
  for (const exercise of view.lesson.exercises ?? []) {
    const answer = exercise.latestSubmission?.answer ?? exercise.hostGrade?.learnerAnswer ?? null;
    if (answer === null && !exercise.hostGrade) continue;
    const occurredAt = exercise.hostGrade?.occurredAt ?? exercise.latestSubmission?.occurredAt;
    if (!occurredAt) continue;
    progress.recordExerciseAttempt({
      commandId: `local-view:${locator.studyId}/${locator.courseId}/${locator.unitId}/${locator.lessonId}/${exercise.id}@${exercise.contentRevision}`,
      locator,
      exerciseId: exercise.id,
      contentRevision: exercise.contentRevision,
      answer: answer ?? "",
      score: exercise.hostGrade?.passed ? 1 : 0,
      maxScore: 1,
      hostGrade: exercise.hostGrade
        ? {
            passed: exercise.hostGrade.passed,
            evaluation: exercise.hostGrade.evaluation,
            extensions: exercise.hostGrade.extensions,
            host: exercise.hostGrade.host,
            learnerAnswer: exercise.hostGrade.learnerAnswer,
            occurredAt: exercise.hostGrade.occurredAt,
          }
        : null,
      occurredAt,
    });
  }
}

function importLegacyProgress(view: StudyView, progress: ProgressPort): void {
  for (const course of view.courses) {
    for (const unit of course.units) {
      for (const lesson of unit.lessons) {
        const local = lesson.progress;
        if (!local) continue;
        const key = lessonKey(view.study.id, course.id, lesson.id);
        if (local.progress > progress.lessonState(key).progress) {
          progress.advanceLesson(key, local.progress);
        }
        if (local.readConfirmed) progress.confirmLessonRead(key, local.contentRevision);
      }
    }
  }
}
