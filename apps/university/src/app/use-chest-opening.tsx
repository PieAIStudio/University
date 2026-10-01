import {
  chestBaseline,
  chestReward,
  dailyFirstBonus,
  type ChestBaseline,
  type ChestReward,
  type LessonRef,
  type ProgressDocument,
  type KnowledgeAlbum,
  type KnowledgeAlbumCard,
  type Keepsake,
  lessonKey as lessonDocumentKey,
} from "@pieai/university-core";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { KeepsakeArt, keepsakeCopy } from "@pieai/university-ui";
import { ChestRewards, type ChestRewardStage } from "@pieai/university-ui/path/ChestRewards.js";
import { EmblemImage, usePrefersReducedMotion } from "@pieai/university-world";
import { useI18n } from "@pieai/university-ui/i18n.js";
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
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { GuestAdoption, GuestAdoptionSnapshot } from "../account/guest-adoption.js";
const noAdoption = () => null;
const noSubscription = () => () => {};

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
  readonly key: number;
  readonly owner: object | string | null;
  readonly knowledgeCards: readonly KnowledgeAlbumCard[];
  readonly completedCourse?: string;
  readonly completionAvatar?: ReactNode;
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
  readonly onLeave?: () => void;
  readonly keepsake?: { readonly item: Keepsake; readonly isNew: boolean };
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
  onLessonDone,
  readAlbum,
  courseTitle,
  guestAdoption,
  completionAvatar,
  keepsakeOf,
  onKeepsake,
}: {
  /** The lesson being read now, or null. The baseline is taken when it changes. */
  readonly lessonOpen: LessonRef | null;
  readonly lessons: readonly LessonPlacement[];
  readonly guardName: (role: MonsterRole) => string;
  readonly onLessonDone?: (locator: LessonRef) => void;
  readonly readAlbum?: () => KnowledgeAlbum | null;
  readonly courseTitle?: string;
  readonly completionAvatar?: ReactNode;
  readonly guestAdoption?: GuestAdoption;
  /** The keepsake this lesson's chest leaves, if it is a blue or gold one. */
  readonly keepsakeOf?: (locator: LessonRef) => Keepsake | undefined;
  /** 放进小屋: leave the chest for the house. */
  readonly onKeepsake?: (keepsake: Keepsake) => void;
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
  const t = useI18n();
  const adoption = useSyncExternalStore<GuestAdoptionSnapshot | null>(
    guestAdoption?.subscribe ?? noSubscription,
    guestAdoption?.getSnapshot ?? noAdoption,
  );
  const readOwner = () => guestAdoption?.getSnapshot().scope ?? progressPort.syncState().userId;
  const canAct = () => guestAdoption?.getSnapshot().ready !== false;
  const owner = readOwner();
  const ready = adoption?.ready !== false;
  const latestDone = useRef(onLessonDone);
  latestDone.current = onLessonDone;
  const baseline = useRef<{
    key: string;
    owner: object | string | null;
    value: ChestBaseline;
    knowledge: KnowledgeAlbum | null;
    /** The lesson was already finished when it opened: its keepsake is not new. */
    doneBefore: boolean;
  } | null>(null);
  const lessonKey = lessonOpen
    ? `${lessonOpen.studyId}/${lessonOpen.courseId}/${lessonOpen.unitId}/${lessonOpen.lessonId}`
    : null;
  useEffect(() => {
    if (!lessonKey || (baseline.current?.key === lessonKey && baseline.current.owner === owner))
      return;
    const knowledge = readAlbum?.() ?? null;
    baseline.current = {
      key: lessonKey,
      owner,
      knowledge,
      value: chestBaseline(snapshot(), knowledge?.coursesFinished, knowledge?.pathsFinished),
      doneBefore:
        snapshot().lessons[
          lessonDocumentKey(lessonOpen!.studyId, lessonOpen!.courseId, lessonOpen!.lessonId)
        ]?.completedAt != null,
    };
  }, [lessonKey, owner, readAlbum]);

  const [storedFlow, setFlow] = useState<Flow | null>(null);
  const sequence = useRef(0);
  const flow = storedFlow?.owner === owner ? storedFlow : null;
  useEffect(() => {
    if (storedFlow && storedFlow.owner !== owner) setFlow(null);
  }, [storedFlow, owner]);

  const begin = (locator: LessonRef) => {
    if (readOwner() !== owner || !canAct()) return;
    const key = `${locator.studyId}/${locator.courseId}/${locator.unitId}/${locator.lessonId}`;
    const index = lessons.findIndex((lesson) => lesson.lessonId === locator.lessonId);
    const before =
      baseline.current?.key === key && baseline.current.owner === owner ? baseline.current : null;
    const from = before?.value;
    // Nothing to compare against (a reload mid-lesson): no chest, the page as before.
    if (index < 0 || !from) return;
    const cardsOf = (document: ProgressDocument) =>
      Object.keys(document.cards).filter((cardKey) =>
        cardKey.startsWith(`${locator.studyId}/${locator.courseId}/${locator.lessonId}/`),
      ).length;
    const after = snapshot();
    const knowledge = readAlbum?.() ?? null;
    const collectedBefore = new Set(
      before?.knowledge?.cards.filter((card) => card.collected).map((card) => card.head.id) ?? [],
    );
    const knowledgeCards = (knowledge?.cards ?? []).filter(
      (card) =>
        card.collected &&
        card.lessons.some(
          (lesson) =>
            lesson.complete &&
            lesson.locator.studyId === locator.studyId &&
            lesson.locator.courseId === locator.courseId &&
            lesson.locator.unitId === locator.unitId &&
            lesson.locator.lessonId === locator.lessonId,
        ),
    );
    let reward = chestReward({
      baseline: from,
      after,
      locator,
      reviewCards: cardsOf(after),
      knowledgeCards: before?.knowledge
        ? knowledgeCards.filter((card) => !collectedBefore.has(card.head.id)).length
        : 0,
      coursesFinished: before?.knowledge ? knowledge?.coursesFinished : 0,
      pathsFinished: before?.knowledge ? knowledge?.pathsFinished : 0,
    });
    const bonus = dailyFirstBonus(after, Date.now(), reward.xp);
    if (bonus) {
      progressPort.addXp(bonus.eventId, bonus.amount);
      reward = { ...reward, xp: reward.xp + bonus.amount };
    }
    const tier = lessonChestTier(lessons, index);
    const keepsake = tier === "wood" ? undefined : keepsakeOf?.(locator);
    setFlow({
      key: ++sequence.current,
      owner,
      knowledgeCards,
      ...(before?.knowledge &&
      knowledge &&
      courseTitle &&
      knowledge.coursesFinished > before.knowledge.coursesFinished
        ? { completedCourse: courseTitle, completionAvatar }
        : {}),
      source: { kind: "lesson", locator, lessonNumber: index + 1 },
      ...(keepsake ? { keepsake: { item: keepsake, isNew: !before.doneBefore } } : {}),
      from: tier,
      tier: openedTier(tier, reward.allFirstTry),
      reward,
      dailyFirst: bonus !== null,
      guard: reducedMotion ? null : openingGuard(lessons, index),
      stage: "closed",
      skipped: false,
    });
  };

  const beginWeekly = (chest: WeeklyChest) => {
    if (readOwner() !== owner || !canAct()) return;
    setFlow({
      key: ++sequence.current,
      owner,
      knowledgeCards: [],
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
  };

  // These are presentation transitions, not account/data writes. The same
  // guest's optional save must not detach a button between press and release
  // or lose the scene's one settlement callback. Only a changed learner scope
  // cancels them. Navigation still waits for verified local adoption below.
  const update = (patch: Partial<Flow>) =>
    setFlow((current) =>
      current && current.key === flow?.key && current.owner === owner && readOwner() === owner
        ? { ...current, ...patch }
        : current,
    );

  /*
    The scene reports when the chest has settled and when the monster has run.
    Where it cannot (no WebGL, a hidden tab, a lost context), the words must
    not wait for it forever: each stage has a deadline a little past its own
    length, after which the page moves on as if the scene had reported.
  */
  useEffect(() => {
    if (!ready || !flow || (flow.stage !== "opening" && flow.stage !== "throwing")) return;
    const seconds =
      flow.stage === "throwing"
        ? THROW_DEADLINE_SECONDS
        : flow.skipped
          ? SKIP_DEADLINE_SECONDS
          : openingLength(flow.tier) + UPGRADE_LEAD + OPENING_GRACE_SECONDS;
    const timer = window.setTimeout(
      () =>
        setFlow((current) =>
          current?.key !== flow.key || current.owner !== readOwner() || !canAct()
            ? current
            : current.stage === "throwing"
              ? { ...current, stage: "done" }
              : current?.stage === "opening"
                ? { ...current, stage: "rewards" }
                : current,
        ),
      seconds * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [flow?.key, flow?.stage, flow?.skipped, flow?.tier, ready]);

  useEffect(() => {
    if (!ready || flow?.stage !== "leaving") return;
    const done = flow.source.kind === "weekly" ? flow.source.onDone : flow.onLeave;
    const timer = window.setTimeout(
      () => {
        if (readOwner() !== owner || !canAct() || sequence.current !== flow.key) return;
        setFlow(null);
        done?.();
      },
      reducedMotion ? 0 : LEAVING_MS,
    );
    return () => window.clearTimeout(timer);
  }, [flow?.key, flow?.stage, owner, reducedMotion, ready]);

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
            current?.key === flow.key &&
            current.owner === readOwner() &&
            current.stage === "opening"
              ? { ...current, stage: "rewards" }
              : current,
          );
      },
      onTap: () =>
        setFlow((current) =>
          !current || current.key !== flow.key || current.owner !== readOwner()
            ? current
            : current.stage === "closed"
              ? { ...current, stage: "opening" }
              : current.stage === "opening"
                ? { ...current, skipped: true }
                : current,
        ),
    };
  }, [flow]);

  // A scrollable reward list reuses the same pre-rendered 3D picture as
  // the badge wall, rather than opening a WebGL context per badge.
  const overlay =
    flow && flow.stage !== "leaving" ? (
      <ChestRewards
        stage={flow.stage}
        tier={flow.tier}
        upgraded={flow.tier !== flow.from}
        reward={flow.reward}
        knowledgeCards={flow.knowledgeCards}
        sound={progressPort.accountData().preferences.soundEnabled}
        badgeEmblem={(badge) => <EmblemImage kind="badge" id={badge.id} size={128} />}
        completion={
          flow.completedCourse ? (
            <div className="course-completion-card" data-course-completion>
              {flow.completionAvatar}
              <EmblemImage kind="badge" id="first-course" size={112} />
              <p>{t.t("album.courseComplete", { title: flow.completedCourse })}</p>
            </div>
          ) : null
        }
        keepsake={
          flow.keepsake ? (
            <div className="chest-keepsake" data-chest-keepsake={flow.keepsake.item.id}>
              <KeepsakeArt art={flow.keepsake.item.art} />
              <p>
                {t.t(flow.keepsake.isNew ? "chest.keepsake.new" : "chest.keepsake.again", {
                  name: t.t(keepsakeCopy(flow.keepsake.item)[0]),
                })}
              </p>
              <GameButton
                variant="secondary"
                static
                data-chest-action="keepsake"
                onClick={() => {
                  const item = flow.keepsake!.item;
                  update({ stage: "leaving", onLeave: () => onKeepsake?.(item) });
                }}
              >
                {t.t("chest.keepsake.put")}
              </GameButton>
            </div>
          ) : null
        }
        dailyFirst={flow.dailyFirst}
        {...(flow.source.kind === "lesson" ? { lessonNumber: flow.source.lessonNumber } : {})}
        guardName={flow.guard ? guardName(flow.guard.role) : null}
        reducedMotion={reducedMotion}
        onOpen={() => update({ stage: "opening" })}
        onSkip={() => update({ skipped: true })}
        onThrow={() => update({ stage: "throwing" })}
        onContinue={() => {
          // The timer is fenced by the transient learner scope and chest key.
          // Only a confirmed adoption of this same guest keeps that scope, so
          // the completion callback can use the now-bound account's invitation.
          const source = flow.source;
          update({
            stage: "leaving",
            ...(source.kind === "lesson"
              ? { onLeave: () => latestDone.current?.(source.locator) }
              : {}),
          });
        }}
      />
    ) : flow && !ready ? (
      <section className="chest-rewards" role="status" aria-busy="true">
        {t.t("album.accountPreparing")}
      </section>
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
