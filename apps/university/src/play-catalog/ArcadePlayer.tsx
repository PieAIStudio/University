import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { GameButton, GamePanel } from "@pieai/swimmer-ui-kit";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { SoundToggle, playSound } from "@pieai/university-ui/sound/index.js";
import {
  ArcadeScene,
  ArcadeSession,
  ARCADE_SOURCES,
  SOURCE,
  CATEGORIES,
  word,
  type ArcadeAction,
  type ToyMode,
  type ToyLocale,
} from "@pieai/university-world/toy-play.js";
import "./arcade3d.css";

export function ArcadePlayer({
  mode,
  edition = "garden",
  displayMode,
}: {
  mode: ToyMode;
  edition?: "garden" | "purpose";
  displayMode?: "sky-invaders" | "factory-stack" | "press-words";
}) {
  const { locale: appLocale, t } = useI18n();
  const locale: ToyLocale = appLocale === "en" ? "en" : "zh-CN";
  const [round, setRound] = useState(0);
  const [slow, setSlow] = useState(false);
  const session = useMemo(
    () => new ArcadeSession(mode, 7103 + round * 31, slow ? 0.5 : 1),
    [mode, round, slow],
  );
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [visible, setVisible] = useState(() => !document.hidden);
  const board = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLDetailsElement>(null);
  const frozen = paused || !visible || !onScreen || sourceOpen || failed || !ready;
  const enabled = !frozen && s.phase === "playing";
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  const act = useCallback(
    (a: ArcadeAction) => {
      if (enabled) {
        session.act(a);
        if (a.type === "fit" || a.type === "drop") board.current?.focus({ preventScroll: true });
      }
    },
    [enabled, session],
  );
  useLayoutEffect(() => {
    session.setSuspended(frozen);
  }, [session, frozen]);
  useEffect(() => {
    const visibility = () => {
      setVisible(!document.hidden);
      if (document.hidden) {
        session.setSuspended(true);
        setPaused(true);
      }
    };
    const blur = () => {
      if (session.getState().phase === "playing") {
        session.setSuspended(true);
        setPaused(true);
      }
    };
    const release = () => {
      session.act({ type: "direction", value: 0 });
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      session.setSuspended(true);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [session]);
  useEffect(() => {
    if (!board.current) return;
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(Boolean(entry?.isIntersecting)),
    );
    observer.observe(board.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!s.notice.id || s.notice.kind === "none") return;
    playSound(
      s.notice.kind === "wrong" || s.notice.kind === "miss" ? "answer.wrong" : "answer.correct",
    );
  }, [s.notice.id]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // Read-only diagnostics: no setter, time travel, answer submission or win button.
    const get = () => structuredClone(session.getState());
    Reflect.set(window, "__arcade3d", get);
    return () => {
      if (Reflect.get(window, "__arcade3d") === get) Reflect.deleteProperty(window, "__arcade3d");
    };
  }, [session]);
  const focusBoard = () => {
    board.current?.scrollIntoView({ block: "center", behavior: "instant" });
    board.current?.focus({ preventScroll: true });
  };
  const start = () => {
    setPaused(false);
    setSourceOpen(false);
    session.act({ type: "start" });
    focusBoard();
  };
  const reset = () => {
    setRound((r) => r + 1);
    setPaused(false);
  };
  const original = `/play-lab/catalog?group=arcade&entry=arcade:${mode}&lang=${locale}`;
  const ended = s.phase === "won" || s.phase === "lost";
  return (
    <section
      className="arcade3d"
      data-testid="arcade3d"
      data-mode={mode}
      data-edition={edition}
      data-phase={s.phase}
      data-frozen={frozen}
      data-score={s.score}
      data-resolved={s.resolved}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        if (
          target.matches("input,textarea,select") ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        if (event.key === "Escape" && s.phase === "playing") {
          event.preventDefault();
          session.setSuspended(true);
          setPaused(true);
          return;
        }
        if (!enabled) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          const d = event.key === "ArrowLeft" ? -1 : 1;
          if (mode === "invaders") act({ type: "direction", value: d });
          if (mode === "stack")
            act({ type: "lane", index: Math.min(2, Math.max(0, session.getState().lane + d)) });
        }
        if (/^[1-6]$/.test(event.key)) {
          const index = Number(event.key) - 1;
          if (mode === "stack" && index < 3) {
            event.preventDefault();
            act({ type: "lane", index });
          }
          if (mode === "cloze-tetris" && s.bag[index] !== undefined) {
            event.preventDefault();
            act({ type: "word", index: s.bag[index]! });
          }
        }
        if (event.code === "Space" && mode === "stack" && !target.closest("button")) {
          event.preventDefault();
          act({ type: "drop" });
        }
      }}
      onKeyUp={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight")
          session.act({ type: "direction", value: 0 });
      }}
    >
      <div className="arcade3d__toolbar">
        <span>{t("arcade3d.preview")}</span>
        <div>
          <SoundToggle />
          <GameButton
            static
            sound={false}
            variant="secondary"
            disabled={s.phase !== "playing"}
            onClick={() => {
              if (!paused) session.setSuspended(true);
              setPaused((p) => !p);
            }}
          >
            {t(paused ? "arcade3d.resume" : "arcade3d.pause")}
          </GameButton>
          <GameButton static sound={false} variant="ghost" onClick={reset}>
            {t("arcade3d.restart")}
          </GameButton>
        </div>
      </div>
      <div className="arcade3d__hud">
        <b>{t("arcade3d.score", { score: s.score })}</b>
        <span>
          {mode === "invaders"
            ? t("arcade3d.wave", { wave: s.wave })
            : t("arcade3d.done", { count: s.resolved, total: s.goal })}
        </span>
        {mode === "invaders" ? (
          <span aria-label={t("arcade3d.hearts", { lives: s.lives })}>
            {"♥".repeat(s.lives)}
            {"♡".repeat(4 - s.lives)}
          </span>
        ) : (
          <span>{t("arcade3d.combo", { combo: s.combo })}</span>
        )}
      </div>
      <div
        className="arcade3d__viewport"
        ref={board}
        tabIndex={0}
        role="group"
        aria-label={t("arcade3d.board")}
        data-testid="arcade-board"
      >
        {!failed ? (
          <ArcadeScene
            edition={edition}
            key={epoch}
            session={session}
            snapshot={s}
            locale={locale}
            act={act}
            booting={!ready}
            frozen={frozen || s.phase !== "playing"}
            onReady={onReady}
            onFailure={onFailure}
          />
        ) : null}
        {mode === "invaders" && s.phase === "playing" ? (
          <div className="arcade3d__tool-strip" aria-hidden="true">
            <span>{word(CATEGORIES[0]!, locale)}</span>
            <span>{word(CATEGORIES[1]!, locale)}</span>
          </div>
        ) : null}
        {mode === "invaders" && s.wave % 5 === 0 && s.phase === "playing" ? (
          <div className="arcade3d__challenge">
            {t("arcade3d.challenge", { seconds: Math.max(0, Math.ceil(s.challengeLeft)) })}
          </div>
        ) : null}
        {failed ||
        !ready ||
        s.phase === "ready" ||
        paused ||
        sourceOpen ||
        s.phase === "upgrade" ||
        ended ? (
          <div className="arcade3d__overlay" data-testid="arcade-overlay">
            <GamePanel className="arcade3d__overlay-panel">
              {failed ? (
                <>
                  <p>{t("arcade3d.unavailable")}</p>
                  <GameButton
                    static
                    sound={false}
                    onClick={() => {
                      setReady(false);
                      setFailed(false);
                      setEpoch((e) => e + 1);
                    }}
                  >
                    {t("arcade3d.retry3d")}
                  </GameButton>
                  <p>
                    <a href={original}>{t("arcade3d.original")}</a>
                  </p>
                </>
              ) : !ready ? (
                <p role="status">{t("arcade3d.loading")}</p>
              ) : s.phase === "ready" ? (
                <>
                  <h3>{t(`arcade3d.${displayMode ?? mode}`)}</h3>
                  <p>{t(`arcade3d.how.${mode}`)}</p>
                  <label className="arcade3d__pace">
                    <input
                      type="checkbox"
                      checked={slow}
                      onChange={(e) => setSlow(e.target.checked)}
                    />
                    {t("arcade3d.calm")}
                  </label>
                  <GameButton static sound={false} onClick={start} data-testid="arcade-start">
                    {t("arcade3d.start")}
                  </GameButton>
                </>
              ) : ended ? (
                <>
                  <h3>{t(s.phase === "won" ? "arcade3d.win" : "arcade3d.lose")}</h3>
                  <strong className="arcade3d__final-score">{s.score}</strong>
                  <p>{t("arcade3d.result", { correct: s.correct, best: s.best })}</p>
                  <p>{t("arcade3d.boundary")}</p>
                  <GameButton static sound={false} onClick={reset}>
                    {t("arcade3d.restart")}
                  </GameButton>
                </>
              ) : s.phase === "upgrade" ? (
                <>
                  <h3>{t(s.challengeExpired ? "arcade3d.challengeEnd" : "arcade3d.stageClear")}</h3>
                  <div className="arcade3d__upgrades">
                    {(["rapid", "heart", "slow"] as const).map((choice) => (
                      <GameButton
                        key={choice}
                        static
                        sound={false}
                        variant="secondary"
                        onClick={() => {
                          session.act({ type: "upgrade", choice });
                          focusBoard();
                        }}
                        data-testid={`arcade-upgrade-${choice}`}
                      >
                        <b>{t(`arcade3d.${choice}`)}</b>
                        <span>{t(`arcade3d.${choice}Note`)}</span>
                      </GameButton>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3>{t("arcade3d.paused")}</h3>
                  <GameButton
                    static
                    sound={false}
                    onClick={() => {
                      setSourceOpen(false);
                      setPaused(false);
                      focusBoard();
                    }}
                  >
                    {t("arcade3d.resume")}
                  </GameButton>
                </>
              )}
            </GamePanel>
          </div>
        ) : null}
      </div>
      <div className="arcade3d__controls" role="group" aria-label={t("arcade3d.controls")}>
        {mode === "stack" ? (
          <>
            {CATEGORIES.map((c, i) => (
              <GameButton
                key={i}
                static
                sound={false}
                variant={s.lane === i ? "primary" : "secondary"}
                disabled={!enabled}
                aria-pressed={s.lane === i}
                onClick={() => act({ type: "lane", index: i })}
                data-testid={`arcade-lane-${i}`}
              >
                {i + 1} · {word(c, locale)}
              </GameButton>
            ))}
            <GameButton
              static
              sound={false}
              disabled={!enabled || !s.falling}
              onClick={() => act({ type: "drop" })}
              data-testid="arcade-drop"
            >
              {t("arcade3d.drop")}
            </GameButton>
          </>
        ) : mode === "invaders" ? (
          <>
            <GameButton
              static
              sound={false}
              variant="secondary"
              disabled={!enabled}
              onPointerDown={() => act({ type: "direction", value: -1 })}
              onClick={() => act({ type: "aim", x: -2.8 })}
            >
              {t("arcade3d.left")}
            </GameButton>
            <input
              type="range"
              min={-3.5}
              max={3.5}
              step={0.05}
              value={s.targetX}
              disabled={!enabled}
              aria-label={t("arcade3d.position")}
              onChange={(e) => act({ type: "aim", x: Number(e.target.value) })}
            />
            <GameButton
              static
              sound={false}
              variant="secondary"
              disabled={!enabled}
              onPointerDown={() => act({ type: "direction", value: 1 })}
              onClick={() => act({ type: "aim", x: 2.8 })}
            >
              {t("arcade3d.right")}
            </GameButton>
            <span>
              {t("arcade3d.tool", { tool: word(CATEGORIES[s.shipX < 0 ? 0 : 1]!, locale) })}
            </span>
          </>
        ) : (
          <span>{t("arcade3d.wordHint")}</span>
        )}
      </div>
      <div className="arcade3d__notice" role="status" data-kind={s.notice.kind}>
        {word(s.notice.text, locale)}
      </div>
      {ended && s.reviews.length ? (
        <GamePanel className="arcade3d__review">
          <h3>{t("arcade3d.review")}</h3>
          {s.reviews.map((r) => (
            <p key={r.key}>
              <b>{word(r.text, locale).replace("____", word(r.answer, locale))}</b>
              <br />
              {word(r.why, locale)}
              <small>{t(r.corrected ? "arcade3d.corrected" : "arcade3d.pending")}</small>
            </p>
          ))}
        </GamePanel>
      ) : null}
      <details
        className="arcade3d__sources"
        ref={source}
        open={sourceOpen}
        onToggle={(e) => {
          if (e.currentTarget.open) session.setSuspended(true);
          setSourceOpen(e.currentTarget.open);
        }}
      >
        <summary>{t("arcade3d.material")}</summary>
        <div className="arcade3d__source-layout">
          <figure>
            <img src={SOURCE.image} alt="Earthrise · NASA / Bill Anders" />
            <figcaption>{SOURCE.credit}</figcaption>
          </figure>
          <div>
            {ARCADE_SOURCES.filter((_, i) => mode === "cloze-tetris" || i === 0).map((r) => (
              <section key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.title}
                </a>
                <p>{word(r.text, locale)}</p>
              </section>
            ))}
            <p>{t("arcade3d.materialNote")}</p>
          </div>
        </div>
        <GameButton
          static
          sound={false}
          onClick={() => {
            setSourceOpen(false);
            focusBoard();
          }}
        >
          {t("arcade3d.backGame")}
        </GameButton>
      </details>
      <a className="arcade3d__original" href={original}>
        {t("arcade3d.original")}
      </a>
    </section>
  );
}
