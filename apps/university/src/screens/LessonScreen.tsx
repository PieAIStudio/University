/**
 * The screen the product's advantage lives on, and there is one of it.
 *
 * Everything else here exists in every learning app. A paragraph of explanation
 * sitting next to the exact commit and line range in a shipping private
 * repository does not. This screen does not render that paragraph — it wires
 * the shared reader to the build's ports. A second Markdown pipeline would be
 * drift with a schedule, and for a while there were two of these: one that
 * fetched a view over HTTP and one that folded a package, which is how the two
 * campuses came to disagree about what happens when a lesson is finished.
 */
import { translate } from "@pieai/university-ui/i18n.js";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  courseShapeOf,
  isLessonComplete,
  lessonKeyOf,
  lessonRefKey,
  NOT_STARTED,
  progressSourceOf,
  readCourseProgress,
  type ExerciseAttemptResult,
  type LessonRef,
} from "@pieai/university-core";
import { LessonReader } from "@pieai/university-ui/lesson/LessonReader.js";
import { lessonProgressDestinationId } from "@pieai/university-ui/cta/LiquidCtaTransition.js";
import { lessonNeighbours } from "@pieai/university-ui/lesson/LessonNav.js";
import { RecoveryState } from "@pieai/university-ui/loading/RecoveryState.js";
import { playSound, SoundToggle } from "@pieai/university-ui/sound/index.js";
import type { LessonLinkTarget } from "@pieai/university-ui/markdown/remark-lesson-links.js";
import type { CourseView, LessonView } from "@pieai/university-ui/view/lesson-view.js";
import { createReviewCardPort } from "@pieai/university-ui/review/scheduler-ports.js";
import type { EntitlementReader } from "@pieai/university-ui/capability/ai-entitlements.js";

import { trackEvent, withProductAnalyticsReview } from "../analytics/productAnalytics";
import { contentPort, gradingPort, readerPort, sourceAccessPort } from "../ports/index.js";
import { progressPort } from "../progress/store.js";

function exerciseAnalyticsKey(locator: LessonRef, exerciseId: string): string {
  return `${locator.studyId}/${locator.courseId}/${locator.unitId}/${locator.lessonId}/${exerciseId}`;
}

function isNewGrade(occurredAt: string, previousAt: string): boolean {
  if (!previousAt) return true;
  const next = Date.parse(occurredAt);
  const previous = Date.parse(previousAt);
  return Number.isFinite(next) && Number.isFinite(previous)
    ? next > previous
    : occurredAt !== previousAt;
}

function exerciseTierOf(result: ExerciseAttemptResult): "tier-1" | "tier-2" {
  return result.hostGrade?.host === "tier-1" ? "tier-1" : "tier-2";
}

export function LessonScreen({
  locator,
  course,
  returnDepth,
  onBack,
  onFollowLink,
  onOpenLesson,
  onReturn,
  onSettled,
  onWorthwhileProgress,
  readEntitlements,
}: {
  readonly locator: LessonRef;
  /** The course's shape, for prev/next. Null while the shelf is still arriving. */
  readonly course: CourseView | null;
  readonly returnDepth: number;
  readonly onBack: () => void;
  readonly onFollowLink: (target: LessonLinkTarget) => void;
  readonly onOpenLesson: (next: LessonRef) => void;
  readonly onReturn: () => void;
  readonly onSettled: (doneBefore: number) => void;
  /** Starts the optional account session after a new learner value is saved. */
  readonly onWorthwhileProgress?: () => void;
  /** Reads the server-selected AI plan for open tutoring controls. */
  readonly readEntitlements?: EntitlementReader;
}) {
  const progress = useSyncExternalStore(progressPort.subscribe, progressPort.snapshot);
  const [view, setView] = useState<{ readonly key: string; readonly view: LessonView } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const requested = lessonRefKey(locator);
  const source = useMemo(() => progressSourceOf(progressPort), []);
  const pendingExerciseResults = useRef(
    new Map<
      string,
      {
        readonly attemptCount: number;
        readonly previousGradeAt: string;
      }
    >(),
  );
  const knownExerciseGrades = useRef(new Map<string, string>());

  const trackedReader = useMemo(
    () => ({
      ...readerPort,
      async completeLesson(
        target: LessonRef,
        input: Parameters<typeof readerPort.completeLesson>[1],
      ) {
        await readerPort.completeLesson(target, input);
        trackEvent({
          name: "lesson_read_confirmed",
          studyId: target.studyId,
          courseId: target.courseId,
          lessonId: target.lessonId,
        });
      },
    }),
    [],
  );

  const trackedGrading = useMemo(
    () => ({
      ...gradingPort,
      async submitExercise(input: Parameters<typeof gradingPort.submitExercise>[0]) {
        const key = exerciseAnalyticsKey(input.locator, input.exerciseId);
        const previousGradeAt = knownExerciseGrades.current.get(key) ?? "";
        const result = await gradingPort.submitExercise(input);
        trackEvent({
          name: "exercise_submitted",
          studyId: input.locator.studyId,
          courseId: input.locator.courseId,
          lessonId: input.locator.lessonId,
          tier: exerciseTierOf(result),
        });
        if (result.hostGrade && isNewGrade(result.hostGrade.occurredAt, previousGradeAt)) {
          trackEvent({
            name: "exercise_result",
            studyId: input.locator.studyId,
            courseId: input.locator.courseId,
            lessonId: input.locator.lessonId,
            passed: result.hostGrade.passed,
            attemptCount: result.attemptCount,
          });
        } else {
          pendingExerciseResults.current.set(key, {
            attemptCount: result.attemptCount,
            previousGradeAt,
          });
        }
        return result;
      },
    }),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void contentPort
      .lesson(locator, { signal: controller.signal })
      .then((loaded) => setView({ key: requested, view: loaded }))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(
          reason instanceof Error
            ? reason.message
            : translate("app.screens.lessonScreen.copy.无法读取课程"),
        );
      });
    return () => controller.abort();
  }, [requested, reloads]);

  /**
   * Reading the reward off the document, rather than being told about it.
   *
   * Two ports used to announce it — the reader when a read was confirmed, the
   * grader when an answer passed — and only one campus listened to the grader,
   * because only one campus grades in the browser. The authoring campus's host
   * writes its verdict to disk minutes later, so an announcement was never
   * going to work there. Both facts land in the shared document; this watches
   * the document.
   */
  const settled = useRef<string | null>(null);
  const shown = view?.key === requested ? view.view : null;

  useEffect(() => {
    if (!shown) return;
    for (const exercise of shown.lesson.exercises) {
      const key = exerciseAnalyticsKey(locator, exercise.id);
      const occurredAt = exercise.hostGrade?.occurredAt ?? "";
      const pending = pendingExerciseResults.current.get(key);
      if (pending && occurredAt && isNewGrade(occurredAt, pending.previousGradeAt)) {
        pendingExerciseResults.current.delete(key);
        trackEvent({
          name: "exercise_result",
          studyId: locator.studyId,
          courseId: locator.courseId,
          lessonId: locator.lessonId,
          passed: exercise.hostGrade?.passed === true,
          attemptCount: pending.attemptCount,
        });
      }
      knownExerciseGrades.current.set(key, occurredAt);
    }
  }, [shown, locator.courseId, locator.lessonId, locator.studyId, locator.unitId]);
  /*
    The shared source can now answer both facts independently because this
    caller supplies the current lesson revision and its complete exercise id
    list. It used to be unsafe here: it asked the document's aggregate
    `progress` for the exercise result, then this effect wrote that same result
    back as `progress`, forming a read/write cycle.
  */
  const completion = shown
    ? source.completionOf(locator, {
        contentRevision: shown.lesson.contentRevision,
        exerciseIds: shown.lesson.exercises.map((exercise) => exercise.id),
      })
    : null;
  const finished = completion != null && isLessonComplete(completion);

  useEffect(() => {
    if (!finished || !course || settled.current === requested) return;
    settled.current = requested;
    // Counted before the write, because that is the only moment the previous
    // number exists. Deriving it afterwards as `done - 1` was wrong on a lesson
    // finished twice: the count does not move, and the subtraction invented a
    // step the map had not made.
    const doneBefore = readCourseProgress(courseShapeOf(course, locator.studyId), source).done;
    const wasIncomplete = (progress.lessons[lessonKeyOf(locator)]?.progress ?? 0) < 1;
    progressPort.advanceLesson(lessonKeyOf(locator), 1);
    // The drop is the reason to come back tomorrow, so it happens the moment
    // the lesson is passed rather than on some later screen.
    progressPort.dropCards(
      locator.studyId,
      locator.courseId,
      locator.lessonId,
      (shown?.lesson.cards ?? []).map((card) => card.id),
    );
    if (wasIncomplete) onWorthwhileProgress?.();
    onSettled(doneBefore);
  }, [
    finished,
    course,
    requested,
    shown,
    locator,
    onSettled,
    onWorthwhileProgress,
    progress,
    source,
  ]);

  const overlaid = useMemo(
    () => (shown ? overlayCloudRecords(shown, locator) : null),
    [shown, locator, progress],
  );

  const review = useMemo(
    () =>
      withProductAnalyticsReview(
        createReviewCardPort(contentPort, progressPort),
        () => progressPort.dueCards().length,
      ),
    [],
  );
  const neighbours = useMemo(
    () => (course ? lessonNeighbours([course], locator) : null),
    [course, locator],
  );
  const unitObjective = course?.units.find((unit) => unit.id === locator.unitId)?.objective ?? "";
  const back = useCallback(() => {
    playSound("nav.back");
    onBack();
  }, [onBack]);

  if (error) {
    return (
      <main className="reader">
        <RecoveryState
          reason="content"
          onRetry={() => setReloads((n) => n + 1)}
          retryLabel={translate("app.screens.lessonScreen.copy.重试这节课")}
          onContinue={onBack}
          continueLabel={translate("app.screens.lessonScreen.copy.回到课程岛")}
        />
      </main>
    );
  }

  if (!overlaid)
    return (
      <p className="loading-copy">{translate("app.screens.lessonScreen.copy.正在打开这节课")}</p>
    );

  return (
    <main className="reader">
      <LessonReader
        locator={locator}
        view={overlaid}
        completion={completion ?? NOT_STARTED}
        completionDestination={lessonProgressDestinationId(
          locator.studyId,
          locator.courseId,
          locator.lessonId,
        )}
        unitObjective={unitObjective}
        reader={trackedReader}
        grading={trackedGrading}
        readEntitlements={readEntitlements}
        sourceAccess={sourceAccessPort}
        progress={progressPort}
        review={review}
        /*
          Empty on purpose. The token is only ever forwarded to `ReviewCard`,
          which uses it for a loopback route it takes when no review port was
          supplied — and one always is now.
        */
        requestToken=""
        onLearningChanged={async () => setReloads((n) => n + 1)}
        neighbours={neighbours}
        onOpenLesson={onOpenLesson}
        onBackToCourse={back}
        onFollowLink={onFollowLink}
        {...(returnDepth > 0 ? { onReturn } : {})}
        toolbarExtras={<SoundToggle progress={progressPort} />}
      />
    </main>
  );
}

/**
 * Records the document holds win over a view that was built somewhere else.
 *
 * The delivery build folds the view out of a package that knows nothing about
 * this learner; the authoring build reads a server that knew, but may be
 * behind a device the learner used yesterday. Same overlay for both, so an
 * answer given on a phone shows on a laptop either way.
 */
function overlayCloudRecords(view: LessonView, locator: LessonRef): LessonView {
  return {
    ...view,
    lesson: {
      ...view.lesson,
      exercises: view.lesson.exercises.map((exercise) => {
        const latest = progressPort.latestExerciseAttempt(
          locator,
          exercise.id,
          exercise.contentRevision,
        );
        if (!latest) return exercise;
        const localAt = Date.parse(
          exercise.hostGrade?.occurredAt ?? exercise.latestSubmission?.occurredAt ?? "",
        );
        if (Number.isFinite(localAt) && localAt > Date.parse(latest.occurredAt)) return exercise;
        return {
          ...exercise,
          awaitingHostGrade: latest.hostGrade?.passed !== true,
          latestSubmission: { answer: latest.answer, occurredAt: latest.occurredAt },
          hostGrade: latest.hostGrade
            ? {
                passed: latest.hostGrade.passed,
                evaluation: latest.hostGrade.evaluation,
                extensions: latest.hostGrade.extensions,
                host: latest.hostGrade.host,
                learnerAnswer: latest.hostGrade.learnerAnswer,
                occurredAt: latest.hostGrade.occurredAt,
              }
            : null,
        };
      }),
    },
  };
}
