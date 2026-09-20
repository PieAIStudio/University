import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { progressSourceOf } from "@pieai/university-core";
import { LessonReader } from "@pieai/university-ui/lesson/LessonReader.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { useAnswerDraft } from "@pieai/university-ui/review/use-answer-draft.js";
import type { LessonView } from "@pieai/university-ui/view/lesson-view.js";
import { progressPort } from "../progress/store.js";
import { contentPort, gradingPort, readerPort, sourceAccessPort } from "../ports/index.js";
import {
  personalAccountScope,
  PersonalHttpError,
  readPersonalJson,
  type PersonalRecord,
  type PersonalJob,
} from "./api.js";

interface Props {
  scope: { studyId: string; courseId: string; unitId: string; lessonIds: readonly string[] };
  onClose: () => void;
}

export function PersonalLessonPanel({ scope, onClose }: Props) {
  const { t, locale } = useI18n();
  const account = personalAccountScope();
  const goalIdentity = useMemo(
    () => ({
      accountScope: account,
      locator: {
        studyId: scope.studyId,
        courseId: scope.courseId,
        unitId: scope.unitId,
        lessonId: scope.lessonIds[0] ?? "personal-task",
      },
      exerciseId: `personal-goal:${scope.lessonIds.join("|")}`,
      contentRevision: 1,
    }),
    [account, scope],
  );
  const {
    answer: goal,
    setAnswer: setGoal,
    persistence: goalPersistence,
  } = useAnswerDraft({
    identity: goalIdentity,
    submittedAnswer: "",
    submittedAt: null,
  });
  const [job, setJob] = useState<PersonalJob | null>(null);
  const [records, setRecords] = useState<readonly PersonalRecord[]>([]);
  const [selected, setSelected] = useState<PersonalRecord | null>(null);
  const [view, setView] = useState<LessonView | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const pending = useRef<{ goal: string; commandId: string } | null>(null);
  const document = useSyncExternalStore(
    progressPort.subscribe,
    progressPort.snapshot,
    progressPort.snapshot,
  );
  const busy = starting || job?.status === "working";

  const loadList = useCallback(
    async (signal?: AbortSignal) => {
      const listing = await readPersonalJson<{
        lessons: PersonalRecord[];
        active: PersonalJob[];
        recent?: PersonalJob[];
      }>("/list", account, { signal });
      if (signal?.aborted) return;
      setRecords(listing.lessons);
      const latest = listing.active[0] ?? listing.recent?.[0];
      if (latest) {
        setJob(latest);
        if (latest.status === "failed") setError(latest.error ?? t("mapNodes.personal.failed"));
      }
      setAvailable(true);
    },
    [account, t],
  );
  useEffect(() => {
    const controller = new AbortController();
    void loadList(controller.signal).catch(() => {
      if (!controller.signal.aborted) setAvailable(false);
    });
    return () => controller.abort();
  }, [loadList]);

  useEffect(() => {
    if (job?.status !== "working") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const current = await readPersonalJson<PersonalJob>(`/jobs/${job.commandId}`, account, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setJob(current);
        if (current.status === "ready" && current.record) {
          setRecords((previous) => [
            current.record!,
            ...previous.filter((record) => record.contentId !== current.record!.contentId),
          ]);
        } else if (current.status === "failed")
          setError(current.error ?? t("mapNodes.personal.failed"));
        if (current.status !== "working") pending.current = null;
        if (current.status === "working") timer = setTimeout(poll, 1500);
      } catch (reason) {
        if (!controller.signal.aborted) {
          if (reason instanceof PersonalHttpError && reason.status === 404) {
            setJob({ ...job, status: "failed" });
            pending.current = null;
            setError(t("mapNodes.personal.interrupted"));
            void loadList(controller.signal).catch(() => {});
            return;
          }
          setError(reason instanceof Error ? reason.message : t("mapNodes.personal.failed"));
          timer = setTimeout(poll, 5000);
        }
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [job?.commandId, job?.status, account, t, loadList]);

  useEffect(() => {
    if (!selected) {
      setView(null);
      return;
    }
    const controller = new AbortController();
    setView(null);
    setError(null);
    void contentPort
      .lesson(selected.locator, { signal: controller.signal })
      .then((loaded) => {
        if (!controller.signal.aborted) setView(loaded);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : t("mapNodes.personal.notFound"));
      });
    return () => controller.abort();
  }, [selected, locale, t]);
  const completion = useMemo(
    () =>
      selected && view
        ? progressSourceOf(progressPort).completionOf(selected.locator, {
            contentRevision: view.lesson.contentRevision,
            exerciseIds: view.lesson.exercises.map((exercise) => exercise.id),
          })
        : null,
    [selected, view, document],
  );

  async function generate() {
    if (busy) return;
    if (goal.trim().length < 8) {
      setError(t("mapNodes.personal.short"));
      return;
    }
    setError(null);
    setStarting(true);
    const request =
      pending.current?.goal === goal.trim()
        ? pending.current
        : { goal: goal.trim(), commandId: crypto.randomUUID() };
    pending.current = request;
    try {
      const current = await readPersonalJson<PersonalJob>("/generate", account, {
        method: "POST",
        body: JSON.stringify({
          accountScope: account,
          commandId: request.commandId,
          goal: request.goal,
          locale,
          scope,
        }),
      });
      setJob(current);
      if (current.status !== "working") {
        pending.current = null;
        if (current.record) await loadList();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("mapNodes.personal.failed"));
    } finally {
      setStarting(false);
    }
  }

  if (selected && view && completion)
    return (
      <section className="map-node-flow" data-map-node-flow="personal-lesson">
        <GameButton variant="ghost" onClick={() => setSelected(null)}>
          {t("mapNodes.personal.back")}
        </GameButton>
        <LessonReader
          locator={selected.locator}
          view={view}
          completion={completion}
          unitObjective={selected.unitObjective}
          reader={readerPort}
          grading={gradingPort}
          runPrimm={gradingPort.executePrimm}
          sourceAccess={sourceAccessPort}
          progress={progressPort}
          requestToken={`personal:${selected.contentId}:${locale}`}
          answerDraftScope={account}
          onLearningChanged={async () => setView(await contentPort.lesson(selected.locator))}
          onBackToCourse={onClose}
        />
      </section>
    );

  return (
    <section className="map-node-flow" data-map-node-flow="personal">
      <h3>{t("mapNodes.personal.title")}</h3>
      <p>{t("mapNodes.personal.intro")}</p>
      <p className="map-node__note">{t("mapNodes.personal.boundary")}</p>
      {available === null ? (
        <p role="status">{t("mapNodes.loading")}</p>
      ) : available === false ? (
        <>
          <p role="status">{t("mapNodes.personal.unavailable")}</p>
          <GameButton
            onClick={() => {
              setAvailable(null);
              void loadList().catch(() => setAvailable(false));
            }}
          >
            {t("mapNodes.retry")}
          </GameButton>
        </>
      ) : (
        <>
          <label className="map-node__input-label">
            {t("mapNodes.personal.goal")}
            <textarea
              rows={4}
              maxLength={600}
              value={job?.status === "working" ? (job.goal ?? goal) : goal}
              disabled={!!busy}
              placeholder={t("mapNodes.personal.example")}
              onChange={(event) => setGoal(event.target.value)}
            />
            <small>{t("mapNodes.personal.privacy")}</small>
          </label>
          {goalPersistence === "failed" || goalPersistence === "unavailable" ? (
            <p role="status">{t("mapNodes.draftFailed")}</p>
          ) : null}
          {job?.status === "working" ? (
            <div role="status">
              <h4>{t("mapNodes.personal.generating")}</h4>
              <p>{t(`mapNodes.personal.${job.stage}`)}</p>
              <p className="map-node__note">{t("mapNodes.personal.wait")}</p>
              <GameButton
                variant="secondary"
                onClick={async () => {
                  try {
                    const result = await readPersonalJson<{ cancelled: boolean }>(
                      "/cancel-generation",
                      account,
                      { method: "POST", body: JSON.stringify({ commandId: job.commandId }) },
                    );
                    setJob({ ...job, status: result.cancelled ? "cancelled" : "ready" });
                    pending.current = null;
                    await loadList();
                  } catch (reason) {
                    setError(String(reason));
                  }
                }}
              >
                {t("mapNodes.personal.cancel")}
              </GameButton>
            </div>
          ) : (
            <GameButton disabled={!!busy} onClick={() => void generate()}>
              {t("mapNodes.personal.create")}
            </GameButton>
          )}
          {job?.status === "cancelled" ? (
            <p role="status">{t("mapNodes.personal.cancelled")}</p>
          ) : null}
        </>
      )}
      {error ? <p role="alert">{error}</p> : null}
      {selected && !view ? (
        <>
          <p role="status">{error ? t("mapNodes.personal.notFound") : t("mapNodes.loading")}</p>
          <GameButton
            variant="ghost"
            onClick={() => {
              setSelected(null);
              setError(null);
            }}
          >
            {t("mapNodes.personal.back")}
          </GameButton>
        </>
      ) : null}
      {records.length ? (
        <>
          <h4>{t("mapNodes.personal.saved")}</h4>
          <p className="map-node__note">{t("mapNodes.personal.review")}</p>
          <ul className="map-node__lesson-list">
            {records.map((record) => (
              <li key={record.contentId}>
                <span>
                  <strong>{record.title}</strong>
                  <br />
                  {record.goal}
                </span>
                <GameButton onClick={() => setSelected(record)}>
                  {t("mapNodes.personal.start")}
                </GameButton>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
