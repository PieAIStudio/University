import type { AvatarHandle } from "@pieai/swimmer-avatar-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import type { LessonPlacement } from "../Maps.js";
import type { CourseOpening } from "./ChestOpening.js";
import type { MonsterPlacement, MonsterReaction, MonsterReactionPhase } from "./MonsterField.js";
import { BOSS_HEIGHT, MONSTER_HEIGHT } from "./chests-and-monsters.js";
import type { ThrowEvent } from "./StarThrow.js";

/**
 * How the monster takes the star, chosen fresh each time so the moment does not
 * wear out (V7: 「小怪的反应每次随机一种」): shake its head and beg, then get hit
 * and run; run before the star even lands; or get hit, jump and spin, and run.
 */
export type ReactionStyle = "beg" | "early" | "spin";
const STYLES: readonly ReactionStyle[] = ["beg", "early", "spin"];

/** The stop whose monster the star chases off: the next lesson, or the segment's gate. */
export type GuardedStop = { readonly lessonId: string } | { readonly siteId: string };

/**
 * The lessons as the monsters should see them while a star is still to be
 * thrown: the next stop stays guarded until its monster has run. When the
 * lesson just finished was the one that cleared its segment, it is shown
 * unfinished to the monsters alone, so the boss is still standing to be
 * chased away. Nothing else on the island reads these.
 */
export function guardedLessons(
  lessons: readonly LessonPlacement[],
  opened: string,
  guard: GuardedStop | null,
): readonly LessonPlacement[] {
  if (!guard) return lessons;
  return lessons.map((lesson) =>
    "lessonId" in guard && lesson.lessonId === guard.lessonId
      ? { ...lesson, state: "locked" as const }
      : "siteId" in guard && lesson.lessonId === opened
        ? { ...lesson, state: "live" as const }
        : lesson,
  );
}

export function isGuardedPlacement(entry: MonsterPlacement, guard: GuardedStop): boolean {
  const stop = entry.monster.stop;
  return "lessonId" in guard
    ? stop.kind === "lesson" && stop.lessonId === guard.lessonId
    : "siteId" in stop && stop.siteId === guard.siteId;
}

/**
 * The star-throw half of the opening: which monster is chased, how it reacts
 * to each star, and when the stop it guarded is open. The course scene renders
 * the pieces; this only sequences them.
 */
export function useChestSequence({
  opening,
  avatarAt,
}: {
  readonly opening: CourseOpening | null;
  readonly avatarAt: THREE.Vector3 | null;
}) {
  const [gone, setGone] = useState(false);
  const [phase, setPhase] = useState<MonsterReactionPhase | null>(null);
  const style = useRef<ReactionStyle>("beg");
  const timers = useRef<number[]>([]);
  const avatar = useRef<AvatarHandle | null>(null);
  const throwing = opening?.throwing ?? null;
  const key = `${opening?.lessonId ?? ""}:${throwing?.started ? 1 : 0}`;
  useEffect(() => {
    setGone(false);
    setPhase(null);
    style.current = STYLES[Math.floor(Math.random() * STYLES.length)]!;
    return () => {
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current = [];
    };
  }, [key]);
  const later = (seconds: number, next: MonsterReactionPhase) => {
    timers.current.push(window.setTimeout(() => setPhase(next), seconds * 1000));
  };
  const guard = opening && !gone ? (opening.guard ?? null) : null;

  const onThrow = useCallback((event: ThrowEvent) => {
    const how = style.current;
    if (event.kind === "release" && event.star === 0) {
      if (how === "early") later(0.3, "flee");
      else setPhase("brace");
    }
    if (event.kind === "impact" && event.last && how !== "early") {
      setPhase(how === "spin" ? "spin" : "hit");
      later(how === "spin" ? 0.75 : 0.5, "flee");
    }
  }, []);

  const doneRef = useRef(throwing?.onDone);
  doneRef.current = throwing?.onDone;
  const reactionFor = (target: MonsterPlacement | null): MonsterReaction | null => {
    if (!target || !phase || !avatarAt) return null;
    const away = target.at.clone().sub(avatarAt).setY(0);
    if (away.lengthSq() < 1e-6) away.set(0, 0, -1);
    return {
      monsterId: target.monster.id,
      phase,
      away: away.normalize(),
      onGone: () => {
        setGone(true);
        setPhase(null);
        doneRef.current?.();
      },
    };
  };

  return {
    guard,
    /** Stars for this throw: three for a segment's boss. */
    stars: guard && "siteId" in guard ? 3 : 1,
    avatar,
    onAvatar: useCallback((handle: AvatarHandle | null) => {
      avatar.current = handle;
    }, []),
    onThrow,
    reactionFor,
    gone,
  };
}

/** The point a star aims at: the middle of the monster. */
export function starTarget(entry: MonsterPlacement): THREE.Vector3 {
  const height = entry.monster.boss ? BOSS_HEIGHT : MONSTER_HEIGHT;
  return entry.at.clone().setY(entry.at.y + height * 0.55);
}
