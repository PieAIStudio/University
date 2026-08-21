import { useEffect, useMemo, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";

import type { CourseView, LessonRef } from "@pieai/university-ui/view/lesson-view.js";

type CourseRouteLevel = "beginner" | "familiar" | "builder";

interface RouteQuestion {
  readonly prompt: string;
  readonly options: readonly { readonly label: string; readonly score: number }[];
}

const COURSE_ROUTE_QUESTIONS: readonly RouteQuestion[] = [
  {
    prompt: "如果 App 里的按钮文字不对，你第一反应更接近哪一种？",
    options: [
      { label: "我会在界面里继续找", score: 0 },
      { label: "我会猜某个文件可能负责它", score: 1 },
      { label: "我会打开项目找代码并运行检查", score: 2 },
    ],
  },
  {
    prompt: "看到 `.tsx`、`package.json` 这些名字时，你大概处在什么状态？",
    options: [
      { label: "看起来都很陌生", score: 0 },
      { label: "见过，但需要有人带着看", score: 1 },
      { label: "我能大致说出它们分别做什么", score: 2 },
    ],
  },
  {
    prompt: "你以前把一个项目改过，并重新跑起来吗？",
    options: [
      { label: "还没有", score: 0 },
      { label: "改过小地方，但过程不太稳定", score: 1 },
      { label: "改过，也能自己排查问题", score: 2 },
    ],
  },
];

const ROUTE_STARTS: Record<
  CourseRouteLevel,
  { readonly unitId: string; readonly lessonId: string }
> = {
  beginner: { unitId: "what-is-an-app", lessonId: "you-already-know-apps" },
  familiar: { unitId: "what-is-code", lessonId: "code-is-text" },
  builder: { unitId: "files-and-folders", lessonId: "file-vs-folder" },
};

const ROUTE_COPY: Record<
  CourseRouteLevel,
  { readonly label: string; readonly description: string; readonly reason: string }
> = {
  beginner: {
    label: "从零开始",
    description: "从 App、文件和代码的最小概念开始，把这门课完整走一遍。",
    reason: "你会先建立“屏幕上的东西和文件里的代码有关”这条最重要的连接。",
  },
  familiar: {
    label: "有一点基础",
    description: "跳过最前面的使用者视角，从代码和文件的关系开始。",
    reason: "你已经见过项目文件，先把代码怎样组成界面这条线接起来更省力。",
  },
  builder: {
    label: "有开发经验",
    description: "跳过入门解释，从文件、配置和运行关系开始。",
    reason: "你已经改过并运行过项目，直接整理文件职责和运行链路更合适。",
  },
};

export function classifyCourseRoute(score: number): CourseRouteLevel {
  if (score <= 2) return "beginner";
  if (score <= 4) return "familiar";
  return "builder";
}

function getCourseRoutePlan(course: CourseView, level: CourseRouteLevel) {
  const lessons = course.units.flatMap((unit) =>
    unit.lessons.map((lesson) => ({ unitId: unit.id, lesson })),
  );
  const requested = ROUTE_STARTS[level];
  const startIndex = Math.max(
    0,
    lessons.findIndex(
      (entry) => entry.unitId === requested.unitId && entry.lesson.id === requested.lessonId,
    ),
  );
  return {
    ...ROUTE_COPY[level],
    level,
    startIndex,
    recommendedCount: Math.max(lessons.length - startIndex, 0),
    entryPoint: lessons[startIndex] ?? lessons[0] ?? null,
    totalCount: lessons.length,
  };
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

export function CourseRouteQuiz({
  studyId,
  course,
  onOpenLesson,
}: {
  readonly studyId: string;
  readonly course: CourseView;
  readonly onOpenLesson: (locator: LessonRef) => void;
}) {
  const storageKey = `universitylocal-route-${studyId}-${course.id}`;
  const [answers, setAnswers] = useState<readonly number[]>([]);
  const [result, setResult] = useState<StoredRouteResult | null>(null);
  const plan = useMemo(
    () => (result ? getCourseRoutePlan(course, result.level) : null),
    [course, result],
  );

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
    const nextResult: StoredRouteResult = {
      level: classifyCourseRoute(nextAnswers.reduce((sum, value) => sum + value, 0)),
      score: nextAnswers.reduce((sum, value) => sum + value, 0),
    };
    setResult(nextResult);
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
    <details className="course-route-quiz" open>
      <summary>
        <span>
          <span className="eyebrow">学习路线</span>
          <strong>先测测你的学习起点</strong>
        </span>
        <span className="course-route-quiz__summary-meta">
          {result ? ROUTE_COPY[result.level].label : "3 个小问题"}
        </span>
      </summary>
      <div className="course-route-quiz__body">
        {result && plan ? (
          <div className="course-route-quiz__result">
            <p className="course-route-quiz__result-label">根据你的回答，推荐起点是</p>
            <h3>{plan.label}</h3>
            <p>{plan.description}</p>
            <p className="course-route-quiz__count">
              建议先学 {plan.recommendedCount} 节（这门课共 {plan.totalCount} 节）。
            </p>
            <p className="course-route-quiz__reason">{plan.reason}</p>
            <div className="course-route-quiz__actions">
              {plan.entryPoint ? (
                <GameButton
                  variant="primary"
                  onClick={() =>
                    onOpenLesson({
                      studyId,
                      courseId: course.id,
                      unitId: plan.entryPoint.unitId,
                      lessonId: plan.entryPoint.lesson.id,
                    })
                  }
                >
                  从推荐起点开始
                </GameButton>
              ) : null}
              <button type="button" className="text-button" onClick={retake}>
                重新回答
              </button>
            </div>
            <p className="course-route-quiz__note">
              这是推荐起点，不会锁住前面的课；你仍然可以展开全部 {plan.totalCount} 节课。
            </p>
          </div>
        ) : currentQuestion ? (
          <div className="course-route-quiz__question" aria-live="polite">
            <div className="course-route-quiz__progress">
              <span>
                第 {answers.length + 1} / {COURSE_ROUTE_QUESTIONS.length} 题
              </span>
              <span>{answers.length === 0 ? "凭直觉回答就好" : "继续回答，系统会自动判断"}</span>
            </div>
            <h3>{currentQuestion.prompt}</h3>
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
