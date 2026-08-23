import type { ReactNode } from "react";

import { IslandIcon, StreakIcon } from "../shell/icons.js";
import type { ShellCounter } from "../shell/AppShell.js";

/**
 * The counter row both shells wear.
 *
 * This lived in `apps/online` and the authoring shell kept its own copy, which
 * is how they drifted: the delivery shell learned that a hardcoded zero is a
 * lie and the authoring shell never heard about it. One implementation now,
 * because "what belongs in the counter row" is one product decision and not
 * two.
 *
 * It sits in `navigation/` rather than `shell/` on purpose. `shell/` is the
 * product-neutral chrome that has to stay liftable into SwimmerUIKit, and
 * these labels and hrefs are University's.
 *
 * **Only counters that count something.** 学分 and ⚡额度 used to render a
 * hardcoded "0" in both shells, and neither system exists — so the first thing
 * a new learner read about themselves was three zeros in muted brown. A zero
 * is a claim: it says you have none of a thing. For a thing that has not been
 * built, nothing is the honest state, and it reads better besides. Their slots
 * are held in the player journey (v3 「顶部四计数」) and come back the moment
 * they carry a real number.
 */
export function universityCounters(args: {
  /**
   * The project you are in, not the size of the catalogue. v3 「顶部四计数」
   * puts it where Duolingo puts the language flag, and that slot answers
   * "where am I" — the first question a returning learner has. Rendering the
   * icon alone left the project named nowhere but a label floating in the 3D
   * scene, which disappears the moment you enter a course.
   */
  readonly projectName: string;
  /** The ▾ next to the name. Absent, the slot stays a labelled value. */
  readonly projectControl?: ReactNode;
  /**
   * `null` means this shell has no streak signal yet — not that the streak is
   * zero. The authoring shell is in that state until ADR-0001's shared
   * progress lands, and it was rendering a literal "0" for a number it had no
   * way to know. A counter that cannot be wrong is worth more than a counter
   * that is always there.
   *
   * A real zero still renders, greyed. Zero days is a true fact about a system
   * that exists, and greying it is how Duolingo says the same thing.
   */
  readonly streakDays: number | null;
}): readonly ShellCounter[] {
  const counters: ShellCounter[] = [
    {
      id: "island",
      icon: <IslandIcon />,
      value: args.projectName,
      label: "当前项目",
      control: args.projectControl,
    },
  ];
  if (args.streakDays !== null) {
    counters.push({
      id: "streak",
      icon: <StreakIcon />,
      value: String(args.streakDays),
      label: "连击",
      href: "#/quests",
      muted: args.streakDays === 0,
    });
  }
  return counters;
}
