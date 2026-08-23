import { useSyncExternalStore } from "react";

import type { View } from "../url-state";

/** Lesson is a bare route: UniversityShell must not mount. */
export function isBareView(view: View): boolean {
  return view.kind === "lesson";
}

export function activeIdForView(view: View): string {
  switch (view.kind) {
    case "world":
    case "course":
    case "settled":
    // The planet is where you choose which series to learn, so the rail's
    // 学习 stays lit while you are on it — you have not left learning to go
    // somewhere else, you are picking what to learn.
    case "planet":
      return "learn";
    case "library":
    case "terms":
    case "term":
    case "concepts":
    case "concept":
    case "anti-pattern":
    case "anti-pattern-entry":
      return "library";
    case "favourites":
      return "favourites";
    case "practice":
      return "practice";
    case "league":
      return "league";
    case "quests":
      return "quests";
    case "plans":
      return "plan";
    case "me":
    case "avatar-lab":
      return "profile";
    case "catalog":
      return "catalog";
    case "review":
      return "review";
    case "settings":
      return "settings";
    case "lesson":
      return "learn";
  }
}

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
