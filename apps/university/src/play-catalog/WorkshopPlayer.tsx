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
  WorkshopSession,
  WorkshopScene,
  ARCADE_SOURCES,
  SOURCE,
  CLAIMS,
  word,
  type WorkshopMode,
  type WorkshopAction,
  type ToyLocale,
} from "@pieai/university-world/toy-play.js";
import "./arcade3d.css";
import "./workshop.css";

export function WorkshopPlayer({ mode }: { mode: WorkshopMode }) {
  const { t, locale: uiLocale } = useI18n();
  const locale: ToyLocale = uiLocale === "en" ? "en" : "zh-CN";
  const [round, setRound] = useState(0),
    [slow, setSlow] = useState(false);
  const session = useMemo(
    () => new WorkshopSession(mode, 391 + round * 13, slow ? 0.5 : 1),
    [mode, round, slow],
  );
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [epoch, setEpoch] = useState(0);
  const [paused, setPaused] = useState(false),
    [source, setSource] = useState(false),
    [visible, setVisible] = useState(!document.hidden),
    [onScreen, setOnScreen] = useState(true);
  const board = useRef<HTMLDivElement>(null);
  const frozen = !ready || failed || paused || source || !visible || !onScreen;
  const ended = s.phase === "won" || s.phase === "lost";
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => {
    setFailed(true);
    setReady(false);
    setPaused(true);
  }, []);
  const act = useCallback(
    (a: WorkshopAction) => {
      if (!frozen) session.act(a);
    },
    [frozen, session],
  );
  useLayoutEffect(() => {
    session.setSuspended(frozen);
  }, [session, frozen]);
  useEffect(() => {
    const hide = () => {
      setVisible(!document.hidden);
      if (document.hidden) {
        session.setSuspended(true);
        setPaused(true);
      }
    };
    const blur = () => {
      if (["playing", "running"].includes(session.getState().phase)) {
        session.setSuspended(true);
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", blur);
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(Boolean(entry?.isIntersecting)),
    );
    if (board.current) observer.observe(board.current);
    return () => {
      session.setSuspended(true);
      observer.disconnect();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", blur);
    };
  }, [session]);
  const previous = useRef({ correct: 0, mistakes: 0 });
  useEffect(() => {
    if (s.mistakes > previous.current.mistakes) playSound("answer.wrong");
    else if (s.correct > previous.current.correct) playSound("answer.correct");
    previous.current = { correct: s.correct, mistakes: s.mistakes };
  }, [s.correct, s.mistakes]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const read = () => structuredClone(session.getState());
    Reflect.set(window, "__workshop3d", read);
    return () => {
      if (Reflect.get(window, "__workshop3d") === read)
        Reflect.deleteProperty(window, "__workshop3d");
    };
  }, [session]);
  const focus = () => {
    board.current?.scrollIntoView({ block: "center", behavior: "instant" });
    board.current?.focus({ preventScroll: true });
  };
  const restart = () => {
    setRound((n) => n + 1);
    setPaused(false);
    setSource(false);
  };
  const original = `/play-lab/catalog?group=${mode === "slice" ? "arcade" : "blocks"}&entry=${mode === "slice" ? "arcade" : "blocks"}:${mode}&lang=${locale}`;
  return (
    <section
      className="arcade3d workshop"
      data-testid="workshop-player"
      data-mode={mode}
      data-phase={s.phase}
      data-frozen={frozen}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          session.setSuspended(true);
          setPaused(true);
          e.preventDefault();
        }
      }}
    >
      <div className="arcade3d__toolbar">
        <span>{t("gallery.three.new")}</span>
        <div>
          <SoundToggle />
          <GameButton
            static
            sound={false}
            variant="secondary"
            disabled={!["playing", "running"].includes(s.phase)}
            onClick={() => {
              if (!paused) session.setSuspended(true);
              setPaused((p) => !p);
            }}
          >
            {t(paused ? "arcade3d.resume" : "arcade3d.pause")}
          </GameButton>
          <GameButton static sound={false} variant="ghost" onClick={restart}>
            {t("arcade3d.restart")}
          </GameButton>
        </div>
      </div>
      <div className="arcade3d__hud">
        <b>{t("arcade3d.score", { score: s.score })}</b>
        <span>
          {mode === "slice"
            ? t("purpose.sliceProgress", { count: s.resolved, bad: s.mistakes })
            : t("purpose.groups", { round: s.round + 1 })}
        </span>
      </div>
      <div
        className="arcade3d__viewport workshop__viewport"
        tabIndex={0}
        role="group"
        aria-label={t("arcade3d.board")}
        ref={board}
        data-testid="workshop-board"
      >
        {!failed ? (
          <WorkshopScene
            key={epoch}
            session={session}
            snapshot={s}
            locale={locale}
            frozen={frozen}
            ready={ready}
            onReady={onReady}
            onFailure={onFailure}
            act={act}
          />
        ) : null}
        {!ready ||
        failed ||
        s.phase === "ready" ||
        s.phase === "round" ||
        ended ||
        paused ||
        source ? (
          <div className="arcade3d__overlay">
            <GamePanel className="arcade3d__overlay-panel">
              {failed ? (
                <>
                  <p>{t("arcade3d.unavailable")}</p>
                  <GameButton
                    static
                    sound={false}
                    onClick={() => {
                      setFailed(false);
                      setReady(false);
                      setPaused(false);
                      setEpoch((n) => n + 1);
                    }}
                  >
                    {t("arcade3d.retry3d")}
                  </GameButton>
                  <p>
                    <a href={original}>{t("purpose.original")}</a>
                  </p>
                </>
              ) : !ready ? (
                <p>{t("arcade3d.loading")}</p>
              ) : s.phase === "ready" ? (
                <>
                  <h3>{t(`arcade3d.${mode}`)}</h3>
                  <p>{t(`arcade3d.how.${mode}`)}</p>
                  {mode === "slice" ? (
                    <label className="arcade3d__pace">
                      <input
                        type="checkbox"
                        checked={slow}
                        onChange={(e) => setSlow(e.target.checked)}
                      />
                      {t("arcade3d.calm")}
                    </label>
                  ) : null}
                  <GameButton
                    static
                    sound={false}
                    data-testid="workshop-start"
                    onClick={() => {
                      setPaused(false);
                      setSource(false);
                      session.act({ type: "start" });
                      focus();
                    }}
                  >
                    {t("arcade3d.start")}
                  </GameButton>
                </>
              ) : ended ? (
                <>
                  <h3>{t(s.phase === "won" ? "arcade3d.win" : "arcade3d.lose")}</h3>
                  <p>
                    {t("purpose.result", {
                      score: s.score,
                      correct: s.correct,
                      mistakes: s.mistakes,
                    })}
                  </p>
                  {mode === "slice" ? <p>{t("purpose.missed", { count: s.missed })}</p> : null}
                  <p>{t("arcade3d.boundary")}</p>
                  <GameButton static sound={false} onClick={restart}>
                    {t("arcade3d.restart")}
                  </GameButton>
                </>
              ) : s.phase === "round" ? (
                <>
                  <h3>{t("purpose.roundClear")}</h3>
                  <GameButton
                    static
                    sound={false}
                    data-testid="workshop-next"
                    onClick={() => {
                      session.act({ type: "next" });
                      focus();
                    }}
                  >
                    {t("purpose.next")}
                  </GameButton>
                </>
              ) : (
                <>
                  <h3>{t("arcade3d.paused")}</h3>
                  <GameButton
                    static
                    sound={false}
                    onClick={() => {
                      setPaused(false);
                      setSource(false);
                      focus();
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
      <div className="arcade3d__controls">
        {mode !== "slice" ? (
          <GameButton
            static
            sound={false}
            disabled={frozen || s.phase !== "playing"}
            onClick={() => {
              act({ type: "check" });
              focus();
            }}
            data-testid="workshop-check"
          >
            {t(`purpose.check.${mode}`)}
          </GameButton>
        ) : (
          s.capsules
            .filter((c) => c.cutAt === null)
            .map((c) => (
              <GameButton
                static
                sound={false}
                key={c.id}
                className="workshop__cut-button"
                variant="secondary"
                disabled={frozen || s.phase !== "playing"}
                onClick={() => act({ type: "cut", id: c.id })}
                data-testid={`slice-cut-${c.id}`}
              >
                {t("purpose.cut", { text: word(CLAIMS[c.card]!.prompt, locale) })}
              </GameButton>
            ))
        )}
      </div>
      <div className="arcade3d__notice" role="status">
        {word(s.notice, locale)}
      </div>
      {ended && s.errors.length ? (
        <GamePanel className="arcade3d__review">
          <h3>{t("arcade3d.review")}</h3>
          {s.errors.map((i) => (
            <p key={i}>
              <b>{word(CLAIMS[i]!.prompt, locale)}</b>
              <br />
              {word(CLAIMS[i]!.explanation, locale)}
            </p>
          ))}
        </GamePanel>
      ) : null}
      <details
        className="arcade3d__sources"
        open={source}
        onToggle={(e) => {
          if (e.currentTarget.open) session.setSuspended(true);
          setSource(e.currentTarget.open);
        }}
      >
        <summary>{t("purpose.read")}</summary>
        <div className="arcade3d__source-layout">
          <figure>
            <img src={SOURCE.image} alt="Earthrise · NASA / Bill Anders" />
            <figcaption>{SOURCE.credit}</figcaption>
          </figure>
          <div>
            {ARCADE_SOURCES.map((r) => (
              <section key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.title}
                </a>
                <p>{word(r.text, locale)}</p>
              </section>
            ))}
            <p>{t("purpose.sourceNote")}</p>
          </div>
        </div>
        <GameButton
          static
          sound={false}
          onClick={() => {
            setSource(false);
            focus();
          }}
        >
          {t("arcade3d.backGame")}
        </GameButton>
      </details>
      <a className="arcade3d__original" href={original}>
        {t("purpose.original")}
      </a>
    </section>
  );
}
