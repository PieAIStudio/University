import { useSyncExternalStore } from "react";

/**
 * What a route decides about layout, once the route itself stopped being this
 * shell's private business.
 *
 * `isBareView` and `activeIdForView` moved to `@pieai/university-core` with the
 * `View` union: both campuses ask the same two questions of the same address,
 * and a second answer to 「这个地址点亮哪个槽」 is exactly the kind of drift the
 * shared union exists to remove. What is left here is a media query, which is
 * about this document rather than about the address.
 */
export function useMinWidth(px: number): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window.matchMedia !== "function") return () => undefined;
      const mq = window.matchMedia(`(min-width: ${px}px)`);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () =>
      typeof window.matchMedia === "function"
        ? window.matchMedia(`(min-width: ${px}px)`).matches
        : false,
    () => false,
  );
}
