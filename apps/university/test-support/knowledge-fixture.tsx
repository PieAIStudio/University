import { StrictMode, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import {
  CONCEPT_ENTRIES,
  CONCEPT_HEADS,
  badgesFor,
  createProgressPort,
  emptyProgress,
  knowledgeAlbum,
  leagueStanding,
  lessonKey,
  progressSourceOf,
  toPath,
  type AlbumCourse,
  type CardProgress,
  type ChestReward,
} from "@pieai/university-core";
import { GameButton, GamePanel } from "@pieai/swimmer-ui-kit";
import { InterfaceLanguageProvider } from "@pieai/university-ui/i18n.js";
import { ConceptIndex, KnowledgeCardTile } from "@pieai/university-ui";
import { BadgeWall, LeagueScreen } from "@pieai/university-ui/navigation/screens.js";
import { ChestRewards } from "@pieai/university-ui/path/ChestRewards.js";
import { EmblemImage, usePrefersReducedMotion } from "@pieai/university-world";
import { withRankPromotion } from "../src/progress/rank-promotion.js";
import { RankPromotion } from "../src/progress/RankPromotion.js";
import "@pieai/swimmer-ui-kit/styles.css";
import "@pieai/university-ui/reference/term-index.css";
import "@pieai/university-ui/navigation/university-shell.css";
import "@pieai/university-ui/path/chest-rewards.css";
import "../src/guide/journey-cards.css";
import "./knowledge-fixture.css";

// Deliberately synthetic, memory-only history: never imported into the product
// singleton, localStorage, an account, analytics, a payment or an AI request.
const ids = ["frontend", "prompt", "multimodal"] as const;
const now = Date.now();
const course: AlbumCourse = {
  studyId: "synthetic",
  domainId: "ai-foundations",
  id: "knowledge",
  title: "Synthetic three-level course",
  isDefault: true,
  units: [
    {
      id: "unit",
      title: "Synthetic unit",
      lessons: ids.map((id, index) => ({
        id: `level-${index + 1}`,
        contentRevision: 1,
        exerciseIds: [],
        conceptIds: [id],
        reviewCardRevisions: { card: 1 },
      })),
    },
  ],
};
const initial = emptyProgress();
function card(
  id: string,
  lessonId: string,
  stability: number,
  state: CardProgress["fsrs"]["state"],
): CardProgress {
  return {
    cardKey: `synthetic/knowledge/${lessonId}/${id}`,
    studyId: "synthetic",
    courseId: "knowledge",
    unitId: "unit",
    lessonId,
    contentRevision: 1,
    kind: "course-card",
    dueAt: now,
    fsrs: {
      due: new Date(now).toISOString(),
      stability,
      difficulty: 5,
      elapsed_days: 20,
      scheduled_days: 20,
      learning_steps: 0,
      reps: state === 0 ? 0 : 4,
      lapses: 0,
      state,
      ...(state === 0 ? {} : { last_review: new Date(now - 20 * 86400_000).toISOString() }),
    },
  };
}
ids.forEach((_, index) => {
  const id = `level-${index + 1}`;
  initial.lessons[lessonKey("synthetic", "knowledge", id)] = {
    progress: 1,
    completedAt: now,
    attempts: 1,
    readConfirmed: true,
    readConfirmedRevision: 1,
  };
  const row = card("card", id, [0, 5, 30][index]!, index === 0 ? 0 : 2);
  initial.cards[row.cardKey] = row;
});
for (let i = 0; i < 8; i++) {
  const row = card(`earlier-${i}`, "earlier", 30, 2);
  initial.cards[row.cardKey] = row;
}
const threshold = card("threshold", "earlier", 20, 2);
initial.cards[threshold.cardKey] = threshold;
const model = withRankPromotion(
  createProgressPort({
    persistence: { read: () => JSON.stringify(initial), write: () => undefined },
  }),
);
const progress = model.progress;
const source = progressSourceOf(progress);
const root = document.getElementById("root");
if (!root) throw new Error("Missing synthetic fixture root");

function Fixture() {
  const document = useSyncExternalStore(progress.subscribe, progress.snapshot);
  const reducedMotion = usePrefersReducedMotion();
  const [revealing, setRevealing] = useState(false);
  const album = knowledgeAlbum(CONCEPT_HEADS, [course], source, document);
  const cards = ids.map((id) => album.cards.find((entry) => entry.head.id === id)!);
  const reward: ChestReward = {
    xp: 0,
    levelBefore: 1,
    levelAfter: 1,
    reviewCards: 3,
    knowledgeCards: cards.length,
    streakDay: 0,
    allFirstTry: false,
    badges: badgesFor(document, album.coursesFinished, album.pathsFinished).filter(
      (badge) => badge.id === "first-course",
    ),
  };
  return (
    <main className="knowledge-fixture" data-knowledge-fixture>
      <header className="knowledge-fixture__notice">
        <h1>Synthetic learning history</h1>
        <p>
          These are real components with isolated, fabricated history. This page proves presentation
          and scheduler integration, not learner retention, a live account, or physical-device
          permission.
        </p>
      </header>
      <GamePanel title="Three memory frames">
        <div className="knowledge-fixture__tiers" data-tier-gallery>
          {cards.map((entry) => (
            <KnowledgeCardTile
              key={entry.head.id}
              card={entry}
              onOpen={() => window.location.assign(toPath({ kind: "concept", id: entry.head.id }))}
            />
          ))}
        </div>
        <GameButton static data-fixture-reveal onClick={() => setRevealing(true)}>
          Reveal these recorded cards
        </GameButton>
      </GamePanel>
      {revealing ? (
        <ChestRewards
          stage="rewards"
          tier="legendary"
          upgraded={false}
          reward={reward}
          dailyFirst={false}
          reducedMotion={reducedMotion}
          knowledgeCards={[cards[2]!, cards[0]!, cards[1]!]}
          badgeEmblem={(badge) => <EmblemImage kind="badge" id={badge.id} size={128} />}
          completion={
            <div className="course-completion-card" data-course-completion>
              <EmblemImage kind="badge" id="first-course" />
              <p>{course.title}</p>
            </div>
          }
          onOpen={() => undefined}
          onSkip={() => undefined}
          onThrow={() => undefined}
          onContinue={() => setRevealing(false)}
        />
      ) : null}
      <section aria-label="Synthetic rank crossing">
        <p data-long-term-count>{leagueStanding(document, Date.now()).cards}</p>
        <GameButton
          static
          data-fixture-grade
          onClick={() => progress.gradeCard(threshold.cardKey, "good")}
        >
          Rate the due threshold card
        </GameButton>
        <input aria-label="An unfinished answer" defaultValue="Keep this draft" />
      </section>
      <RankPromotion promotions={model.promotions} owner={null} />
      <LeagueScreen
        document={document}
        emblem={(id) => <EmblemImage kind="rank" id={id} size={72} />}
      />
      <BadgeWall
        embedded
        document={document}
        coursesFinished={album.coursesFinished}
        pathsFinished={album.pathsFinished}
        emblem={(badge) => (
          <EmblemImage kind="badge" id={badge.id} locked={!badge.earned} size={96} />
        )}
      />
      <ConceptIndex
        entries={CONCEPT_ENTRIES}
        album={album}
        domain={{ id: "ai-foundations", label: "AI" }}
      />
    </main>
  );
}
createRoot(root).render(
  <StrictMode>
    <InterfaceLanguageProvider locale="en">
      <Fixture />
    </InterfaceLanguageProvider>
  </StrictMode>,
);
