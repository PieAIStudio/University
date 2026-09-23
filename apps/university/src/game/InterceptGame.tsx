import type { GameRound } from "@pieai/university-core";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import {
  InterceptScene,
  InterceptSession,
  MAX_HEARTS,
  type InterceptState,
  type UpgradeId,
} from "@pieai/university-world/game-kit.js";
import { GameButton, GameToggle } from "@pieai/swimmer-ui-kit";
import {
  AnswerButtons,
  BriefingPanel,
  ChipGroup,
  Countdown,
  GameFrame,
  GameNotice,
  HeartsMeter,
  PanelActions,
  PauseButton,
  PausePanel,
  ResultPanel,
  ScoreChip,
  UpgradePanel,
  type ResultLine,
} from "@pieai/university-ui/game-frame/index.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { playSound } from "@pieai/university-ui/sound/index.js";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * 庭院拦截, assembled (ADR-0011, assembly layer): content in, frame around,
 * scene inside, session underneath. The map's challenge node and the play lab
 * both render this; neither keeps a copy.
 */
export interface InterceptGameProps {
  readonly rounds: readonly GameRound[];
  readonly recipe?: AvatarRecipe | null;
  /** Leave the game (the node dialog closes). */
  readonly onClose?: () => void;
  readonly onOpenLesson?: (lessonId: string) => void;
  /** WebGL is not available: the host offers its 2D game instead. */
  readonly onUnavailable?: () => void;
  /** The host's 2D game, offered from the intro to anyone who prefers it. */
  readonly onPlain?: () => void;
}

export function InterceptGame(props: InterceptGameProps) {
  const [run, setRun] = useState(0);
  return (
    <InterceptRun key={run} {...props} seed={1 + run * 7919} onAgain={() => setRun((n) => n + 1)} />
  );
}

function InterceptRun({
  rounds,
  recipe,
  onClose,
  onOpenLesson,
  onUnavailable,
  onPlain,
  seed,
  onAgain,
}: InterceptGameProps & { seed: number; onAgain: () => void }) {
  const { t } = useI18n();
  const session = useMemo(() => new InterceptSession(rounds, seed), [rounds, seed]);
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [onScreen, setOnScreen] = useState(true);
  const [calm, setCalm] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const banner = useRef<HTMLParagraphElement>(null);
  const [hudTop, setHudTop] = useState(96);
  const running = s.phase === "countdown" || s.phase === "playing";
  const frozen = paused || !visible || !onScreen || failed || !ready || !running;

  useLayoutEffect(() => session.setSuspended(frozen), [session, frozen]);

  // Pause the moment the learner looks away; never catch up afterwards.
  useEffect(() => {
    const hidden = () => {
      setVisible(!document.hidden);
      if (document.hidden) setPaused(true);
    };
    const blur = () => {
      if (session.getState().phase === "playing") setPaused(true);
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", blur);
    return () => {
      session.setSuspended(true);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", blur);
    };
  }, [session]);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(Boolean(entry?.isIntersecting)),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // The camera fits the arena below the question banner, wherever it ends.
  useEffect(() => {
    const node = banner.current;
    const host = frame.current;
    if (!node || !host) return;
    const measure = () => {
      const top = node.getBoundingClientRect().bottom - host.getBoundingClientRect().top;
      if (top > 0) setHudTop(Math.round(top));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observer.observe(host);
    return () => observer.disconnect();
  }, [s.roundIndex, s.phase]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // Read-only diagnostics for browser checks: no setter, no answer, no win.
    const read = () => ({
      state: structuredClone(session.getState()),
      round: session.currentRound()?.round ?? null,
    });
    Reflect.set(window, "__intercept", read);
    return () => {
      if (Reflect.get(window, "__intercept") === read)
        Reflect.deleteProperty(window, "__intercept");
    };
  }, [session]);

  const round = s.rounds[s.roundIndex] ?? null;
  const bins = round?.round.bins ?? [];

  const act = session.act;
  const answer = useCallback(
    (binId: string) => {
      if (!frozen && session.getState().phase === "playing") act({ type: "throw", binId });
    },
    [act, frozen, session],
  );

  // Sound follows the verdicts, once each.
  useEffect(() => {
    const notice = s.notice;
    if (!notice) return;
    playSound(
      notice.kind === "right" || notice.kind === "corrected" ? "answer.correct" : "answer.wrong",
    );
  }, [s.notice?.id]);

  // A verdict stays up long enough to read its reason, then clears.
  const [shownNotice, setShownNotice] = useState<InterceptState["notice"]>(null);
  useEffect(() => {
    if (!s.notice) return;
    setShownNotice(s.notice);
    const reading = s.notice.kind === "right" ? 1100 : 2600;
    const timer = window.setTimeout(() => setShownNotice(null), reading);
    return () => window.clearTimeout(timer);
  }, [s.notice?.id]);

  const itemText = (itemId: string) =>
    round?.round.items.find((item) => item.id === itemId)?.text ?? "";
  const newestBoat = s.boats.filter((boat) => boat.state === "sailing").at(-1);
  const live = shownNotice
    ? `${t(`gameKit.notice.${shownNotice.kind}`, { points: shownNotice.points })} ${shownNotice.kind === "right" ? "" : shownNotice.reason}`
    : newestBoat
      ? t("intercept.newBoat", { text: itemText(newestBoat.itemId) })
      : "";

  const upgradeText: Record<UpgradeId, [string, string]> = {
    heart: [t("gameKit.upgrade.heart"), t("gameKit.upgrade.heartNote")],
    slow: [t("gameKit.upgrade.slow"), t("gameKit.upgrade.slowNote")],
    shield: [t("gameKit.upgrade.shield"), t("gameKit.upgrade.shieldNote")],
    bonus: [t("gameKit.upgrade.bonus"), t("gameKit.upgrade.bonusNote")],
  };

  const lessons = [...new Set(s.rounds.filter((r) => !r.review).map((r) => r.round.lessonTitle))];
  const resultLines: ResultLine[] = s.log.flatMap((entry) => {
    const source = session.roundOf(entry.roundId);
    const item = source?.items.find((candidate) => candidate.id === entry.itemId);
    if (!source || !item) return [];
    const binIndex = source.bins.findIndex((bin) => bin.id === item.binId);
    return [
      {
        key: `${entry.roundId}/${entry.itemId}`,
        text: item.text,
        bin: source.bins[binIndex]?.label ?? "",
        binIndex: Math.max(0, binIndex),
        why: item.why,
        outcome: entry.outcome,
        lessonId: source.lessonId,
        lessonTitle: source.lessonTitle,
      },
    ];
  });

  const mainIndex = s.rounds.slice(0, s.roundIndex + 1).filter((r) => !r.review).length;
  const panel = failed ? (
    <div data-testid="game-unavailable">
      <p>{t("intercept.unavailable")}</p>
      <PanelActions>
        <GameButton
          static
          sound={false}
          onClick={() => {
            setFailed(false);
            setReady(false);
            setEpoch((n) => n + 1);
          }}
        >
          {t("intercept.retry")}
        </GameButton>
        {onUnavailable ? (
          <GameButton static sound={false} variant="secondary" onClick={onUnavailable}>
            {t("mapNodes.game.title")}
          </GameButton>
        ) : null}
      </PanelActions>
    </div>
  ) : !ready ? (
    <p role="status">{t("arcade3d.loading")}</p>
  ) : s.phase === "intro" ? (
    <div data-testid="game-intro">
      <h3>{t("intercept.title")}</h3>
      <p>{t("intercept.intro")}</p>
      <p>{t("intercept.controls")}</p>
      <p className="game-frame__source">
        {t("intercept.sources", { lessons: lessons.join("、") })}
      </p>
      <GameToggle checked={calm} label={t("intercept.calm")} onClick={() => setCalm((on) => !on)} />
      <PanelActions>
        <GameButton
          static
          sound={false}
          onClick={() => act({ type: "start", calm })}
          data-testid="game-start"
        >
          {t("intercept.start")}
        </GameButton>
        {onPlain ? (
          <GameButton
            static
            sound={false}
            variant="ghost"
            onClick={onPlain}
            data-testid="game-plain"
          >
            {t("intercept.plain")}
          </GameButton>
        ) : null}
      </PanelActions>
    </div>
  ) : s.phase === "briefing" && round ? (
    <BriefingPanel
      eyebrow={
        round.review
          ? t("gameKit.reviewRound")
          : t("gameKit.round", { current: mainIndex, total: s.mainRounds })
      }
      question={round.round.question}
      bins={round.round.bins}
      source={t("gameKit.fromLesson", { lesson: round.round.lessonTitle })}
      onReady={() => act({ type: "ready" })}
    />
  ) : s.phase === "upgrade" ? (
    <UpgradePanel
      title={t("gameKit.upgrade.title")}
      options={s.offered.map((id) => ({ id, title: upgradeText[id][0], note: upgradeText[id][1] }))}
      onChoose={(id) => act({ type: "upgrade", id: id as UpgradeId })}
    />
  ) : s.phase === "won" || s.phase === "lost" ? (
    <ResultPanel
      won={s.phase === "won"}
      score={s.run.score}
      best={s.run.best}
      lines={resultLines}
      onAgain={onAgain}
      {...(onOpenLesson ? { onOpenLesson } : {})}
      {...(onClose ? { onClose } : {})}
    />
  ) : paused ? (
    <PausePanel onResume={() => setPaused(false)} {...(onClose ? { onQuit: onClose } : {})} />
  ) : null;

  return (
    <div
      ref={frame}
      className="intercept-game"
      data-testid="intercept-game"
      data-phase={s.phase}
      data-frozen={frozen}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        if (
          target.matches("input,textarea,select") ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        if (event.key === "Escape" && running) {
          event.preventDefault();
          setPaused(true);
          return;
        }
        const index = Number(event.key) - 1;
        if (Number.isInteger(index) && bins[index] && s.phase === "playing") {
          event.preventDefault();
          answer(bins[index].id);
        }
      }}
    >
      <GameFrame
        label={t("intercept.title")}
        phase={s.phase}
        stage={
          failed ? null : (
            <InterceptScene
              key={epoch}
              session={session}
              snapshot={s}
              recipe={recipe ?? null}
              frozen={frozen}
              booting={!ready}
              hud={{ top: hudTop, bottom: 4 }}
              describeBoat={(text, bin) =>
                bin ? t("intercept.boatRevealed", { text, bin }) : t("intercept.boat", { text })
              }
              onTarget={(boatId) => act({ type: "target", boatId })}
              onReady={() => setReady(true)}
              onFailure={() => {
                setFailed(true);
                setReady(false);
              }}
            />
          )
        }
        top={
          <>
            <ChipGroup>
              <HeartsMeter
                hearts={s.run.hearts}
                max={Math.max(3, Math.min(MAX_HEARTS, s.run.hearts))}
                shield={s.run.shield}
              />
              {round ? (
                <span className="game-frame__chip">
                  {round.review
                    ? t("gameKit.reviewRound")
                    : t("gameKit.round", { current: mainIndex, total: s.mainRounds })}
                </span>
              ) : null}
            </ChipGroup>
            <ChipGroup>
              <ScoreChip score={s.run.score} combo={s.run.combo} />
              {running ? (
                <PauseButton paused={paused} onToggle={() => setPaused((p) => !p)} />
              ) : null}
            </ChipGroup>
          </>
        }
        banner={
          round && (running || s.phase === "briefing") ? (
            <p ref={banner} className="game-frame__question" data-testid="game-question">
              {round.round.question}
            </p>
          ) : null
        }
        notice={
          shownNotice && running ? (
            <GameNotice
              tone={
                shownNotice.kind === "right" || shownNotice.kind === "corrected"
                  ? "success"
                  : shownNotice.kind === "shield"
                    ? "info"
                    : "danger"
              }
              title={t(`gameKit.notice.${shownNotice.kind}`, { points: shownNotice.points })}
              {...(shownNotice.kind === "right"
                ? {}
                : { reason: `「${itemText(shownNotice.itemId)}」${shownNotice.reason}` })}
            />
          ) : null
        }
        overlay={
          s.phase === "countdown" ? <Countdown value={Math.max(1, Math.ceil(s.countdown))} /> : null
        }
        panel={panel}
        actions={
          bins.length && s.phase !== "intro" ? (
            <AnswerButtons
              bins={bins}
              disabled={s.phase !== "playing" || frozen}
              onAnswer={answer}
            />
          ) : null
        }
        live={live}
      />
    </div>
  );
}
