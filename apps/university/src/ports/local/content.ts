/**
 * Authoring's ContentPort: the loopback server that reads the disk.
 *
 * What was saved a second ago is on screen now, which is the whole reason this
 * mode exists. Behaviour is the contract: changing a path or a field here is
 * changing what 4317 has always answered, and that is a product change.
 */
import { isSafeId, lessonKey, type LessonRef, type ProgressPort } from "@pieai/university-core";
import { cardContentPath, lessonPath, readJson } from "@pieai/university-ui/api/client.js";
import type { CardBody, ContentPort, Shelf } from "@pieai/university-ui/content/port.js";
import type {
  BootstrapData,
  CourseReviewCardLocator,
  LessonView,
  StudyView,
} from "@pieai/university-ui/view/lesson-view.js";

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
  return readJson<BootstrapData>(await fetch("/api/bootstrap"));
}

export function createLocalContentPort(options: {
  /** The shared document, for the one-time import of the old SQLite projection. */
  readonly progress: ProgressPort;
}): ContentPort {
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
      const studies = await Promise.all(
        boot.studies.map(async (summary) => {
          const view = await readJson<StudyView>(
            await fetch(`/api/studies/${encodeURIComponent(summary.id)}`),
          );
          importLegacyProgress(view, options.progress);
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
            courses: view.courses.map((course) => ({
              ...course,
              units: course.units.map((unit) => ({
                ...unit,
                lessons: unit.lessons.map((lesson) => ({ ...lesson, progress: null })),
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
      importLegacyLessonRecords(view, locator, options.progress);
      return view;
    },

    async card(card: CourseReviewCardLocator) {
      guard(card);
      return readJson<CardBody>(await fetch(cardContentPath(card)));
    },
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
