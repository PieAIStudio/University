import { useEffect, useMemo, useRef, useState } from "react";
import { primmRequestPrompt, type PrimmStepOf } from "@pieai/university-core";
import { useI18n } from "../../i18n/index.js";
import { PrimmResultText } from "../PrimmResultText.js";
import { playCoach, pointerDrag, stopCoach } from "../primm-coach.js";
import type { PrimmStepsActivity, PrimmWork } from "../primm-types.js";
import { RunStatus, shuffled } from "./parts.js";

/** Match: each live answer goes under the request that produced it; whole answers, never excerpts. */
export function MatchStep({
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
  // Matching an answer to its request means reading the whole answer: a first
  // sentence and a count hid exactly what the learner had to judge.
  return (
    <>
      <div className="primm-steps__answers" data-guide="step-match">
        {order.map((id) =>
          placed[id] ? null : (
            <AnswerCard
              key={id}
              id={id}
              text={runs[id]!.result.text}
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
                {answered ? (
                  <PrimmResultText text={runs[answered]!.result.text} />
                ) : (
                  t("primm.steps.drop")
                )}
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
