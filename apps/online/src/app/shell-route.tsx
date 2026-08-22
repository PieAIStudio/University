import { useSyncExternalStore } from "react";

import type { ShellCounter } from "@pieai/university-ui/navigation/UniversityShell.js";
import { IslandIcon, StreakIcon } from "@pieai/university-ui/shell/icons.js";

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
  /*
    Only counters that count something.

    学分 and ⚡额度 were rendering a hardcoded "0", and neither system exists —
    so the first thing a new learner read about themselves was three zeros in
    muted brown. A zero is a claim: it says you have none of a thing. Nothing
    is the honest state for a thing that has not been built, and it reads
    better besides.

    Their slots are held in the player journey (v3 「顶部四计数」) and they come
    back the moment they carry a real number. The streak stays at zero because
    zero days is a true fact about a real system, and greying it is how
    Duolingo says the same thing.
  */
  const muted = args.streakDays === 0;
  return [
    /*
      The project's name, not just its icon. v3 「顶部四计数」 puts the current
      project where Duolingo puts the language flag, and that slot is the
      answer to "where am I" — the first question a returning learner has.
      Rendering the icon alone meant the only place the project was named was
      a label floating in the 3D scene, which disappears the moment you enter
      a course.
    */
    { id: "island", icon: <IslandIcon />, value: args.projectName, label: "当前项目" },
    {
      id: "streak",
      icon: <StreakIcon />,
      value: String(args.streakDays),
      label: "连击",
      href: "#/quests",
      muted,
    },
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
