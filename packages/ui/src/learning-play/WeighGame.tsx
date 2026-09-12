import { useState } from "react";
import {
  createWeighState,
  decideWeigh,
  isWeighComplete,
  weighOutcomes,
  type WeighActivity,
  type WeighState,
} from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";
import { playSound } from "../sound/index.js";
import type { ActivityControls } from "./controls.js";

interface Settled {
  readonly situationId: string;
  readonly why: string;
  readonly costOfOther: Readonly<Record<string, string>>;
}

/**
 * One situation at a time, and the same choices every time.
 *
 * The options stay on screen unchanged from the first situation to the last —
 * that is the whole point. The reader picks the same-looking button twice and
 * is right once and wrong once, and the summary at the end is where those two
 * facts are put side by side, because neither situation on its own shows the
 * answer moving.
 *
 * What each option costs is written on the button rather than in a standing row
 * of cards above it. The cards were a second copy of the same three things, and
 * on a phone they pushed the first thing the reader can actually press off the
 * bottom of the screen — a game whose opening screen has nothing to do on it.
 * One block also puts the explanation on the control it explains.
 */
export function WeighGame({
  activity,
  disabled,
  onAttempt,
  guided = false,
}: ActivityControls<WeighActivity>) {
  const [state, setState] = useState<WeighState>(createWeighState);
  const [settled, setSettled] = useState<readonly Settled[]>([]);
  const [missed, setMissed] = useState<string | null>(null);

  const done = isWeighComplete(activity, state);
  const current = activity.situations.find((situation) => !state.decided[situation.id]);
  const labelOf = (optionId: string) =>
    activity.options.find((option) => option.id === optionId)?.label ?? optionId;

  function decide(optionId: string) {
    if (disabled || !current) return;
    const verdict = decideWeigh(activity, state, current.id, optionId);
    if (verdict.kind === "right") {
      playSound("answer.correct");
      setState(verdict.state);
      setSettled((rows) => [
        ...rows,
        { situationId: current.id, why: verdict.why, costOfOther: verdict.costOfOther },
      ]);
      setMissed(null);
      if (isWeighComplete(activity, verdict.state)) {
        onAttempt(
          true,
          { decided: verdict.state.decided, misses: verdict.state.misses },
          activity.takeaway,
        );
      }
      return;
    }
    if (verdict.kind !== "wrong") return;
    playSound("answer.wrong");
    setState(verdict.state);
    /*
      A miss names the situation and nothing else. The reason each option loses
      here is the answer, and spending it on a wrong guess would let somebody
      collect every explanation without making a single judgement.
    */
    setMissed(current.id);
  }

  return (
    <div className="play-weigh">
      <p className="play-weigh__question">{activity.question}</p>

      {current ? (
        <section className="play-weigh__current">
          <p className="play-weigh__progress">
            {t("play.weigh.progress", {
              value0: activity.situations.indexOf(current) + 1,
              value1: activity.situations.length,
            })}
          </p>
          <div className="play-weigh__situation">
            <strong>{current.label}</strong>
            <small>{current.detail}</small>
          </div>
          {guided ? <p className="play-weigh__guide">{t("play.weigh.guideDecide")}</p> : null}
          <div className="play-weigh__choices">
            {activity.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="play-weigh__choice"
                disabled={disabled}
                onClick={() => decide(option.id)}
              >
                <strong>{option.label}</strong>
                <small>{option.note}</small>
              </button>
            ))}
          </div>
          {missed === current.id ? (
            <p className="play-weigh__miss" role="status">
              {t("play.weigh.notHere")}
            </p>
          ) : null}
        </section>
      ) : null}

      {settled.length > 0 ? (
        <ol className="play-weigh__settled">
          {settled.map((row) => {
            const situation = activity.situations.find((item) => item.id === row.situationId);
            return (
              <li key={row.situationId} className="play-weigh__settled-row">
                <strong>{situation?.label}</strong>
                <span className="play-weigh__settled-pick">
                  {labelOf(state.decided[row.situationId] ?? "")}
                </span>
                <small>{row.why}</small>
                {/*
                  One line per losing choice. With three options on the board
                  「the other one」 names two different things, so each is priced
                  by name — otherwise the reader is told a cost and has to guess
                  which choice it belonged to.
                */}
                {activity.options
                  .filter((option) => option.id !== situation?.bestOptionId)
                  .map((option) => (
                    <small key={option.id} className="play-weigh__cost">
                      {t("play.weigh.costOfOther", {
                        value0: option.label,
                        value1: row.costOfOther[option.id] ?? "",
                      })}
                    </small>
                  ))}
              </li>
            );
          })}
        </ol>
      ) : null}

      {done ? (
        <section className="play-weigh__done">
          {/*
            The flip, stated as a fact about what just happened. It is assembled
            from the board rather than authored, so it cannot claim a pattern
            the reader's own answers did not produce.
          */}
          <p className="play-weigh__flip">{t("play.weigh.flipHeading")}</p>
          <ul>
            {weighOutcomes(activity).map((row) => (
              <li key={row.optionId}>
                <strong>{labelOf(row.optionId)}</strong>
                {` — ${row.situationIds
                  .map(
                    (id) =>
                      activity.situations.find((situation) => situation.id === id)?.label ?? id,
                  )
                  .join("、")}`}
              </li>
            ))}
          </ul>
          <p className="play-weigh__takeaway">{activity.takeaway}</p>
        </section>
      ) : null}
      {state.misses > 0 && !done ? (
        <p className="play-weigh__misses">{t("play.weigh.misses", { value0: state.misses })}</p>
      ) : null}
    </div>
  );
}
