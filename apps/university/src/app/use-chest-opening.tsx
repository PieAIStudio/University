import {
  chestBaseline,
  chestReward,
  dailyFirstBonus,
  type ChestBaseline,
  type ChestReward,
  type LessonRef,
  type ProgressDocument,
} from "@pieai/university-core";
import { ChestRewards, type ChestRewardStage } from "@pieai/university-ui/path/ChestRewards.js";
import { usePrefersReducedMotion } from "@pieai/university-world";
import type { LessonPlacement } from "@pieai/university-world/Maps.js";
import {
  lessonChestTier,
  openingGuard,
  openingLength,
  openedTier,
  UPGRADE_LEAD,
  type ChestTier,
  type CourseOpening,
  type MonsterRole,
} from "@pieai/university-world/learning-nodes.js";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { progressPort, snapshot } from "../progress/store";

/** How long the camera takes to rise back to the map before the lesson's page shows. */
const LEAVING_MS = 950;
/** Deadlines past which the words move on without the scene (see the effect below). */
const OPENING_GRACE_SECONDS = 1.5;
const SKIP_DEADLINE_SECONDS = 1.2;
/** Three stars for a boss, each rising, flying and landing, then the flee. */
const THROW_DEADLINE_SECONDS = 6;

/** The chest the weekly boss dropped: what it holds was written when the last heart fell. */
export interface WeeklyChest {
  readonly week: string;
  readonly flawless: boolean;
  readonly reward: ChestReward;
  /** Once its card has closed. */
  readonly onDone?: () => void;
}

interface Flow {
  readonly source:
    | { readonly kind: "lesson"; readonly locator: LessonRef; readonly lessonNumber: number }
    | { readonly kind: "weekly"; readonly week: string; readonly onDone?: () => void };
  readonly tier: ChestTier;
  readonly from: ChestTier;
  readonly reward: ChestReward;
  readonly dailyFirst: boolean;
  readonly guard: ReturnType<typeof openingGuard>;
  readonly stage: ChestRewardStage | "leaving";
  readonly skipped: boolean;
}

/**
 * Finishing a lesson opens its chest on the island (V7 station 4). This hook
 * keeps the one piece of state that spans the lesson and the island: the
 * record as it stood when the lesson opened, so the chest can announce exactly
 * what the lesson added. It hands the scene a `CourseOpening` and the page its
 * DOM overlay; once it is no longer active the lesson's page follows.
 */
export function useChestOpening({
  lessonOpen,
  lessons,
  guardName,
}: {
  /** The lesson being read now, or null. The baseline is taken when it changes. */
  readonly lessonOpen: LessonRef | null;
  readonly lessons: readonly LessonPlacement[];
  readonly guardName: (role: MonsterRole) => string;
}): {
  readonly active: boolean;
  /** The chest open now is the weekly boss's, on the course island rather than after a lesson. */
  readonly weekly: boolean;
  readonly opening: CourseOpening | null;
  readonly overlay: ReactNode;
  begin(locator: LessonRef): void;
  beginWeekly(chest: WeeklyChest): void;
} {
  const reducedMotion = usePrefersReducedMotion();
  const baseline = useRef<{ key: string; value: ChestBaseline } | null>(null);
  const lessonKey = lessonOpen
    ? `${lessonOpen.studyId}/${lessonOpen.courseId}/${lessonOpen.unitId}/${lessonOpen.lessonId}`
    : null;
  useEffect(() => {
    if (!lessonKey || baseline.current?.key === lessonKey) return;
    baseline.current = { key: lessonKey, value: chestBaseline(snapshot()) };
  }, [lessonKey]);

  const [flow, setFlow] = useState<Flow | null>(null);

  const begin = (locator: LessonRef) => {
    const key = `${locator.studyId}/${locator.courseId}/${locator.unitId}/${locator.lessonId}`;
    const index = lessons.findIndex((lesson) => lesson.lessonId === locator.lessonId);
    const from = baseline.current?.key === key ? baseline.current.value : null;
    // Nothing to compare against (a reload mid-lesson): no chest, the page as before.
    if (index < 0 || !from) return;
    const cardsOf = (document: ProgressDocument) =>
      Object.keys(document.cards).filter((cardKey) =>
        cardKey.startsWith(`${locator.studyId}/${locator.courseId}/${locator.lessonId}/`),
      ).length;
    const after = snapshot();
    let reward = chestReward({
      baseline: from,
      after,
      locator,
      reviewCards: cardsOf(after),
      knowledgeCards: 0,
    });
    const bonus = dailyFirstBonus(after, Date.now(), reward.xp);
    if (bonus) {
      progressPort.addXp(bonus.eventId, bonus.amount);
      reward = { ...reward, xp: reward.xp + bonus.amount };
    }
    const tier = lessonChestTier(lessons, index);
    setFlow({
      source: { kind: "lesson", locator, lessonNumber: index + 1 },
      from: tier,
      tier: openedTier(tier, reward.allFirstTry),
      reward,
      dailyFirst: bonus !== null,
      guard: reducedMotion ? null : openingGuard(lessons, index),
      stage: "closed",
      skipped: false,
    });
  };

  const beginWeekly = (chest: WeeklyChest) =>
    setFlow({
      source: {
        kind: "weekly",
        week: chest.week,
        ...(chest.onDone ? { onDone: chest.onDone } : {}),
      },
      from: "epic",
      tier: openedTier("epic", chest.flawless),
      reward: chest.reward,
      dailyFirst: false,
      guard: null,
      stage: "closed",
      skipped: false,
    });

  const update = (patch: Partial<Flow>) =>
    setFlow((current) => (current ? { ...current, ...patch } : current));

  /*
    The scene reports when the chest has settled and when the monster has run.
    Where it cannot (no WebGL, a hidden tab, a lost context), the words must
    not wait for it forever: each stage has a deadline a little past its own
    length, after which the page moves on as if the scene had reported.
  */
  useEffect(() => {
    if (!flow || (flow.stage !== "opening" && flow.stage !== "throwing")) return;
    const seconds =
      flow.stage === "throwing"
        ? THROW_DEADLINE_SECONDS
        : flow.skipped
          ? SKIP_DEADLINE_SECONDS
          : openingLength(flow.tier) + UPGRADE_LEAD + OPENING_GRACE_SECONDS;
    const timer = window.setTimeout(
      () =>
        setFlow((current) =>
          current?.stage === "throwing"
            ? { ...current, stage: "done" }
            : current?.stage === "opening"
              ? { ...current, stage: "rewards" }
              : current,
        ),
      seconds * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [flow?.stage, flow?.skipped, flow?.tier]);

  useEffect(() => {
    if (flow?.stage !== "leaving") return;
    const done = flow.source.kind === "weekly" ? flow.source.onDone : undefined;
    const timer = window.setTimeout(
      () => {
        setFlow(null);
        done?.();
      },
      reducedMotion ? 0 : LEAVING_MS,
    );
    return () => window.clearTimeout(timer);
  }, [flow?.stage, reducedMotion]);

  const opening = useMemo<CourseOpening | null>(() => {
    if (!flow) return null;
    const started = flow.stage !== "closed";
    const weekly = flow.source.kind === "weekly";
    return {
      lessonId: flow.source.kind === "lesson" ? flow.source.locator.lessonId : "",
      ...(flow.source.kind === "weekly"
        ? { owner: { kind: "weekly" as const, week: flow.source.week } }
        : {}),
      tier: flow.tier,
      from: flow.from,
      started,
      skipped: flow.skipped,
      // The boss's chest drops beside the learner in close-up; the camera stays for the tap.
      closeUp: (started || weekly) && flow.stage !== "leaving",
      guard: flow.guard?.stop ?? null,
      throwing: {
        started: flow.stage === "throwing" || flow.stage === "done" || flow.stage === "leaving",
        onDone: () => update({ stage: "done" }),
      },
      onPhase: (phase) => {
        if (phase === "settled")
          setFlow((current) =>
            current?.stage === "opening" ? { ...current, stage: "rewards" } : current,
          );
      },
      onTap: () =>
        setFlow((current) =>
          !current
            ? current
            : current.stage === "closed"
              ? { ...current, stage: "opening" }
              : current.stage === "opening"
                ? { ...current, skipped: true }
                : current,
        ),
    };
  }, [flow]);

  const overlay =
    flow && flow.stage !== "leaving" ? (
      <ChestRewards
        stage={flow.stage}
        tier={flow.tier}
        upgraded={flow.tier !== flow.from}
        reward={flow.reward}
        dailyFirst={flow.dailyFirst}
        {...(flow.source.kind === "lesson" ? { lessonNumber: flow.source.lessonNumber } : {})}
        guardName={flow.guard ? guardName(flow.guard.role) : null}
        reducedMotion={reducedMotion}
        onOpen={() => update({ stage: "opening" })}
        onSkip={() => update({ skipped: true })}
        onThrow={() => update({ stage: "throwing" })}
        onContinue={() => update({ stage: "leaving" })}
      />
    ) : null;

  return {
    active: flow !== null,
    weekly: flow?.source.kind === "weekly",
    opening,
    overlay,
    begin,
    beginWeekly,
  };
}
