import type {
  RoundGame,
  RoundGameState,
  RoundNotice,
  RoundSource,
  UpgradeId,
} from "@pieai/university-world/game-kit.js";
import { MAX_HEARTS } from "@pieai/university-world/game-kit.js";
import { GameButton, GameToggle } from "@pieai/swimmer-ui-kit";
import {
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
  type BriefingBin,
  type ResultLine,
} from "@pieai/university-ui/game-frame/index.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { playSound } from "@pieai/university-ui/sound/index.js";
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { FirstUseGuide, useFirstUse, type GuideStep } from "../guide/FirstUseGuide.js";

/**
 * Everything an island game's assembly shares (ADR-0011, assembly layer):
 * pausing when the learner looks away, the camera's room below the question,
 * the intro, briefing, upgrade, pause and result panels, hearts and score,
 * verdict sound and the verdict's reading time. A game supplies its scene,
 * its answer controls, and how its items read in words.
 */
type AnyRoundGame = RoundGame<
  RoundSource,
  { readonly id: number; readonly kind: string },
  RoundGameState<RoundSource, { readonly id: number; readonly kind: string }>,
  // The shell only sends the shared actions; each game sends its own.
  never
>;

export interface RoundGameCopy {
  readonly title: string;
  /** One line: what the game is. The rules are shown, not written (first-use guide). */
  readonly intro: string;
  readonly calm: string;
}

export interface SceneSlot {
  /** Time stands still: paused, hidden, a panel, or a first-use guide speaking. */
  readonly frozen: boolean;
  /** Input is refused. A guide stops time but not the learner's hands. */
  readonly blocked: boolean;
  readonly booting: boolean;
  readonly hud: { readonly top: number; readonly bottom: number };
  readonly onReady: () => void;
  readonly onFailure: () => void;
}

export interface RoundGameShellProps<G extends AnyRoundGame> {
  readonly session: G;
  /** Prefix for test ids and the dev-only read hook: `game-${name}`, `window.__${name}`. */
  readonly name: string;
  readonly copy: RoundGameCopy;
  /** The 3D scene; the shell keys it so a retry after a lost context mounts a fresh one. */
  readonly scene: (slot: SceneSlot) => ReactNode;
  /** The answer row under the stage while a round is on. */
  readonly actions?: (playing: boolean) => ReactNode;
  /**
   * The first-use walk, once the first round is on screen (Owner 2026-09-30:
   * 涟 shows the way instead of a screen of rules). Targets are `data-guide`
   * elements in the frame: `question`, `stage`, `answers`, `pad`, or the game's own.
   */
  readonly guide?: readonly GuideStep[];
  /** Chips beside the round counter: a clock, a sentence so far. */
  readonly chips?: ReactNode;
  /** Under the question while playing, when the game has more to say. */
  readonly bannerExtra?: ReactNode;
  readonly briefing: (round: RoundSource) => { bins?: readonly BriefingBin[]; note?: string };
  /** One line of the review sheet per logged item. */
  readonly resultLine: (
    round: RoundSource,
    itemId: string,
  ) => Omit<ResultLine, "key" | "outcome" | "lessonId" | "lessonTitle"> | null;
  /** The notice's reason, with whatever the item's words say it is about. */
  readonly noticeReason: (notice: RoundNotice) => string;
  /** Read aloud when nothing else is: the newest mover. */
  readonly idleLive?: string;
  /** Game keys while playing; return true when handled. */
  readonly onKey?: (event: KeyboardEvent<HTMLDivElement>) => boolean;
  readonly onClose?: () => void;
  readonly onOpenLesson?: (lessonId: string) => void;
  readonly onUnavailable?: () => void;
  readonly onPlain?: () => void;
  /** A genuine completed run; the host, not the renderer, owns rewards. */
  readonly onWon?: () => void;
  readonly onAgain: () => void;
}

export function RoundGameShell<G extends AnyRoundGame>(props: RoundGameShellProps<G>) {
  const { session, name, copy } = props;
  const { t } = useI18n();
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [onScreen, setOnScreen] = useState(true);
  const [calm, setCalm] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const banner = useRef<HTMLDivElement>(null);
  const [hudTop, setHudTop] = useState(96);
  const running = s.phase === "countdown" || s.phase === "playing";
  const firstUse = useFirstUse(props.guide ? `game:${name}` : null);
  const [replay, setReplay] = useState(false);
  const [guiding, setGuiding] = useState(false);
  const guided = useRef(false);
  const blocked = paused || !visible || !onScreen || failed || !ready || !running;
  const frozen = blocked || guiding;
  // The walk starts once, the first time a round is actually on screen.
  useEffect(() => {
    if (s.phase !== "playing" || guided.current || !props.guide) return;
    if (!firstUse.needed && !replay) return;
    guided.current = true;
    setGuiding(true);
  }, [s.phase, firstUse.needed, replay, props.guide]);

  useLayoutEffect(() => session.setSuspended(frozen), [session, frozen]);

  const reportedWin = useRef<G | null>(null);
  useEffect(() => {
    if (s.phase !== "won" || reportedWin.current === session) return;
    reportedWin.current = session;
    props.onWon?.();
  }, [s.phase, session, props.onWon]);

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
    const key = `__${name}`;
    Reflect.set(window, key, read);
    return () => {
      if (Reflect.get(window, key) === read) Reflect.deleteProperty(window, key);
    };
  }, [session, name]);

  // Sound follows the verdicts, once each.
  useEffect(() => {
    const notice = s.notice;
    if (!notice) return;
    playSound(
      notice.kind === "right" || notice.kind === "corrected" ? "answer.correct" : "answer.wrong",
    );
  }, [s.notice?.id]);

  // A verdict stays up long enough to read its reason, then clears.
  const [shownNotice, setShownNotice] = useState<RoundNotice | null>(null);
  useEffect(() => {
    if (!s.notice) return;
    setShownNotice(s.notice);
    const reading = s.notice.kind === "right" ? 1100 : 2600;
    const timer = window.setTimeout(() => setShownNotice(null), reading);
    return () => window.clearTimeout(timer);
  }, [s.notice?.id]);

  const round = s.rounds[s.roundIndex] ?? null;
  const live = shownNotice
    ? `${t(`gameKit.notice.${shownNotice.kind}`, { points: shownNotice.points })} ${shownNotice.kind === "right" ? "" : props.noticeReason(shownNotice)}`
    : (props.idleLive ?? "");

  const upgradeText: Record<UpgradeId, [string, string]> = {
    heart: [t("gameKit.upgrade.heart"), t("gameKit.upgrade.heartNote")],
    slow: [t("gameKit.upgrade.slow"), t("gameKit.upgrade.slowNote")],
    shield: [t("gameKit.upgrade.shield"), t("gameKit.upgrade.shieldNote")],
    bonus: [t("gameKit.upgrade.bonus"), t("gameKit.upgrade.bonusNote")],
  };

  const lessons = [...new Set(s.rounds.filter((r) => !r.review).map((r) => r.round.lessonTitle))];
  const resultLines: ResultLine[] = s.log.flatMap((entry) => {
    const source = session.roundOf(entry.roundId);
    const line = source && props.resultLine(source, entry.itemId);
    if (!source || !line) return [];
    return [
      {
        ...line,
        key: `${entry.roundId}/${entry.itemId}`,
        outcome: entry.outcome,
        lessonId: source.lessonId,
        lessonTitle: source.lessonTitle,
      },
    ];
  });

  const mainIndex = s.rounds.slice(0, s.roundIndex + 1).filter((r) => !r.review).length;
  const roundChip = round
    ? round.review
      ? t("gameKit.reviewRound")
      : t("gameKit.round", { current: mainIndex, total: s.mainRounds })
    : null;
  const briefing = round && s.phase === "briefing" ? props.briefing(round.round) : null;

  const panel = failed ? (
    <div data-testid="game-unavailable">
      <p>{t("gameKit.unavailable")}</p>
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
          {t("gameKit.retry")}
        </GameButton>
        {props.onUnavailable ? (
          <GameButton static sound={false} variant="secondary" onClick={props.onUnavailable}>
            {t("mapNodes.game.title")}
          </GameButton>
        ) : null}
      </PanelActions>
    </div>
  ) : !ready ? (
    <p role="status">{t("arcade3d.loading")}</p>
  ) : s.phase === "intro" ? (
    <div data-testid="game-intro">
      <h3>{copy.title}</h3>
      <p>{copy.intro}</p>
      <p className="game-frame__source">{t("gameKit.sources", { lessons: lessons.join("、") })}</p>
      <GameToggle checked={calm} label={copy.calm} onClick={() => setCalm((on) => !on)} />
      <PanelActions>
        <GameButton
          static
          sound={false}
          onClick={() => session.act({ type: "start", calm })}
          data-testid="game-start"
        >
          {t("gameKit.start")}
        </GameButton>
        {props.onPlain ? (
          <GameButton
            static
            sound={false}
            variant="ghost"
            onClick={props.onPlain}
            data-testid="game-plain"
          >
            {t("gameKit.plain")}
          </GameButton>
        ) : null}
        {props.guide && !firstUse.needed ? (
          <GameButton
            static
            sound={false}
            variant="ghost"
            aria-pressed={replay}
            onClick={() => setReplay((on) => !on)}
            data-testid="game-howto"
          >
            {t(replay ? "guide.replayOn" : "guide.replay")}
          </GameButton>
        ) : null}
      </PanelActions>
    </div>
  ) : briefing && round ? (
    <BriefingPanel
      eyebrow={roundChip ?? ""}
      question={round.round.question}
      {...(briefing.note ? { note: briefing.note } : {})}
      {...(briefing.bins ? { bins: briefing.bins } : {})}
      source={t("gameKit.fromLesson", { lesson: round.round.lessonTitle })}
      onReady={() => session.act({ type: "ready" })}
    />
  ) : s.phase === "upgrade" ? (
    <UpgradePanel
      title={t("gameKit.upgrade.title")}
      options={s.offered.map((id) => ({ id, title: upgradeText[id][0], note: upgradeText[id][1] }))}
      onChoose={(id) => session.act({ type: "upgrade", id: id as UpgradeId })}
    />
  ) : s.phase === "won" || s.phase === "lost" ? (
    <ResultPanel
      won={s.phase === "won"}
      score={s.run.score}
      best={s.run.best}
      lines={resultLines}
      onAgain={props.onAgain}
      {...(props.onOpenLesson ? { onOpenLesson: props.onOpenLesson } : {})}
      {...(props.onClose ? { onClose: props.onClose } : {})}
    />
  ) : paused ? (
    <PausePanel
      onResume={() => setPaused(false)}
      {...(props.onClose ? { onQuit: props.onClose } : {})}
    />
  ) : null;

  return (
    <div
      ref={frame}
      className={`round-game round-game--${name}`}
      data-testid={`${name}-game`}
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
        if (s.phase === "playing" && !blocked && props.onKey?.(event)) event.preventDefault();
      }}
    >
      <GameFrame
        label={copy.title}
        phase={s.phase}
        stage={
          failed ? null : (
            <Fragment key={epoch}>
              {props.scene({
                frozen,
                blocked,
                booting: !ready,
                hud: { top: hudTop, bottom: 4 },
                onReady: () => setReady(true),
                onFailure: () => {
                  setFailed(true);
                  setReady(false);
                },
              })}
            </Fragment>
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
              {roundChip ? <span className="game-frame__chip">{roundChip}</span> : null}
              {running ? props.chips : null}
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
            <div ref={banner}>
              <p className="game-frame__question" data-testid="game-question" data-guide="question">
                {round.round.question}
              </p>
              {running ? props.bannerExtra : null}
            </div>
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
              {...(shownNotice.kind === "right" ? {} : { reason: props.noticeReason(shownNotice) })}
            />
          ) : null
        }
        overlay={
          s.phase === "countdown" ? <Countdown value={Math.max(1, Math.ceil(s.countdown))} /> : null
        }
        panel={panel}
        actions={
          props.actions && round && s.phase !== "intro"
            ? props.actions(s.phase === "playing" && !blocked)
            : null
        }
        live={live}
      />
      {guiding && props.guide ? (
        <FirstUseGuide
          id={`game:${name}`}
          steps={props.guide}
          root={frame}
          onDone={() => {
            firstUse.finish();
            setReplay(false);
            setGuiding(false);
          }}
        />
      ) : null}
    </div>
  );
}
