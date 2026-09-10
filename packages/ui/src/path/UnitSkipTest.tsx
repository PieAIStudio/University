import { useCallback, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  isUnitProven,
  judgeSkipAnswer,
  openedLessonIds,
  pickSkipTest,
  provenLessonIds,
  skipTestCandidates,
  SKIP_TEST_SIZE,
  type LessonRef,
  type SkipTestCandidate,
  type SkipTestVerdict,
} from "@pieai/university-core";

import { translate } from "../i18n/index.js";
import type { ContentPort } from "../content/port.js";
import type { UnitView } from "../view/lesson-view.js";

type Sitting =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  /** The unit's own exercises cannot be settled for free, so there is no test. */
  | { readonly kind: "unavailable" }
  | { readonly kind: "failed-to-load" }
  | {
      readonly kind: "asking";
      readonly questions: readonly SkipTestCandidate[];
      readonly results: readonly { readonly lessonId: string; readonly verdict: SkipTestVerdict }[];
      readonly answer: string;
      /** Set after a blank submit, so the message is a reply rather than a rule. */
      readonly blank: boolean;
    }
  | {
      readonly kind: "settled";
      readonly proven: readonly string[];
      readonly opened: readonly string[];
      readonly wrong: number;
    };

export interface UnitSkipTestProps {
  readonly studyId: string;
  readonly courseId: string;
  readonly unit: UnitView;
  /** Only `lesson` is used; naming the slice keeps the dependency honest. */
  readonly content: Pick<ContentPort, "lesson">;
  /** Which of this unit's lessons a previous sitting already proved. */
  readonly proven: ReadonlySet<string>;
  readonly onProven: (lessonIds: readonly string[]) => void;
  readonly onOpenLesson: (locator: LessonRef) => void;
  /** Injected by tests so one draw can be replayed; the product draws at random. */
  readonly pick?: (length: number) => number;
}

/**
 * 「我会了」 — three questions from this unit's own exercises, and what passing
 * them does and does not mean.
 *
 * V5 §12 决定 B、D、E、G, in one component because the design says they are one
 * mechanism: 「开场的几个问题和单元入口的『我会了』不是两套东西，是同一个机制的
 * 两个入口：自述缩小范围，测试决定解锁。」 The course-opening self-report renders
 * this same component per unit it recommends; it has no test of its own and no
 * way to prove anything by itself, which is the whole of 决定 G.
 *
 * Three things this deliberately does not do:
 *
 * It does not go through `GradingPort.submitExercise`. That path records an
 * attempt against the lesson, and an attempt is a claim that the learner worked
 * on it. Passing a skip test is a claim that they did not need to.
 *
 * It does not ask a question tier one cannot settle. `skipTestCandidates`
 * filters by the answer key, so an open-ended exercise is simply never drawn —
 * the alternative is spending the learner's metered grading balance on a test
 * whose reward is doing less work, which sells the tier backwards.
 *
 * It does not tell anyone they have 「学过」 these lessons. The result says so
 * out loud, because the next thing that happens if it does not is a review card
 * for prose nobody read, three weeks later, and a learner who starts ignoring
 * review prompts.
 */
export function UnitSkipTest({
  studyId,
  courseId,
  unit,
  content,
  proven,
  onProven,
  onOpenLesson,
  pick,
}: UnitSkipTestProps) {
  const [sitting, setSitting] = useState<Sitting>({ kind: "idle" });
  const lessonIds = unit.lessons.map((lesson) => lesson.id);
  const alreadyProven = isUnitProven(lessonIds, proven);

  const start = useCallback(async () => {
    setSitting({ kind: "loading" });
    try {
      /*
        Every lesson in the unit, because which ones carry a settleable answer
        is not knowable from the shelf: the authoring campus does not even have
        the exercise ids until it has fetched the lesson. Both campuses answer
        this from something they already hold — a bundled package on one side,
        a loopback server on the other — so the cost is a fan-out, not a wait.
      */
      const loaded = await Promise.all(
        unit.lessons.map((lesson) =>
          content.lesson({ studyId, courseId, unitId: unit.id, lessonId: lesson.id }),
        ),
      );
      const candidates = skipTestCandidates(
        loaded.map((view) => ({ id: view.lesson.id, exercises: view.lesson.exercises })),
      );
      const questions = pickSkipTest(candidates, {
        size: SKIP_TEST_SIZE,
        ...(pick ? { pick } : {}),
      });
      if (questions.length === 0) {
        setSitting({ kind: "unavailable" });
        return;
      }
      setSitting({ kind: "asking", questions, results: [], answer: "", blank: false });
    } catch {
      setSitting({ kind: "failed-to-load" });
    }
  }, [content, courseId, pick, studyId, unit]);

  function submit() {
    if (sitting.kind !== "asking") return;
    const question = sitting.questions[sitting.results.length];
    if (!question) return;
    const verdict = judgeSkipAnswer(sitting.answer, question.answerKey);
    if (verdict === "unanswered") {
      setSitting({ ...sitting, blank: true });
      return;
    }
    const results = [...sitting.results, { lessonId: question.lessonId, verdict }];
    if (results.length < sitting.questions.length) {
      setSitting({ ...sitting, results, answer: "", blank: false });
      return;
    }
    const earned = provenLessonIds(lessonIds, results);
    const opened = openedLessonIds(results);
    const wrong = results.filter((result) => result.verdict === "wrong").length;
    if (earned.length > 0) onProven(earned);
    setSitting({ kind: "settled", proven: earned, opened, wrong });
  }

  function lessonTitle(lessonId: string): string {
    return unit.lessons.find((lesson) => lesson.id === lessonId)?.title ?? lessonId;
  }

  if (sitting.kind === "idle") {
    return (
      <div className="skip-test skip-test--entry">
        <p className="skip-test__pitch">
          {alreadyProven
            ? translate("ui.path.unitSkipTest.copy.这一单元你已经证明过了-想再试一次也可以")
            : translate("ui.path.unitSkipTest.copy.这一单元你已经会了-做三道它自己的题就能跳过去")}
        </p>
        <GameButton variant="ghost" onClick={() => void start()}>
          {alreadyProven
            ? translate("ui.path.unitSkipTest.copy.再测一次")
            : translate("ui.path.unitSkipTest.copy.我会了")}
        </GameButton>
      </div>
    );
  }

  if (sitting.kind === "loading") {
    return (
      <p className="skip-test skip-test__note" aria-live="polite">
        {translate("ui.path.unitSkipTest.copy.正在从这一单元里抽题")}
      </p>
    );
  }

  if (sitting.kind === "failed-to-load") {
    return (
      <div className="skip-test" aria-live="polite">
        <p className="skip-test__note">
          {translate("ui.path.unitSkipTest.copy.这一单元的题没读出来-再试一次")}
        </p>
        <GameButton variant="ghost" onClick={() => void start()}>
          {translate("ui.path.unitSkipTest.copy.再试一次")}
        </GameButton>
      </div>
    );
  }

  /*
    Said plainly rather than by hiding the button. 36 of the 117 units on the
    shelf are in this state — their exercises ask for a sentence, and a sentence
    is exactly what tier one cannot judge — and a learner who clicked 「我会了」
    is owed the reason, not a control that quietly does nothing.
  */
  if (sitting.kind === "unavailable") {
    return (
      <div className="skip-test" aria-live="polite">
        <p className="skip-test__note">
          {translate(
            "ui.path.unitSkipTest.copy.这一单元的练习要写一整句话-没法当场判对错-所以不能靠做题跳过",
          )}
        </p>
      </div>
    );
  }

  if (sitting.kind === "asking") {
    const question = sitting.questions[sitting.results.length];
    if (!question) return null;
    return (
      <div className="skip-test" aria-live="polite">
        <p className="skip-test__progress">
          {translate("ui.path.courseRouteQuiz.copy.第")} {sitting.results.length + 1} /{" "}
          {sitting.questions.length} {translate("ui.path.courseRouteQuiz.copy.题")}
        </p>
        <p className="skip-test__prompt">{question.prompt}</p>
        <label className="skip-test__label" htmlFor={`skip-${unit.id}`}>
          {translate("ui.path.unitSkipTest.copy.把你的答案写在这里")}
        </label>
        <textarea
          id={`skip-${unit.id}`}
          className="skip-test__answer"
          rows={2}
          value={sitting.answer}
          onChange={(event) => setSitting({ ...sitting, answer: event.target.value, blank: false })}
        />
        {sitting.blank ? (
          <p className="skip-test__note">
            {translate("ui.path.unitSkipTest.copy.先写下你的答案-再交")}
          </p>
        ) : null}
        <GameButton variant="primary" onClick={submit}>
          {translate("ui.path.unitSkipTest.copy.交这一题")}
        </GameButton>
      </div>
    );
  }

  return (
    <div className="skip-test skip-test--settled" aria-live="polite">
      {sitting.proven.length === 0 ? (
        <>
          <p className="skip-test__verdict">
            {translate("ui.path.unitSkipTest.copy.错了两道以上-这一单元还是从头读一遍吧")}
          </p>
          <GameButton variant="ghost" onClick={() => setSitting({ kind: "idle" })}>
            {translate("ui.path.unitSkipTest.copy.再测一次")}
          </GameButton>
        </>
      ) : (
        <>
          <p className="skip-test__verdict">
            {sitting.wrong === 0
              ? translate("ui.path.unitSkipTest.copy.三道全对-这一单元你不用从头学了")
              : translate("ui.path.unitSkipTest.copy.错了一道-那一节读一下-其余的算你会了")}
          </p>
          {sitting.opened.map((lessonId) => (
            <button
              key={lessonId}
              type="button"
              className="text-button skip-test__open"
              onClick={() => onOpenLesson({ studyId, courseId, unitId: unit.id, lessonId })}
            >
              {translate("ui.path.unitSkipTest.copy.去读")}
              {lessonTitle(lessonId)}
            </button>
          ))}
          {/*
            The sentence that keeps 决定 E true for the person, not only for the
            store. Skipping moves where they may go; it does not claim they have
            read anything, and the cards stay out of the queue until they do.
          */}
          <p className="skip-test__note">
            {translate(
              "ui.path.unitSkipTest.copy.跳过不等于学过-这几节的复习卡不会进复习队列-想正式读随时点进来-那时才开始排期",
            )}
          </p>
        </>
      )}
    </div>
  );
}
