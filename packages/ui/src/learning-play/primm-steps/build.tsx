import type { PrimmStepOf } from "@pieai/university-core";
import { primmBuildVerdict } from "@pieai/university-core";
import { playSound } from "../../sound/index.js";
import { playCoach, stopCoach } from "../primm-coach.js";
import type { Primary, StepContext, StepView } from "./context.js";

/** Build: pieces into one request; a stray piece names its own reason, and order matters. */
export function buildStep(current: PrimmStepOf<"build">, ctx: StepContext): StepView {
  const { t, session, update, finishStep, setFeedback } = ctx;
  let primary: Primary | undefined;
  let demo: (() => void) | undefined;

  const placed = session.built[current.id] ?? [];
  const done = session.done.includes(current.id);
  demo = () => {
    const tile = document.querySelector<HTMLElement>(".primm-steps__tiles .primm-steps__tile");
    if (tile) void playCoach({ from: tile, gesture: "tap", caption: t("primm.steps.coach.build") });
  };
  const setPlaced = (next: string[]) => update({ built: { ...session.built, [current.id]: next } });
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
          text:
            current.hint ??
            t(verdict.reason === "order" ? "primm.steps.orderText" : "primm.steps.missingText"),
        });
      },
    };
  const body = (
    <>
      {current.context ? <p className="primm-steps__context">{current.context}</p> : null}
      <div
        className={`primm-steps__line${placed.length ? "" : " is-empty"}`}
        data-guide="step-line"
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
      <div className="primm-steps__tiles" data-guide="step-tiles">
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
  return { body, primary, demo };
}
