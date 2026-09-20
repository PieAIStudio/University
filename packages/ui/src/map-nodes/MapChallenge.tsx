import { useEffect, useMemo, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  challengeBoards,
  challengeDeck,
  fingerprint,
  isChallengePair,
  type ChallengeCard,
  type LessonRef,
} from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import { playSound } from "../sound/index.js";
import { useSessionDraft } from "./use-session-draft.js";

interface Session {
  stage: "intro" | "playing" | "finished";
  order: string[];
  answerOrder: string[];
  board: number;
  matched: string[];
  attempts: number;
  elapsed: number;
  timed: boolean;
}

export function MapChallenge({
  cards,
  locator,
  accountScope,
  onClose,
  onPlayed,
}: {
  cards: readonly ChallengeCard[];
  locator: LessonRef;
  accountScope: string;
  onClose: () => void;
  onPlayed?: (cardIds: readonly string[]) => void;
}) {
  const { t } = useI18n();
  // Content identity does not depend on the order the loader resolves cards.
  const identity = fingerprint(JSON.stringify([...cards].sort((a, b) => a.id.localeCompare(b.id))));
  const validIds = new Set(cards.map((card) => card.id));
  const initial: Session = {
    stage: "intro",
    order: [],
    answerOrder: [],
    board: 0,
    matched: [],
    attempts: 0,
    elapsed: 0,
    timed: true,
  };
  const { state, update, ref, persistence } = useSessionDraft<Session>({
    accountScope,
    locator,
    key: `challenge:${identity}`,
    initial,
    restore: (value) => {
      if (!value || typeof value !== "object") return null;
      const v = value as Session;
      if (
        !["intro", "playing", "finished"].includes(v.stage) ||
        !Array.isArray(v.order) ||
        !Array.isArray(v.matched) ||
        !v.order.every((id) => validIds.has(id)) ||
        new Set(v.order).size !== v.order.length ||
        !v.matched.every((id) => v.order.includes(id)) ||
        new Set(v.matched).size !== v.matched.length ||
        !Number.isInteger(v.board) ||
        v.board < 0 ||
        !Number.isInteger(v.attempts) ||
        v.attempts < 0 ||
        !Number.isFinite(v.elapsed) ||
        v.elapsed < 0 ||
        v.elapsed > 180000 ||
        typeof v.timed !== "boolean"
      )
        return null;
      if (
        v.stage !== "intro" &&
        (v.order.length < 2 ||
          v.board >=
            challengeBoards(v.order.map((id) => cards.find((card) => card.id === id)!)).length)
      )
        return null;
      const answerOrder = v.answerOrder ?? [...v.order].reverse();
      if (
        !Array.isArray(answerOrder) ||
        answerOrder.length !== v.order.length ||
        new Set(answerOrder).size !== answerOrder.length ||
        !answerOrder.every((id) => v.order.includes(id))
      )
        return null;
      return { ...v, answerOrder };
    },
  });
  const [paused, setPaused] = useState(state.stage === "playing");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ right: boolean; card?: ChallengeCard } | null>(null);
  const deck = useMemo(
    () => state.order.map((id) => cards.find((card) => card.id === id)!).filter(Boolean),
    [cards, state.order],
  );
  const boards = useMemo(() => challengeBoards(deck), [deck]);
  const board = boards[state.board] ?? [];
  const answers = useMemo(
    () =>
      state.answerOrder.flatMap((id) => {
        const card = board.find((item) => item.id === id);
        return card ? [card] : [];
      }),
    [board, state.answerOrder],
  );
  const done = board.length > 0 && board.every((card) => state.matched.includes(card.id));
  const expired = state.timed && state.elapsed >= 180000;

  useEffect(() => {
    const hide = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => {
    if (state.stage !== "playing" || paused || !state.timed || expired) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      if (!document.hidden)
        update((current) => ({
          ...current,
          elapsed: Math.min(180000, current.elapsed + now - last),
        }));
      last = now;
    }, 500);
    return () => clearInterval(timer);
  }, [state.stage, state.timed, paused, expired, update]);

  function start() {
    const order = challengeDeck(cards).map((card) => card.id);
    const answerOrder = challengeDeck(cards).map((card) => card.id);
    update({ ...initial, timed: state.timed, stage: "playing", order, answerOrder });
    setPaused(false);
    setSelected(null);
    setSelectedAnswer(null);
    setFeedback(null);
  }
  function finish() {
    if (ref.current.stage === "finished") return;
    onPlayed?.(ref.current.matched);
    update((current) => ({ ...current, stage: "finished" }));
  }
  function match(from: string, to: string) {
    if (
      paused ||
      expired ||
      state.stage !== "playing" ||
      state.matched.includes(from) ||
      state.matched.includes(to)
    )
      return;
    const right = isChallengePair(board, from, to);
    const card = board.find((item) => item.id === from);
    update((current) => ({
      ...current,
      attempts: current.attempts + 1,
      matched: right ? [...current.matched, from] : current.matched,
    }));
    setSelected(null);
    setSelectedAnswer(null);
    setFeedback({ right, ...(right && card ? { card } : {}) });
    playSound(right ? "answer.correct" : "answer.wrong");
  }
  const seconds = Math.max(0, Math.ceil((180000 - state.elapsed) / 1000));
  return (
    <section className="map-node-flow" data-map-node-flow="challenge">
      <h3>{t("mapNodes.game.title")}</h3>
      {state.stage === "intro" ? (
        <>
          <p>{t("mapNodes.game.intro")}</p>
          {cards.length < 2 ? (
            <p>{t("mapNodes.game.empty")}</p>
          ) : (
            <>
              <p className="map-node__note">
                {t("mapNodes.game.available", { count: cards.length })}
              </p>
              <div className="map-node__actions">
                <GameButton
                  variant={state.timed ? "primary" : "secondary"}
                  aria-pressed={state.timed}
                  onClick={() => update({ ...state, timed: true })}
                >
                  {t("mapNodes.game.timed")}
                </GameButton>
                <GameButton
                  variant={!state.timed ? "primary" : "secondary"}
                  aria-pressed={!state.timed}
                  onClick={() => update({ ...state, timed: false })}
                >
                  {t("mapNodes.game.untimed")}
                </GameButton>
              </div>
              <GameButton onClick={start}>{t("mapNodes.game.start")}</GameButton>
            </>
          )}
        </>
      ) : state.stage === "finished" ? (
        <>
          <h4>{t("mapNodes.game.done")}</h4>
          <p>
            {t("mapNodes.game.summary", {
              matched: state.matched.length,
              attempts: state.attempts,
            })}
          </p>
          <p className="map-node__note">{t("mapNodes.game.notProof")}</p>
          <div className="map-node__actions">
            <GameButton onClick={onClose}>{t("mapNodes.return")}</GameButton>
            <GameButton variant="ghost" onClick={() => update(initial)}>
              {t("mapNodes.game.replay")}
            </GameButton>
          </div>
        </>
      ) : (
        <>
          <div className="map-node__game-hud">
            <span>
              {t("mapNodes.game.round", { current: state.board + 1, total: boards.length })}
            </span>
            <strong>{t("mapNodes.game.score", { count: state.matched.length })}</strong>
            {state.timed ? (
              <span role="timer" aria-live="off">
                {t("mapNodes.game.time", {
                  time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
                })}
              </span>
            ) : null}
            <GameButton variant="ghost" onClick={() => setPaused((value) => !value)}>
              {t(paused ? "mapNodes.game.resume" : "mapNodes.game.pause")}
            </GameButton>
          </div>
          {paused ? (
            <p role="status">{t("mapNodes.game.paused")}</p>
          ) : expired ? (
            <div role="status">
              <p>{t("mapNodes.game.expired")}</p>
              <GameButton onClick={finish}>{t("mapNodes.game.finish")}</GameButton>
              <GameButton variant="ghost" onClick={() => update({ ...state, timed: false })}>
                {t("mapNodes.game.continueUntimed")}
              </GameButton>
            </div>
          ) : (
            <>
              <p className="map-node__note">{t("mapNodes.game.pick")}</p>
              <div className="map-match-board">
                <div>
                  {board.map((card) => (
                    <GameButton
                      key={card.id}
                      className="map-match-card"
                      variant={selected === card.id ? "primary" : "secondary"}
                      aria-pressed={selected === card.id}
                      disabled={state.matched.includes(card.id)}
                      data-match-front={card.id}
                      onClick={() => {
                        if (selectedAnswer) match(card.id, selectedAnswer);
                        else {
                          setSelected(selected === card.id ? null : card.id);
                          setFeedback(null);
                        }
                      }}
                    >
                      {state.matched.includes(card.id) ? "✓ " : ""}
                      {card.front}
                    </GameButton>
                  ))}
                </div>
                <div>
                  {answers.map((card) => (
                    <GameButton
                      key={card.id}
                      className="map-match-card"
                      variant={selectedAnswer === card.id ? "primary" : "secondary"}
                      aria-pressed={selectedAnswer === card.id}
                      disabled={state.matched.includes(card.id)}
                      data-match-back={card.id}
                      onClick={() => {
                        if (selected) match(selected, card.id);
                        else {
                          setSelectedAnswer(selectedAnswer === card.id ? null : card.id);
                          setFeedback(null);
                        }
                      }}
                    >
                      {state.matched.includes(card.id) ? "✓ " : ""}
                      {card.back}
                    </GameButton>
                  ))}
                </div>
              </div>
              {feedback ? (
                <p
                  className={feedback.right ? "map-node__feedback is-right" : "map-node__feedback"}
                  role="status"
                >
                  {feedback.right
                    ? t("mapNodes.game.right", { lesson: feedback.card?.lessonTitle ?? "" })
                    : t("mapNodes.game.miss")}
                </p>
              ) : null}
              {done ? (
                <GameButton
                  onClick={() => {
                    if (state.board + 1 === boards.length) finish();
                    else {
                      update({ ...state, board: state.board + 1 });
                      setSelected(null);
                      setSelectedAnswer(null);
                      setFeedback(null);
                    }
                  }}
                >
                  {t(
                    state.board + 1 === boards.length
                      ? "mapNodes.game.finish"
                      : "mapNodes.game.next",
                  )}
                </GameButton>
              ) : null}
            </>
          )}
        </>
      )}
      {persistence === "failed" || persistence === "unavailable" ? (
        <p role="status">{t("mapNodes.draftFailed")}</p>
      ) : null}
    </section>
  );
}
