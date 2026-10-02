import { useEffect, useRef, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import type { PrimmStepOf } from "@pieai/university-core";
import { useI18n } from "../../i18n/index.js";
import { playSound } from "../../sound/index.js";
import { stopCoach } from "../primm-coach.js";

/** Sort: one card at a time into a bucket, by swipe, drag or button. */
export function SortStep({
  step,
  decided,
  done,
  image,
  onDecide,
  onMiss,
}: {
  readonly step: PrimmStepOf<"sort">;
  readonly decided: Readonly<Record<string, string>>;
  readonly done: boolean;
  readonly image: string | undefined;
  readonly onDecide: (cardId: string, bucketId: string) => void;
  /** A wrong side: the card stays on top until it goes right (Owner H1). */
  readonly onMiss: (cardId: string) => void;
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
    if (!good) {
      // Why not, never which side: the learner moves the card again.
      setNote({ good, text: top.miss ?? t("primm.steps.sortAgain") });
      setStreak(0);
      onMiss(top.id);
      return;
    }
    setNote({ good, text: top.why });
    setStreak(streak + 1);
    if (streak + 1 >= 3) playSound("reward.streak");
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
          <div
            ref={topRef}
            key={top.id}
            className="primm-steps__card is-top"
            data-guide="step-card"
          >
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
      <div className="primm-steps__buckets" data-guide="step-buckets">
        {(binary ? [no!, yes!] : step.buckets).map((bucket) => (
          <GameButton
            key={bucket.id}
            data-bucket={bucket.id}
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
