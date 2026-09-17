import { useMemo, useSyncExternalStore } from "react";

const serverSnapshot = () => false;

/** Subscribe once; never allocate a MediaQueryList in a render-frame callback. */
export function usePrefersReducedMotion(): boolean {
  const store = useMemo(() => {
    const media =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : undefined;
    return {
      getSnapshot: () => media?.matches ?? false,
      subscribe: (notify: () => void) => {
        media?.addEventListener("change", notify);
        return () => media?.removeEventListener("change", notify);
      },
    };
  }, []);
  // A browser preference is external state. Do not defer it behind a
  // concurrent scene render while the existing frame callback keeps pulsing.
  return useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);
}
