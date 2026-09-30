import { hasBeenGuided, recordGuided } from "@pieai/university-core";
import { useI18n } from "@pieai/university-ui/i18n.js";
import {
  DEFAULT_COMPANION_PREFERENCES,
  companionAppearance,
} from "@pieai/swimmer-nerve-kit/companion";
import { createGuidanceWalk, type GuidanceController } from "@pieai/swimmer-nerve-kit/guidance";
import { createTargetRegistry } from "@pieai/swimmer-nerve-kit/targets";
import { registerElementTarget } from "@pieai/swimmer-nerve-kit/targets-dom";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { LiquidPresence } from "@pieai/swimmer-ui-kit/liquid-presence";
import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from "react";

import { nerveLanguage } from "../nerve-language.js";
import { progressPort } from "../progress/store.js";
import "./first-use.css";

/**
 * The first time a learner meets a game or an interaction component, 涟 shows
 * the way instead of a screen of rules (Owner 2026-09-30): the same droplet
 * as on the map flies to one thing at a time and says one short line there.
 *
 * Two kinds of step. A look step points and waits for 「知道了」. A do step
 * points at a control and waits for the learner to use it — the click is the
 * real action, not a rehearsal, so do steps only ever point at a move that
 * costs nothing (pick a stone, turn, change lanes), never at an answer.
 *
 * Built from the kits, not beside them: Nerve's guidance walk owns the steps
 * and their order, UIKit's LiquidPresence draws the droplet, and targets are
 * ordinary DOM elements the screen marks with `data-guide`.
 */
export interface GuideStep {
  /** The `data-guide` value of the element to point at, inside `root`. */
  readonly target: string;
  readonly say: string;
  /** Wait for the learner to use the target instead of 「知道了」. */
  readonly act?: boolean;
}

/** Whether this learner still needs the guide `id`, and a way to say it is done. */
export function useFirstUse(id: string | null) {
  // A string, not the array: accountData() returns a fresh copy on every
  // call, and a snapshot that is never equal to itself re-renders forever.
  const guided = useSyncExternalStore(progressPort.subscribe, readGuided, readGuided);
  const needed = id !== null && !hasBeenGuided(guided.split(" "), id);
  const finish = useCallback(() => {
    if (!id) return;
    const preferences = progressPort.accountData().preferences;
    if (hasBeenGuided(preferences.guided, id)) return;
    progressPort.setAccountPreferences({
      ...preferences,
      guided: recordGuided(preferences.guided, id),
      updatedAt: { ...preferences.updatedAt, guided: new Date().toISOString() },
    });
  }, [id]);
  return { needed, finish };
}

const RETRIES = 4;
const readGuided = () => (progressPort.accountData().preferences.guided ?? []).join(" ");
const appearance = companionAppearance(DEFAULT_COMPANION_PREFERENCES, 44);
const noSubscription = () => () => {};

export function FirstUseGuide({
  id,
  steps,
  root,
  placement = "frame",
  onDone,
}: {
  id: string;
  steps: readonly GuideStep[];
  /** Where the targets live; searched once, when the guide starts. */
  root: RefObject<HTMLElement | null>;
  /**
   * Where the droplet rests between steps: the corner of the game frame it
   * guides, or the corner of the page for a lesson.
   */
  placement?: "frame" | "page";
  /** Finished or skipped: either way it is not shown again. */
  onDone: () => void;
}) {
  const { t, locale } = useI18n();
  const [walk, setWalk] = useState<GuidanceController | null>(null);
  const [missing, setMissing] = useState(false);

  // Effect-owned, so StrictMode never reuses a walk its rehearsal disposed.
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const registry = createTargetRegistry();
    const releases: (() => void)[] = [];
    for (const step of steps) {
      const element = host.querySelector(`[data-guide="${step.target}"]`);
      if (element)
        releases.push(
          registerElementTarget(registry, element, { id: step.target, label: step.say }),
        );
    }
    if (releases.length !== new Set(steps.map((step) => step.target)).size) {
      // A guide whose place is not on screen says nothing rather than guess.
      releases.forEach((release) => release());
      setMissing(true);
      return;
    }
    const controller = createGuidanceWalk(
      registry,
      { steps: steps.map((step) => ({ targetId: step.target, explanation: step.say })) },
      `first-use:${id}`,
      { scope: { id: `first-use:${id}` }, language: () => nerveLanguage(locale) },
    );
    setWalk(controller);
    return () => {
      controller.dispose();
      releases.forEach((release) => release());
    };
    // Steps are read once: a walk is bound to the places it started with.
  }, [id, root]);

  useEffect(() => {
    if (missing) onDone();
  }, [missing, onDone]);

  const view = useSyncExternalStore(
    walk ? walk.subscribe : noSubscription,
    () => walk?.getSnapshot() ?? null,
    () => walk?.getSnapshot() ?? null,
  );
  // A step can find its place covered for a frame — by the bubble of the step
  // before, which is still leaving. Look again a few frames later; if the
  // place stays hidden, say the line beside the droplet instead of guessing.
  const [retries, setRetries] = useState(0);
  useEffect(() => setRetries(0), [view?.key]);
  useEffect(() => {
    if (!walk || view?.status !== "unavailable" || retries >= RETRIES) return;
    const key = view.key;
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        walk.retry(key);
        setRetries((n) => n + 1);
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [walk, view?.key, view?.status, retries]);

  if (!walk || !view || view.status === "closed") return null;
  const step = steps[view.index];
  const last = view.index === view.total - 1;
  const advance = () => {
    if (last) onDone();
    else walk.next(view.key);
  };

  const bubble = (
    <div className="first-use__bubble">
      <p>{view.explanation}</p>
      <div className="first-use__actions">
        {step?.act && view.status === "showing" ? (
          <span className="first-use__try">{t("guide.try")}</span>
        ) : (
          <GameButton static sound={false} onClick={advance} data-testid="first-use-next">
            {last && placement === "frame" ? t("guide.start") : t("guide.ok")}
          </GameButton>
        )}
        <button
          type="button"
          className="first-use__skip"
          onClick={onDone}
          data-testid="first-use-skip"
        >
          {t("guide.skip")}
        </button>
      </div>
      <small className="first-use__count">
        {view.index + 1} / {view.total}
      </small>
    </div>
  );
  const stranded = view.status === "unavailable" && retries >= RETRIES;

  return (
    <div
      className={`first-use first-use--${placement}`}
      data-testid="first-use"
      data-step={view.index}
      data-status={view.status}
      data-target={view.target ? "yes" : "no"}
    >
      <LiquidPresence
        {...appearance}
        target={view.status === "showing" ? view.target : null}
        dismissOnTargetClick={Boolean(step?.act)}
        onDismiss={(reason) => {
          // The learner used the control a do step pointed at.
          if (reason === "dismissed" && step?.act) advance();
        }}
        guideContent={bubble}
      />
      {stranded ? <div className="first-use__fallback">{bubble}</div> : null}
    </div>
  );
}
