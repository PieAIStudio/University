import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { GameButton, GameIconButton, GamePanel } from "@pieai/swimmer-ui-kit";
import { LiquidPresence, type LiquidPresenceTarget } from "@pieai/swimmer-ui-kit/liquid-presence";
import { nervePresenceActivity, nervePresenceTarget } from "@pieai/swimmer-nerve-kit/presence";
import { createTargetRegistry, type TargetRect } from "@pieai/swimmer-nerve-kit/targets";
import { translate as t } from "@pieai/university-ui/i18n.js";
import {
  mapGuideAnswer,
  mapGuideQuestions,
  type MapGuideAnswer,
  type MapGuideMap,
  type MapGuidePlace,
  type MapGuideQuestion,
} from "./map-guide.js";
import "./map-guide.css";

/**
 * 涟 on the map (ADR-0012, phase one; V5 #map-guide). The droplet sits at the
 * bottom centre of the stage and owns the map's first sentence — the entry
 * hint that used to float there on its own. Asked a question, it answers from
 * the map and flies to the one place the answer names.
 *
 * The places are registered with SwimmerNerveKit's target registry: the same
 * contract a model will read in phase two, so a model can only ever point at
 * what the map has registered, never at a selector or a coordinate it made up.
 * Pointing grants nothing; the only action offered is the place's own.
 */
export function MapGuide({
  map,
  opening,
  openingVisible,
  onShortcuts,
}: {
  readonly map: MapGuideMap;
  /** The map's first sentence, said until the learner has picked once. */
  readonly opening: ReactNode;
  readonly openingVisible: boolean;
  readonly onShortcuts: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<{
    readonly answer: MapGuideAnswer;
    readonly target: LiquidPresenceTarget | null;
    /** The answer names a place the learner cannot see right now. */
    readonly unseen: boolean;
  } | null>(null);
  const registry = useMemo(() => createTargetRegistry(), []);
  const gesture = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const shortcuts = useRef(onShortcuts);
  shortcuts.current = onShortcuts;

  // Answers are read from the map as it is now, so every place an answer can
  // name is registered for as long as this map shows it.
  const answers = useMemo(
    () =>
      mapGuideQuestions(map.view).map((question) =>
        mapGuideAnswer(question, map, () => shortcuts.current()),
      ),
    [map],
  );
  useEffect(() => {
    const off = answers.flatMap((answer) =>
      answer.place
        ? [
            registry.register({
              id: `guide.${answer.question}`,
              label: answer.place.label,
              rect: () => placeRect(answer.place!),
              contextElement: () => placeElement(answer.place!),
            }),
          ]
        : [],
    );
    return () => off.forEach((unregister) => unregister());
  }, [answers, registry]);

  // A new map is a new scope: an old gesture never lands on it.
  useEffect(() => {
    setShown(null);
    setOpen(false);
  }, [map.view]);

  useEffect(() => {
    if (!open) return;
    root.current
      ?.querySelector<HTMLElement>(".map-guide__panel button")
      ?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    setShown(null);
    root.current?.querySelector<HTMLElement>(".map-guide__body")?.focus({ preventScroll: true });
  }

  function ask(question: MapGuideQuestion) {
    const answer = answers.find((candidate) => candidate.question === question)!;
    const target = answer.place
      ? nervePresenceTarget(registry, `guide.${question}`, `${question}:${++gesture.current}`)
      : null;
    setShown({ answer, target, unseen: answer.place !== null && target === null });
  }

  const unseen = shown?.unseen ? shown.answer.place : null;

  return (
    <div ref={root} className="map-guide" data-map-guide={open ? "open" : "closed"}>
      {open ? (
        <GamePanel
          id={panelId}
          className="map-guide__panel"
          tone="strong"
          aria-label={t("map.guide.name")}
        >
          <div className="map-guide__head">
            <p className="map-guide__say" aria-live="polite">
              {shown ? shown.answer.text : t("map.guide.intro")}
              {unseen ? (
                <span className="map-guide__aside">
                  {t(
                    unseen.kind === "marker"
                      ? "map.guide.offscreen.map"
                      : "map.guide.offscreen.menu",
                  )}
                </span>
              ) : null}
            </p>
            <GameIconButton label={t("map.guide.close")} onClick={close}>
              <span aria-hidden="true">×</span>
            </GameIconButton>
          </div>
          {shown ? (
            <div className="map-guide__actions">
              {shown.answer.go ? (
                <GameButton
                  variant="primary"
                  onClick={() => {
                    const run = shown.answer.go!.run;
                    setOpen(false);
                    setShown(null);
                    run();
                  }}
                >
                  {shown.answer.go.label}
                </GameButton>
              ) : null}
              <GameButton variant="secondary" onClick={() => setShown(null)}>
                {t("map.guide.again")}
              </GameButton>
            </div>
          ) : (
            <ul className="map-guide__questions">
              {answers.map((answer) => (
                <li key={answer.question}>
                  <GameButton
                    variant="secondary"
                    fullWidth
                    data-guide-question={answer.question}
                    onClick={() => ask(answer.question)}
                  >
                    {t(`map.guide.q.${answer.question}`)}
                  </GameButton>
                </li>
              ))}
            </ul>
          )}
        </GamePanel>
      ) : (
        <p
          className={`hint hint--entry map-guide__opening${openingVisible ? "" : " hint--dismissed"}`}
          data-game-ui-tone="glass"
        >
          {opening}
        </p>
      )}
      <GameButton
        variant="secondary"
        className="map-guide__body"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t("map.guide.open")}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <LiquidPresence
          size={40}
          // Phase one has no model, no voice and no task: nothing to observe.
          activity={nervePresenceActivity({})}
          target={shown?.target ?? null}
          onDismiss={() =>
            setShown((current) => (current ? { ...current, target: null } : current))
          }
        />
        <span className="map-guide__name">{t("map.guide.button")}</span>
      </GameButton>
    </div>
  );
}

function placeElement(place: MapGuidePlace): HTMLElement | null {
  if (place.kind === "marker")
    return document.querySelector<HTMLElement>(`[data-map-marker="${CSS.escape(place.markerId)}"]`);
  // The rail at a desk, the tab bar elsewhere: whichever is on screen.
  return (
    [...document.querySelectorAll<HTMLElement>(`[data-nav-id="${place.navId}"]`)].find(
      (element) => visibleRect(element) !== null,
    ) ?? null
  );
}

/** Where the place is now, or null when a learner could not see it. */
function placeRect(place: MapGuidePlace): TargetRect | null {
  const element = placeElement(place);
  if (!element) return null;
  // A map label the layout has not placed this frame is not on the map.
  if (place.kind === "marker" && !element.classList.contains("is-visible")) return null;
  return visibleRect(element);
}

/*
  SwimmerNerveKit's unreleased `registerElementTarget` does this and more;
  replace this with it once a release carries it.
*/
function visibleRect(element: HTMLElement): TargetRect | null {
  if (!element.isConnected || element.closest('[hidden], [inert], [aria-hidden="true"]'))
    return null;
  if (
    typeof element.checkVisibility === "function" &&
    !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })
  )
    return null;
  const rect = element.getBoundingClientRect();
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.right <= 0 ||
    rect.bottom <= 0 ||
    rect.left >= window.innerWidth ||
    rect.top >= window.innerHeight
  )
    return null;
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}
