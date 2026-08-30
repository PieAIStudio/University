import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

import { LiquidGroup } from "@pieai/swimmer-ui-kit";

/** A rectangle in viewport coordinates, with its top-left corner as origin. */
export interface LiquidScreenRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Lets a destination register a meaningful sub-rect instead of its layout
 * wrapper. The lesson progress target uses this to land on the leading edge of
 * the filled track, not on the whole progress component (or its value label).
 */
export type LiquidDestinationMeasure = (element: HTMLElement) => LiquidScreenRect | null;

export type LiquidCtaFlightPhase = "press" | "stretch" | "thread" | "break" | "land";

export interface LiquidFlightShape extends LiquidScreenRect {
  readonly scale: number;
}

export interface LiquidFlightFrame {
  readonly progress: number;
  readonly phase: LiquidCtaFlightPhase;
  /** How far the button has travelled; the follow tail supplies the string. */
  readonly travel: number;
  /** The shrinking source bead eases backward during the split. */
  readonly sourceTravel: number;
  /** The small leading bead stays near the source until the thread is made. */
  readonly landingTravel: number;
  readonly source: LiquidFlightShape;
  readonly landing: LiquidFlightShape;
}

export const LIQUID_CTA_DURATION_MS = 352;
const LIQUID_CTA_SETTLE_HOLD_MS = 72;
const LIQUID_CTA_TARGET_GRACE_MS = 640;
const LIQUID_CTA_BOUNDS_PADDING = 12;

type LiquidDestinationRegistration = {
  readonly kind: "element";
  readonly element: HTMLElement;
  readonly measure?: LiquidDestinationMeasure;
};

export type LiquidCtaTransitionPhase = "pending" | "active" | "settling";

export interface LiquidCtaTransitionSnapshot {
  readonly token: number;
  readonly phase: LiquidCtaTransitionPhase;
  readonly destinationId: string;
  readonly source: LiquidScreenRect;
  readonly target: LiquidScreenRect | null;
  readonly startedAt: number | null;
  /** A test/capture clock. Null means the normal wall-clock driver is active. */
  readonly debugProgress: number | null;
}

const destinations = new Map<string, LiquidDestinationRegistration>();
const listeners = new Set<() => void>();
let transitionSnapshot: LiquidCtaTransitionSnapshot | null = null;
let pendingExpiry: number | null = null;
let nextToken = 0;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function easeInOut(value: number): number {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

function narrowFlightLayout(): boolean {
  return typeof window !== "undefined" && window.innerWidth < 960;
}

function screenRectOf(rect: {
  readonly x?: number;
  readonly y?: number;
  readonly left?: number;
  readonly top?: number;
  readonly width: number;
  readonly height: number;
}): LiquidScreenRect | null {
  const x = rect.x ?? rect.left;
  const y = rect.y ?? rect.top;
  if (
    x === undefined ||
    y === undefined ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return null;
  }
  return { x, y, width: rect.width, height: rect.height };
}

function viewportSize(): { readonly width: number; readonly height: number } {
  if (typeof window === "undefined") return { width: 0, height: 0 };
  return {
    width: window.innerWidth || document.documentElement.clientWidth,
    height: window.innerHeight || document.documentElement.clientHeight,
  };
}

/** A target whose center is outside the viewport is not a target for this cue. */
function visibleRect(rect: LiquidScreenRect | null): LiquidScreenRect | null {
  if (!rect) return null;
  const { width, height } = viewportSize();
  if (width <= 0 || height <= 0) return rect;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  return centerX >= 0 && centerX <= width && centerY >= 0 && centerY <= height ? rect : null;
}

function rectFromRegistration(
  registration: LiquidDestinationRegistration | undefined,
): LiquidScreenRect | null {
  if (!registration) return null;
  const rect = registration.measure
    ? registration.measure(registration.element)
    : screenRectOf(registration.element.getBoundingClientRect());
  return visibleRect(rect);
}

function notify(): void {
  for (const listener of listeners) listener();
}

function clearPendingExpiry(): void {
  if (pendingExpiry === null || typeof window === "undefined") return;
  window.clearTimeout(pendingExpiry);
  pendingExpiry = null;
}

function resolvePendingDestination(id: string): void {
  if (transitionSnapshot?.phase !== "pending" || transitionSnapshot.destinationId !== id) {
    return;
  }
  const target = rectFromRegistration(destinations.get(id));
  if (!target) return;
  clearPendingExpiry();
  transitionSnapshot = {
    ...transitionSnapshot,
    phase: "active",
    target,
    startedAt: now(),
  };
  notify();
}

function schedulePendingExpiry(token: number): void {
  if (typeof window === "undefined") return;
  clearPendingExpiry();
  pendingExpiry = window.setTimeout(() => {
    pendingExpiry = null;
    if (transitionSnapshot?.token !== token || transitionSnapshot.phase !== "pending") return;
    transitionSnapshot = null;
    notify();
  }, LIQUID_CTA_TARGET_GRACE_MS);
}

export function prefersReducedLiquidMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function liquidDestinationId(scope: string, key: string): string {
  return `${scope}:${key}`;
}

export function lessonProgressDestinationId(
  studyId: string,
  courseId: string,
  lessonId: string,
): string {
  return liquidDestinationId("lesson-progress", `${studyId}/${courseId}/${lessonId}`);
}

/**
 * Measure a small, circular landing point at the filled edge of GameProgress.
 *
 * The track remains the recognisable destination. The transition only owns a
 * bead-sized part of it, so the final frame is absorbed by the bar instead of
 * becoming a second horizontal UI component. This also keeps the value label
 * outside the liquid's rectangle.
 */
export function liquidProgressDestinationRect(element: HTMLElement): LiquidScreenRect | null {
  const track = element.matches(".game-ui-progress-track")
    ? element
    : element.querySelector<HTMLElement>(".game-ui-progress-track");
  if (!track) return null;
  const trackRect = screenRectOf(track.getBoundingClientRect());
  if (!trackRect) return null;

  const fill = element.querySelector<HTMLElement>(".game-ui-progress-fill");
  const fillRect = fill ? screenRectOf(fill.getBoundingClientRect()) : null;
  const filledEdge = fillRect ? fillRect.x + fillRect.width : trackRect.x;
  const size = Math.min(trackRect.width, Math.max(16, Math.min(22, trackRect.height * 1.6)));
  const center = Math.min(
    trackRect.x + trackRect.width - size / 2,
    Math.max(trackRect.x + size / 2, filledEdge),
  );
  return {
    x: center - size / 2,
    y: trackRect.y + (trackRect.height - size) / 2,
    width: size,
    height: size,
  };
}

/** Register a visible DOM destination and return the exact cleanup for it. */
export function registerLiquidDestination(
  id: string,
  element: HTMLElement | null,
  measure?: LiquidDestinationMeasure,
): () => void {
  if (!id || !element) return () => undefined;
  const registration: LiquidDestinationRegistration = { kind: "element", element, measure };
  destinations.set(id, registration);
  resolvePendingDestination(id);
  return () => {
    if (destinations.get(id) !== registration) return;
    destinations.delete(id);
    if (transitionSnapshot?.destinationId === id) {
      cancelLiquidCtaTransition(transitionSnapshot.token);
    }
  };
}

export function readLiquidDestination(id: string): LiquidScreenRect | null {
  return rectFromRegistration(destinations.get(id));
}

export function beginLiquidCtaTransition(
  sourceElement: HTMLElement | null,
  destinationId: string | undefined,
): boolean {
  if (
    typeof window === "undefined" ||
    !sourceElement ||
    !destinationId ||
    prefersReducedLiquidMotion()
  ) {
    return false;
  }
  const source = visibleRect(screenRectOf(sourceElement.getBoundingClientRect()));
  if (!source) return false;

  clearPendingExpiry();
  const token = ++nextToken;
  transitionSnapshot = {
    token,
    phase: "pending",
    destinationId,
    source,
    target: null,
    startedAt: null,
    debugProgress: null,
  };
  notify();
  resolvePendingDestination(destinationId);
  if (transitionSnapshot?.phase === "pending") schedulePendingExpiry(token);
  return true;
}

export function cancelLiquidCtaTransition(token?: number): void {
  if (token !== undefined && transitionSnapshot?.token !== token) return;
  clearPendingExpiry();
  if (transitionSnapshot === null) return;
  transitionSnapshot = null;
  notify();
}

export function holdLiquidCtaTransition(token: number): void {
  if (
    transitionSnapshot?.token !== token ||
    transitionSnapshot.phase !== "active" ||
    transitionSnapshot.debugProgress !== null
  ) {
    return;
  }
  transitionSnapshot = { ...transitionSnapshot, phase: "settling" };
  notify();
}

export function completeLiquidCtaTransition(token: number): void {
  if (transitionSnapshot?.token !== token) return;
  clearPendingExpiry();
  transitionSnapshot = null;
  notify();
}

export function setLiquidCtaDebugProgress(progress: number): void {
  if (!transitionSnapshot || transitionSnapshot.phase === "pending") return;
  transitionSnapshot = {
    ...transitionSnapshot,
    debugProgress: clamp01(progress),
  };
  notify();
}

export function clearLiquidCtaDebugProgress(): void {
  if (!transitionSnapshot || transitionSnapshot.debugProgress === null) return;
  transitionSnapshot = {
    ...transitionSnapshot,
    debugProgress: null,
    startedAt: now(),
    phase: "active",
  };
  notify();
}

export function subscribeLiquidCtaTransition(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function liquidCtaTransitionSnapshot(): LiquidCtaTransitionSnapshot | null {
  return transitionSnapshot;
}

/**
 * The authored shape phases. The follow-enabled LiquidGroup receives these
 * positions; its own short-lived tail is what makes the middle read as a
 * local string instead of a rectangle travelling across the screen.
 */
export function computeLiquidFlightFrame(
  source: LiquidScreenRect,
  target: LiquidScreenRect,
  progress: number,
): LiquidFlightFrame {
  const p = clamp01(progress);
  const pressEnd = 0.14;
  const stretchEnd = 0.34;
  const threadEnd = 0.78;
  const breakEnd = 0.93;
  const narrow = narrowFlightLayout();
  const sourceShape = narrow
    ? (() => {
        const size = Math.min(source.width, source.height);
        return {
          ...source,
          x: source.x + (source.width - size) / 2,
          width: size,
          height: size,
        };
      })()
    : source;
  let phase: LiquidCtaFlightPhase;
  let travel: number;
  let sourceTravel: number;
  let landingTravel: number;
  let sourceScale: number;
  let landingScale: number;

  if (p < pressEnd) {
    phase = "press";
    const local = smoothstep(p / pressEnd);
    travel = narrow ? 0 : 0.025 * local;
    sourceTravel = travel;
    landingTravel = travel;
    sourceScale = 1 + 0.05 * local;
    landingScale = 0.01;
  } else if (p < stretchEnd) {
    phase = "stretch";
    const local = smoothstep((p - pressEnd) / (stretchEnd - pressEnd));
    // On a phone the source fills almost the whole reading column. Keep the
    // large source bead on its button while it melts down; only the tiny bead
    // is allowed to leave for the right-side air lane.
    travel = narrow ? 0 : 0.025 + 0.16 * local;
    sourceTravel = travel;
    landingTravel = travel;
    sourceScale = narrow ? 1.05 - 1.01 * local : 1.05 - 0.05 * local;
    landingScale = 0.01;
  } else if (p < threadEnd) {
    phase = "thread";
    const local = easeInOut((p - stretchEnd) / (threadEnd - stretchEnd));
    travel = 0.185 + 0.815 * local;
    // Keep the tail local. The previous frame left the landing bead parked
    // at the final target from the first stretch frame, so LiquidGroup drew a
    // long diagonal across the lesson before the material had travelled there.
    sourceTravel = Math.max(0, travel - 0.12);
    landingTravel = travel;
    sourceScale = narrow ? 0.28 : 1;
    landingScale = 0.01;
  } else if (p < breakEnd) {
    phase = "break";
    const local = smoothstep((p - threadEnd) / (breakEnd - threadEnd));
    travel = 1;
    // Pull the shrinking source back along the travelled path so the landing
    // bead can grow at the target without two blobs stacking on one another.
    sourceTravel = 1 - 0.56 * local;
    landingTravel = 1;
    sourceScale = narrow ? 0.28 * (1 - local) : 1 - 0.99 * local;
    landingScale = 0.01 + 0.99 * local;
  } else {
    phase = "land";
    const local = smoothstep((p - breakEnd) / (1 - breakEnd));
    travel = 1;
    // The break has finished. Move the invisible source onto the destination
    // so LiquidGroup no longer stretches a line from the middle of the page;
    // the only visible material left is the small absorbed landing bead.
    sourceTravel = 1;
    landingTravel = 1;
    sourceScale = 0;
    landingScale = 1 - 0.04 * local;
  }

  return {
    progress: p,
    phase,
    travel,
    sourceTravel,
    landingTravel,
    source: { ...sourceShape, scale: sourceScale },
    landing: { ...target, scale: landingScale },
  };
}

function scaledShapeRect(shape: LiquidFlightShape): LiquidScreenRect {
  const width = shape.width * shape.scale;
  const height = shape.height * shape.scale;
  return {
    x: shape.x + (shape.width - width) / 2,
    y: shape.y + (shape.height - height) / 2,
    width,
    height,
  };
}

function followCoverageRect(
  source: LiquidScreenRect,
  landing: LiquidScreenRect,
  padding: number,
): LiquidScreenRect {
  const left = Math.min(source.x, landing.x) - padding;
  const top = Math.min(source.y, landing.y) - padding;
  const right = Math.max(source.x + source.width, landing.x + landing.width) + padding;
  const bottom = Math.max(source.y + source.height, landing.y + landing.height) + padding;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Return the screen rectangles that can be painted by the authored flight.
 *
 * This is also the contract used by the text-obscuring regression test: the
 * two bead silhouettes plus the short follow corridor are checked against
 * readable DOM rectangles. The desktop route keeps that corridor in side air;
 * the reader's z-index boundary is the safety net at narrower widths.
 */
export function liquidFlightCoverageRects(
  source: LiquidScreenRect,
  target: LiquidScreenRect,
  progress: number,
): readonly LiquidScreenRect[] {
  const frame = computeLiquidFlightFrame(source, target, progress);
  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;
  const sourceShape = scaledShapeRect(
    shapeAtTravel(
      frame.source,
      sourceCenterX,
      sourceCenterY,
      targetCenterX,
      targetCenterY,
      frame.sourceTravel,
    ),
  );
  const landingShape = scaledShapeRect(
    shapeAtTravel(
      frame.landing,
      sourceCenterX,
      sourceCenterY,
      targetCenterX,
      targetCenterY,
      frame.landingTravel,
    ),
  );
  const coverage = [sourceShape, landingShape].filter((rect) => rect.width > 0 && rect.height > 0);
  if (frame.phase === "thread" || frame.phase === "break") {
    coverage.push(followCoverageRect(sourceShape, landingShape, 8));
  }
  return coverage;
}

export function LiquidDestination({
  id,
  children,
  className,
  measure,
}: {
  readonly id: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly measure?: LiquidDestinationMeasure;
}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useEffect(() => registerLiquidDestination(id, element, measure), [id, element, measure]);
  return (
    <div ref={setElement} className={className} data-liquid-destination={id}>
      {children}
    </div>
  );
}

type FlightPoint = { readonly x: number; readonly y: number };

function flightRoutePoints(
  sourceCenterX: number,
  sourceCenterY: number,
  targetCenterX: number,
  targetCenterY: number,
): readonly FlightPoint[] {
  if (typeof window === "undefined") {
    return [
      { x: sourceCenterX, y: sourceCenterY },
      {
        x: sourceCenterX + (targetCenterX - sourceCenterX) * 0.5,
        y: sourceCenterY + (targetCenterY - sourceCenterY) * 0.5,
      },
      { x: targetCenterX, y: targetCenterY },
    ];
  }
  if (window.innerWidth < 960) {
    // The phone source is a full-width button. Hold it in place until it has
    // melted to a pinprick, then send that pinprick out past the right edge so
    // the prose never becomes the flight's visible runway.
    return [
      { x: sourceCenterX, y: sourceCenterY },
      { x: window.innerWidth + 260, y: sourceCenterY },
      { x: targetCenterX, y: targetCenterY },
    ];
  }
  // On a desktop lesson the centre column ends before the right air lane. Use
  // three deliberate legs: leave horizontally, descend in side air, then
  // return at toolbar height. A single quadratic curve bends back through the
  // first prose line near the end, which makes the effect look like ink over
  // the copy even when the reader layer is correctly above it.
  const sideX = Math.max(sourceCenterX + 240, window.innerWidth - 80);
  return [
    { x: sourceCenterX, y: sourceCenterY },
    { x: sideX, y: sourceCenterY },
    { x: sideX, y: targetCenterY },
    { x: targetCenterX, y: targetCenterY },
  ];
}

function pointAtFlightTravel(
  sourceCenterX: number,
  sourceCenterY: number,
  targetCenterX: number,
  targetCenterY: number,
  travel: number,
): { readonly x: number; readonly y: number } {
  const t = Math.min(1, Math.max(0, travel));
  const route = flightRoutePoints(sourceCenterX, sourceCenterY, targetCenterX, targetCenterY);
  if (route.length === 4) {
    const firstLegEnd = 0.24;
    const secondLegEnd = 0.72;
    if (t < firstLegEnd) {
      const local = smoothstep(t / firstLegEnd);
      return {
        x: route[0].x + (route[1].x - route[0].x) * local,
        y: route[0].y + (route[1].y - route[0].y) * local,
      };
    }
    if (t < secondLegEnd) {
      const local = smoothstep((t - firstLegEnd) / (secondLegEnd - firstLegEnd));
      return {
        x: route[1].x + (route[2].x - route[1].x) * local,
        y: route[1].y + (route[2].y - route[1].y) * local,
      };
    }
    const local = smoothstep((t - secondLegEnd) / (1 - secondLegEnd));
    return {
      x: route[2].x + (route[3].x - route[2].x) * local,
      y: route[2].y + (route[3].y - route[2].y) * local,
    };
  }
  const [from, control, to] = route;
  const fromSource = 1 - t;
  return {
    x: fromSource * fromSource * from.x + 2 * fromSource * t * control.x + t * t * to.x,
    y: fromSource * fromSource * from.y + 2 * fromSource * t * control.y + t * t * to.y,
  };
}

function flightBounds(
  source: LiquidScreenRect,
  target: LiquidScreenRect,
): {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
} {
  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;
  const route = flightRoutePoints(sourceCenterX, sourceCenterY, targetCenterX, targetCenterY);
  const left = Math.floor(
    Math.min(...route.map((point) => point.x - source.width / 2)) - LIQUID_CTA_BOUNDS_PADDING,
  );
  const top = Math.floor(
    Math.min(...route.map((point) => point.y - source.height / 2)) - LIQUID_CTA_BOUNDS_PADDING,
  );
  const right = Math.ceil(
    Math.max(...route.map((point) => point.x + source.width / 2)) + LIQUID_CTA_BOUNDS_PADDING,
  );
  const bottom = Math.ceil(
    Math.max(...route.map((point) => point.y + source.height / 2)) + LIQUID_CTA_BOUNDS_PADDING,
  );
  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function relativeShapeStyle(
  shape: LiquidScreenRect,
  bounds: { readonly left: number; readonly top: number },
): CSSProperties {
  return {
    left: shape.x - bounds.left,
    top: shape.y - bounds.top,
    width: shape.width,
    height: shape.height,
  };
}

function shapeAtTravel(
  shape: LiquidFlightShape,
  sourceCenterX: number,
  sourceCenterY: number,
  targetCenterX: number,
  targetCenterY: number,
  travel: number,
): LiquidFlightShape {
  const { x: centerX, y: centerY } = pointAtFlightTravel(
    sourceCenterX,
    sourceCenterY,
    targetCenterX,
    targetCenterY,
    travel,
  );
  return {
    ...shape,
    x: centerX - shape.width / 2,
    y: centerY - shape.height / 2,
  };
}

export function LiquidCtaTransitionLayer() {
  const transition = useSyncExternalStore(
    subscribeLiquidCtaTransition,
    liquidCtaTransitionSnapshot,
    () => null,
  );
  const [clock, setClock] = useState<{ readonly token: number | null; readonly progress: number }>({
    token: null,
    progress: 0,
  });

  useEffect(() => {
    if (!transition || transition.phase === "pending") {
      setClock({ token: transition?.token ?? null, progress: 0 });
      return;
    }

    const token = transition.token;
    if (transition.debugProgress !== null || transition.phase === "settling") {
      setClock({ token, progress: transition.debugProgress ?? 1 });
      if (transition.phase !== "settling" || transition.debugProgress !== null) return;
      const timer = window.setTimeout(
        () => completeLiquidCtaTransition(token),
        LIQUID_CTA_SETTLE_HOLD_MS,
      );
      return () => window.clearTimeout(timer);
    }

    const startedAt = transition.startedAt ?? now();
    let frame = 0;
    const tick = (timestamp: number) => {
      const progress = clamp01((timestamp - startedAt) / LIQUID_CTA_DURATION_MS);
      setClock({ token, progress });
      if (progress >= 1) holdLiquidCtaTransition(token);
      else frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [transition?.token, transition?.phase, transition?.debugProgress, transition?.startedAt]);

  if (!transition || transition.phase === "pending" || !transition.target) return null;
  const progress =
    clock.token === transition.token ? clock.progress : (transition.debugProgress ?? 0);
  const frame = computeLiquidFlightFrame(transition.source, transition.target, progress);
  const bounds = flightBounds(transition.source, transition.target);
  const sourceCenterX = transition.source.x + transition.source.width / 2;
  const sourceCenterY = transition.source.y + transition.source.height / 2;
  const targetCenterX = transition.target.x + transition.target.width / 2;
  const targetCenterY = transition.target.y + transition.target.height / 2;
  const landing = shapeAtTravel(
    frame.landing,
    sourceCenterX,
    sourceCenterY,
    targetCenterX,
    targetCenterY,
    frame.landingTravel,
  );
  const sourcePosition = pointAtFlightTravel(
    sourceCenterX,
    sourceCenterY,
    targetCenterX,
    targetCenterY,
    frame.sourceTravel,
  );

  return (
    <div
      className="liquid-cta__flight"
      data-liquid-cta-flight="true"
      data-liquid-cta-flight-phase={frame.phase}
      data-liquid-cta-flight-progress={frame.progress.toFixed(3)}
      data-liquid-cta-flight-travel={frame.travel.toFixed(3)}
      aria-hidden="true"
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
    >
      <LiquidGroup
        className="liquid-cta__flight-liquid"
        fill="var(--liquid-cta-fill)"
        stroke="1px solid var(--game-ui-accent-bright)"
        shadow="var(--liquid-cta-shadow)"
        blur={4}
        contrast={24}
        filterPadding={10}
        motion="follow"
        waviness={0}
        style={
          {
            width: "100%",
            height: "100%",
            "--game-ui-liquid-gooey-move-tail": 0.32,
            "--game-ui-liquid-gooey-move-stretch": 0.14,
          } as CSSProperties
        }
      >
        <LiquidGroup.Item
          className="liquid-cta__flight-item liquid-cta__flight-item--source"
          radius={999}
          scale={frame.source.scale}
          x={sourcePosition.x - sourceCenterX}
          y={sourcePosition.y - sourceCenterY}
          style={relativeShapeStyle(frame.source, bounds)}
        >
          <span className="liquid-cta__flight-shape" />
        </LiquidGroup.Item>
        <LiquidGroup.Item
          className="liquid-cta__flight-item liquid-cta__flight-item--landing"
          radius={999}
          scale={frame.landing.scale}
          style={relativeShapeStyle(landing, bounds)}
        >
          <span className="liquid-cta__flight-shape" />
        </LiquidGroup.Item>
      </LiquidGroup>
    </div>
  );
}

export interface LiquidCtaDebugApi {
  readonly setProgress: (progress: number) => void;
  readonly clearProgress: () => void;
  readonly cancel: () => void;
  readonly snapshot: () => LiquidCtaTransitionSnapshot | null;
}

const debugApi: LiquidCtaDebugApi = {
  setProgress: setLiquidCtaDebugProgress,
  clearProgress: clearLiquidCtaDebugProgress,
  cancel: () => cancelLiquidCtaTransition(),
  snapshot: liquidCtaTransitionSnapshot,
};

declare global {
  interface Window {
    __universityLiquidCta?: LiquidCtaDebugApi;
  }
}

if (typeof window !== "undefined") window.__universityLiquidCta = debugApi;
