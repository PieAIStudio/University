import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GameButton, GamePanel } from "@pieai/swimmer-ui-kit";
import {
  PRIMM_PHASES,
  primmBuildVerdict,
  primmRequestPrompt,
  primmSentences,
  primmSentencesMentioning,
  type PrimmStep,
  type PrimmStepOf,
} from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import { useAnswerDraft } from "../review/use-answer-draft.js";
import { playSound } from "../sound/index.js";
import { PrimmAsset, PrimmSource } from "./PrimmMaterials.js";
import { PrimmResultText } from "./PrimmResultText.js";
import { coachSeen, markCoachSeen, playCoach, pointerDrag, stopCoach } from "./primm-coach.js";
import {
  initialStepsSession,
  restoreStepsSession,
  type StepsSession,
} from "./primm-steps-session.js";
import type { PrimmLessonProps, PrimmStepsActivity, PrimmWork } from "./primm-types.js";

type Props = Omit<PrimmLessonProps, "activity"> & { readonly activity: PrimmStepsActivity };
type Tone = "good" | "bad" | "info";
interface Feedback {
  readonly tone: Tone;
  readonly title: string;
  readonly text?: string;
}
type Busy = "run" | "evaluate" | "complete" | null;

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
  const pending = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
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
    // The opening keeps its photo in view; each step brings its question to the top.
    if (screen > 0) heading.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
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
  }
  function miss(message: string) {
    playSound("answer.wrong");
    setToast(message);
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
  const stepDone = step ? session.done.includes(step.id) : false;

  let body: ReactNode = null;
  let primary: { label: string; enabled: boolean; onClick: () => void } = {
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
        <h2 ref={heading} tabIndex={-1} id={headingId}>
          {step.title}
        </h2>
      </div>
    );
    const view = renderStep(step);
    body = (
      <section className="primm-steps__step" data-step-kind={step.kind} key={step.id}>
        {head}
        {view}
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
    } catch {
      if (!controller.signal.aborted) setError(t("primm.completeFailed"));
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(null);
      }
    }
  }

  function renderStep(current: PrimmStep): ReactNode {
    switch (current.kind) {
      case "choose":
        return renderChoose(current);
      case "send":
        return renderSend(current);
      case "find":
        return renderFind(current);
      case "match":
        return renderMatch(current);
      case "sort":
        return renderSort(current);
      case "point":
        return renderPoint(current);
      case "build":
        return renderBuild(current);
      case "make":
        return renderMake();
    }
  }

  function renderChoose(current: PrimmStepOf<"choose">) {
    const picked = session.choices[current.id];
    const locked = session.done.includes(current.id);
    primary = locked
      ? primary
      : {
          label: t(current.phase === "predict" ? "primm.steps.choose" : "primm.steps.check"),
          enabled: !!picked,
          onClick: () => {
            const option = current.options.find((item) => item.id === picked);
            if (!option) return;
            const text = option.after ?? current.after;
            if (current.answerId)
              finishStep(current.id, {
                tone: option.id === current.answerId ? "good" : "bad",
                title: t(
                  option.id === current.answerId ? "primm.steps.right" : "primm.steps.wrong",
                ),
                ...(text ? { text } : {}),
              });
            else
              // A prediction is noted; any other open choice is echoed back as the learner's own.
              finishStep(current.id, {
                tone: "info",
                title: current.phase === "predict" ? t("primm.steps.noted") : option.label,
                ...(text ? { text } : {}),
              });
          },
        };
    const context =
      current.phase === "predict" && starterImage ? (
        <figure className="primm-steps__thumb">
          <img src={photoUrl(starterImage)} alt={asset(starterImage)?.alt ?? ""} />
        </figure>
      ) : current.phase === "make" && session.runs.make ? (
        <div className="primm-steps__chat">
          <p className="primm-steps__bubble is-me">{session.runs.make.request.prompt}</p>
          <div className="primm-steps__bubble is-ai">
            <PrimmResultText text={session.runs.make.finalWork ?? session.runs.make.result.text} />
          </div>
        </div>
      ) : null;
    return (
      <>
        {context}
        <div className="primm-steps__options" role="radiogroup" aria-labelledby={headingId}>
          {current.options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={picked === option.id}
              disabled={locked}
              className="primm-steps__option"
              onClick={() => {
                playSound("ui.press");
                update({ choices: { ...session.choices, [current.id]: option.id } });
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </>
    );
  }

  function renderSend(current: PrimmStepOf<"send">) {
    const request = requestOf(current);
    const work = request ? session.runs[request.key] : undefined;
    const attached = !!session.attached[current.id] || !!work;
    const image = starterImage;
    demo = () => {
      const from = document.querySelector<HTMLElement>(`[data-attach="${current.id}"]`);
      const to = document.querySelector<HTMLElement>(`[data-composer="${current.id}"]`);
      if (from && to)
        void playCoach({ from, to, gesture: "drag", caption: t("primm.steps.coach.attach") });
    };
    const send = async () => {
      if (!request) return;
      const result = await execute(
        request.key,
        current.phase === "modify" ? "modify" : "run",
        request.prompt,
      );
      if (!result) return;
      const debrief =
        current.debriefs?.find((item) => item.requestId === request.key)?.text ?? current.after;
      finishStep(current.id, {
        tone: "info",
        title: t("primm.steps.answered"),
        ...(debrief ? { text: debrief } : {}),
      });
    };
    return (
      <>
        <div className="primm-steps__chat">
          {work ? (
            <>
              <div className="primm-steps__bubble is-me">
                {image ? <img src={photoUrl(image)} alt="" /> : null}
                <p>{work.request.prompt}</p>
              </div>
              <div className="primm-steps__bubble is-ai" aria-live="polite">
                <PrimmResultText text={work.result.text} />
              </div>
              <p className="primm-steps__live">{t("primm.steps.liveNote")}</p>
            </>
          ) : null}
        </div>
        {!work ? (
          <>
            <div
              className={`primm-steps__composer${attached ? " is-filled" : ""}`}
              data-drop="composer"
              data-composer={current.id}
              role="group"
              aria-label={t("primm.conversation")}
            >
              <div className="primm-steps__slot">
                {attached && image ? (
                  <img src={photoUrl(image)} alt={current.attachmentLabel} />
                ) : (
                  <span>{t("primm.steps.composerTarget")}</span>
                )}
              </div>
              <p className="primm-steps__composer-text">{request?.prompt}</p>
              <GameButton
                variant="primary"
                disabled={!attached || busy !== null || !request}
                onClick={() => void send()}
              >
                {busy === "run" ? t("primm.steps.running") : t("primm.steps.send")}
              </GameButton>
            </div>
            {!attached && image ? (
              <AttachTile
                stepId={current.id}
                label={current.attachmentLabel}
                hint={t("primm.steps.attachHint")}
                url={photoUrl(image)}
                onAttach={() => {
                  playSound("answer.correct");
                  update({ attached: { ...session.attached, [current.id]: true } });
                }}
              />
            ) : null}
          </>
        ) : null}
        <RunStatus
          busy={busy === "run"}
          error={error}
          onCancel={cancel}
          onRetry={() => void send()}
        />
      </>
    );
  }

  function renderFind(current: PrimmStepOf<"find">) {
    const work = latestRun(steps.indexOf(current));
    const sentences = work ? primmSentences(work.result.text) : [];
    const hits = primmSentencesMentioning(sentences, current.terms);
    const found = session.found[current.id];
    const done = session.done.includes(current.id);
    return (
      <>
        <div className="primm-steps__bubble is-ai primm-steps__sentences">
          {sentences.map((sentence, index) => (
            <button
              key={`${index}:${sentence}`}
              type="button"
              className={`primm-steps__sentence${found === index ? " is-hit" : ""}`}
              disabled={done}
              onClick={() => {
                if (!hits.includes(index)) return miss(t("primm.steps.tryAgainToast"));
                update({ found: { ...session.found, [current.id]: index } });
                finishStep(current.id, {
                  tone: "good",
                  title: t("primm.steps.found"),
                  text: current.found,
                });
              }}
            >
              {sentence}
            </button>
          ))}
        </div>
        <p className="primm-steps__live">{t("primm.steps.liveNote")}</p>
        {!done ? (
          <button
            type="button"
            className="primm-steps__link"
            onClick={() => {
              if (hits.length) return miss(t("primm.steps.mentionedToast"));
              update({ found: { ...session.found, [current.id]: -1 } });
              finishStep(current.id, {
                tone: "info",
                title: t("primm.steps.notMentioned"),
                text: current.absent,
              });
            }}
          >
            {t("primm.steps.notMentioned")}
          </button>
        ) : null}
      </>
    );
  }

  function renderMatch(current: PrimmStepOf<"match">) {
    return (
      <MatchStep
        step={current}
        activity={activity}
        runs={session.runs}
        placed={session.matched[current.id] ?? {}}
        busy={busy === "run"}
        error={error}
        done={session.done.includes(current.id)}
        run={(id, prompt) => execute(id, "run", prompt)}
        onCancel={cancel}
        onPlace={(answer, question) => {
          if (answer !== question) return miss(t("primm.steps.wrongMatch"));
          playSound("answer.correct");
          const placed = { ...session.matched[current.id], [answer]: question };
          update({ matched: { ...session.matched, [current.id]: placed } });
          if (current.requestIds.every((id) => placed[id] === id))
            finishStep(current.id, {
              tone: "good",
              title: t("primm.steps.seen"),
              text: current.after,
            });
        }}
        setDemo={(play) => (demo = play)}
      />
    );
  }

  function renderSort(current: PrimmStepOf<"sort">) {
    const decided = session.sorted[current.id] ?? {};
    demo = () => {
      const card = document.querySelector<HTMLElement>(".primm-steps__card.is-top");
      if (card)
        void playCoach({
          from: card,
          gesture: "swipe",
          caption: t("primm.steps.coach.swipe", {
            right: current.buckets[0]!.label,
            left: current.buckets[1]!.label,
          }),
        });
    };
    return (
      <SortStep
        step={current}
        decided={decided}
        done={session.done.includes(current.id)}
        image={starterImage ? photoUrl(starterImage) : undefined}
        onDecide={(cardId, bucketId) => {
          const next = { ...decided, [cardId]: bucketId };
          update({ sorted: { ...session.sorted, [current.id]: next } });
          const card = current.cards.find((item) => item.id === cardId)!;
          playSound(card.bucketId === bucketId ? "answer.correct" : "answer.wrong");
          if (current.cards.every((item) => next[item.id])) {
            const right = current.cards.filter((item) => next[item.id] === item.bucketId).length;
            finishStep(current.id, {
              tone: right === current.cards.length ? "good" : "info",
              title: t("primm.steps.sorted", { right, total: current.cards.length }),
              text: current.after,
            });
          }
        }}
      />
    );
  }

  function renderPoint(current: PrimmStepOf<"point">) {
    const picked = session.pointed[current.id];
    const done = session.done.includes(current.id);
    const work = latestRun(steps.indexOf(current));
    return (
      <>
        {work && current.phase !== "make" ? (
          <div className="primm-steps__chat">
            <p className="primm-steps__bubble is-me">{work.request.prompt}</p>
            <div className="primm-steps__bubble is-ai">
              <PrimmResultText text={work.result.text} />
            </div>
          </div>
        ) : null}
        <figure className="primm-steps__point">
          <img
            src={photoUrl(current.assetId)}
            alt={asset(current.assetId)?.alt ?? ""}
            onClick={() => !done && miss(current.miss)}
          />
          {current.regions.map((region) => (
            <button
              key={region.id}
              type="button"
              disabled={done}
              className={`primm-steps__region${picked === region.id ? " is-hit" : ""}`}
              style={{
                left: `${region.x * 100}%`,
                top: `${region.y * 100}%`,
                width: `${region.width * 100}%`,
                height: `${region.height * 100}%`,
              }}
              aria-label={region.label}
              onClick={() => {
                if (region.id !== current.targetId) return miss(current.miss);
                update({ pointed: { ...session.pointed, [current.id]: region.id } });
                finishStep(current.id, {
                  tone: "good",
                  title: t("primm.steps.pointed"),
                  text: current.after,
                });
              }}
            >
              <span>{region.label}</span>
            </button>
          ))}
        </figure>
      </>
    );
  }

  function renderBuild(current: PrimmStepOf<"build">) {
    const placed = session.built[current.id] ?? [];
    const done = session.done.includes(current.id);
    demo = () => {
      const tile = document.querySelector<HTMLElement>(".primm-steps__tiles .primm-steps__tile");
      if (tile)
        void playCoach({ from: tile, gesture: "tap", caption: t("primm.steps.coach.build") });
    };
    const setPlaced = (next: string[]) =>
      update({ built: { ...session.built, [current.id]: next } });
    if (!done)
      primary = {
        label: t("primm.steps.check"),
        enabled: placed.length > 0,
        onClick: () => {
          const verdict = primmBuildVerdict(current, placed);
          if (verdict.ok)
            return finishStep(current.id, {
              tone: "good",
              title: t("primm.steps.built"),
              text: current.after,
            });
          playSound("answer.wrong");
          if (verdict.reason === "extra") {
            const piece = current.pieces.find((item) => item.id === verdict.pieceId);
            return setFeedback({
              tone: "bad",
              title: t("primm.steps.extra"),
              ...(piece?.why ? { text: piece.why } : {}),
            });
          }
          setFeedback({
            tone: "bad",
            title: t(verdict.reason === "order" ? "primm.steps.order" : "primm.steps.missing"),
            text: t(
              verdict.reason === "order" ? "primm.steps.orderText" : "primm.steps.missingText",
            ),
          });
        },
      };
    return (
      <>
        {current.context ? <p className="primm-steps__context">{current.context}</p> : null}
        <div
          className={`primm-steps__line${placed.length ? "" : " is-empty"}`}
          aria-label={t("primm.steps.lineLabel")}
          data-empty={t("primm.steps.lineHint")}
        >
          {placed.map((id) => (
            <button
              key={id}
              type="button"
              className="primm-steps__tile"
              disabled={done}
              onClick={() => {
                setFeedback(null);
                setPlaced(placed.filter((item) => item !== id));
              }}
            >
              {current.pieces.find((piece) => piece.id === id)?.text}
            </button>
          ))}
        </div>
        <div className="primm-steps__tiles">
          {current.pieces.map((piece) =>
            placed.includes(piece.id) ? (
              <span key={piece.id} className="primm-steps__tile is-used" aria-hidden="true">
                {piece.text}
              </span>
            ) : (
              <button
                key={piece.id}
                type="button"
                className="primm-steps__tile"
                disabled={done}
                onClick={() => {
                  stopCoach();
                  playSound("ui.press");
                  setFeedback(null);
                  setPlaced([...placed, piece.id]);
                }}
              >
                {piece.text}
              </button>
            ),
          )}
        </div>
      </>
    );
  }

  function renderMake() {
    const work = session.runs.make;
    const image = activity.make.assetIds[0];
    const passed = session.evaluation?.outcome === "pass";
    primary = {
      label: t("primm.steps.continue"),
      enabled: passed && session.done.includes(step!.id),
      onClick: () => go(screen + 1),
    };
    const send = async () => {
      if (!session.makePrompt.trim()) return;
      update({ evaluation: null });
      await execute("make", "make", session.makePrompt.trim());
    };
    const evaluate = async (refresh = false) => {
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
    };
    return (
      <>
        <p className="primm-steps__context">{activity.make.scenario}</p>
        {image ? <PrimmAsset asset={asset(image)} /> : null}
        <div className="primm-steps__composer is-write">
          <label className="primm-steps__visually-hidden" htmlFor={`${headingId}-make`}>
            {t("primm.request")}
          </label>
          <textarea
            id={`${headingId}-make`}
            maxLength={2000}
            rows={2}
            value={session.makePrompt}
            placeholder={activity.make.promptPlaceholder}
            readOnly={busy !== null}
            onChange={(event) =>
              update({
                makePrompt: event.target.value,
                evaluation: null,
                runs: Object.fromEntries(
                  Object.entries(session.runs).filter(([key]) => key !== "make"),
                ),
              })
            }
          />
          <GameButton
            variant="primary"
            disabled={busy !== null || !session.makePrompt.trim()}
            onClick={() => void send()}
          >
            {busy === "run" ? t("primm.steps.running") : t("primm.steps.send")}
          </GameButton>
        </div>
        <ul className="primm-steps__checklist">
          {activity.make.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <RunStatus
          busy={busy === "run"}
          error={busy === "evaluate" ? "" : error}
          onCancel={cancel}
          onRetry={() => void send()}
        />
        {work ? (
          <section className="primm-steps__artifact" aria-label={activity.make.artifactLabel}>
            <p className="primm-steps__live">{t("primm.steps.liveNote")}</p>
            <label htmlFor={`${headingId}-final`}>{t("primm.refineArtifact")}</label>
            <textarea
              id={`${headingId}-final`}
              data-final-work
              maxLength={8000}
              readOnly={busy !== null || passed}
              value={work.finalWork ?? work.result.text}
              onChange={(event) =>
                update({
                  evaluation: null,
                  runs: { ...session.runs, make: { ...work, finalWork: event.target.value } },
                })
              }
            />
            {!passed ? (
              <GameButton
                variant="secondary"
                disabled={busy !== null || !(work.finalWork ?? work.result.text).trim()}
                onClick={() => void evaluate()}
              >
                {t(busy === "evaluate" ? "primm.evaluating" : "primm.evaluate")}
              </GameButton>
            ) : null}
            {session.evaluation && !passed ? (
              <div role="status" className="primm-steps__verdict">
                <p>{t(`primm.${session.evaluation.outcome}`)}</p>
                <p>{session.evaluation.explanation}</p>
                {session.evaluation.outcome === "undecided" && refreshPrimmEvaluation ? (
                  <GameButton disabled={busy !== null} onClick={() => void evaluate(true)}>
                    {t("primm.refreshGrade")}
                  </GameButton>
                ) : null}
                {session.evaluation.outcome === "undecided" && copyPrimmEvaluation ? (
                  <GameButton disabled={busy !== null} onClick={() => void copyPrimmEvaluation()}>
                    {t("primm.coaching")}
                  </GameButton>
                ) : null}
              </div>
            ) : null}
            {busy === "evaluate" && error ? <p role="alert">{error}</p> : null}
          </section>
        ) : null}
      </>
    );
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

const DEMO_KINDS = new Set<PrimmStep["kind"]>(["send", "match", "sort", "build"]);

function RunStatus({
  busy,
  error,
  onCancel,
  onRetry,
}: {
  readonly busy: boolean;
  readonly error: string;
  readonly onCancel: () => void;
  readonly onRetry: () => void;
}) {
  const { t } = useI18n();
  if (busy)
    return (
      <p className="primm-steps__status" role="status">
        {t("primm.steps.running")}
        <button type="button" className="primm-steps__link" onClick={onCancel}>
          {t("primm.steps.cancel")}
        </button>
      </p>
    );
  if (error)
    return (
      <p className="primm-steps__status" role="alert">
        {error}
        <button type="button" className="primm-steps__link" onClick={onRetry}>
          {t("primm.steps.retry")}
        </button>
      </p>
    );
  return null;
}

function AttachTile({
  stepId,
  label,
  hint,
  url,
  onAttach,
}: {
  readonly stepId: string;
  readonly label: string;
  readonly hint: string;
  readonly url: string | undefined;
  readonly onAttach: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const attach = useRef(onAttach);
  attach.current = onAttach;
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return pointerDrag(element, {
      targets: () => [...document.querySelectorAll<HTMLElement>(`[data-composer="${stepId}"]`)],
      onDrop: () => attach.current(),
      onStart: stopCoach,
    });
  }, [stepId]);
  return (
    <div className="primm-steps__tray">
      <button
        ref={ref}
        type="button"
        className="primm-steps__attach"
        data-attach={stepId}
        aria-label={label}
        title={hint}
        onClick={() => attach.current()}
      >
        {url ? <img src={url} alt="" /> : <span>{label}</span>}
      </button>
      <p className="primm-steps__hint">{hint}</p>
    </div>
  );
}

/** Seeded order, so a reload shows the same shuffle rather than a new puzzle. */
function shuffled<T>(items: readonly T[], seed: string): T[] {
  let hash = [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    const other = hash % (index + 1);
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  if (copy.length > 1 && copy.every((item, index) => item === items[index]))
    copy.push(copy.shift()!);
  return copy;
}

function MatchStep({
  step,
  activity,
  runs,
  placed,
  busy,
  error,
  done,
  run,
  onCancel,
  onPlace,
  setDemo,
}: {
  readonly step: PrimmStepOf<"match">;
  readonly activity: PrimmStepsActivity;
  readonly runs: Readonly<Record<string, PrimmWork>>;
  readonly placed: Readonly<Record<string, string>>;
  readonly busy: boolean;
  readonly error: string;
  readonly done: boolean;
  readonly run: (id: string, prompt: string) => Promise<PrimmWork | null>;
  readonly onCancel: () => void;
  readonly onPlace: (answer: string, question: string) => void;
  readonly setDemo: (play: () => void) => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const missing = step.requestIds.filter((id) => !runs[id]);
  const next = missing[0];
  const runNext = async () => {
    for (const id of missing) {
      const prompt = primmRequestPrompt(activity, id);
      if (!prompt || !(await run(id, prompt))) return;
    }
  };
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !next || done) return;
    started.current = true;
    void runNext();
    // Run the missing requests once, when the step opens.
  }, []);
  const order = useMemo(() => shuffled(step.requestIds, step.id), [step.id, step.requestIds]);
  const place = (answer: string, question: string) => {
    setSelected(null);
    onPlace(answer, question);
  };
  setDemo(() => {
    const from = document.querySelector<HTMLElement>(".primm-steps__answer:not([hidden])");
    const zones = [...document.querySelectorAll<HTMLElement>(".primm-steps__zone:not(.is-done)")];
    const to = zones.find((zone) => zone.dataset.question !== from?.dataset.answer) ?? zones[0];
    if (from && to)
      void playCoach({ from, to, gesture: "drag", caption: t("primm.steps.coach.match") });
  });
  if (missing.length)
    return (
      <RunStatus busy={busy} error={error} onCancel={onCancel} onRetry={() => void runNext()} />
    );
  const excerpt = (text: string) => {
    const sentences = primmSentences(text);
    return sentences.length > 2
      ? `${sentences.slice(0, 1).join("")}${t("primm.steps.moreSentences", { count: sentences.length })}`
      : text;
  };
  return (
    <>
      <div className="primm-steps__answers">
        {order.map((id) =>
          placed[id] ? null : (
            <AnswerCard
              key={id}
              id={id}
              text={excerpt(runs[id]!.result.text)}
              selected={selected === id}
              disabled={done}
              onSelect={() => setSelected(selected === id ? null : id)}
              onDrop={(question) => place(id, question)}
            />
          ),
        )}
      </div>
      <div className="primm-steps__questions">
        {step.requestIds.map((id) => {
          const answered = Object.entries(placed).find(([, question]) => question === id)?.[0];
          return (
            <div key={id} className="primm-steps__question">
              <p>{t("primm.steps.youAsked", { text: primmRequestPrompt(activity, id) ?? "" })}</p>
              <button
                type="button"
                className={`primm-steps__zone${answered ? " is-done" : ""}`}
                data-drop="question"
                data-question={id}
                disabled={!!answered || done}
                onClick={() => selected && place(selected, id)}
              >
                {answered ? excerpt(runs[answered]!.result.text) : t("primm.steps.drop")}
              </button>
            </div>
          );
        })}
      </div>
      <p className="primm-steps__live">{t("primm.steps.liveAll")}</p>
    </>
  );
}

function AnswerCard({
  id,
  text,
  selected,
  disabled,
  onSelect,
  onDrop,
}: {
  readonly id: string;
  readonly text: string;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onSelect: () => void;
  readonly onDrop: (question: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const drop = useRef(onDrop);
  drop.current = onDrop;
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return pointerDrag(element, {
      targets: () => [
        ...document.querySelectorAll<HTMLElement>(".primm-steps__zone:not(.is-done)"),
      ],
      onDrop: (target) => drop.current(target.dataset.question ?? ""),
      onStart: stopCoach,
    });
  }, []);
  return (
    <button
      ref={ref}
      type="button"
      className={`primm-steps__answer${selected ? " is-selected" : ""}`}
      data-answer={id}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      <PrimmResultText text={text} />
    </button>
  );
}

function SortStep({
  step,
  decided,
  done,
  image,
  onDecide,
}: {
  readonly step: PrimmStepOf<"sort">;
  readonly decided: Readonly<Record<string, string>>;
  readonly done: boolean;
  readonly image: string | undefined;
  readonly onDecide: (cardId: string, bucketId: string) => void;
}) {
  const { t } = useI18n();
  const [note, setNote] = useState<{ good: boolean; text: string } | null>(null);
  const [streak, setStreak] = useState(0);
  const remaining = step.cards.filter((card) => !decided[card.id]);
  const top = remaining[0];
  const [yes, no] = step.buckets;
  const binary = step.buckets.length === 2;
  const topRef = useRef<HTMLDivElement>(null);
  const decide = (bucketId: string) => {
    if (!top || done) return;
    stopCoach();
    const good = top.bucketId === bucketId;
    const bucket = step.buckets.find((item) => item.id === top.bucketId)!.label;
    setNote({ good, text: good ? top.why : t("primm.steps.actually", { bucket, why: top.why }) });
    setStreak(good ? streak + 1 : 0);
    if (good && streak + 1 >= 3) playSound("reward.streak");
    onDecide(top.id, bucketId);
  };
  useEffect(() => {
    const card = topRef.current;
    if (!card || !binary) return;
    let x0: number | null = null;
    const down = (event: PointerEvent) => {
      x0 = event.clientX;
      card.setPointerCapture?.(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (x0 === null) return;
      const dx = event.clientX - x0;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 14}deg)`;
    };
    const up = (event: PointerEvent) => {
      if (x0 === null) return;
      const dx = event.clientX - x0;
      x0 = null;
      card.style.transform = "";
      if (Math.abs(dx) > 80) decide(dx > 0 ? yes!.id : no!.id);
    };
    card.addEventListener("pointerdown", down);
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerup", up);
    card.addEventListener("pointercancel", up);
    return () => {
      card.removeEventListener("pointerdown", down);
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerup", up);
      card.removeEventListener("pointercancel", up);
    };
  });
  return (
    <div
      className="primm-steps__sort"
      onKeyDown={(event) => {
        if (!binary) return;
        if (event.key === "ArrowRight") decide(yes!.id);
        if (event.key === "ArrowLeft") decide(no!.id);
      }}
    >
      {image ? (
        <figure className="primm-steps__thumb">
          <img src={image} alt="" />
        </figure>
      ) : null}
      <p className="primm-steps__streak" aria-live="polite">
        {streak >= 2 ? t("primm.steps.combo", { count: streak }) : ""}
      </p>
      <div className="primm-steps__stack">
        {top ? (
          <div ref={topRef} key={top.id} className="primm-steps__card is-top">
            {top.text}
          </div>
        ) : null}
        {remaining[1] ? <div className="primm-steps__card is-under" aria-hidden="true" /> : null}
      </div>
      <p
        className={`primm-steps__note${note ? (note.good ? " is-good" : " is-bad") : ""}`}
        aria-live="polite"
      >
        {note?.text ?? ""}
      </p>
      <div className="primm-steps__buckets">
        {(binary ? [no!, yes!] : step.buckets).map((bucket) => (
          <GameButton
            key={bucket.id}
            variant={
              bucket.id === yes?.id
                ? "success"
                : bucket.id === no?.id && binary
                  ? "danger"
                  : "secondary"
            }
            disabled={!top || done}
            onClick={() => decide(bucket.id)}
          >
            {binary
              ? bucket.id === yes!.id
                ? `${bucket.label} →`
                : `← ${bucket.label}`
              : bucket.label}
          </GameButton>
        ))}
      </div>
    </div>
  );
}
