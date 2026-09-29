import type { View } from "@pieai/university-core";

export const SPLASH_VISIT_KEY = "university.splash.v1";
type VisitStorage = Pick<Storage, "getItem" | "setItem">;

export function splashVisit(storage: VisitStorage | null): number {
  try {
    const count = Number(storage?.getItem(SPLASH_VISIT_KEY) ?? 0);
    return Number.isSafeInteger(count) && count >= 0 ? count : 0;
  } catch {
    return 0;
  }
}

export function rememberSplashVisit(storage: VisitStorage | null, visit: number): void {
  try {
    storage?.setItem(SPLASH_VISIT_KEY, String(Math.min(visit + 1, 1_000_000)));
  } catch {
    /* Presentation memory is optional. */
  }
}

export function splashStorage(): VisitStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Only the approved, currently true claims. Never advertise connected AI providers. */
export const SPLASH_POINTS = ["why", "prepared", "example", "memory", "play", "time"] as const;
export type SplashPoint = (typeof SPLASH_POINTS)[number];
export function splashPoints(visit: number): readonly SplashPoint[] {
  const offset = (Number.isSafeInteger(visit) && visit >= 0 ? visit : 0) % SPLASH_POINTS.length;
  return Array.from(
    { length: 3 },
    (_, index) => SPLASH_POINTS[(offset + index) % SPLASH_POINTS.length]!,
  );
}

/** Progress measures completed work: content, asset loading, and an actual complete frame. */
export function splashProgress(
  dataReady: boolean,
  loaded: number,
  total: number,
  frameReady: boolean,
): number {
  if (dataReady && frameReady) return 1;
  const assets =
    Number.isFinite(loaded) && Number.isFinite(total) && total > 0
      ? Math.max(0, Math.min(1, loaded / total))
      : 0;
  return ((dataReady ? 1 : 0) + assets) / 3;
}

/** Deep lesson/auth links keep their destination; an internal navigation is a transition, not a new launch. */
export function isSplashEntry(
  view: View,
  url: URL,
  referrer = "",
  navigationType = "navigate",
): boolean {
  if (view.kind !== "world" && view.kind !== "course" && view.kind !== "planet") return false;
  if ([...url.searchParams.keys()].some((key) => key !== "lang" && !key.startsWith("utm_")))
    return false;
  if (url.hash && !url.hash.startsWith("#/")) return false;
  if (referrer && navigationType !== "reload") {
    try {
      if (new URL(referrer).origin === url.origin) return false;
    } catch {
      /* Not a usable internal navigation. */
    }
  }
  return true;
}
