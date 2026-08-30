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
  readonly source: LiquidFlightShape;
  readonly landing: LiquidFlightShape;
}

export const LIQUID_CTA_DURATION_MS = 352;
const LIQUID_CTA_SETTLE_HOLD_MS = 72;
const LIQUID_CTA_TARGET_GRACE_MS = 640;
const LIQUID_CTA_BOUNDS_PADDING = 12;

type LiquidDestinationRegistration =
  | { readonly kind: "element"; readonly element: HTMLElement }
  | { readonly kind: "rect"; readonly rect: LiquidScreenRect };

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
  if (registration.kind === "rect") return visibleRect(registration.rect);
  return visibleRect(screenRectOf(registration.element.getBoundingClientRect()));
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

export function courseMapDestinationId(studyId: string, courseId: string): string {
  return liquidDestinationId("course-map", `${studyId}/${courseId}`);
}

export function lessonProgressDestinationId(
  studyId: string,
  courseId: string,
  lessonId: string,
): string {
  return liquidDestinationId("lesson-progress", `${studyId}/${courseId}/${lessonId}`);
}

/** Register a visible DOM destination and return the exact cleanup for it. */
export function registerLiquidDestination(id: string, element: HTMLElement | null): () => void {
  if (!id || !element) return () => undefined;
  const registration: LiquidDestinationRegistration = { kind: "element", element };
  destinations.set(id, registration);
  resolvePendingDestination(id);
  return () => {
    if (destinations.get(id) !== registration) return;
    destinations.delete(id);
    if (transitionSnapshot?.phase === "pending" && transitionSnapshot.destinationId === id) {
      notify();
    }
  };
}

/** Update a renderer-owned target without making the renderer itself reactive. */
export function setLiquidDestination(id: string, rect: LiquidScreenRect | null): void {
  if (!id) return;
  if (!rect) destinations.delete(id);
  else destinations.set(id, { kind: "rect", rect });
  resolvePendingDestination(id);
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
 * string instead of a rectangle travelling across the screen.
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
  let phase: LiquidCtaFlightPhase;
  let travel: number;
  let sourceTravel: number;
  let sourceScale: number;
  let landingScale: number;

  if (p < pressEnd) {
    phase = "press";
    const local = smoothstep(p / pressEnd);
    travel = 0.025 * local;
    sourceTravel = travel;
    sourceScale = 1 + 0.05 * local;
    landingScale = 0.01;
  } else if (p < stretchEnd) {
    phase = "stretch";
    const local = smoothstep((p - pressEnd) / (stretchEnd - pressEnd));
    travel = 0.025 + 0.16 * local;
    sourceTravel = travel;
    sourceScale = 1.05 - 0.05 * local;
    landingScale = 0.01;
  } else if (p < threadEnd) {
    phase = "thread";
    const local = easeInOut((p - stretchEnd) / (threadEnd - stretchEnd));
    travel = 0.185 + 0.815 * local;
    sourceTravel = travel;
    sourceScale = 1;
    landingScale = 0.01;
  } else if (p < breakEnd) {
    phase = "break";
    const local = smoothstep((p - threadEnd) / (breakEnd - threadEnd));
    travel = 1;
    // Pull the shrinking source back along the travelled path so the landing
    // bead can grow at the target without two blobs stacking on one another.
    sourceTravel = 1 - 0.56 * local;
    sourceScale = 1 - 0.99 * local;
    landingScale = 0.01 + 0.99 * local;
  } else {
    phase = "land";
    const local = smoothstep((p - breakEnd) / (1 - breakEnd));
    travel = 1;
    sourceTravel = 0.44;
    sourceScale = 0.01;
    landingScale = 1.04 - 0.04 * local;
  }

  return {
    progress: p,
    phase,
    travel,
    sourceTravel,
    source: { ...source, scale: sourceScale },
    landing: { ...target, scale: landingScale },
  };
}

export function LiquidDestination({
  id,
  children,
  className,
}: {
  readonly id: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useEffect(() => registerLiquidDestination(id, element), [id, element]);
  return (
    <div ref={setElement} className={className} data-liquid-destination={id}>
      {children}
    </div>
  );
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
  const left = Math.floor(Math.min(source.x, target.x) - LIQUID_CTA_BOUNDS_PADDING);
  const top = Math.floor(Math.min(source.y, target.y) - LIQUID_CTA_BOUNDS_PADDING);
  const right = Math.ceil(
    Math.max(source.x + source.width, target.x + target.width) + LIQUID_CTA_BOUNDS_PADDING,
  );
  const bottom = Math.ceil(
    Math.max(source.y + source.height, target.y + target.height) + LIQUID_CTA_BOUNDS_PADDING,
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
          x={(targetCenterX - sourceCenterX) * frame.sourceTravel}
          y={(targetCenterY - sourceCenterY) * frame.sourceTravel}
          style={relativeShapeStyle(frame.source, bounds)}
        >
          <span className="liquid-cta__flight-shape" />
        </LiquidGroup.Item>
        <LiquidGroup.Item
          className="liquid-cta__flight-item liquid-cta__flight-item--landing"
          radius={999}
          scale={frame.landing.scale}
          style={relativeShapeStyle(frame.landing, bounds)}
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
