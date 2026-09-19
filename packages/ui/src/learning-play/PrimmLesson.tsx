import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { GameButton, GamePanel } from "@pieai/swimmer-ui-kit";
import { useI18n } from "../i18n/index.js";
import { useAnswerDraft } from "../review/use-answer-draft.js";
import { playSound } from "../sound/index.js";
import { PrimmInvestigate, investigationComplete } from "./PrimmInvestigate.js";
import { PrimmMaterials, PrimmSource } from "./PrimmMaterials.js";
import { PrimmAttachment } from "./PrimmAttachment.js";
import { PrimmRequestWorkbench, joinRequestFragments } from "./PrimmRequestWorkbench.js";
import { initialPrimmSession, restorePrimmSession, type PrimmSession } from "./primm-session.js";
import type { PrimmLessonProps, PrimmOutput } from "./primm-types.js";

export type { PrimmLessonProps, RunPrimm, PrimmWork, PrimmEvaluation } from "./primm-types.js";
const phases = ["predict", "run", "investigate", "modify", "make"] as const;
export function PrimmLesson(props: PrimmLessonProps) {
  const { locale } = useI18n();
  const scope = JSON.stringify([
    props.answerDraftScope,
    props.lessonRef,
    props.contentRevision,
    props.activity.id,
    locale,
  ]);
  return <PrimmSessionView key={scope} {...props} />;
}
function PrimmSessionView({
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
}: PrimmLessonProps) {
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
    draft.answer ? restorePrimmSession(activity, draft.answer) : initialPrimmSession(activity),
  );
  const state = useRef(session);
  state.current = session;
  const [busy, setBusy] = useState<
    "run" | "modify" | "make" | "evaluate" | "complete" | "packet" | null
  >(null);
  const pending = useRef<AbortController | null>(null);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const focusNewOutput = useRef(false);
  const headingId = useId();
  const inputId = useId();
  const progressCallback = useRef(onPathProgress);
  progressCallback.current = onPathProgress;
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
    progressCallback.current?.(session.stage);
  }, [session.stage]);
  useLayoutEffect(() => {
    if (busy || !focusNewOutput.current) return;
    focusNewOutput.current = false;
    const root = heading.current?.closest(".primm");
    const target =
      session.stage === 4
        ? root?.querySelector<HTMLElement>("[data-final-work]")
        : [...(root?.querySelectorAll<HTMLElement>(".primm__result h3") ?? [])].at(-1);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
  }, [busy, session.run, session.modify, session.make, session.stage]);
  function update(patch: Partial<PrimmSession>) {
    const next = { ...state.current, ...patch };
    state.current = next;
    setSession(next);
    draft.setAnswer(JSON.stringify(next));
  }
  function cancel() {
    pending.current?.abort();
    pending.current = null;
    setBusy(null);
    setError(t("primm.cancelled"));
  }
  function advance() {
    setError("");
    setCopyState("");
    update({ stage: state.current.stage + 1 });
    playSound("ui.press");
  }
  async function execute(phase: "run" | "modify" | "make") {
    if (pending.current) return;
    if (phase === "run" && activity.experienceVersion === 2 && !state.current.attached) return;
    setError("");
    if (!runPrimm || !lessonRef) {
      setError(t("primm.unavailable"));
      return;
    }
    const prompt =
      phase === "run"
        ? activity.starter.prompt
        : phase === "modify"
          ? state.current.modifyPrompt
          : state.current.makePrompt;
    if (!prompt.trim() || (phase === "modify" && prompt.trim() === activity.starter.prompt.trim()))
      return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(phase);
    update({ [phase]: null, ...(phase === "make" ? { evaluation: null } : {}) });
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
      if (controller.signal.aborted || pending.current !== controller) return;
      if (result.kind !== "live") throw new Error(t("primm.replayRejected"));
      if (result.prompt !== prompt) throw new Error(t("primm.failed"));
      if (!result.text.trim()) throw new Error(t("primm.emptyResult"));
      focusNewOutput.current = true;
      update({
        [phase]: { request, result, ...(phase === "make" ? { finalWork: result.text } : {}) },
      });
    } catch {
      if (!controller.signal.aborted && pending.current === controller) setError(t("primm.failed"));
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(null);
      }
    }
  }
  async function evaluate(refresh = false) {
    if (pending.current || !state.current.make) return;
    const evaluateWork = refresh ? refreshPrimmEvaluation : evaluatePrimm;
    if (!evaluateWork) {
      setError(t("primm.gradeUnavailable"));
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy("evaluate");
    setError("");
    try {
      const evaluation = await evaluateWork(state.current.make, controller.signal);
      if (!controller.signal.aborted && pending.current === controller) update({ evaluation });
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
  async function complete() {
    if (
      pending.current ||
      state.current.stage !== 5 ||
      state.current.evaluation?.outcome !== "pass"
    )
      return;
    if (!onPrimmComplete) {
      setError(t("primm.completeFailed"));
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy("complete");
    setError("");
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
  async function copy(packet = false) {
    try {
      if (packet) {
        if (!copyPrimmEvaluation || pending.current) return;
        setBusy("packet");
        await copyPrimmEvaluation();
      } else {
        if (!navigator.clipboard) throw new Error();
        await navigator.clipboard.writeText(
          session.make?.finalWork ?? session.make?.result.text ?? "",
        );
      }
      setCopyState(t(packet ? "primm.coachingCopied" : "primm.copied"));
    } catch {
      setCopyState(t("primm.copyFailed"));
    } finally {
      if (packet) setBusy(null);
    }
  }
  const phase = phases[session.stage];
  const atMake = phase === "make";
  const executionPhase = phase === "run" || phase === "modify" || phase === "make" ? phase : null;
  const currentOutput = executionPhase ? session[executionPhase]?.result : null;
  const everyday = activity.experienceVersion === 2;
  const canExecute =
    phase === "run"
      ? !everyday || session.attached
      : phase === "modify"
        ? !!session.modifyPrompt.trim() &&
          session.modifyPrompt.trim() !== activity.starter.prompt.trim()
        : !!session.makePrompt.trim();
  const investigationHasItsMaterial =
    everyday &&
    phase === "investigate" &&
    !["sort", "check-result"].includes(activity.investigate.game.kind);
  const showMaterials =
    session.stage < 5 &&
    phase !== "predict" &&
    !(everyday && phase === "run") &&
    !investigationHasItsMaterial;
  const prediction = activity.predict.options.find((item) => item.id === session.prediction);
  const investigated =
    phase === "investigate" && investigationComplete(activity, session.investigation);
  const debrief =
    currentOutput && busy === null
      ? phase === "run"
        ? activity.run.debrief
        : phase === "modify"
          ? activity.modify.debrief
          : undefined
      : undefined;
  const stageTitle =
    phase === "predict" ? activity.title : phase ? activity[phase].title : activity.finish.title;
  const operationAsset =
    phase === "investigate" && activity.investigate.game.kind === "inspect-image"
      ? activity.investigate.game.assetId
      : undefined;
  return (
    <GamePanel
      className={`primm${everyday ? " primm--everyday" : ""}`}
      aria-labelledby={headingId}
      data-primm-stage={phase ?? "finish"}
    >
      <h2 ref={heading} tabIndex={-1} id={headingId}>
        {stageTitle}
      </h2>
      {phase === "predict" ? (
        <>
          {everyday ? (
            <aside className="primm__case">
              <p>{activity.intro.connection}</p>
              {activity.intro.sourceIds?.map((id) => (
                <PrimmSource
                  key={id}
                  source={activity.sources.find((source) => source.id === id)}
                />
              ))}
            </aside>
          ) : null}
          <p className="primm__situation">
            {activity.intro.situation} {activity.intro.need}
          </p>
          {!everyday ? <p>{activity.intro.connection}</p> : null}
          {!everyday
            ? activity.intro.sourceIds?.map((id) => (
                <PrimmSource key={id} source={activity.sources.find((s) => s.id === id)} />
              ))
            : null}
        </>
      ) : null}
      {phase === "run" ? (
        <>
          <p>{activity.run.note}</p>
          {prediction ? (
            <p className="primm__credit">{t("primm.predicted", { text: prediction.label })}</p>
          ) : null}
        </>
      ) : null}
      {phase === "investigate" ? <p>{activity.investigate.brief}</p> : null}
      {phase === "modify" ? (
        <>
          <p>{activity.modify.brief}</p>
          <p>{activity.modify.goal}</p>
        </>
      ) : null}
      {atMake ? (
        <>
          <p>{activity.make.scenario}</p>
          <p>{activity.make.goal}</p>
        </>
      ) : null}
      {showMaterials ? (
        <PrimmMaterials
          activity={activity}
          materialIds={atMake ? activity.make.materialIds : activity.starter.materialIds}
          assetIds={atMake ? activity.make.assetIds : activity.starter.assetIds}
          assets={assets}
          omitAssetId={operationAsset}
        />
      ) : null}
      {phase === "run" && everyday ? (
        <PrimmAttachment
          activity={activity}
          assets={assets}
          attached={session.attached}
          disabled={busy !== null}
          onAttach={(attached) => update({ attached, run: null })}
        />
      ) : null}
      {phase === "run" && !everyday ? (
        <section>
          <h3>{t("primm.prompt")}</h3>
          <pre className="primm__text">{activity.starter.prompt}</pre>
        </section>
      ) : null}
      {phase === "predict" ? (
        <div className="primm__first-step">
          <PrimmMaterials
            activity={activity}
            materialIds={activity.starter.materialIds}
            assetIds={activity.starter.assetIds}
            assets={assets}
          />
          <div>
            <section>
              <h3>{t("primm.prompt")}</h3>
              <pre className="primm__text">{activity.starter.prompt}</pre>
            </section>
            <fieldset>
              <legend>{activity.predict.question}</legend>
              {activity.predict.options.map((option) => (
                <GameButton
                  key={option.id}
                  aria-pressed={session.prediction === option.id}
                  onClick={() => update({ prediction: option.id })}
                >
                  {option.label}
                </GameButton>
              ))}
            </fieldset>
            <GameButton
              variant="primary"
              disabled={!activity.predict.options.some((o) => o.id === session.prediction)}
              onClick={advance}
            >
              {t("primm.next")}
            </GameButton>
          </div>
        </div>
      ) : null}
      {phase === "investigate" ? (
        <>
          <PrimmResult result={session.run!.result} label={t("primm.result")} />
          <div data-primm-game={activity.investigate.game.kind}>
            <PrimmInvestigate
              activity={activity}
              assets={assets}
              draft={session.investigation}
              onChange={(investigation) => update({ investigation })}
            />
          </div>
          {/* The teacher explains what the learner just found, never before they act. */}
          {investigated ? (
            <div className="primm__debrief" role="status">
              <p>{activity.investigate.explanation}</p>
              {activity.investigate.more?.map((more) => (
                <details key={more.question}>
                  <summary>{more.question}</summary>
                  <p>{more.answer}</p>
                </details>
              ))}
            </div>
          ) : null}
          <GameButton variant="primary" disabled={!investigated} onClick={advance}>
            {t("primm.next")}
          </GameButton>
        </>
      ) : null}
      {phase === "modify" && activity.modify.workbench ? (
        <PrimmRequestWorkbench
          workbench={activity.modify.workbench}
          fragments={session.fragments}
          observation={session.investigation.observation}
          disabled={busy !== null}
          onChange={(fragments) => {
            setError("");
            update({ fragments, modifyPrompt: joinRequestFragments(fragments), modify: null });
          }}
        />
      ) : null}
      {(phase === "modify" && !activity.modify.workbench) || atMake ? (
        <>
          <label htmlFor={inputId}>{t("primm.request")}</label>
          <textarea
            id={inputId}
            maxLength={2000}
            value={atMake ? session.makePrompt : session.modifyPrompt}
            placeholder={atMake ? activity.make.promptPlaceholder : undefined}
            readOnly={busy !== null}
            onChange={(event) => {
              setError("");
              setCopyState("");
              update(
                atMake
                  ? { makePrompt: event.target.value, make: null, evaluation: null }
                  : { modifyPrompt: event.target.value, modify: null },
              );
            }}
          />
          {phase === "modify" && activity.modify.suggestion ? (
            <details>
              <summary>{t("primm.suggestion")}</summary>
              <p>{activity.modify.suggestion}</p>
            </details>
          ) : null}
        </>
      ) : null}
      {executionPhase ? (
        <>
          <div className="primm__actions">
            <GameButton
              variant={currentOutput ? "secondary" : "primary"}
              disabled={busy !== null || !canExecute}
              onClick={() => void execute(executionPhase)}
            >
              {busy === executionPhase
                ? t("primm.busy")
                : currentOutput
                  ? t("primm.retry")
                  : everyday && phase === "run"
                    ? t("primm.sendPrepared")
                    : everyday && phase === "modify"
                      ? t("primm.runChanged")
                      : everyday && atMake
                        ? t("primm.makeDraft")
                        : t("primm.execute")}
            </GameButton>
            {busy && busy !== "complete" && busy !== "packet" ? (
              <GameButton onClick={cancel}>{t("primm.cancel")}</GameButton>
            ) : null}
          </div>
          {phase === "modify" ? (
            <div className="primm__comparison">
              <PrimmResult result={session.run!.result} label={t("primm.before")} />
              {currentOutput ? (
                <PrimmResult result={currentOutput} label={t("primm.after")} />
              ) : (
                <p>{t(canExecute ? "primm.changed" : "primm.modifyFirst")}</p>
              )}
            </div>
          ) : currentOutput && !atMake ? (
            <PrimmResult result={currentOutput} label={t("primm.result")} />
          ) : null}
          {debrief ? <p className="primm__debrief">{debrief}</p> : null}
          {phase === "run" || phase === "modify" ? (
            <GameButton
              variant="primary"
              disabled={!currentOutput || busy !== null}
              onClick={advance}
            >
              {t("primm.next")}
            </GameButton>
          ) : null}
        </>
      ) : null}
      {atMake ? (
        <>
          <ul>
            {activity.make.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {session.make ? (
            <>
              <section
                className={everyday ? "primm-artifact" : undefined}
                aria-label={everyday ? activity.make.artifactLabel : undefined}
                data-primm-operation={everyday ? "make-artifact" : undefined}
              >
                {everyday ? <h3>{activity.make.artifactLabel}</h3> : null}
                <label htmlFor={`${inputId}-final`}>
                  {everyday ? t("primm.refineArtifact") : t("primm.finalWork")}
                </label>
                <textarea
                  id={`${inputId}-final`}
                  data-final-work
                  maxLength={8000}
                  readOnly={busy !== null}
                  value={session.make.finalWork ?? session.make.result.text}
                  onChange={(event) =>
                    update({
                      make: { ...session.make!, finalWork: event.target.value },
                      evaluation: null,
                    })
                  }
                />
              </section>
              <GameButton
                disabled={
                  busy !== null || !(session.make.finalWork ?? session.make.result.text).trim()
                }
                variant={session.evaluation?.outcome === "pass" ? "secondary" : "primary"}
                onClick={() => void evaluate()}
              >
                {t(busy === "evaluate" ? "primm.evaluating" : "primm.evaluate")}
              </GameButton>
              {session.evaluation ? (
                <div role="status">
                  <p>{t(`primm.${session.evaluation.outcome}`)}</p>
                  <p>{session.evaluation.explanation}</p>
                </div>
              ) : null}
              {session.evaluation?.outcome === "undecided" ? (
                <div className="primm__actions">
                  {refreshPrimmEvaluation ? (
                    <GameButton disabled={busy !== null} onClick={() => void evaluate(true)}>
                      {t("primm.refreshGrade")}
                    </GameButton>
                  ) : null}
                  {copyPrimmEvaluation ? (
                    <GameButton disabled={busy !== null} onClick={() => void copy(true)}>
                      {t("primm.coaching")}
                    </GameButton>
                  ) : null}
                </div>
              ) : null}
              {session.evaluation?.outcome === "pass" ? (
                <GameButton variant="primary" disabled={busy !== null} onClick={advance}>
                  {t("primm.finish")}
                </GameButton>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
      {session.stage === 5 && session.make ? (
        <>
          <p>{activity.finish.note}</p>
          <pre className="primm__text">{session.make.finalWork ?? session.make.result.text}</pre>
          <div className="primm__actions">
            <GameButton onClick={() => void copy()}>{t("primm.copy")}</GameButton>
            <GameButton variant="primary" disabled={busy !== null} onClick={() => void complete()}>
              {t(busy === "complete" ? "primm.completing" : "primm.complete")}
            </GameButton>
          </div>
        </>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {copyState ? <p role="status">{copyState}</p> : null}
      {answerDraftScope &&
      lessonRef &&
      (draft.persistence === "failed" || draft.persistence === "unavailable") ? (
        <p role="alert">{t("primm.draftFailed")}</p>
      ) : null}
    </GamePanel>
  );
}
function PrimmResult({ result, label }: { readonly result: PrimmOutput; readonly label: string }) {
  return (
    <section className="primm__result" aria-label={label}>
      <h3 tabIndex={-1}>{label}</h3>
      <pre className="primm__text">{result.text}</pre>
    </section>
  );
}
