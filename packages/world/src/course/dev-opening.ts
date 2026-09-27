import { useEffect, useMemo, useState } from "react";

import type { CourseOpening } from "./ChestOpening.js";
import type { ChestTier, CourseChest } from "./chests-and-monsters.js";

const TIERS: readonly ChestTier[] = ["wood", "rare", "epic", "legendary"];

/**
 * Development only: `?v7open=<tier>` stages the opening on the chest you can
 * take now, so the scene can be judged before the lesson flow drives it
 * (`?v7open=wood&v7from=wood` shows no upgrade, `v7from` lower shows one).
 * Tapping the chest starts it. Production builds never read the URL here.
 */
export function useDevOpening(chests: readonly CourseChest[]): CourseOpening | null {
  const [started, setStarted] = useState(false);
  const [throwing, setThrowing] = useState(false);
  const params = useMemo(() => {
    if (!import.meta.env.DEV || typeof location === "undefined") return null;
    const query = new URLSearchParams(location.search);
    const tier = query.get("v7open") as ChestTier | null;
    if (!tier || !TIERS.includes(tier)) return null;
    const from = (query.get("v7from") as ChestTier | null) ?? tier;
    return {
      tier,
      from: TIERS.includes(from) ? from : tier,
      auto: query.has("v7start"),
      boss: query.has("v7boss"),
    };
  }, []);
  useEffect(() => {
    if (!params) return;
    const bag = globalThis as unknown as { __v7OpenStart?: () => void };
    const throwBag = globalThis as unknown as { __v7Throw?: () => void };
    bag.__v7OpenStart = () => setStarted(true);
    throwBag.__v7Throw = () => setThrowing(true);
    return () => {
      delete bag.__v7OpenStart;
      delete throwBag.__v7Throw;
    };
  }, [params]);
  const ready = chests.find((chest) => chest.state === "ready" && chest.owner.kind === "lesson");
  if (!params || !ready || ready.owner.kind !== "lesson") return null;
  // The star goes to the next lesson's monster, or with `v7boss` to the first gate's boss.
  const next = chests[chests.indexOf(ready) + 1];
  const gate = chests.find((chest) => chest.owner.kind === "checkpoint");
  const guard =
    params.boss && gate && gate.owner.kind === "checkpoint"
      ? { siteId: gate.owner.siteId }
      : next && next.owner.kind === "lesson"
        ? { lessonId: next.owner.lessonId }
        : null;
  return {
    lessonId: ready.owner.lessonId,
    tier: params.tier,
    from: params.from,
    started: started || params.auto,
    closeUp: started || params.auto,
    guard,
    throwing: { started: throwing },
    onTap: () => setStarted(true),
  };
}

/**
 * Development only: `?v7wisps=<n>` brings wisps back to the first n lesson
 * stones, so the review wisps can be judged before review data drives them.
 */
export function devWispLessons(lessonIds: readonly string[]): readonly string[] | null {
  if (!import.meta.env.DEV || typeof location === "undefined") return null;
  const count = Number(new URLSearchParams(location.search).get("v7wisps") ?? "0");
  return count > 0 ? lessonIds.slice(0, count) : null;
}

/** `?v7weekly` stands this week's boss at the shore, to look at before the app decides it. */
export function devWeeklyBoss(): { readonly week: string } | null {
  if (!import.meta.env.DEV || typeof location === "undefined") return null;
  return new URLSearchParams(location.search).has("v7weekly") ? { week: "dev" } : null;
}
