import { useEffect, useMemo, useRef, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  fingerprint,
  planCheckpoint,
  settleCheckpoint,
  type CheckpointAnswer,
  type CheckpointLesson,
  type CheckpointPlan,
  type LessonRef,
} from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import { ChoiceOptions } from "../review/ChoiceOptions.js";
import { useSessionDraft } from "./use-session-draft.js";

export type CheckpointSettlement = NonNullable<ReturnType<typeof settleCheckpoint>>;
interface Sitting {
  started: boolean;
  answers: CheckpointAnswer[];
  answer: string;
  finished: boolean;
}
const initial: Sitting = { started: false, answers: [], answer: "", finished: false };

export function MapCheckpoint(props: {
  lessons: readonly CheckpointLesson[];
  locator: LessonRef;
  accountScope: string;
  onCommit: (
    plan: CheckpointPlan,
    answers: readonly CheckpointAnswer[],
    signal: AbortSignal,
  ) => Promise<void>;
  onOpenLesson: (lessonId: string) => void;
  onClose: () => void;
}) {
  const plan = useMemo(() => planCheckpoint(props.lessons), [props.lessons]);
  return <CheckpointSession key={plan.fingerprint} {...props} plan={plan} />;
}

function CheckpointSession({
  lessons,
  locator,
  accountScope,
  onCommit,
  onOpenLesson,
  onClose,
  plan,
}: Parameters<typeof MapCheckpoint>[0] & { plan: CheckpointPlan }) {
  const { t } = useI18n();
  const { state, update, persistence } = useSessionDraft<Sitting>({
    accountScope,
    locator,
    key: `checkpoint:${fingerprint(plan.fingerprint)}`,
    initial,
    restore: (value) => {
      if (!value || typeof value !== "object") return null;
      const v = value as Partial<Sitting>;
      if (
        typeof v.started !== "boolean" ||
        typeof v.finished !== "boolean" ||
        typeof v.answer !== "string" ||
        !Array.isArray(v.answers) ||
        v.answers.length > plan.questions.length
      )
        return null;
      if (
        !v.answers.every(
          (answer, i) =>
            answer &&
            typeof answer.answer === "string" &&
            answer.lessonId === plan.questions[i]?.lessonId &&
            answer.exerciseId === plan.questions[i]?.exerciseId,
        )
      )
        return null;
      if (v.finished && !settleCheckpoint(plan, v.answers)) return null;
      return v as Sitting;
    },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"blank" | "changed" | "saveFailed" | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const result = state.finished ? settleCheckpoint(plan, state.answers) : null;
  const title = (id: string) => lessons.find((lesson) => lesson.id === id)?.title ?? id;
  const lessonsList = (ids: readonly string[]) => (
    <ul className="map-node__lesson-list">
      {ids.map((id) => (
        <li key={id}>
          <span>{title(id)}</span>
          <GameButton variant="ghost" onClick={() => onOpenLesson(id)}>
            {t("mapNodes.openLesson")}
          </GameButton>
        </li>
      ))}
    </ul>
  );

  async function commit(answers: CheckpointAnswer[]) {
    setBusy(true);
    setError(null);
    const request = new AbortController();
    controller.current = request;
    try {
      await onCommit(plan, answers, request.signal);
      if (!request.signal.aborted) update({ started: true, answers, answer: "", finished: true });
    } catch (reason) {
      if (!request.signal.aborted)
        setError(
          reason instanceof Error && reason.message === "content-changed"
            ? "changed"
            : "saveFailed",
        );
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }

  function submit() {
    if (busy) return;
    if (state.answers.length === plan.questions.length) {
      void commit(state.answers);
      return;
    }
    if (!state.answer.trim()) {
      setError("blank");
      return;
    }
    const question = plan.questions[state.answers.length]!;
    const answers = [
      ...state.answers,
      { lessonId: question.lessonId, exerciseId: question.exerciseId, answer: state.answer },
    ];
    update({ started: true, answers, answer: "", finished: false });
    setError(null);
    if (answers.length === plan.questions.length) void commit(answers);
  }

  return (
    <section className="map-node-flow" data-map-node-flow="checkpoint">
      {result ? (
        <>
          <h3>{t(result.complete ? "mapNodes.check.complete" : "mapNodes.check.partial")}</h3>
          <p>
            {result.proven.length
              ? t("mapNodes.check.passed", { count: result.proven.length })
              : t("mapNodes.check.noPass")}
          </p>
          {result.proven.length ? (
            <ul>
              {result.proven.map((id) => (
                <li key={id}>◇ {title(id)}</li>
              ))}
            </ul>
          ) : null}
          {result.needsPractice.length ? (
            <>
              <h4>{t("mapNodes.check.practice")}</h4>
              {lessonsList(result.needsPractice)}
            </>
          ) : null}
          {result.untested.length ? (
            <>
              <h4>{t("mapNodes.check.untested")}</h4>
              {lessonsList(result.untested)}
            </>
          ) : null}
          <p className="map-node__note">{t("mapNodes.check.noRead")}</p>
          <div className="map-node__actions">
            <GameButton onClick={onClose}>{t("mapNodes.return")}</GameButton>
            <GameButton variant="ghost" onClick={() => update(initial)}>
              {t("mapNodes.retry")}
            </GameButton>
          </div>
        </>
      ) : !state.started ? (
        <>
          <h3>{t("mapNodes.check.title")}</h3>
          <p>{t("mapNodes.check.intro")}</p>
          <p>
            {t("mapNodes.check.coverage", {
              covered: lessons.length - plan.unavailable.length,
              total: lessons.length,
              questions: plan.questions.length,
            })}
          </p>
          {plan.unavailable.length ? (
            <>
              <p className="map-node__note">{t("mapNodes.check.unavailable")}</p>
              {lessonsList(plan.unavailable.map((item) => item.lessonId))}
            </>
          ) : null}
          {plan.questions.length ? (
            <GameButton onClick={() => update({ ...initial, started: true })}>
              {t("mapNodes.check.start")}
            </GameButton>
          ) : (
            <p>{t("mapNodes.check.empty")}</p>
          )}
        </>
      ) : (
        <>
          {state.answers.length < plan.questions.length
            ? (() => {
                const question = plan.questions[state.answers.length]!;
                return (
                  <div key={`${question.lessonId}/${question.exerciseId}`}>
                    <p className="map-node__eyebrow">
                      {t("mapNodes.check.progress", {
                        current: state.answers.length + 1,
                        total: plan.questions.length,
                      })}{" "}
                      · {question.lessonTitle}
                    </p>
                    <h3>{question.prompt}</h3>
                    {question.options ? (
                      <ChoiceOptions
                        options={question.options}
                        selectedId={state.answer}
                        disabled={busy}
                        onSelect={(answer) => {
                          update({ ...state, answer });
                          setError(null);
                        }}
                      />
                    ) : (
                      <label className="map-node__input-label">
                        {t("mapNodes.check.answer")}
                        <textarea
                          autoComplete="off"
                          maxLength={500}
                          rows={3}
                          value={state.answer}
                          disabled={busy}
                          onChange={(event) => {
                            update({ ...state, answer: event.target.value });
                            setError(null);
                          }}
                        />
                        <small>{t("mapNodes.check.short")}</small>
                      </label>
                    )}
                  </div>
                );
              })()
            : null}
          {busy ? <p role="status">{t("mapNodes.check.saving")}</p> : null}
          {error ? <p role="alert">{t(`mapNodes.check.${error}`)}</p> : null}
          {error === "changed" ? (
            <GameButton onClick={onClose}>{t("mapNodes.return")}</GameButton>
          ) : (
            <GameButton disabled={busy} onClick={submit}>
              {t(
                state.answers.length >= plan.questions.length - 1
                  ? "mapNodes.check.settle"
                  : "mapNodes.check.submit",
              )}
            </GameButton>
          )}
        </>
      )}
      {persistence === "failed" || persistence === "unavailable" ? (
        <p role="status">{t("mapNodes.draftFailed")}</p>
      ) : null}
    </section>
  );
}
