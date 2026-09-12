import { useEffect, useState } from "react";
import {
  createSortState,
  isSortComplete,
  placeSortItem,
  type SortActivity,
  type SortState,
} from "@pieai/university-core";
import { LiquidSurface } from "@pieai/swimmer-ui-kit";
import { translate as t } from "../i18n/index.js";
import { playSound } from "../sound/index.js";
import type { ActivityControls } from "./controls.js";

/*
  A piece that has just landed in a bucket.

  This is the one moment in the whole board where the brand's liquid actually
  has something to say: a thing arriving under its own weight. The body mounts
  at the `settle` form's rest offset and flips to engaged on the next frame, so
  the spring has two states to travel between — set engaged on the first render
  and there is nothing to animate.

  The fill is the raised surface, not the pale accent it started as. A bucket
  is `panel-deep` — a tan tray — and a pale-accent chip on it measured barely
  any separation at all: the piece read as a smudge on the tray rather than as
  something resting in it. The raised cream is the same token the board's other
  pieces use, so a placed chip joins that language instead of inventing one.

  The chip's own text is never inside the deforming layer. `LiquidSurface`
  keeps the silhouette behind and the DOM in front, which is what stops a
  landing from blurring the label it is announcing.
*/
function PlacedChip({ label }: { label: string }) {
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setLanded(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <LiquidSurface
      active={landed}
      className="play-sort__placed-body"
      fill="var(--game-ui-surface-raised)"
      form="settle"
      radius={12}
    >
      <span className="play-sort__placed-label">{label}</span>
    </LiquidSurface>
  );
}

interface Note {
  readonly itemId: string;
  readonly right: boolean;
  readonly text: string;
}

/**
 * Pick a thing, then pick where it belongs.
 *
 * Two taps rather than a drag. A drag needs a pointer that can be held, a
 * target big enough to hit while moving, and a keyboard path that has to be
 * built separately — and `connect` already established that picking one thing
 * and then its partner reads clearly on a phone.
 */
export function SortGame({
  activity,
  disabled,
  onAttempt,
  guided = false,
}: ActivityControls<SortActivity>) {
  const [state, setState] = useState<SortState>(createSortState);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  const remaining = activity.items.filter((item) => !state.placed[item.id]);
  const done = isSortComplete(activity, state);

  function place(bucketId: string) {
    if (disabled || !picked) return;
    const verdict = placeSortItem(activity, state, picked, bucketId);
    if (verdict.kind === "right") {
      playSound("answer.correct");
      setState(verdict.state);
      setNote({ itemId: picked, right: true, text: verdict.why });
      setPicked(null);
      if (isSortComplete(activity, verdict.state)) {
        onAttempt(
          true,
          { placed: verdict.state.placed, misses: verdict.state.misses },
          activity.takeaway,
        );
      }
      return;
    }
    if (verdict.kind !== "wrong") return;
    playSound("answer.wrong");
    setState(verdict.state);
    /*
      A miss keeps the item in hand and says what is wrong with this bucket for
      this thing. Falling back to a generic line is deliberate and visible: an
      author who did not write the temptation gets the plain sentence, not an
      invented reason that sounds like it came from the lesson.
    */
    setNote({
      itemId: picked,
      right: false,
      text: verdict.whyNot ?? t("play.sort.missGeneric"),
    });
  }

  return (
    <div className="play-sort">
      <p className="play-sort__question">{activity.question}</p>
      {guided && !done ? (
        <p className="play-sort__guide">
          {picked ? t("play.sort.guidePickBucket") : t("play.sort.guidePickItem")}
        </p>
      ) : null}

      <ul className="play-sort__items">
        {remaining.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="play-sort__item"
              aria-pressed={picked === item.id}
              disabled={disabled}
              onClick={() => {
                setPicked((current) => (current === item.id ? null : item.id));
                setNote(null);
              }}
            >
              <span className="play-sort__item-label">{item.label}</span>
              <small>{item.detail}</small>
            </button>
          </li>
        ))}
      </ul>

      <div className="play-sort__buckets">
        {activity.buckets.map((bucket) => {
          const held = activity.items.filter((item) => state.placed[item.id] === bucket.id);
          return (
            <section key={bucket.id} className="play-sort__bucket">
              <button
                type="button"
                className="play-sort__bucket-head"
                disabled={disabled || !picked}
                onClick={() => place(bucket.id)}
              >
                <strong>{bucket.label}</strong>
                <small>{bucket.note}</small>
              </button>
              <ul>
                {held.map((item) => (
                  <li key={item.id} className="play-sort__placed">
                    <PlacedChip label={item.label} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {note ? (
        <p
          className={`play-sort__note play-sort__note--${note.right ? "right" : "wrong"}`}
          role="status"
        >
          {note.text}
        </p>
      ) : null}
      {done ? <p className="play-sort__done">{activity.takeaway}</p> : null}
      {state.misses > 0 && !done ? (
        <p className="play-sort__misses">{t("play.sort.misses", { value0: state.misses })}</p>
      ) : null}
    </div>
  );
}
