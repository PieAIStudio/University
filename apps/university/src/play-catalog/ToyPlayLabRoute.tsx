import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { GameButton, GamePanel } from "@pieai/swimmer-ui-kit";
import { useI18n } from "@pieai/university-ui/i18n.js";
import {
  ToyScene,
  TOY_MODES,
  TITLES,
  ACTIONS,
  CATEGORIES,
  SOURCE,
  toyDeck,
  newToyGame,
  toyReducer,
  word,
  type ToyEvent,
  type ToyLocale,
  type ToyMode,
  type Words,
} from "@pieai/university-world/toy-play.js";
import "./toy-play.css";

function initialMode(): ToyMode {
  const mode = new URLSearchParams(window.location.search).get("game");
  return TOY_MODES.find((candidate) => candidate === mode) ?? "stack";
}

export default function ToyPlayLabRoute() {
  const { locale: appLocale, t } = useI18n();
  const locale: ToyLocale = appLocale === "en" ? "en" : "zh-CN";
  const [state, send] = useReducer(toyReducer, initialMode(), newToyGame);
  const [paused, setPaused] = useState(false);
  const [timed, setTimed] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [flat, setFlat] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [rendererEpoch, setRendererEpoch] = useState(0);
  const [sceneVisible, setSceneVisible] = useState(true);
  const sceneBox = useRef<HTMLDivElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const previousPhase = useRef(state.phase);
  const heading = useRef<HTMLHeadingElement>(null);
  const material = useRef<HTMLElement>(null);
  const deck = toyDeck(state.mode);
  const card = deck[Math.min(state.cursor, deck.length - 1)]!;
  const complete = state.phase === "complete";
  const rendererReady = ready || flat || unavailable;
  const interactive = rendererReady && !paused && visible && state.phase === "playing";
  const timeRunning = interactive && timed && !sourceOpen && (sceneVisible || flat || unavailable);
  const choiceCount = state.mode === "invaders" ? 2 : 3;
  const choices = card.options ?? CATEGORIES.slice(0, choiceCount);
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => {
    setUnavailable(true);
    setReady(false);
  }, []);
  const dispatch = useCallback(
    (event: ToyEvent) => {
      if ((event.type === "select" || event.type === "submit") && !interactive) return;
      send(event);
    },
    [interactive],
  );

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  useEffect(() => {
    const element = sceneBox.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setSceneVisible(Boolean(entry?.isIntersecting)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!timeRunning) return;
    const timer = window.setInterval(() => send({ type: "tick", active: true }), 1000);
    return () => window.clearInterval(timer);
  }, [timeRunning]);
  useEffect(() => {
    const element =
      state.phase === "feedback"
        ? feedback.current
        : state.phase === "playing" && previousPhase.current !== "playing"
          ? heading.current
          : null;
    previousPhase.current = state.phase;
    element?.focus({ preventScroll: true });
    if (element && window.matchMedia("(max-width: 760px)").matches) {
      element.scrollIntoView({
        block: state.phase === "feedback" ? "nearest" : "start",
        behavior: "instant",
      });
    }
  }, [state.phase, state.cursor]);
  useEffect(() => {
    if (
      !timed ||
      !state.correct ||
      state.phase !== "feedback" ||
      paused ||
      !visible ||
      sourceOpen ||
      (!sceneVisible && !flat && !unavailable)
    )
      return;
    const timer = window.setTimeout(() => send({ type: "next" }), 2400);
    return () => window.clearTimeout(timer);
  }, [
    timed,
    state.correct,
    state.phase,
    paused,
    visible,
    sourceOpen,
    sceneVisible,
    flat,
    unavailable,
  ]);

  const submitSelected = () => {
    if (state.selected !== null) dispatch({ type: "submit", index: state.selected });
  };
  const choose = (index: number) =>
    dispatch({ type: state.mode === "stack" ? "submit" : "select", index });
  const switchMode = (mode: ToyMode) => {
    send({ type: "reset", mode });
    setPaused(false);
    const url = new URL(window.location.href);
    url.searchParams.set("game", mode);
    window.history.replaceState(window.history.state, "", url);
  };
  const advance = () => {
    send({ type: state.correct ? "next" : "retry" });
  };
  const reset = () => {
    send({ type: "reset", mode: state.mode });
    setPaused(false);
  };

  return (
    <section
      className="toy-lab"
      data-testid="toy-lab"
      data-mode={state.mode}
      data-phase={state.phase}
      data-cursor={state.cursor}
      data-seconds={state.seconds}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        if (
          target.matches("input,textarea,select") ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        if (/^[1-3]$/.test(event.key) && interactive) {
          const index = Number(event.key) - 1;
          if (index < choices.length) {
            event.preventDefault();
            choose(index);
          }
        }
      }}
    >
      <header className="toy-lab__header">
        <div>
          <a href={`/play-lab/catalog?lang=${locale}`}>{t("返回互动目录")}</a>
          <h1>{t("3D 互动玩具台")}</h1>
        </div>
        <p>{t("同一套积木，三种玩法。先看材料，再动手试试。")}</p>
      </header>
      <nav className="toy-lab__modes" aria-label={t("选择 3D 玩法")}>
        {TOY_MODES.map((mode, index) => (
          <GameButton
            key={mode}
            static
            sound={false}
            variant={state.mode === mode ? "primary" : "ghost"}
            aria-pressed={state.mode === mode}
            onClick={() => switchMode(mode)}
            data-testid={`toy-mode-${mode}`}
          >
            <span className="toy-lab__mode-number" aria-hidden="true">
              {index + 1}
            </span>
            {word(TITLES[mode], locale)}
          </GameButton>
        ))}
        <span className="toy-lab__local">{t("本地实验 · 不计入课程成绩")}</span>
      </nav>
      <div className="toy-lab__layout">
        <div className="toy-lab__play">
          <div className="toy-lab__toolbar">
            <span>
              {t("已完成")} <b>{state.cursor}</b> / {deck.length}
            </span>
            <div>
              <GameButton
                static
                sound={false}
                variant="ghost"
                disabled={complete}
                onClick={() => setPaused(!paused)}
              >
                {paused ? t("继续玩") : t("暂停")}
              </GameButton>
              <GameButton static sound={false} variant="ghost" onClick={reset}>
                {t("重新开始")}
              </GameButton>
            </div>
          </div>
          <progress
            className="toy-lab__progress"
            value={state.cursor}
            max={deck.length}
            aria-label={t("本轮进度")}
          />
          <div className="toy-lab__question">
            <div className="toy-lab__mobile-material">
              <img src={SOURCE.image} alt="" />
              <div>
                <b>Earthrise · NASA</b>
                <GameButton
                  static
                  sound={false}
                  variant="ghost"
                  onClick={() => {
                    setSourceOpen(true);
                    material.current?.scrollIntoView({ block: "start", behavior: "instant" });
                  }}
                >
                  {t("看大图与记录")}
                </GameButton>
              </div>
            </div>
            <p>{word(ACTIONS[state.mode], locale)}</p>
            <h2 ref={heading} tabIndex={-1}>
              {complete ? t("本轮练习完成") : word(card.prompt, locale)}
            </h2>
          </div>
          <div className="toy-lab__scene" data-testid="toy-scene" ref={sceneBox}>
            {!flat && !unavailable ? (
              <ToyScene
                key={rendererEpoch}
                state={state}
                locale={locale}
                interactive={interactive}
                dispatch={dispatch}
                timed={timed}
                paused={paused || !visible || !sceneVisible}
                onReady={onReady}
                onFailure={onFailure}
              />
            ) : (
              <div className="toy-lab__flat">
                <h3>{unavailable ? t("3D 暂时不可用，仍可继续练习") : t("简洁操作模式")}</h3>
                <p>{t("题目、材料和判断规则完全相同。用下方按钮完成操作。")}</p>
              </div>
            )}
            {!rendererReady ? (
              <div className="toy-lab__cover" role="status">
                {t("正在摆好小工位…")}
                <GameButton static sound={false} variant="secondary" onClick={() => setFlat(true)}>
                  {t("先用简洁模式")}
                </GameButton>
              </div>
            ) : null}
            {paused ? (
              <div className="toy-lab__cover">
                <h3>{t("歇一会儿，不会丢进度")}</h3>
                <GameButton static sound={false} onClick={() => setPaused(false)}>
                  {t("继续玩")}
                </GameButton>
              </div>
            ) : null}
          </div>
          {!complete ? (
            <div className="toy-lab__controls" role="group" aria-label={t("操作区，也可使用键盘")}>
              <p className="toy-lab__hint">
                {state.mode === "stack"
                  ? t("拖动货箱，或直接点一个分类。键盘可按 1 / 2 / 3。")
                  : state.mode === "invaders"
                    ? t("先选一道门，再点“放行小船”。选的是核对方式，不是答案。")
                    : t("先选词块，再嵌入缺口。也可以在 3D 工位上直接拖入。")}
              </p>
              <div className="toy-lab__choice-row">
                {choices.map((choice: Words, index: number) => (
                  <GameButton
                    key={index}
                    static
                    sound={false}
                    disabled={!interactive}
                    variant={
                      state.selected === index && state.mode !== "stack" ? "primary" : "secondary"
                    }
                    aria-pressed={state.mode === "stack" ? undefined : state.selected === index}
                    onClick={() => choose(index)}
                    data-testid={`toy-choice-${index}`}
                  >
                    <kbd aria-hidden="true">{index + 1}</kbd>
                    {word(choice, locale)}
                  </GameButton>
                ))}
                {state.mode !== "stack" ? (
                  <GameButton
                    static
                    sound={false}
                    variant="primary"
                    disabled={!interactive || state.selected === null}
                    onClick={submitSelected}
                    data-testid="toy-submit"
                  >
                    {state.mode === "invaders" ? t("放行小船") : t("嵌入并检查")}
                  </GameButton>
                ) : null}
              </div>
              {state.phase === "feedback" ? (
                <div
                  className="toy-lab__feedback"
                  ref={feedback}
                  tabIndex={-1}
                  role="status"
                  data-correct={state.correct}
                >
                  <div>
                    <strong>
                      {state.correct
                        ? t("这次对上了")
                        : state.seconds === 0
                          ? t("时间到了，停下来看看")
                          : t("换个思路，再试一次")}
                    </strong>
                    <p>{word(card.explanation, locale)}</p>
                    {timed && state.correct ? (
                      <GameButton
                        static
                        sound={false}
                        variant="ghost"
                        onClick={() => setTimed(false)}
                      >
                        {t("停下来看解释")}
                      </GameButton>
                    ) : null}
                  </div>
                  <GameButton
                    static
                    sound={false}
                    variant={state.correct ? "success" : "secondary"}
                    onClick={advance}
                    data-testid="toy-next"
                  >
                    {state.correct
                      ? state.cursor === deck.length - 1
                        ? t("看本轮结果")
                        : t("下一件")
                      : t("再试一次")}
                  </GameButton>
                </div>
              ) : null}
            </div>
          ) : (
            <GamePanel className="toy-lab__result" role="status">
              <h3>{t("小工位收工了")}</h3>
              <p>{t("toy.completedLine", { total: deck.length, first: state.firstTry })}</p>
              <p>{t("这是对这一组材料的练习，不代表已经学会处理所有图片。")}</p>
              {state.missed.length ? (
                <details>
                  <summary>{t("再看一下出过错的地方")}</summary>
                  {deck
                    .filter((c) => state.missed.includes(c.id))
                    .map((c) => (
                      <p key={c.id}>
                        <b>{word(c.prompt, locale)}</b>
                        <br />
                        {word(c.explanation, locale)}
                      </p>
                    ))}
                </details>
              ) : null}
              <GameButton
                static
                sound={false}
                onClick={() => switchMode(TOY_MODES[(TOY_MODES.indexOf(state.mode) + 1) % 3]!)}
              >
                {t("换一个玩法")}
              </GameButton>
            </GamePanel>
          )}
          <div className="toy-lab__settings">
            <label>
              <input
                type="checkbox"
                checked={timed}
                onChange={(e) => setTimed(e.target.checked)}
                disabled={complete}
              />
              {t("连玩挑战：每件 25 秒，答对后自动接下一件")}
            </label>
            <span>
              {timed
                ? sourceOpen
                  ? t("查看记录中 · 计时暂停")
                  : t("toy.remaining", { seconds: state.seconds })
                : t("从容模式 · 不计时")}
            </span>
            <GameButton
              static
              sound={false}
              variant="ghost"
              onClick={() => {
                if (flat || unavailable) {
                  setUnavailable(false);
                  setReady(false);
                  setRendererEpoch((n) => n + 1);
                  setFlat(false);
                } else setFlat(true);
              }}
            >
              {flat || unavailable ? t("打开 3D") : t("简洁模式")}
            </GameButton>
          </div>
        </div>
        <aside ref={material} className="toy-lab__material" aria-label={t("这次用的真实材料")}>
          <h2>{t("先看这张真实照片")}</h2>
          <figure>
            <img
              src={SOURCE.image}
              alt={t("《地出》：灰色月面上方，蓝白色的地球悬在暗色背景中。")}
            />
            <figcaption>Earthrise · {SOURCE.credit}</figcaption>
          </figure>
          <p>
            {t(
              "要检查 AI 对这张照片的描述，你会先看画面，还是查拍摄记录？有些说法，两份材料都没告诉我们。",
            )}
          </p>
          <details open={sourceOpen} onToggle={(event) => setSourceOpen(event.currentTarget.open)}>
            <summary>{t("查看 NASA 拍摄记录")}</summary>
            <p>{word(SOURCE.summary, locale)}</p>
            <a href={SOURCE.url} target="_blank" rel="noreferrer">
              {t("打开 NASA 原始页面")}
            </a>
            <p className="toy-lab__note">
              {t("以上为原文信息的简要转述，不是 AI 现场生成的回答。")}
            </p>
          </details>
          <GameButton
            className="toy-lab__return-game"
            static
            sound={false}
            variant="secondary"
            onClick={() => {
              setSourceOpen(false);
              heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
              heading.current?.focus({ preventScroll: true });
            }}
          >
            {t("回到游戏")}
          </GameButton>
          <div className="toy-lab__material-note">
            <strong>{t("不是靠颜色猜答案")}</strong>
            <p>{t("货箱和词块的颜色不提示对错。判断依据只有照片与记录；出错后会说明原因。")}</p>
          </div>
          <details>
            <summary>{t("这套 3D 积木从哪里来？")}</summary>
            <p>
              {t(
                "摊位、推车、灯笼和石头复用项目中已有的 Kenney 模型；木桥、圆树、货箱、插槽和门是共用的程序化零件。三个玩法使用同一套材质、灯光与镜头。",
              )}
            </p>
            <a href="https://kenney.nl/assets/fantasy-town-kit" target="_blank" rel="noreferrer">
              Kenney · Fantasy Town Kit · CC0
            </a>
          </details>
        </aside>
      </div>
    </section>
  );
}
