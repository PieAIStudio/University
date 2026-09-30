import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { GameButton, GameCallout, GamePanel } from "@pieai/swimmer-ui-kit";
import {
  completedPracticeLessons,
  lessonPracticeQuestions,
  lessonPracticeAttempt,
  pickLessonPractice,
  progressSourceOf,
  lessonRefKey,
  type PracticeCourse,
  type PracticeLesson,
  type LessonPracticeQuestion,
  type ProgressPort,
  type LessonRef,
} from "@pieai/university-core";
import type { ContentPort } from "../content/port.js";
import { PracticeRoundComplete } from "./PracticeRoundComplete.js";
import { QuestionStep } from "../path/QuestionStep.js";
import { useI18n } from "../i18n/index.js";

type Mode = "round" | "free";
type State =
  | { readonly kind: "loading" }
  | { readonly kind: "empty" | "failed"; readonly lessons: readonly PracticeLesson[] }
  | {
      readonly kind: "asking";
      readonly questions: readonly LessonPracticeQuestion[];
      readonly index: number;
      readonly failures: number;
    }
  | { readonly kind: "finished"; readonly answered: number };

/** One assembly of the existing native QuestionStep. Rehearsal does not call
 * the lesson grading/metering port and never manufactures a new question. */
export function LessonPracticeSurface({
  courses,
  ready = true,
  progress,
  content,
  initialMode = "round",
  onOpenLesson,
  onBack,
}: {
  readonly courses: readonly PracticeCourse[];
  readonly ready?: boolean;
  readonly progress: ProgressPort;
  readonly content: ContentPort;
  readonly initialMode?: Mode;
  readonly onOpenLesson: (locator: LessonRef) => void;
  readonly onBack: () => void;
}) {
  const t = useI18n();
  useSyncExternalStore(progress.subscribe, progress.snapshot);
  const owner = progress.syncState().userId;
  const source = useMemo(() => progressSourceOf(progress), [progress]);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [mode, setMode] = useState<Mode>(initialMode);
  const [answer, setAnswer] = useState("");
  const [blank, setBlank] = useState(false);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const sent = useRef<string | null>(null);
  const inputId = useId();
  const root = useRef<HTMLElement>(null);
  const focus = useRef<HTMLHeadingElement>(null);
  const [freeOffset, setFreeOffset] = useState(0);
  const lifecycle = useRef({ epoch: 0, controller: null as AbortController | null }).current;

  const load = useCallback(
    async (nextMode: Mode) => {
      if (progress.syncState().userId !== owner) return;
      lifecycle.controller?.abort();
      const controller = new AbortController();
      lifecycle.controller = controller;
      const epoch = ++lifecycle.epoch;
      const current = () =>
        !controller.signal.aborted &&
        lifecycle.epoch === epoch &&
        progress.syncState().userId === owner;
      setState({ kind: "loading" });
      setMode(nextMode);
      setAnswer("");
      setVerdict(null);
      setBlank(false);
      sent.current = null;
      const lessons = completedPracticeLessons(courses, source);
      const timer = window.setTimeout(() => {
        if (!current()) return;
        controller.abort();
        setState({ kind: "failed", lessons });
      }, 30_000);
      controller.signal.addEventListener("abort", () => window.clearTimeout(timer), { once: true });
      const loaded: Parameters<typeof lessonPracticeQuestions>[0][number][] = [];
      let failures = 0;
      // Four bounded readers, no second shelf and no requests for unseen lessons.
      for (let index = 0; index < lessons.length && current(); index += 4) {
        await Promise.all(
          lessons.slice(index, index + 4).map(async (ref) => {
            try {
              const view = await content.lesson(ref.locator, { signal: controller.signal });
              if (current()) loaded.push({ ref, body: view.lesson });
            } catch {
              if (current()) failures++;
            }
          }),
        );
      }
      window.clearTimeout(timer);
      if (!current()) return;
      // Network completion order must not decide mistake priority or identity.
      loaded.sort((a, b) => lessons.indexOf(a.ref) - lessons.indexOf(b.ref));
      const questions = pickLessonPractice(lessonPracticeQuestions(loaded, progress.snapshot()));
      if (!questions.length) {
        setState({ kind: failures ? "failed" : "empty", lessons });
        return;
      }
      setState({
        kind: "asking",
        questions: nextMode === "round" ? questions.slice(0, 3) : questions,
        index: 0,
        failures,
      });
    },
    [courses, source, owner, progress, content, lifecycle],
  );

  useEffect(() => {
    setFreeOffset(0);
    if (ready) void load(initialMode);
    return () => {
      lifecycle.epoch++;
      lifecycle.controller?.abort();
    };
  }, [ready, load, initialMode, lifecycle]);

  const question = state.kind === "asking" ? state.questions[state.index] : null;
  useEffect(() => {
    if (state.kind !== "asking" && state.kind !== "finished") return;
    focus.current?.focus({ preventScroll: true });
    focus.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
  }, [state.kind, question?.id]);
  useEffect(() => {
    if (verdict === null) return;
    root.current
      ?.querySelector<HTMLElement>("[data-practice-verdict]")
      ?.focus({ preventScroll: true });
  }, [verdict]);
  const submit = () => {
    if (
      !question ||
      verdict !== null ||
      sent.current === question.id ||
      progress.syncState().userId !== owner
    )
      return;
    const valid = completedPracticeLessons(courses, source).some(
      (lesson) => lessonRefKey(lesson.locator) === lessonRefKey(question.locator),
    );
    if (!valid) {
      void load(mode);
      return;
    }
    const record = lessonPracticeAttempt(
      question,
      answer,
      `practice:${crypto.randomUUID()}`,
      Date.now(),
    );
    if (!record) {
      setBlank(true);
      return;
    }
    sent.current = question.id;
    progress.recordExerciseAttempt(record);
    setVerdict(record.hostGrade!.passed);
  };
  const next = () => {
    if (state.kind !== "asking" || verdict === null || progress.syncState().userId !== owner)
      return;
    if (state.index + 1 >= state.questions.length) {
      if (mode === "free") {
        setFreeOffset((offset) => offset + state.questions.length);
        void load("free");
      } else setState({ kind: "finished", answered: state.questions.length });
      return;
    }
    setState({ ...state, index: state.index + 1 });
    setAnswer("");
    setBlank(false);
    setVerdict(null);
    sent.current = null;
  };

  return (
    <section
      ref={root}
      className="native-practice"
      data-native-practice
      data-practice-state={state.kind}
    >
      {state.kind !== "finished" ? (
        <header>
          <h1 ref={focus} tabIndex={-1} data-practice-focus className="practice-stream__heading">
            {t.t("doors.practice.title")}
          </h1>
          {state.kind !== "asking" ? <p>{t.t("doors.practice.description")}</p> : null}
        </header>
      ) : null}
      {state.kind === "loading" ? <p role="status">{t.t("doors.practice.loading")}</p> : null}
      {state.kind === "empty" || state.kind === "failed" ? (
        <GameCallout
          tone="neutral"
          heading={t.t(
            state.kind === "failed"
              ? "doors.practice.failed"
              : state.lessons.length
                ? "doors.practice.noQuestions"
                : "doors.practice.none",
          )}
        >
          {state.kind === "failed" ? (
            <GameButton static onClick={() => void load(mode)}>
              {t.t("doors.practice.retry")}
            </GameButton>
          ) : null}
          {state.kind === "empty" && !state.lessons.length ? (
            <div className="learner-destinations">
              <a href="/" data-practice-learn>
                {t.t("doors.practice.learnFirst")}
              </a>
            </div>
          ) : null}
          {state.lessons[0] ? (
            <GameButton
              variant="secondary"
              static
              onClick={() => onOpenLesson(state.lessons[0]!.locator)}
            >
              {t.t("doors.practice.read")}
            </GameButton>
          ) : null}
        </GameCallout>
      ) : null}
      {state.kind === "asking" && question ? (
        <GamePanel>
          <p data-practice-ordinal>
            {mode === "round"
              ? t.t("doors.practice.progress", {
                  number: state.index + 1,
                  total: state.questions.length,
                })
              : t.t("doors.practice.freeProgress", { number: freeOffset + state.index + 1 })}
          </p>
          {question.previousMistake ? (
            <p data-practice-priority="mistake">{t.t("doors.practice.mistake")}</p>
          ) : null}
          {state.failures > 0 ? <p role="status">{t.t("doors.practice.failed")}</p> : null}
          {verdict === null ? (
            <QuestionStep
              question={question}
              answer={answer}
              blank={blank}
              inputId={inputId}
              submitLabel={t.t("doors.practice.submit")}
              disableEmpty
              onAnswer={(value) => {
                setAnswer(value);
                setBlank(false);
              }}
              onSubmit={submit}
            />
          ) : (
            <>
              <p className="question-step__prompt">{question.prompt}</p>
              <p role="status" tabIndex={-1} data-practice-verdict={verdict ? "correct" : "wrong"}>
                {t.t(verdict ? "doors.practice.correct" : "doors.practice.wrong")}
              </p>
              <div className="native-practice__actions">
                {!verdict ? (
                  <GameButton
                    variant="secondary"
                    static
                    onClick={() => {
                      setVerdict(null);
                      sent.current = null;
                    }}
                  >
                    {t.t("doors.practice.again")}
                  </GameButton>
                ) : null}
                <GameButton static data-practice-next onClick={next}>
                  {t.t(
                    mode === "round" && state.index + 1 === state.questions.length
                      ? "doors.practice.finish"
                      : "doors.practice.next",
                  )}
                </GameButton>
              </div>
            </>
          )}
          {progress.localSaveState?.() === "failed" ? (
            <p role="alert">{t.t("doors.practice.saveFailed")}</p>
          ) : null}
          <p
            className="native-practice__source"
            data-practice-source={lessonRefKey(question.locator)}
          >
            {t.t("doors.practice.from", {
              course: question.courseTitle,
              number: question.lessonNumber,
            })}
          </p>
          {verdict !== null ? (
            <details key={question.id} className="product-details" data-practice-reward>
              <summary>{t.t("doors.practice.read")}</summary>
              <p>{question.lessonTitle}</p>
              <GameButton variant="secondary" static onClick={() => onOpenLesson(question.locator)}>
                {t.t("doors.practice.read")}
              </GameButton>
            </details>
          ) : (
            <GameButton variant="ghost" static onClick={() => onOpenLesson(question.locator)}>
              {t.t("doors.practice.read")}
            </GameButton>
          )}
        </GamePanel>
      ) : null}
      {state.kind === "finished" ? (
        <PracticeRoundComplete
          count={state.answered}
          receipt={t.t("doors.practice.summary", { count: state.answered })}
          focusRef={focus}
          onFinish={onBack}
          onRound={() => {
            setFreeOffset(0);
            void load("round");
          }}
          onFree={() => {
            setFreeOffset(0);
            void load("free");
          }}
        />
      ) : null}
      <p className="native-practice__boundary">{t.t("doors.practice.boundary")}</p>
      <div className="native-practice__actions">
        <GameButton variant="ghost" static data-practice-leave onClick={onBack}>
          {t.t("doors.practice.exit")}
        </GameButton>
        <a href="/mistakes">{t.t("doors.practice.allMistakes")}</a>
      </div>
    </section>
  );
}
