import { useCallback, useEffect, useRef, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { useI18n } from "@pieai/university-ui/i18n.js";
import {
  PropFinishScene,
  PROP_SAMPLES,
  FINISH_IDS,
  parsePropId,
  parsePropFinish,
  type PropId,
  type PropFinish,
  type PropCost,
} from "@pieai/university-world/prop-finish.js";
import "./prop-finish.css";

export default function PropFinishRoute() {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<PropId>(() =>
    parsePropId(new URLSearchParams(location.search).get("object")),
  );
  const [finish, setFinish] = useState<PropFinish>(() =>
    parsePropFinish(new URLSearchParams(location.search).get("method")),
  );
  const [gallery, setGallery] = useState(false),
    [rotation, setRotation] = useState(-0.5),
    [tilt, setTilt] = useState(0.3),
    [zoom, setZoom] = useState(1);
  const [diagnostic, setDiagnostic] = useState(false);
  const [post, setPost] = useState(true),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(""),
    [epoch, setEpoch] = useState(0);
  const [visible, setVisible] = useState(!document.hidden),
    [inView, setInView] = useState(true);
  const viewport = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number; r: number; t: number } | null>(null);
  const [costs, setCosts] = useState<PropCost[]>([]);
  const onReady = useCallback((values: PropCost[]) => {
      setCosts(values);
      setReady(true);
    }, []),
    onFailure = useCallback((message: string) => setFailed(message), []);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new IntersectionObserver(([e]) => setInView(Boolean(e?.isIntersecting)));
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const u = new URL(location.href);
    u.searchParams.set("object", selected);
    u.searchParams.set("method", finish);
    history.replaceState(history.state, "", u);
  }, [selected, finish]);
  const sample = PROP_SAMPLES.find((s) => s.id === selected)!;
  const cost = costs.find((s) => s.id === selected);
  const family = sample.tree ? "plant" : selected.startsWith("rock") ? "rock" : "built";
  return (
    <section
      className="prop-finish"
      data-testid="prop-finish"
      data-ready={ready}
      data-method={finish}
    >
      <header className="prop-finish__header">
        <div>
          <p className="prop-finish__eyebrow">{t("finish.eyebrow")}</p>
          <h1>{t("finish.title")}</h1>
          <p>{t("finish.intro")}</p>
        </div>
        <a href={`/play-lab/catalog?group=three&lang=${locale}`}>{t("finish.games")}</a>
      </header>
      <div className="prop-finish__methods" aria-label={t("finish.methods")}>
        {FINISH_IDS.map((id) => (
          <GameButton
            static
            key={id}
            variant={finish === id ? "primary" : "secondary"}
            aria-pressed={finish === id}
            data-testid={`finish-${id}`}
            onClick={() => setFinish(id)}
          >
            {t(`finish.method.${id}`)}
          </GameButton>
        ))}
      </div>
      <p className="prop-finish__explanation" data-testid="finish-explanation">
        {t(`finish.about.${finish}`)}
      </p>
      {finish !== "original" ? (
        <p className="prop-finish__advice" data-testid="finish-advice">
          {t(`finish.advice.${finish}.${family}`)}
        </p>
      ) : null}
      <div className="prop-finish__view-controls">
        <GameButton
          static
          aria-pressed={!gallery}
          onClick={() => setGallery(false)}
          data-testid="finish-pair"
        >
          {t("finish.pair")}
        </GameButton>
        <GameButton
          static
          aria-pressed={gallery}
          onClick={() => setGallery(true)}
          data-testid="finish-gallery"
        >
          {t("finish.gallery")}
        </GameButton>
        <GameButton
          static
          onClick={() => {
            setRotation(-0.5);
            setTilt(0.3);
            setZoom(1);
          }}
          data-testid="finish-reset"
        >
          {t("finish.reset")}
        </GameButton>
        <label>
          {t("finish.zoom")}
          <input
            type="range"
            min="0.7"
            max="1.35"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
      </div>
      <div
        ref={viewport}
        className={`prop-finish__viewport ${gallery ? "prop-finish__viewport--gallery" : ""}`}
        data-testid="finish-viewport"
        tabIndex={0}
        role="group"
        aria-label={t("finish.stage")}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            setRotation((r) => r + (e.key === "ArrowLeft" ? -0.15 : 0.15));
          }
        }}
        onPointerDown={(e) => {
          // Recovery controls live above the canvas. Capturing their pointer
          // would reroute pointerup to this group and swallow the button click.
          if (e.button !== 0 || (e.target as HTMLElement).closest("button,a,input,select")) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, r: rotation, t: tilt };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setRotation(d.r + (e.clientX - d.x) * 0.008);
          setTilt(Math.max(0.08, Math.min(0.8, d.t + (e.clientY - d.y) * 0.004)));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        {!failed ? (
          <PropFinishScene
            key={epoch}
            labels={
              Object.fromEntries(
                PROP_SAMPLES.map((s) => [s.id, t(`finish.object.${s.id}`)]),
              ) as Record<PropId, string>
            }
            selected={selected}
            finish={finish}
            gallery={gallery}
            rotation={rotation}
            tilt={tilt}
            zoom={zoom}
            post={post}
            active={visible && inView}
            diagnostic={diagnostic && finish === "crafted"}
            onReady={onReady}
            onFailure={onFailure}
          />
        ) : (
          <div className="prop-finish__notice" role="alert">
            <p>{t("finish.failed")}</p>
            <GameButton
              static
              onClick={() => {
                setFailed("");
                setReady(false);
                setEpoch((e) => e + 1);
              }}
            >
              {t("finish.retry")}
            </GameButton>
            <code>{failed}</code>
          </div>
        )}
        {!ready && !failed ? (
          <div className="prop-finish__notice" role="status">
            {t("finish.loading")}
          </div>
        ) : null}
        {!gallery ? (
          <div className="prop-finish__pair-labels">
            <span>{t("finish.method.original")}</span>
            <span>{t(`finish.method.${finish}`)}</span>
          </div>
        ) : null}
      </div>
      <p className="prop-finish__hint">{t("finish.hint")}</p>
      <nav className="prop-finish__objects" aria-label={t("finish.objects")}>
        {PROP_SAMPLES.map((s, i) => (
          <GameButton
            static
            key={s.id}
            variant={selected === s.id ? "primary" : "secondary"}
            aria-pressed={selected === s.id}
            data-testid={`finish-object-${s.id}`}
            onClick={() => {
              setSelected(s.id);
              setGallery(false);
            }}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            {t(`finish.object.${s.id}`)}
          </GameButton>
        ))}
      </nav>
      <div className="prop-finish__source">
        <strong>{t(`finish.object.${selected}`)}</strong>
        <span>{sample.source}</span>
        <small>{sample.consumer}</small>
      </div>
      {cost ? (
        <p className="prop-finish__cost" data-testid="finish-cost">
          {t("finish.triangles")}: {cost.triangles.original.toLocaleString(locale)} →{" "}
          {cost.triangles[finish].toLocaleString(locale)} ·{" "}
          {t(
            finish === "bevel"
              ? "finish.costGeometry"
              : finish === "crafted"
                ? "finish.costMaterial"
                : "finish.costSame",
          )}
        </p>
      ) : null}
      <p>{t("finish.boundary")}</p>
      <details className="prop-finish__technical">
        <summary>{t("finish.technical")}</summary>
        <p>{t("finish.technicalNote")}</p>
        <label>
          <input
            data-testid="finish-diagnostic"
            type="checkbox"
            checked={diagnostic}
            disabled={finish !== "crafted"}
            onChange={(e) => setDiagnostic(e.target.checked)}
          />
          {t("finish.diagnostic")}
        </label>
        <label>
          <input
            data-testid="finish-grade"
            type="checkbox"
            checked={post}
            onChange={(e) => setPost(e.target.checked)}
          />
          {t("finish.grade")}
        </label>
        <p>{t("finish.cost")}</p>
      </details>
    </section>
  );
}
