import { useEffect, useId, useRef, useState } from "react";
import { GameButton, GameProgress, GameToggle } from "@pieai/swimmer-ui-kit";
import {
  createDispatchState,
  dispatchStatus,
  isDispatchCacheReady,
  routeDispatch,
  type DispatchActivity,
  type DispatchState,
} from "@pieai/university-core";

import { useI18n } from "../i18n/index.js";
import { playSound } from "../sound/sound.js";
import { PlayGuide } from "./PlayGuide.js";
import type { ActivityControls } from "./controls.js";

type ClockMode = "untimed" | "running" | "paused" | "expired";

export function DispatchGame({
  activity,
  disabled,
  onAttempt,
  guided = false,
}: ActivityControls<DispatchActivity>) {
  const interfaceTranslator = useI18n();
  const [state, setState] = useState<DispatchState>(createDispatchState);
  const stateRef = useRef(state);
  const [feedback, setFeedback] = useState("");
  const [rejected, setRejected] = useState(false);
  const [clockMode, setClockMode] = useState<ClockMode>("untimed");
  const clockRef = useRef<ClockMode>("untimed");
  const [remainingMs, setRemainingMs] = useState(activity.seconds * 1_000);
  const remainingRef = useRef(remainingMs);
  const deadlineRef = useRef(0);
  const reported = useRef(false);
  const wrongRoutes = useRef(0);
  const timeouts = useRef(0);
  const timedEver = useRef(false);
  const feedbackId = useId();
  const status = dispatchStatus(activity, state);
  const current = activity.cards[state.cursor];
  const terminal = status !== "active";
  const waiting = clockMode === "paused" || clockMode === "expired";
  const cacheReady = current ? isDispatchCacheReady(current, state) : false;

  function changeClockMode(mode: ClockMode) {
    clockRef.current = mode;
    setClockMode(mode);
  }

  function freezeClock() {
    if (clockRef.current !== "running") return;
    const left = Math.max(0, deadlineRef.current - Date.now());
    remainingRef.current = left;
    setRemainingMs(left);
    if (left === 0) {
      timeouts.current += 1;
      changeClockMode("expired");
    } else {
      changeClockMode("paused");
    }
  }

  function startClock() {
    if (disabled || terminal) return;
    timedEver.current = true;
    deadlineRef.current = Date.now() + remainingRef.current;
    changeClockMode("running");
    playSound("ui.press");
  }

  function useUntimedPractice() {
    freezeClock();
    changeClockMode("untimed");
    playSound("ui.press");
  }

  function restartTimed() {
    if (disabled) return;
    const fresh = createDispatchState();
    stateRef.current = fresh;
    setState(fresh);
    setFeedback("");
    setRejected(false);
    reported.current = false;
    wrongRoutes.current = 0;
    timeouts.current = 0;
    timedEver.current = true;
    remainingRef.current = activity.seconds * 1_000;
    setRemainingMs(remainingRef.current);
    deadlineRef.current = Date.now() + remainingRef.current;
    changeClockMode("running");
    playSound("ui.press");
  }

  useEffect(() => {
    if (clockMode !== "running" || disabled || status !== "active") return;
    const interval = window.setInterval(() => {
      if (clockRef.current !== "running") return;
      const left = Math.max(0, deadlineRef.current - Date.now());
      remainingRef.current = left;
      setRemainingMs(left);
      if (left === 0) {
        timeouts.current += 1;
        clockRef.current = "expired";
        setClockMode("expired");
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, [clockMode, disabled, status]);

  useEffect(() => {
    const pauseInBackground = () => {
      if (!document.hidden || clockRef.current !== "running") return;
      const left = Math.max(0, deadlineRef.current - Date.now());
      remainingRef.current = left;
      setRemainingMs(left);
      const nextMode = left === 0 ? "expired" : "paused";
      if (left === 0) timeouts.current += 1;
      clockRef.current = nextMode;
      setClockMode(nextMode);
    };
    document.addEventListener("visibilitychange", pauseInBackground);
    return () => document.removeEventListener("visibilitychange", pauseInBackground);
  }, []);

  function send(laneId: string) {
    if (disabled || reported.current) return;
    if (clockRef.current === "paused" || clockRef.current === "expired") return;
    if (clockRef.current === "running" && (document.hidden || Date.now() >= deadlineRef.current)) {
      freezeClock();
      return;
    }
    const before = stateRef.current;
    const card = activity.cards[before.cursor];
    if (!card) return;
    playSound("ui.press");
    const result = routeDispatch(activity, before, laneId);
    const lane = activity.lanes.find((item) => item.id === laneId);
    if (!result.accepted) {
      if (result.reason === "round-ended") return;
      wrongRoutes.current += 1;
      setRejected(true);
      setFeedback(
        result.reason === "cache-unavailable"
          ? card.cacheKey
            ? interfaceTranslator.t("play.extra.dispatch.cacheMiss")
            : interfaceTranslator.t("play.extra.dispatch.noCache", { why: card.why })
          : result.reason === "lane-not-allowed"
            ? interfaceTranslator.t("play.extra.dispatch.wrongLane", {
                lane: lane?.label ?? laneId,
                why: card.why,
              })
            : interfaceTranslator.t("play.extra.dispatch.invalidLane"),
      );
      return;
    }

    stateRef.current = result.state;
    setState(result.state);
    setRejected(false);
    setFeedback(
      [
        interfaceTranslator.t("play.extra.dispatch.delivered", {
          lane: lane?.label ?? laneId,
          cost: result.delivery.cost,
        }),
        result.delivery.cacheHit
          ? interfaceTranslator.t("play.extra.dispatch.usedCache")
          : result.delivery.warmed
            ? interfaceTranslator.t("play.extra.dispatch.createdCache")
            : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (result.status === "active") return;

    freezeClock();
    reported.current = true;
    const passed = result.status === "completed";
    onAttempt(
      passed,
      {
        served: result.state.cursor,
        total: activity.cards.length,
        spent: result.state.spent,
        budget: activity.budget,
        deliveries: result.state.deliveries,
        warmedCacheKeys: result.state.warmedCacheKeys,
        wrongRoutes: wrongRoutes.current,
        timed: timedEver.current,
        timeouts: timeouts.current,
        remainingSeconds: Math.ceil(remainingRef.current / 1_000),
      },
      passed
        ? interfaceTranslator.t("play.extra.dispatch.success", {
            count: result.state.cursor,
            spent: result.state.spent,
            budget: activity.budget,
            hits: result.state.deliveries.filter((delivery) => delivery.cacheHit).length,
          })
        : interfaceTranslator.t("play.extra.dispatch.overBudget", {
            spent: result.state.spent,
            budget: activity.budget,
          }),
    );
  }

  return (
    <div className="play-dispatch">
      {guided && !terminal ? (
        <PlayGuide
          title={interfaceTranslator.t(
            state.cursor ? "play.usability.dispatch.next" : "play.usability.dispatch.first",
          )}
        />
      ) : null}

      {waiting && !terminal ? (
        <div className="play-dispatch__pause" role="status">
          <p>
            {interfaceTranslator.t(
              clockMode === "expired"
                ? "play.extra.dispatch.expired"
                : "play.extra.dispatch.paused",
            )}
          </p>
          <div>
            {clockMode === "paused" ? (
              <GameButton variant="primary" sound={false} disabled={disabled} onClick={startClock}>
                {interfaceTranslator.t("play.extra.dispatch.resume")}
              </GameButton>
            ) : (
              <GameButton
                variant="primary"
                sound={false}
                disabled={disabled}
                onClick={useUntimedPractice}
              >
                {interfaceTranslator.t("play.extra.dispatch.continuePractice")}
              </GameButton>
            )}
            {clockMode === "expired" ? (
              <GameButton
                variant="secondary"
                sound={false}
                disabled={disabled}
                onClick={restartTimed}
              >
                {interfaceTranslator.t("play.extra.dispatch.retryTimed")}
              </GameButton>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="play-dispatch__board">
        <section className="play-dispatch__request" data-terminal={terminal}>
          {terminal ? (
            <div className="play-dispatch__terminal">
              <span aria-hidden="true">{status === "completed" ? "✓" : "!"}</span>
              <h4>
                {interfaceTranslator.t(
                  status === "completed"
                    ? "play.extra.dispatch.completeTitle"
                    : "play.extra.dispatch.overBudgetTitle",
                )}
              </h4>
            </div>
          ) : current ? (
            <>
              <div className="play-dispatch__request-heading" aria-live="polite" aria-atomic="true">
                <span className="play-dispatch__request-number">
                  {interfaceTranslator.t("play.extra.dispatch.requestNumber", {
                    number: state.cursor + 1,
                    total: activity.cards.length,
                  })}
                </span>
                <h4>{current.label}</h4>
                <p>{current.detail}</p>
              </div>
              <p className="play-dispatch__cache-notice" data-warm={cacheReady}>
                {interfaceTranslator.t(
                  !current.cacheKey
                    ? "play.extra.dispatch.fresh"
                    : cacheReady
                      ? "play.extra.dispatch.warm"
                      : "play.extra.dispatch.cold",
                )}
              </p>
            </>
          ) : null}
        </section>
      </div>

      <div
        className="play-dispatch__routing"
        role="group"
        aria-label={interfaceTranslator.t("play.extra.dispatch.sendTo")}
      >
        <h4>{interfaceTranslator.t("play.extra.dispatch.sendTo")}</h4>
        <div className="play-dispatch__lanes">
          {activity.lanes.map((lane) => {
            const isCache = lane.id === activity.cacheLaneId;
            return (
              <GameButton
                key={lane.id}
                variant={isCache && cacheReady ? "primary" : "secondary"}
                sound={false}
                static
                disabled={disabled || terminal || waiting || (guided && isCache && !cacheReady)}
                onClick={() => send(lane.id)}
                className="play-dispatch__lane"
                data-cache-ready={isCache && cacheReady}
                aria-describedby={feedbackId}
              >
                <span className="play-dispatch__lane-heading">
                  <strong>{lane.label}</strong>
                  <span>
                    {interfaceTranslator.t("play.extra.dispatch.laneCost", { cost: lane.cost })}
                  </span>
                </span>
                <span className="play-dispatch__lane-note">{lane.note}</span>
                {isCache && current ? (
                  <span className="play-dispatch__lane-status">
                    {interfaceTranslator.t(
                      !current.cacheKey
                        ? "play.extra.dispatch.cacheForbidden"
                        : cacheReady
                          ? "play.extra.dispatch.cacheReady"
                          : "play.extra.dispatch.cacheUnavailable",
                    )}
                  </span>
                ) : null}
              </GameButton>
            );
          })}
        </div>
      </div>

      <p
        id={feedbackId}
        className="play-dispatch__feedback"
        data-rejected={rejected}
        role="status"
        aria-atomic="true"
      >
        {feedback || interfaceTranslator.t("play.extra.dispatch.historyEmpty")}
      </p>

      <details className="play-dispatch__cache" open={guided ? undefined : true}>
        <summary>{interfaceTranslator.t("play.extra.dispatch.cacheRack")}</summary>
        {state.warmedCacheKeys.length === 0 ? (
          <p>{interfaceTranslator.t("play.extra.dispatch.cacheEmpty")}</p>
        ) : (
          <ul>
            {state.warmedCacheKeys.map((key) => (
              <li key={key} data-current={current?.cacheKey === key}>
                <span aria-hidden="true">✓</span>
                <span>
                  {activity.cards.find((card) => card.cacheKey === key)?.label}
                  <small>{key}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
      <div className="play-dispatch__meters">
        <div>
          <span>{interfaceTranslator.t("play.extra.dispatch.served")}</span>
          <strong>
            {interfaceTranslator.number(state.cursor)} /{" "}
            {interfaceTranslator.number(activity.cards.length)}
          </strong>
          {/*
            The kit's bar, not the browser's. A bare <progress> is styled by
            the platform, which means it is the one element on the board that
            does not belong to the brand — and the kit's own bar carries the
            liquid level for free, which is the form that exists for exactly
            this: a quantity rising and holding.
          */}
          <GameProgress
            label={interfaceTranslator.t("play.extra.dispatch.progress")}
            max={activity.cards.length}
            value={state.cursor}
          />
        </div>
        <div data-over-budget={state.spent > activity.budget}>
          <span>{interfaceTranslator.t("play.extra.dispatch.cost")}</span>
          <strong>
            {interfaceTranslator.t("play.extra.dispatch.costValue", {
              cost: state.spent,
              budget: activity.budget,
            })}
          </strong>
          <GameProgress
            label={interfaceTranslator.t("play.extra.dispatch.costProgress")}
            max={Math.max(1, activity.budget)}
            tone={state.spent > activity.budget ? "danger" : "accent"}
            value={Math.min(state.spent, activity.budget)}
          />
        </div>
      </div>
      {!terminal && activity.cards[state.cursor + 1] ? (
        <div className="play-dispatch__next">
          <span>{interfaceTranslator.t("play.extra.dispatch.upNext")}</span>
          <span>
            {activity.cards
              .slice(state.cursor + 1, state.cursor + 3)
              .map((card) => card.label)
              .join(" · ")}
          </span>
        </div>
      ) : null}

      {state.deliveries.length > 0 ? (
        <section className="play-dispatch__history">
          <h4>{interfaceTranslator.t("play.extra.dispatch.history")}</h4>
          <ol>
            {state.deliveries.map((delivery, index) => (
              <li key={delivery.cardId} data-cache-hit={delivery.cacheHit}>
                <span className="play-dispatch__history-index">
                  {interfaceTranslator.number(index + 1)}
                </span>
                <span>{activity.cards.find((card) => card.id === delivery.cardId)?.label}</span>
                <span className="play-dispatch__history-lane">
                  {activity.lanes.find((lane) => lane.id === delivery.laneId)?.label}
                </span>
                <strong>
                  {interfaceTranslator.t("play.extra.dispatch.laneCost", { cost: delivery.cost })}
                </strong>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <details className="play-dispatch__optional-clock" open={guided ? undefined : true}>
        <summary>{interfaceTranslator.t("play.usability.dispatch.options")}</summary>
        <div className="play-dispatch__clock">
          <GameToggle
            checked={clockMode !== "untimed"}
            disabled={disabled || terminal}
            label={interfaceTranslator.t("play.extra.dispatch.timed")}
            onClick={() => {
              if (clockRef.current === "untimed") {
                if (remainingRef.current <= 0) {
                  remainingRef.current = activity.seconds * 1_000;
                  setRemainingMs(remainingRef.current);
                }
                startClock();
              } else {
                useUntimedPractice();
              }
            }}
          />
          <span className="play-dispatch__clock-time" role="timer">
            {clockMode === "untimed"
              ? interfaceTranslator.t("play.extra.dispatch.untimed")
              : interfaceTranslator.t("play.extra.dispatch.timeLeft", {
                  seconds: Math.ceil(remainingMs / 1_000),
                })}
          </span>
          {clockMode === "running" && !terminal ? (
            <GameButton
              variant="ghost"
              sound={false}
              disabled={disabled}
              onClick={() => {
                freezeClock();
                playSound("ui.press");
              }}
            >
              {interfaceTranslator.t("play.extra.dispatch.pause")}
            </GameButton>
          ) : null}
          <p>{interfaceTranslator.t("play.extra.dispatch.timerHelp")}</p>
        </div>
      </details>
    </div>
  );
}
