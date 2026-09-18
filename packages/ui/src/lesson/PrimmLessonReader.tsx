import { useRef, useState } from "react";
import { exerciseGradeOutcome, type ExerciseAttemptResult } from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import { LearningActivity } from "../learning-play/LearningActivity.js";
import type { PrimmActivity, PrimmEvaluation, PrimmWork } from "../learning-play/primm-types.js";
import { LessonToolbar } from "./LessonNav.js";
import { LessonBreadcrumbs } from "./LessonBreadcrumbs.js";
import type { LessonReaderProps } from "./LessonReader.js";

/** The native exercise owns grading; PRIMM owns traversal, never a second answer truth. */
export function composePrimmAnswer(work: PrimmWork): string {
  return JSON.stringify({
    kind: "primm-make",
    request: work.request,
    resultRequestId: work.result.requestId,
    finalWork: work.finalWork ?? work.result.text,
  });
}
export function primmEvaluationOf(result: ExerciseAttemptResult): PrimmEvaluation {
  if (result.answerStored === false) throw new Error("Answer not stored");
  return result.hostGrade
    ? { outcome: exerciseGradeOutcome(result.hostGrade), explanation: result.hostGrade.evaluation }
    : { outcome: result.correct ? "pass" : "undecided", explanation: "" };
}
export function PrimmLessonReader(props: LessonReaderProps & { readonly activity: PrimmActivity }) {
  const { locale } = useI18n();
  const scope = JSON.stringify([
    props.answerDraftScope ?? "local-guest",
    props.locator,
    props.view.lesson.contentRevision,
    props.activity.id,
    locale,
  ]);
  return <PrimmReaderSession key={scope} {...props} />;
}
function PrimmReaderSession({
  locator,
  view,
  activity,
  reader,
  grading,
  runPrimm,
  answerDraftScope = "local-guest",
  onLearningChanged,
  onBackToCourse,
  toolbarExtras,
  breadcrumb,
  completionDestination,
}: LessonReaderProps & { readonly activity: PrimmActivity }) {
  const { t } = useI18n();
  const [stage, setStage] = useState(0);
  const latestView = useRef(view);
  latestView.current = view;
  const exercise = view.lesson.exercises.find(
    (item) => item.id === activity.make.exerciseId && item.kind === "explain",
  );
  const checkGrade = (work: PrimmWork): PrimmEvaluation => {
    const current = latestView.current.lesson.exercises.find(
      (item) => item.id === activity.make.exerciseId,
    );
    const answer = composePrimmAnswer(work);
    const grade = current?.hostGrade;
    // Prior passes on this exercise never grade a newly edited request or another run.
    if (!grade || grade.learnerAnswer !== answer) return { outcome: "undecided", explanation: "" };
    return { outcome: exerciseGradeOutcome(grade), explanation: grade.evaluation };
  };
  return (
    <article className="lesson-reader lesson-reader--interaction lesson-reader--primm">
      {onBackToCourse ? (
        <LessonToolbar
          onClose={onBackToCourse}
          sections={[]}
          progressDestinationId={completionDestination}
          progressOverride={{
            current: stage,
            total: 5,
            label: t("primm.progress", { current: stage, total: 5 }),
          }}
        >
          {toolbarExtras}
        </LessonToolbar>
      ) : null}
      {breadcrumb ? <LessonBreadcrumbs {...breadcrumb} lessonTitle={view.lesson.title} /> : null}
      <div className="primm-reader__main">
        <LearningActivity
          activity={activity}
          assets={view.lesson.assets}
          lessonRef={locator}
          contentRevision={view.lesson.contentRevision}
          answerDraftScope={answerDraftScope}
          runPrimm={
            runPrimm ??
            (grading.executePrimm
              ? (input, signal) => grading.executePrimm!(input, signal)
              : undefined)
          }
          onPathProgress={setStage}
          evaluatePrimm={
            exercise
              ? async (work, signal) => {
                  const result = await grading.submitExercise({
                    locator,
                    exerciseId: exercise.id,
                    contentRevision: exercise.contentRevision,
                    answer: composePrimmAnswer(work),
                    commandId: crypto.randomUUID(),
                    allowMetered: false,
                    signal,
                  });
                  if (signal.aborted) throw new Error("Cancelled");
                  const evaluation = primmEvaluationOf(result);
                  await onLearningChanged();
                  return evaluation;
                }
              : undefined
          }
          refreshPrimmEvaluation={
            exercise
              ? async (work, signal) => {
                  await onLearningChanged();
                  if (signal.aborted) throw new Error("Cancelled");
                  return checkGrade(work);
                }
              : undefined
          }
          copyPrimmEvaluation={
            exercise && grading.coachingPacket
              ? async () => {
                  const packet = await grading.coachingPacket!({
                    locator,
                    exerciseId: exercise.id,
                  });
                  if (!navigator.clipboard) throw new Error("Clipboard unavailable");
                  await navigator.clipboard.writeText(packet.packet);
                }
              : undefined
          }
          onPrimmComplete={async (signal) => {
            await reader.completeLesson(locator, {
              commandId: crypto.randomUUID(),
              contentRevision: view.lesson.contentRevision,
            });
            if (signal.aborted) return;
            await onLearningChanged();
            if (!signal.aborted) onBackToCourse?.();
          }}
        />
      </div>
    </article>
  );
}
