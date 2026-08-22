import { useSyncExternalStore } from "react";

import type { ShellCounter } from "@pieai/university-ui/navigation/UniversityShell.js";
import {
  CreditIcon,
  EnergyIcon,
  IslandIcon,
  StreakIcon,
} from "@pieai/university-ui/shell/icons.js";

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

export function shellCounters(args: {
  readonly projectName: string;
  readonly streakDays: number;
}): readonly ShellCounter[] {
  const muted = args.streakDays === 0;
  return [
    { id: "island", icon: <IslandIcon />, label: args.projectName },
    {
      id: "streak",
      icon: <StreakIcon />,
      value: String(args.streakDays),
      label: "连击",
      href: "#/quests",
      muted,
    },
    { id: "credit", icon: <CreditIcon />, value: "0", label: "学分", href: "#/plans" },
    { id: "energy", icon: <EnergyIcon />, value: "0", label: "额度", href: "#/plans" },
  ];
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
