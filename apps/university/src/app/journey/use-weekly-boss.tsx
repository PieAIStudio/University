import {
  levelOf,
  weeklyBoss,
  weeklyBossLessons,
  weeklyBossWonEventId,
  weeklyBossFlawlessEventId,
  weeklyBossWeek,
  weeklyBossHistory,
  weeklyBossLocationEventId,
  type WeeklyBossHistory,
  WEEKLY_BOSS_HIT_XP,
  WEEKLY_BOSS_WIN_XP,
  type FinishedLesson,
  type LessonRef,
  type ProgressDocument,
  type WeeklyBoss,
} from "@pieai/university-core";
import type { CourseView, LessonView } from "@pieai/university-ui/view/lesson-view.js";
import {
  WeeklyBossFight,
  type WeeklyBossStrike,
} from "@pieai/university-ui/path/WeeklyBossFight.js";
import { usePrefersReducedMotion } from "@pieai/university-world";
import type { LessonPlacement, Marker } from "@pieai/university-world/Maps.js";
import {
  weeklyBossMarker,
  type BossStrike,
  type WeeklyBossScene,
} from "@pieai/university-world/learning-nodes.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { contentPort } from "../../ports/index";
import { progressPort, snapshot } from "../../progress/store";
import type { WeeklyChest } from "./use-chest-opening";
import { useLocalDay } from "./use-local-day";

type Exercises = LessonView["lesson"]["exercises"];
type CourseOf = (studyId: string, courseId: string) => CourseView | null;

/**
 * Three stars, the duck and the run take under five seconds; past this the
 * chest drops anyway, for a scene that cannot report (no WebGL, a hidden tab).
 */
const FINAL_DEADLINE_MS = 6000;

const keyOf = (lesson: FinishedLesson) => `${lesson.studyId}/${lesson.courseId}/${lesson.lessonId}`;

/**
 * The weekly boss on the island you are looking at (V7 mechanic 8; rules in
 * PLAN-V7-07 §2a): where it stands, the fight's card, and what each answer
 * writes and plays. Hearts are XP events, so the record is the only state that
 * outlives the fight; everything held here is the few seconds of a strike.
 *
 * The questions need the lessons' exercises, which only the content port has,
 * so they are fetched only on its course island or the course overview. The
 * overview crown is withheld until the actual five-question pool is known;
 * other routes do not fetch a boss they cannot show.
 */
export function useWeeklyBoss({
  progress,
  island,
  lessons,
  courseOf,
  onOpenLesson,
  onChest,
  showWorld = false,
}: {
  readonly progress: ProgressDocument;
  /** The course island on screen, or null. */
  readonly island: { readonly studyId: string; readonly courseId: string } | null;
  /** That island's stones, as the scene places them: the chip stands over the boss they place. */
  readonly lessons: readonly LessonPlacement[];
  readonly courseOf: CourseOf;
  readonly onOpenLesson: (locator: LessonRef) => void;
  /** The boss has run: its chest stands where it stood. */
  readonly onChest: (chest: WeeklyChest) => void;
  /** The overview may announce a boss only after its real question pool is read. */
  readonly showWorld?: boolean;
}): {
  /** What the course scene draws, or null when no boss stands on this island. */
  readonly scene: WeeklyBossScene | null;
  readonly overlay: ReactNode;
  /** The crown chip over the boss, while it stands and no fight is open. */
  readonly marker: Marker | null;
  readonly availableIsland: WeeklyBoss["island"] | null;
  readonly history: WeeklyBossHistory;
  open(): void;
} {
  const reducedMotion = usePrefersReducedMotion();
  const now = useLocalDay();
  const weekNow = weeklyBossWeek(now);
  // History changes with the progress document or week, not every animation render.
  const history = useMemo(() => weeklyBossHistory(progress, now), [progress, weekNow]);
  const interfaceTranslator = useI18n();
  const owner = progressPort.syncState().userId;
  const scope = `${owner ?? "guest"}:${island?.studyId ?? ""}/${island?.courseId ?? ""}:${weekNow}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const finished = weeklyBossLessons(progress, now);
  const last = finished[0];
  const here =
    island !== null &&
    last !== undefined &&
    last.studyId === island.studyId &&
    last.courseId === island.courseId;
  const finishedKeys = finished.map(keyOf).join("|");

  const refOf = (lesson: FinishedLesson): LessonRef | null => {
    const unit = courseOf(lesson.studyId, lesson.courseId)?.units.find((entry) =>
      entry.lessons.some((candidate) => candidate.id === lesson.lessonId),
    );
    return unit
      ? {
          studyId: lesson.studyId,
          courseId: lesson.courseId,
          unitId: unit.id,
          lessonId: lesson.lessonId,
        }
      : null;
  };

  const [exercises, setExercises] = useState<ReadonlyMap<string, Exercises>>(new Map());
  useEffect(() => {
    if (!here && !showWorld) return;
    const missing = finished.filter((lesson) => !exercises.has(keyOf(lesson)));
    if (missing.length === 0) return;
    const controller = new AbortController();
    void Promise.all(
      missing.map(async (lesson): Promise<readonly [string, Exercises]> => {
        const ref = refOf(lesson);
        if (!ref) return [keyOf(lesson), []];
        try {
          const view = await contentPort.lesson(ref, { signal: controller.signal });
          return [keyOf(lesson), view.lesson.exercises];
        } catch {
          // A lesson that will not load asks nothing; the boss comes only if five others can.
          return [keyOf(lesson), []];
        }
      }),
    ).then((entries) => {
      if (!controller.signal.aborted) setExercises((current) => new Map([...current, ...entries]));
    });
    return () => controller.abort();
    // `finishedKeys` stands for `finished`, which is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, showWorld, finishedKeys, owner, weekNow]);

  const loaded = (here || showWorld) && finished.every((lesson) => exercises.has(keyOf(lesson)));
  const boss = useMemo<WeeklyBoss | null>(
    () =>
      loaded ? weeklyBoss(progress, now, (lesson) => exercises.get(keyOf(lesson)) ?? []) : null,
    [loaded, progress, exercises, now],
  );

  const [card, setCard] = useState(false);
  const [strike, setStrike] = useState<BossStrike | null>(null);
  /** The week whose boss is being chased off, and whether it has gone. */
  const [ending, setEnding] = useState<{ readonly week: string; readonly gone: boolean } | null>(
    null,
  );
  const strikes = useRef(0);
  /** Drops the chest once, whichever comes first: the boss out of sight, or the deadline. */
  const finish = useRef<(() => void) | null>(null);
  useEffect(() => {
    setCard(false);
    setStrike(null);
    setEnding(null);
    finish.current = null;
  }, [scope]);
  useEffect(() => {
    if (!ending || ending.gone) return;
    const timer = window.setTimeout(() => finish.current?.(), FINAL_DEADLINE_MS);
    return () => window.clearTimeout(timer);
  }, [ending]);

  // A new island or a new week: nothing of the last fight carries over.
  const bossKey = boss ? `${boss.week}:${boss.island.studyId}/${boss.island.courseId}` : null;
  useEffect(() => {
    setCard(false);
    setStrike(null);
  }, [bossKey]);

  const lessonTitle = (lessonKey: string) => {
    const [studyId, courseId, lessonId] = lessonKey.split("/");
    if (!studyId || !courseId || !lessonId) return lessonKey;
    for (const unit of courseOf(studyId, courseId)?.units ?? [])
      for (const lesson of unit.lessons) if (lesson.id === lessonId) return lesson.title;
    return lessonKey;
  };

  const onStrike = (result: WeeklyBossStrike) => {
    if (
      !boss ||
      currentScope.current !== scope ||
      progressPort.syncState().userId !== owner ||
      weeklyBossWeek(Date.now()) !== boss.week ||
      Object.hasOwn(snapshot().xpEvents, weeklyBossWonEventId(boss.week))
    )
      return;
    const xpBefore = snapshot().totalXp;
    if (result.hitEventId) progressPort.addXp(result.hitEventId, WEEKLY_BOSS_HIT_XP);
    if (!result.won) {
      if (!reducedMotion)
        setStrike({ id: ++strikes.current, kind: result.verdict === "correct" ? "hit" : "miss" });
      return;
    }
    const week = boss.week;
    const heartXp = snapshot().totalXp;
    // Store the no-XP witness before the win. A server claim must never see a
    // winning document that is missing this same round's first-try condition.
    const arrival =
      (lessons.find((lesson) => lesson.state !== "done") ?? lessons.at(-1))?.lessonId ??
      last?.lessonId;
    if (arrival)
      progressPort.addXp(weeklyBossLocationEventId(week, { ...boss.island, lessonId: arrival }), 0);
    if (result.flawless) progressPort.addXp(weeklyBossFlawlessEventId(week), 0);
    progressPort.addXp(weeklyBossWonEventId(week), WEEKLY_BOSS_WIN_XP);
    const after = snapshot().totalXp;
    setCard(false);
    setEnding({ week, gone: false });
    let dropped = false;
    const drop = () => {
      if (dropped || currentScope.current !== scope || progressPort.syncState().userId !== owner)
        return;
      dropped = true;
      finish.current = null;
      setEnding({ week, gone: true });
      setStrike(null);
      onChest({
        week,
        flawless: result.flawless,
        reward: {
          xp: after - heartXp,
          levelBefore: levelOf(xpBefore).level,
          levelAfter: levelOf(after).level,
          reviewCards: 0,
          knowledgeCards: 0,
          streakDay: 0,
          badges: [],
          allFirstTry: result.flawless,
        },
        onDone: () => {
          if (currentScope.current === scope && progressPort.syncState().userId === owner)
            setEnding((value) => (value?.week === week ? null : value));
        },
      });
    };
    finish.current = drop;
    if (reducedMotion) drop();
    else setStrike({ id: ++strikes.current, kind: "final", onGone: drop });
  };

  // Beaten and its chest taken, it is gone for the week; while it runs, it still stands.
  const standing = here && boss !== null && (!boss.beaten || ending?.week === boss.week);
  const scene = useMemo<WeeklyBossScene | null>(
    () =>
      boss && standing
        ? {
            week: boss.week,
            fighting: card || (ending !== null && !ending.gone),
            strike,
            fled: ending?.week === boss.week && ending.gone,
          }
        : null,
    [boss, standing, card, ending, strike],
  );

  const overlay =
    here && card && boss && !boss.beaten ? (
      <WeeklyBossFight
        boss={boss}
        now={Date.now()}
        lessonTitle={lessonTitle}
        onStrike={onStrike}
        onOpenLesson={(lessonKey) => {
          const [studyId, courseId, lessonId] = lessonKey.split("/");
          const ref =
            studyId && courseId && lessonId
              ? refOf({ studyId, courseId, lessonId, completedAt: 0 })
              : null;
          setCard(false);
          if (ref) onOpenLesson(ref);
        }}
        onClose={() => setCard(false)}
      />
    ) : null;

  const open = () => {
    if (here && boss && !boss.beaten) setCard(true);
  };
  const chipLabel =
    here && boss && !boss.beaten && !card && ending === null
      ? `${interfaceTranslator.t("weeklyBoss.name")} · ${interfaceTranslator.t("weeklyBoss.hearts", { hearts: boss.hearts })}`
      : null;
  const week = boss?.week ?? null;
  const marker = useMemo(
    () =>
      chipLabel && week ? weeklyBossMarker(lessons, week, chipLabel, () => setCard(true)) : null,
    [chipLabel, week, lessons],
  );

  return {
    scene,
    overlay,
    marker,
    open,
    history,
    availableIsland: boss && !boss.beaten ? boss.island : null,
  };
}
