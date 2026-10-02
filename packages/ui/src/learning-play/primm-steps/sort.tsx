import type { PrimmStepOf } from "@pieai/university-core";
import { playSound } from "../../sound/index.js";
import { playCoach } from "../primm-coach.js";
import { SortStep } from "./SortStep.js";
import type { StepContext, StepView } from "./context.js";

/** Sort: one card at a time into its bucket; a wrong side keeps the card until it goes right (Owner H1). */
export function sortStep(current: PrimmStepOf<"sort">, ctx: StepContext): StepView {
  const { t, session, update, finishStep, starterImage, photoUrl, pulse } = ctx;
  let demo: (() => void) | undefined;

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
  const body = (
    <SortStep
      step={current}
      decided={decided}
      done={session.done.includes(current.id)}
      image={starterImage ? photoUrl(starterImage) : undefined}
      onMiss={(cardId) => {
        playSound("answer.wrong");
        pulse("no");
        const missed = session.missed[current.id] ?? [];
        if (!missed.includes(cardId))
          update({ missed: { ...session.missed, [current.id]: [...missed, cardId] } });
      }}
      onDecide={(cardId, bucketId) => {
        const next = { ...decided, [cardId]: bucketId };
        const bin = current.buckets.findIndex((bucket) => bucket.id === bucketId);
        pulse("ok", bin);
        update({ sorted: { ...session.sorted, [current.id]: next } });
        playSound("answer.correct");
        if (current.cards.every((item) => next[item.id])) {
          // Every card ends on its side; the score is the ones placed right first time.
          const missed = session.missed[current.id] ?? [];
          const right = current.cards.filter((item) => !missed.includes(item.id)).length;
          finishStep(current.id, {
            tone: right === current.cards.length ? "good" : "info",
            title: t("primm.steps.sorted", { right, total: current.cards.length }),
            text: current.after,
          });
        }
      }}
    />
  );
  return { body, demo };
}
