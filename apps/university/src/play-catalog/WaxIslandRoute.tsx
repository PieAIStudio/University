import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { progressSourceOf, type ProgressPort } from "@pieai/university-core";
import type { Shelf } from "@pieai/university-ui/content/port.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { placeCourse } from "@pieai/university-world/Maps.js";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import { worldCourse } from "@pieai/university-world/course-map.js";
import { WaxIslandScene, type WaxView } from "@pieai/university-world/wax-slice.js";
import "./wax-island.css";

export default function WaxIslandRoute({
  shelf,
  progressPort,
  recipe,
  signedIn,
}: {
  shelf: Shelf | null;
  progressPort: ProgressPort;
  recipe: AvatarRecipe | null;
  signedIn: boolean;
}) {
  const { t, locale } = useI18n();
  const course = shelf?.studies
    .find((s) => s.id === "browser-ai")
    ?.courses.find((c) => c.id === "run-a-real-project-with-ai");
  const lessons = useMemo(
    () =>
      course ? placeCourse("browser-ai", worldCourse(course), progressSourceOf(progressPort)) : [],
    [course, progressPort],
  );
  const [wax, setWax] = useState(
    () => new URLSearchParams(location.search).get("finish") !== "classic",
  );
  const [strength, setStrength] = useState(1);
  const [soften, setSoften] = useState(true);
  const [scattering, setScattering] = useState(true);
  const [view, setView] = useState<WaxView>("island");
  const [reset, setReset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [onScreen, setOnScreen] = useState(true);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(Boolean(entry?.isIntersecting)),
    );
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [course]);
  const [post, setPost] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => {
    setFailed(true);
    setPaused(true);
  }, []);
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  const choose = (next: boolean) => {
    setWax(next);
    const url = new URL(location.href);
    url.searchParams.set("finish", next ? "wax" : "classic");
    history.replaceState(history.state, "", url);
  };
  const current = lessons.find((l) => l.lessonId === selected) ?? lessons[0];
  return (
    <section
      className="wax-island"
      data-testid="wax-island"
      data-finish={wax ? "wax" : "classic"}
      data-ready={ready}
    >
      <header className="wax-island__heading">
        <div>
          <p className="wax-island__eyebrow">{t("wax.eyebrow")}</p>
          <h1>{t("wax.title")}</h1>
          <p>{t("wax.intro")}</p>
        </div>
        <a href={`/play-lab/catalog?group=three&lang=${locale}`}>{t("wax.games")}</a>
      </header>
      {!shelf ? (
        <p role="status">{t("wax.loading")}</p>
      ) : !course || !lessons.length ? (
        <p role="alert">{t("wax.missing")}</p>
      ) : (
        <>
          <div className="wax-island__toolbar" aria-label={t("wax.controls")}>
            <div className="wax-island__buttons">
              <GameButton
                static
                variant={wax ? "secondary" : "primary"}
                aria-pressed={!wax}
                data-testid="wax-classic"
                onClick={() => choose(false)}
              >
                {t("wax.classic")}
              </GameButton>
              <GameButton
                static
                variant={wax ? "primary" : "secondary"}
                aria-pressed={wax}
                data-testid="wax-on"
                onClick={() => choose(true)}
              >
                {t("wax.wax")}
              </GameButton>
            </div>
            <div className="wax-island__buttons">
              {(["island", "detail", "avatar"] as const).map((v) => (
                <GameButton
                  static
                  key={v}
                  aria-pressed={view === v}
                  data-testid={`wax-view-${v}`}
                  onClick={() => {
                    setView(v);
                    setReset((n) => n + 1);
                  }}
                >
                  {t(`wax.view.${v}`)}
                </GameButton>
              ))}
              <GameButton
                static
                aria-pressed={paused}
                onClick={() => setPaused((v) => !v)}
                data-testid="wax-pause"
              >
                {t(paused ? "wax.resume" : "wax.pause")}
              </GameButton>
            </div>
          </div>
          <div ref={viewport} className="wax-island__viewport" data-testid="wax-viewport">
            {!failed ? (
              <WaxIslandScene
                key={epoch}
                lessons={lessons}
                recipe={recipe}
                signedIn={signedIn}
                selected={current?.lessonId ?? null}
                wax={wax}
                strength={strength}
                soften={soften}
                scattering={scattering}
                paused={paused || hidden || !onScreen}
                ready={ready}
                post={post}
                view={view}
                reset={reset}
                onPick={(lesson) => setSelected(lesson.lessonId)}
                onReady={onReady}
                onFailure={onFailure}
              />
            ) : (
              <div className="wax-island__notice" role="alert">
                <p>{t("wax.failed")}</p>
                <GameButton
                  static
                  onClick={() => {
                    setFailed(false);
                    setReady(false);
                    setEpoch((n) => n + 1);
                  }}
                >
                  {t("wax.retry")}
                </GameButton>
              </div>
            )}
            {!ready && !failed ? (
              <div className="wax-island__notice" role="status">
                {t("wax.loading")}
              </div>
            ) : null}
          </div>
          <div className="wax-island__controls">
            <label>
              {t("wax.strength")}
              <input
                aria-label={t("wax.strength")}
                type="range"
                min="0.3"
                max="1"
                step="0.05"
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
                disabled={!wax}
              />
            </label>
            <label>
              <input
                data-testid="wax-soft"
                type="checkbox"
                checked={soften}
                onChange={(e) => setSoften(e.target.checked)}
                disabled={!wax}
              />
              {t("wax.soft")}
            </label>
            <label>
              <input
                data-testid="wax-scattering"
                type="checkbox"
                checked={scattering}
                onChange={(e) => setScattering(e.target.checked)}
                disabled={!wax}
              />
              {t("wax.scatter")}
            </label>
            <label>
              <input
                data-testid="wax-grade"
                type="checkbox"
                checked={post}
                onChange={(e) => setPost(e.target.checked)}
              />
              {t("wax.grade")}
            </label>
          </div>
          <div className="wax-island__caption">
            <strong>{course.title}</strong>
            <span>{t("wax.hint")}</span>
          </div>
          <label className="wax-island__lesson">
            {t("wax.node")}
            <select
              aria-label={t("wax.node")}
              value={current?.lessonId}
              onChange={(e) => setSelected(e.target.value)}
            >
              {lessons.map((l, i) => (
                <option value={l.lessonId} key={l.lessonId}>
                  {i + 1}. {l.lessonTitle}
                </option>
              ))}
            </select>
          </label>
          <p>{t("wax.scope")}</p>
          <a href={`/browser-ai/run-a-real-project-with-ai?lang=${locale}`}>{t("wax.course")}</a>
          <details>
            <summary>{t("wax.boundary")}</summary>
            <p>{t("wax.note")}</p>
          </details>
        </>
      )}
    </section>
  );
}
