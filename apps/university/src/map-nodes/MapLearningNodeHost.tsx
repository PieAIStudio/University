import { lazy, Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  challengeDeck,
  gameRoundsForSegment,
  isLessonComplete,
  lessonKeyOf,
  planCheckpoint,
  progressSourceOf,
  rememberPracticeQuestion,
  settleCheckpoint,
  type ChallengeCard,
  type GameRound,
  type IdentityPort,
  type LearningSegment,
  type LessonRef,
  type MapLearningKind,
  type ProgressPort,
} from "@pieai/university-core";
import type { ContentPort } from "@pieai/university-ui/content/port.js";
import type { LessonView } from "@pieai/university-ui/view/lesson-view.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { MapNodeDialog } from "@pieai/university-ui/map-nodes/MapNodeDialog.js";
import { MapChallenge } from "@pieai/university-ui/map-nodes/MapChallenge.js";
import { MapCheckpoint } from "@pieai/university-ui/map-nodes/MapCheckpoint.js";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import { hasWebGLContext } from "@pieai/university-world/webgl-capability.js";

const InterceptGame = lazy(() =>
  import("../game/InterceptGame.js").then((module) => ({ default: module.InterceptGame })),
);
/** How many lessons before the segment the game may also draw rounds from. */
const EARLIER_LESSONS = 9;

const PersonalLessonPanel = lazy(() =>
  import("../personal/PersonalLessonPanel.js").then((module) => ({
    default: module.PersonalLessonPanel,
  })),
);

function identityScope(identity: ReturnType<IdentityPort["status"]>) {
  return identity.kind === "anonymous" || identity.kind === "signed_in"
    ? `account:${identity.user.id}`
    : "local-guest";
}
interface Props {
  studyId: string;
  courseId: string;
  segment: LearningSegment;
  kind: MapLearningKind;
  identityPort: IdentityPort;
  progressPort: ProgressPort;
  contentPort: ContentPort;
  returnFocusTo: HTMLElement | null;
  /** Every lesson of the course in order, for rounds from before this segment. */
  outline: readonly { readonly unitId: string; readonly lessonId: string }[];
  /** The learner's own avatar, when signed in; the game's hero. */
  avatarRecipe: AvatarRecipe | null;
  onClose: () => void;
  onOpenLesson: (ref: LessonRef) => void;
}

export default function MapLearningNodeHost(props: Props) {
  const { t, locale } = useI18n();
  const identity = useSyncExternalStore(
    props.identityPort.subscribe,
    props.identityPort.status,
    props.identityPort.status,
  );
  const accountScope = identityScope(identity);
  return (
    <MapNodeDialog
      title={`${t(`mapNodes.${props.kind}`)} · ${t("mapNodes.range", { first: props.segment.firstIndex + 1, last: props.segment.lastIndex + 1 })}`}
      onClose={props.onClose}
      returnFocusTo={props.returnFocusTo}
    >
      <NodeSession
        key={`${accountScope}:${locale}:${props.segment.id}:${props.kind}`}
        {...props}
        accountScope={accountScope}
      />
    </MapNodeDialog>
  );
}

function NodeSession({
  studyId,
  courseId,
  segment,
  kind,
  identityPort,
  progressPort,
  contentPort,
  accountScope,
  outline,
  avatarRecipe,
  onClose,
  onOpenLesson,
}: Props & { accountScope: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<{
    views: LessonView[];
    cards: ChallengeCard[];
    rounds: GameRound[];
  } | null>(null);
  const [flat, setFlat] = useState(() => !hasWebGLContext());
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const base = useMemo(
    () => ({ studyId, courseId, unitId: segment.unitId }),
    [studyId, courseId, segment.unitId],
  );
  const locator = useMemo(
    () => ({ ...base, lessonId: segment.anchorLessonId }),
    [base, segment.anchorLessonId],
  );
  const personalScope = useMemo(
    () => ({ ...base, lessonIds: segment.lessonIds }),
    [base, segment.lessonIds],
  );

  /**
   * Rounds for 庭院拦截 (ADR-0011): this segment's lessons and the few before
   * it, only those the learner completed or proved — the same gate the 2D
   * matching game uses for its cards.
   */
  async function practisedRounds(
    views: readonly LessonView[],
    source: ReturnType<typeof progressSourceOf>,
    signal: AbortSignal,
  ): Promise<GameRound[]> {
    const earlier = outline.slice(
      Math.max(0, segment.firstIndex - EARLIER_LESSONS),
      segment.firstIndex,
    );
    const earlierViews = await Promise.all(
      earlier.map(({ unitId, lessonId }) =>
        contentPort
          .lesson({ studyId, courseId, unitId, lessonId }, { signal })
          .then((view) => ({ unitId, view }))
          .catch(() => null),
      ),
    );
    const practised = [
      ...earlierViews.filter((entry) => entry !== null),
      ...views.map((view) => ({ unitId: segment.unitId, view })),
    ].filter(({ unitId, view }) => {
      const ref = { studyId, courseId, unitId, lessonId: view.lesson.id };
      const snapshot = {
        contentRevision: view.lesson.contentRevision,
        exerciseIds: view.lesson.exercises.map((exercise) => exercise.id),
      };
      return (
        isLessonComplete(source.completionOf(ref, snapshot)) ||
        source.provenOf?.(ref, snapshot) === true
      );
    });
    return [
      ...gameRoundsForSegment(
        practised.map(({ view }) => ({
          id: view.lesson.id,
          title: view.lesson.title,
          activities: view.lesson.activities ?? [],
        })),
        segment.lessonIds,
      ),
    ];
  }

  useEffect(() => {
    if (kind === "personal") return;
    const request = new AbortController();
    setFailed(false);
    setData(null);
    void (async () => {
      const views = await Promise.all(
        segment.lessonIds.map((lessonId) =>
          contentPort.lesson({ ...base, lessonId }, { signal: request.signal }),
        ),
      );
      const source = progressSourceOf(progressPort);
      const cards =
        kind === "challenge"
          ? (
              await Promise.all(
                views.map(async (view) => {
                  const lesson = view.lesson;
                  const ref = { ...base, lessonId: lesson.id };
                  const snapshot = {
                    contentRevision: lesson.contentRevision,
                    exerciseIds: lesson.exercises.map((exercise) => exercise.id),
                  };
                  if (
                    !isLessonComplete(source.completionOf(ref, snapshot)) &&
                    source.provenOf?.(ref, snapshot) !== true
                  )
                    return [];
                  return Promise.all(
                    lesson.cards
                      .filter((card) => card.kind === "basic")
                      .map(async (card) => {
                        const body = await contentPort.card({
                          ...ref,
                          kind: "course-card",
                          cardId: card.id,
                          front: card.front,
                          contentRevision: card.contentRevision,
                        });
                        return {
                          id: `${lesson.id}/${card.id}`,
                          lessonId: lesson.id,
                          lessonTitle: lesson.title,
                          front: body.front,
                          back: body.back ?? "",
                          contentRevision: body.contentRevision,
                        };
                      }),
                  );
                }),
              )
            ).flat()
          : [];
      const rounds =
        kind === "challenge" ? await practisedRounds(views, source, request.signal) : [];
      // The game owns its independently shuffled, saved columns.
      if (!request.signal.aborted)
        setData({ views, cards: challengeDeck(cards, () => 0.999999), rounds });
    })().catch(() => {
      if (!request.signal.aborted) setFailed(true);
    });
    return () => request.abort();
  }, [kind, segment.lessonIds, base, contentPort, progressPort, retry]);

  if (kind === "personal")
    return (
      <Suspense fallback={<p role="status">{t("mapNodes.loading")}</p>}>
        <PersonalLessonPanel scope={personalScope} onClose={onClose} />
      </Suspense>
    );
  if (failed)
    return (
      <div role="alert">
        <p>{t("mapNodes.loadFailed")}</p>
        <GameButton onClick={() => setRetry((value) => value + 1)}>
          {t("mapNodes.retry")}
        </GameButton>
      </div>
    );
  if (!data) return <p role="status">{t("mapNodes.loading")}</p>;

  if (kind === "challenge" && data.rounds.length >= 2 && !flat)
    return (
      <section className="map-node-flow" data-map-node-flow="challenge" data-game="courtyard">
        <Suspense fallback={<p role="status">{t("mapNodes.loading")}</p>}>
          <InterceptGame
            rounds={data.rounds}
            recipe={avatarRecipe}
            onClose={onClose}
            onOpenLesson={(lessonId) => {
              const unitId =
                outline.find((entry) => entry.lessonId === lessonId)?.unitId ?? segment.unitId;
              onOpenLesson({ studyId, courseId, unitId, lessonId });
            }}
            onUnavailable={() => setFlat(true)}
            onPlain={() => setFlat(true)}
          />
        </Suspense>
      </section>
    );

  if (kind === "challenge")
    return (
      <>
        <MapChallenge
          cards={data.cards}
          locator={locator}
          accountScope={accountScope}
          onClose={onClose}
          onPlayed={(ids) => {
            if (identityScope(identityPort.status()) !== accountScope) return;
            let recent = progressPort.accountData().practiceRecent;
            for (const id of ids)
              recent = rememberPracticeQuestion(
                recent,
                `map-challenge:${studyId}/${courseId}/${id}`,
              );
            progressPort.setPracticeRecent(recent);
          }}
        />
        {data.cards.length < 2 ? (
          <GameButton
            variant="secondary"
            onClick={() => onOpenLesson({ ...base, lessonId: segment.lessonIds[0]! })}
          >
            {t("mapNodes.openLesson")}
          </GameButton>
        ) : null}
      </>
    );

  return (
    <MapCheckpoint
      lessons={data.views.map((view) => view.lesson)}
      locator={locator}
      accountScope={accountScope}
      onClose={onClose}
      onOpenLesson={(lessonId) => onOpenLesson({ ...base, lessonId })}
      onCommit={async (plan, answers, signal) => {
        const fresh = await Promise.all(
          segment.lessonIds.map((lessonId) =>
            contentPort.lesson({ ...base, lessonId }, { signal }),
          ),
        );
        const current = planCheckpoint(fresh.map((view) => view.lesson));
        if (current.fingerprint !== plan.fingerprint) throw new Error("content-changed");
        if (signal.aborted || identityScope(identityPort.status()) !== accountScope)
          throw new Error("cancelled");
        const result = settleCheckpoint(current, answers);
        if (!result) throw new Error("incomplete");
        progressPort.markLessonsProven({
          ...base,
          lessonIds: result.proven,
          contentRevisions: result.revisions,
        });
        if (progressPort.localSaveState?.() === "failed") throw new Error("not-saved");
        // No read confirmation, exercise attempts, XP, or card enrollment here.
        for (const lessonId of result.proven) {
          if (!progressPort.snapshot().provenLessons[lessonKeyOf({ ...base, lessonId })])
            throw new Error("not-saved");
        }
      }}
    />
  );
}
