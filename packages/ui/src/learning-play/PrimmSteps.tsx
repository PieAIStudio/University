import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { GameButton, GamePanel } from "@pieai/swimmer-ui-kit";
import {
  PRIMM_PHASES,
  primmBuildVerdict,
  primmRequestPrompt,
  type LessonStageCue,
  type PrimmStep,
  type PrimmStepOf,
} from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import { useAnswerDraft } from "../review/use-answer-draft.js";
import { playSound } from "../sound/index.js";
import { PrimmAsset, PrimmSource } from "./PrimmMaterials.js";
import { PrimmResultText } from "./PrimmResultText.js";
import { coachSeen, markCoachSeen, stopCoach } from "./primm-coach.js";
import {
  initialStepsSession,
  restoreStepsSession,
  type StepsSession,
} from "./primm-steps-session.js";
import type { PrimmLessonProps, PrimmStepsActivity, PrimmWork } from "./primm-types.js";
import { buildStep } from "./primm-steps/build.js";
import { chooseStep } from "./primm-steps/choose.js";
import type { Busy, Feedback, Primary, StepContext, StepView } from "./primm-steps/context.js";
import { findStep } from "./primm-steps/find.js";
import { makeStep } from "./primm-steps/make.js";
import { matchStep } from "./primm-steps/match.js";
import { PrimmAside, PrimmNote } from "./primm-steps/materials.js";
import { DEMO_KINDS } from "./primm-steps/parts.js";
import { pointStep } from "./primm-steps/point.js";
import { sendStep } from "./primm-steps/send.js";
import { sortStep } from "./primm-steps/sort.js";

type Props = Omit<PrimmLessonProps, "activity"> & { readonly activity: PrimmStepsActivity };

/**
 * Version-3 PRIMM: the five phases stay fixed, each holds one to four steps, and
 * every step is one screen with one action. The teacher speaks only after the
 * action, in the bar at the bottom; nothing before it asserts what a live run said.
 */
export function PrimmSteps({
  activity,
  assets,
  lessonRef,
  contentRevision = 1,
  answerDraftScope,
  runPrimm,
  evaluatePrimm,
  refreshPrimmEvaluation,
  copyPrimmEvaluation,
  onPrimmComplete,
  onPathProgress,
  renderStage,
  onTryToday,
}: Props) {
  const { t, locale } = useI18n();
  const draft = useAnswerDraft({
    identity: {
      accountScope: answerDraftScope ?? "primm-preview",
      locator: lessonRef ?? {
        studyId: "preview",
        courseId: "preview",
        unitId: "preview",
        lessonId: activity.id,
      },
      exerciseId: `primm:${activity.id}:${locale}`,
      contentRevision,
    },
    submittedAnswer: "",
    submittedAt: null,
    ...(!lessonRef || !answerDraftScope ? { storage: null } : {}),
  });
  const [session, setSession] = useState(() =>
    draft.answer ? restoreStepsSession(activity, draft.answer) : initialStepsSession(),
  );
  const state = useRef(session);
  state.current = session;
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  // Each settled action, with its verdict, for the stage to answer.
  const [beat, setBeat] = useState<{ n: number; verdict?: "ok" | "no"; bin?: number }>({
    n: 0,
  });
  const pending = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const stageBox = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const steps = activity.steps;
  const screen = session.index; // 0 intro, 1..n steps, n+1 finish
  const step = screen >= 1 && screen <= steps.length ? steps[screen - 1]! : null;
  const progressCallback = useRef(onPathProgress);
  progressCallback.current = onPathProgress;

  useEffect(
    () => () => {
      pending.current?.abort();
      stopCoach();
    },
    [],
  );
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
    // The opening keeps its photo in view; each step brings its question to the
    // top, under the lesson's stage when there is one, so the two stay together.
    if (screen > 0)
      (stageBox.current ?? heading.current)?.scrollIntoView?.({
        block: "start",
        behavior: "instant",
      });
    // Refreshing the same authored step after grading is not navigation.
    // Fresh content arrays must not steal focus or scroll under a held press.
  }, [screen]);
  useLayoutEffect(() => {
    const phasesDone = PRIMM_PHASES.filter((phase) =>
      steps.every((item) => item.phase !== phase || state.current.done.includes(item.id)),
    ).length;
    progressCallback.current?.(screen > steps.length ? 5 : phasesDone);
  }, [screen, steps]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 1900);
    return () => clearTimeout(timer);
  }, [toast]);

  function update(patch: Partial<StepsSession>) {
    const next = { ...state.current, ...patch };
    state.current = next;
    setSession(next);
    draft.setAnswer(JSON.stringify(next));
  }
  function go(index: number) {
    stopCoach();
    // A new screen starts without a verdict; the count of actions goes on.
    setBeat((last) => ({ n: last.n }));
    setFeedback(null);
    setToast("");
    setError("");
    update({ index });
    playSound("ui.press");
  }
  function finishStep(id: string, result: Feedback) {
    if (!state.current.done.includes(id)) update({ done: [...state.current.done, id] });
    setToast("");
    playSound(result.tone === "bad" ? "answer.wrong" : "answer.correct");
    setFeedback(result);
    setBeat((last) => ({ n: last.n + 1, verdict: result.tone === "bad" ? "no" : "ok" }));
  }
  function miss(message: string) {
    playSound("answer.wrong");
    setToast(message);
    setBeat((last) => ({ n: last.n + 1, verdict: "no" }));
  }

  /** Really run prepared or learner text; results are kept per request key. */
  async function execute(
    key: string,
    phase: "run" | "modify" | "make",
    prompt: string,
  ): Promise<PrimmWork | null> {
    if (pending.current) return null;
    if (!runPrimm || !lessonRef) {
      setError(t("primm.unavailable"));
      return null;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy("run");
    setError("");
    try {
      const request = {
        lessonRef,
        contentRevision,
        phase,
        prompt,
        commandId: crypto.randomUUID(),
        locale,
      };
      const result = await runPrimm(request, controller.signal);
      if (controller.signal.aborted || pending.current !== controller) return null;
      if (result.kind !== "live" || result.prompt !== prompt || !result.text.trim())
        throw new Error();
      const work: PrimmWork = {
        request,
        result,
        ...(phase === "make" ? { finalWork: result.text } : {}),
      };
      update({ runs: { ...state.current.runs, [key]: work } });
      return work;
    } catch {
      if (!controller.signal.aborted && pending.current === controller)
        setError(t("primm.steps.failed"));
      return null;
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(null);
      }
    }
  }
  function cancel() {
    pending.current?.abort();
    pending.current = null;
    setBusy(null);
  }

  const chosenRequest = () => {
    const choice = steps.find(
      (item): item is PrimmStepOf<"choose"> => item.kind === "choose" && item.phase === "predict",
    );
    const option = choice?.options.find((item) => item.id === session.choices[choice.id]);
    return option?.requestId ?? "starter";
  };
  /** The request a send step runs, as a key and its exact text. */
  const requestOf = (send: PrimmStepOf<"send">): { key: string; prompt: string } | null => {
    if (send.request === "built") {
      const build = steps.find(
        (item): item is PrimmStepOf<"build"> => item.kind === "build" && item.phase === send.phase,
      );
      const verdict = build ? primmBuildVerdict(build, session.built[build.id] ?? []) : null;
      return verdict?.ok ? { key: `built:${send.id}`, prompt: verdict.prompt } : null;
    }
    const id = send.request === "chosen" ? chosenRequest() : send.request;
    const prompt = primmRequestPrompt(activity, id);
    return prompt ? { key: id, prompt } : null;
  };
  /** The most recent real run before a step, whichever send produced it. */
  const latestRun = (before: number): PrimmWork | undefined => {
    for (let index = before - 1; index >= 0; index--) {
      const earlier = steps[index]!;
      if (earlier.kind === "send") {
        const request = requestOf(earlier);
        return request ? session.runs[request.key] : undefined;
      }
    }
    return undefined;
  };

  const phaseLabel = (phase: PrimmStep["phase"]) => t(`primm.steps.chip.${phase}`);
  const asset = (id: string) => assets?.find((item) => item.id === id);
  const photoUrl = (id: string) => asset(id)?.url;
  const starterImage = activity.starter.assetIds[0];
  // Text the learner works from, where a photo would be: open where it is read,
  // folded where it only reminds.
  const notes = (ids: readonly string[], open: boolean) =>
    activity.materials
      .filter((material) => ids.includes(material.id) && !material.assetId)
      .map((material) => (
        <PrimmNote
          key={material.id}
          material={material}
          open={open}
          source={activity.sources.find((source) => source.id === material.sourceId)}
        />
      ));
  const stepDone = step ? session.done.includes(step.id) : false;

  let body: ReactNode = null;
  let primary: Primary = {
    label: t("primm.steps.continue"),
    enabled: stepDone,
    onClick: () => go(screen + 1),
  };
  let demo: (() => void) | null = null;

  if (screen === 0) {
    body = (
      <section className="primm-steps__intro">
        {starterImage ? <PrimmAsset asset={asset(starterImage)} /> : null}
        <h2 ref={heading} tabIndex={-1} id={headingId}>
          {activity.title}
        </h2>
        <p className="primm-steps__goal">
          <span>{t("primm.steps.goal")}</span>
          {activity.goal}
        </p>
        <p className="primm-steps__lead">{activity.intro.situation}</p>
        <p>{activity.intro.need}</p>
        {notes(activity.starter.materialIds, true)}
        <aside className="primm-steps__case">
          <p>{activity.intro.connection}</p>
          {activity.intro.sourceIds?.map((id) => (
            <PrimmSource key={id} source={activity.sources.find((source) => source.id === id)} />
          ))}
        </aside>
      </section>
    );
    primary = { label: t("primm.steps.start"), enabled: true, onClick: () => go(1) };
  } else if (step) {
    const head = (
      <div className="primm-steps__head">
        <div className="primm-steps__eyebrow">
          <span className="primm-steps__chip">{phaseLabel(step.phase)}</span>
          {DEMO_KINDS.has(step.kind) ? (
            <button type="button" className="primm-steps__demo" onClick={() => demo?.()}>
              {t("primm.steps.demo")}
            </button>
          ) : null}
        </div>
        <h2 ref={heading} tabIndex={-1} id={headingId} data-guide="step-title">
          {step.title}
        </h2>
      </div>
    );
    const view = renderStep(step);
    if (view.primary) primary = view.primary;
    if (view.demo) demo = view.demo;
    body = (
      <section className="primm-steps__step" data-step-kind={step.kind} key={step.id}>
        {head}
        {view.body}
      </section>
    );
  } else {
    const make = session.runs.make;
    body = (
      <section className="primm-steps__finish">
        <h2 ref={heading} tabIndex={-1} id={headingId}>
          {activity.finish.title}
        </h2>
        <p className="primm-steps__takeaway">{activity.takeaway}</p>
        <p>{activity.finish.note}</p>
        {activity.finish.didYouKnow ? (
          <PrimmAside
            text={activity.finish.didYouKnow.text}
            source={activity.sources.find(
              (source) => source.id === activity.finish.didYouKnow!.sourceId,
            )}
          />
        ) : null}
        {activity.finish.today ? (
          <p className="primm-steps__today">
            <b>{t("primm.steps.today")}</b> {activity.finish.today}
          </p>
        ) : null}
        {make ? (
          <section className="primm-steps__artifact" aria-label={activity.make.artifactLabel}>
            <h3>{activity.make.artifactLabel}</h3>
            <PrimmResultText text={make.finalWork ?? make.result.text} />
            <GameButton
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(make.finalWork ?? make.result.text)
                  .then(() => setToast(t("primm.copied")))
                  .catch(() => setToast(t("primm.copyFailed")))
              }
            >
              {t("primm.copy")}
            </GameButton>
          </section>
        ) : null}
      </section>
    );
    primary = {
      label: t(busy === "complete" ? "primm.completing" : "primm.complete"),
      enabled: busy === null && session.evaluation?.outcome === "pass",
      onClick: () => void complete(),
    };
  }

  async function complete() {
    if (pending.current || state.current.evaluation?.outcome !== "pass") return;
    if (!onPrimmComplete) {
      setError(t("primm.completeFailed"));
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy("complete");
    try {
      await onPrimmComplete(controller.signal);
      const today = activity.finish.today?.trim();
      if (today) onTryToday?.(today);
    } catch {
      if (!controller.signal.aborted) setError(t("primm.completeFailed"));
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(null);
      }
    }
  }

  /** Grade the learner's own work; a pass finishes the make step. */
  async function evaluate(refresh = false) {
    const current = state.current.runs.make;
    const evaluateWork = refresh ? refreshPrimmEvaluation : evaluatePrimm;
    if (!current || pending.current) return;
    if (!evaluateWork) return setError(t("primm.gradeUnavailable"));
    const controller = new AbortController();
    pending.current = controller;
    setBusy("evaluate");
    setError("");
    try {
      const evaluation = await evaluateWork(current, controller.signal);
      if (controller.signal.aborted || pending.current !== controller) return;
      update({ evaluation });
      if (evaluation.outcome === "pass")
        finishStep(step!.id, {
          tone: "good",
          title: t("primm.pass"),
          text: evaluation.explanation,
        });
      else playSound(evaluation.outcome === "fail" ? "answer.wrong" : "answer.undecided");
    } catch {
      if (!controller.signal.aborted && pending.current === controller)
        setError(t("primm.gradeUnavailable"));
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(null);
      }
    }
  }

  function renderStep(current: PrimmStep): StepView {
    const ctx: StepContext = {
      t,
      activity,
      steps,
      session,
      screen,
      headingId,
      busy,
      error,
      starterImage,
      update,
      go,
      finishStep,
      miss,
      pulse: (verdict, bin) =>
        setBeat((last) => ({ n: last.n + 1, verdict, ...(bin === undefined ? {} : { bin }) })),
      setFeedback,
      setDemo: (play) => {
        demo = play;
      },
      execute,
      cancel,
      evaluate,
      refreshPrimmEvaluation,
      copyPrimmEvaluation,
      requestOf,
      latestRun,
      asset,
      photoUrl,
      notes,
    };
    switch (current.kind) {
      case "choose":
        return chooseStep(current, ctx);
      case "send":
        return sendStep(current, ctx);
      case "find":
        return findStep(current, ctx);
      case "match":
        return matchStep(current, ctx);
      case "sort":
        return sortStep(current, ctx);
      case "point":
        return pointStep(current, ctx);
      case "build":
        return buildStep(current, ctx);
      case "make":
        return makeStep(current, ctx);
      default: {
        // A step kind that reaches here has no screen. `never` is what makes
        // that a compile error instead of a lesson that saves, loads, and is
        // silently one screen short in front of a learner.
        const unrendered: never = current;
        return unrendered;
      }
    }
  }

  // First visit to a step with a gesture demonstrates it once.
  useEffect(() => {
    if (!step || !DEMO_KINDS.has(step.kind) || session.done.includes(step.id)) return;
    const gesture = `${step.kind}`;
    if (coachSeen(gesture)) return;
    const timer = setTimeout(() => {
      markCoachSeen(gesture);
      demo?.();
    }, 700);
    return () => clearTimeout(timer);
    // Only the step identity decides whether a demonstration is due.
  }, [step?.id]);

  const phaseIndex = step ? PRIMM_PHASES.indexOf(step.phase) : screen === 0 ? -1 : 5;
  const stageCue: LessonStageCue = {
    scene: step?.phase ?? (screen === 0 ? "intro" : "finish"),
    ...(step ? { action: step.kind } : {}),
    beat: beat.n,
    ...(beat.verdict ? { verdict: beat.verdict } : {}),
    ...(beat.bin !== undefined && beat.bin >= 0 ? { bin: beat.bin } : {}),
    ...(step?.kind === "sort" ? { bins: step.buckets.length } : {}),
    ...(step?.kind === "build" ? { wagons: (session.built[step.id] ?? []).length } : {}),
  };
  // A wrong attempt that has not finished the step: the bar offers another try.
  const retrying = feedback?.tone === "bad" && !stepDone;
  return (
    <GamePanel
      className="primm primm-steps"
      aria-labelledby={headingId}
      data-primm-stage={step?.phase ?? (screen === 0 ? "intro" : "finish")}
      data-primm-version="3"
    >
      <ol className="primm-steps__phases" aria-label={t("primm.steps.progress")}>
        {PRIMM_PHASES.map((phase, index) => {
          const inPhase = steps.filter((item) => item.phase === phase);
          const done = inPhase.filter((item) => session.done.includes(item.id)).length;
          return (
            <li
              key={phase}
              className={index === phaseIndex ? "is-current" : undefined}
              aria-current={index === phaseIndex ? "step" : undefined}
            >
              <span className="primm-steps__bar">
                <span style={{ width: `${(done / inPhase.length) * 100}%` }} />
              </span>
              <span className="primm-steps__phase">{t(`primm.steps.phase.${phase}`)}</span>
            </li>
          );
        })}
      </ol>
      {renderStage ? (
        <div className="primm-steps__stage" data-stage-scene={stageCue.scene} ref={stageBox}>
          {renderStage(stageCue)}
        </div>
      ) : null}
      {body}
      {toast ? (
        <p className="primm-steps__toast" role="status">
          {toast}
        </p>
      ) : null}
      {screen > steps.length && error ? <p role="alert">{error}</p> : null}
      <div className={`primm-steps__bottom${feedback ? ` is-${feedback.tone}` : ""}`}>
        {feedback ? (
          <div className="primm-steps__feedback" role="status">
            <strong>{feedback.title}</strong>
            {feedback.text ? <p>{feedback.text}</p> : null}
          </div>
        ) : null}
        <GameButton
          variant="primary"
          fullWidth
          disabled={!retrying && !primary.enabled}
          onClick={() => {
            if (retrying) {
              setFeedback(null);
              return;
            }
            primary.onClick();
          }}
        >
          {retrying ? t("primm.steps.tryAgain") : primary.label}
        </GameButton>
      </div>
      {answerDraftScope &&
      lessonRef &&
      (draft.persistence === "failed" || draft.persistence === "unavailable") ? (
        <p role="alert">{t("primm.draftFailed")}</p>
      ) : null}
    </GamePanel>
  );
}
