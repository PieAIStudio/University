import { translate } from "../i18n/index.js";
import { useEffect, useMemo, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { provenIdsForUnit } from "@pieai/university-core";

import type { ContentPort } from "../content/port.js";
import type { CourseView, LessonRef, UnitView } from "../view/lesson-view.js";
import { UnitSkipTest } from "./UnitSkipTest.js";

type CourseRouteLevel = "beginner" | "familiar" | "builder";

interface RouteQuestion {
  readonly prompt: string;
  readonly options: readonly { readonly label: string; readonly score: number }[];
}

/*
  Every option asks what the learner has done, never what they understand.
  「你以前把一个项目改过并重新跑起来吗」 can be answered; 「你理解组件吗」 measures
  confidence rather than ability, and confidence is the thing this whole section
  exists to stop acting on (V5 §12 决定 A).
*/
const COURSE_ROUTE_QUESTIONS: readonly RouteQuestion[] = [
  {
    prompt: translate(
      "ui.path.courseRouteQuiz.copy.如果-App-里的按钮文字不对-你第一反应更接近哪一种",
    ),
    options: [
      { label: translate("ui.path.courseRouteQuiz.copy.我会在界面里继续找"), score: 0 },
      { label: translate("ui.path.courseRouteQuiz.copy.我会猜某个文件可能负责它"), score: 1 },
      { label: translate("ui.path.courseRouteQuiz.copy.我会打开项目找代码并运行检查"), score: 2 },
    ],
  },
  {
    prompt: translate(
      "ui.path.courseRouteQuiz.copy.看到-tsx-package-json-这些名字时-你大概处在什么状态",
    ),
    options: [
      { label: translate("ui.path.courseRouteQuiz.copy.看起来都很陌生"), score: 0 },
      { label: translate("ui.path.courseRouteQuiz.copy.见过-但需要有人带着看"), score: 1 },
      { label: translate("ui.path.courseRouteQuiz.copy.我能大致说出它们分别做什么"), score: 2 },
    ],
  },
  {
    prompt: translate("ui.path.courseRouteQuiz.copy.你以前把一个项目改过-并重新跑起来吗"),
    options: [
      { label: translate("ui.path.courseRouteQuiz.copy.还没有"), score: 0 },
      { label: translate("ui.path.courseRouteQuiz.copy.改过小地方-但过程不太稳定"), score: 1 },
      { label: translate("ui.path.courseRouteQuiz.copy.改过-也能自己排查问题"), score: 2 },
    ],
  },
];

/**
 * How many leading units the answers suggest testing out of.
 *
 * A count of units, not an index into lessons. It used to be the latter, and
 * that was the defect rather than a detail: an index is a destination, so the
 * answers *were* the unlock. A count is a proposal — 「看起来你可以跳过这几个
 * 单元，要不要各测三道？」 — and every one of those units still has to be earned
 * question by question (V5 §12 决定 G).
 *
 * Units are the author's own chunking, so a unit boundary is the honest seam to
 * offer. A course written as a single unit has no seam at all and is offered
 * nothing here; its one unit still carries 「我会了」 on its own entry, which is
 * 决定 D's entrance and needs no recommendation to reach.
 */
export function recommendedSkipUnitCount(course: CourseView, level: CourseRouteLevel): number {
  if (level === "beginner" || course.units.length < 2) return 0;
  if (level === "familiar") return 1;
  return Math.max(1, course.units.length - 1);
}

/**
 * Whether skipping into this course is a real offer.
 *
 * Under four lessons there is nothing worth skipping into — telling somebody to
 * start at lesson two of three is noise dressed as a decision.
 */
export function hasRouteQuiz(course: {
  readonly units: readonly { readonly lessons: readonly unknown[] }[];
}): boolean {
  return course.units.reduce((sum, unit) => sum + unit.lessons.length, 0) >= 4;
}

/**
 * Why the answers point where they point.
 *
 * What used to sit beside each of these was a name — 从零开始 / 有一点基础 /
 * 有开发经验 — printed as the headline of the result. That is the label 决定 A
 * forbids: 「称号对学习没有用，而且贴上去就很难撕：一个被标成『初级』的人，会在每
 * 一次卡住时把它当成对自己的解释。」 The names are gone; the reasons, which talk
 * about what the person has done rather than what they are, stayed.
 */
const ROUTE_REASON: Record<CourseRouteLevel, string> = {
  beginner: translate(
    "ui.path.courseRouteQuiz.copy.你会先建立-屏幕上的东西和文件里的代码有关-这条最重要的连接",
  ),
  familiar: translate(
    "ui.path.courseRouteQuiz.copy.你已经见过项目文件-先把代码怎样组成界面这条线接起来更省力",
  ),
  builder: translate(
    "ui.path.courseRouteQuiz.copy.你已经改过并运行过项目-直接整理文件职责和运行链路更合适",
  ),
};

export function classifyCourseRoute(score: number): CourseRouteLevel {
  if (score <= 2) return "beginner";
  if (score <= 4) return "familiar";
  return "builder";
}

interface StoredRouteResult {
  readonly level: CourseRouteLevel;
  readonly score: number;
}

function isStoredRouteResult(value: unknown): value is StoredRouteResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredRouteResult>;
  return (
    (candidate.level === "beginner" ||
      candidate.level === "familiar" ||
      candidate.level === "builder") &&
    typeof candidate.score === "number"
  );
}

/**
 * 「我该从哪一关开始」 — asked on the island of a course nobody has started.
 *
 * It was on the authoring workbench, three screens away from any course, next
 * to the study shelf an author registers repositories on. Two things were
 * wrong with that and the merge only made one of them urgent: the workbench is
 * eliminated from the delivery build, so the half of the product that sells
 * courses could not have shown it at all; and a learner deciding where to
 * start is standing on the course, not in a workbench.
 *
 * The caller decides *when*: this is only a live question before the first
 * lesson is done, and a quiz still offering to pick your starting point when
 * you are twenty lessons in is asking about a decision you already made.
 *
 * What it may and may not do is 决定 G, and it used to do the forbidden half.
 * Three self-reported answers chose a lesson and dropped the learner there,
 * which is exactly the failure the design names: 「一个高估自己的人会被自己的答案
 * 推到接不住的地方，然后把接不住理解成『我不适合学这个』。」 Now the answers
 * produce one sentence — these units look skippable, want to try three
 * questions each — and every unit is earned through `UnitSkipTest`, the same
 * component the unit's own 「我会了」 renders. There is no second path, and
 * nothing here writes to progress at all.
 */
export function CourseRouteQuiz({
  studyId,
  course,
  content,
  proven,
  onProven,
  onOpenLesson,
}: {
  readonly studyId: string;
  readonly course: CourseView;
  /** Passed straight through to the skip test; the quiz reads no lesson itself. */
  readonly content: Pick<ContentPort, "lesson">;
  /** Lesson keys this learner has already proved, across the whole document. */
  readonly proven: ReadonlySet<string>;
  readonly onProven: (unit: UnitView, lessonIds: readonly string[]) => void;
  readonly onOpenLesson: (locator: LessonRef) => void;
}) {
  const storageKey = `universitylocal-route-${studyId}-${course.id}`;
  const [answers, setAnswers] = useState<readonly number[]>([]);
  const [result, setResult] = useState<StoredRouteResult | null>(null);
  const suggested = useMemo(
    () => (result ? course.units.slice(0, recommendedSkipUnitCount(course, result.level)) : []),
    [course, result],
  );
  const firstLesson = course.units[0]?.lessons[0];

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (isStoredRouteResult(parsed)) setResult(parsed);
    } catch {
      // A private browser storage failure should not block the route quiz.
    }
  }, [storageKey]);

  const currentQuestion = COURSE_ROUTE_QUESTIONS[answers.length];

  function choose(score: number) {
    const nextAnswers = [...answers, score];
    if (nextAnswers.length < COURSE_ROUTE_QUESTIONS.length) {
      setAnswers(nextAnswers);
      return;
    }
    const total = nextAnswers.reduce((sum, value) => sum + value, 0);
    const nextResult: StoredRouteResult = { level: classifyCourseRoute(total), score: total };
    setResult(nextResult);
    /*
      `localStorage`, still, and deliberately not the progress document. What is
      stored here is a self-report, and a self-report is not a learner fact: it
      unlocks nothing, syncs nowhere, and costs nothing if a private window
      throws it away. The proofs it leads to are the thing that belongs to the
      account, and those are written by the skip test.
    */
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextResult));
    } catch {
      // The result still works for this visit when storage is unavailable.
    }
  }

  function retake() {
    setAnswers([]);
    setResult(null);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Nothing to do; the next answer still starts a fresh local run.
    }
  }

  return (
    /*
      `h4`, because the panel this now sits in is titled by an `h3` — the
      course's own name. On the workbench the page was titled `h1` and these
      were `h3`; moving the component without moving its heading level would
      have put a second `h3` inside the first one's section, which is a broken
      outline for a screen reader and was caught, less politely, by G2 finding
      two 「the title of this panel」 where the product has one.
    */
    <details className="course-route-quiz">
      <summary>
        <span>
          <span className="eyebrow">{translate("ui.path.courseRouteQuiz.copy.学习路线")}</span>
          <strong>{translate("ui.path.courseRouteQuiz.copy.先测测你的学习起点")}</strong>
        </span>
        <span className="course-route-quiz__summary-meta">
          {result
            ? translate("ui.path.courseRouteQuiz.copy.已回答")
            : translate("ui.path.courseRouteQuiz.copy.3-个小问题")}
        </span>
      </summary>
      <div className="course-route-quiz__body">
        {result ? (
          <div className="course-route-quiz__result">
            <p className="course-route-quiz__result-label">
              {translate("ui.path.courseRouteQuiz.copy.根据你的回答")}
            </p>
            {suggested.length > 0 ? (
              <h4>
                {translate("ui.path.courseRouteQuiz.copy.看起来你可以跳过前面")} {suggested.length}{" "}
                {translate("ui.path.courseRouteQuiz.copy.个单元-要不要各测三道")}
              </h4>
            ) : (
              <h4>{translate("ui.path.courseRouteQuiz.copy.这门课从第一节开始最省力")}</h4>
            )}
            <p className="course-route-quiz__reason">{ROUTE_REASON[result.level]}</p>
            {/*
              The units, each with the same test the unit entry offers. Nothing
              above this line has unlocked anything: 「自述本身从不把任何一节标成
              已掌握」, and the way that is kept true is that this component has
              no write path of its own to keep true.
            */}
            {suggested.map((unit) => (
              <section key={unit.id} className="course-route-quiz__unit">
                <p className="course-route-quiz__unit-name">{unit.title}</p>
                <UnitSkipTest
                  studyId={studyId}
                  courseId={course.id}
                  unit={unit}
                  content={content}
                  proven={provenIdsForUnit(
                    proven,
                    { studyId, courseId: course.id },
                    unit.lessons.map((lesson) => lesson.id),
                  )}
                  onProven={(lessonIds) => onProven(unit, lessonIds)}
                  onOpenLesson={onOpenLesson}
                />
              </section>
            ))}
            <div className="course-route-quiz__actions">
              {firstLesson ? (
                <GameButton
                  variant={suggested.length > 0 ? "ghost" : "primary"}
                  onClick={() =>
                    onOpenLesson({
                      studyId,
                      courseId: course.id,
                      unitId: course.units[0]!.id,
                      lessonId: firstLesson.id,
                    })
                  }
                >
                  {translate("ui.path.courseRouteQuiz.copy.从第一节开始")}
                </GameButton>
              ) : null}
              <button type="button" className="text-button" onClick={retake}>
                {translate("ui.path.courseRouteQuiz.copy.重新回答")}
              </button>
            </div>
            <p className="course-route-quiz__note">
              {translate("ui.path.courseRouteQuiz.copy.回答本身不会解锁任何一节-做对题才会")}
            </p>
          </div>
        ) : currentQuestion ? (
          <div className="course-route-quiz__question" aria-live="polite">
            <div className="course-route-quiz__progress">
              <span>
                {translate("ui.path.courseRouteQuiz.copy.第")} {answers.length + 1} /{" "}
                {COURSE_ROUTE_QUESTIONS.length} {translate("ui.path.courseRouteQuiz.copy.题")}
              </span>
              <span>
                {answers.length === 0
                  ? translate("ui.path.courseRouteQuiz.copy.凭直觉回答就好")
                  : translate("ui.path.courseRouteQuiz.copy.继续回答-系统会自动判断")}
              </span>
            </div>
            <h4>{currentQuestion.prompt}</h4>
            <div className="course-route-quiz__options">
              {currentQuestion.options.map((option) => (
                <button
                  type="button"
                  className="course-route-quiz__option"
                  key={option.label}
                  onClick={() => choose(option.score)}
                >
                  {option.label}
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
