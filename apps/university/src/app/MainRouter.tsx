import { accountClosurePort, ACCOUNT_CLOSURE_CONFIRMATION } from "../account/account-closure.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { LearningSaveStatus } from "@pieai/university-ui/progress/LearningSaveStatus.js";
import {
  lazy,
  Suspense,
  type ComponentProps,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  LIBRARY_VIEW_TAB,
  libraryTabOf,
  provenIdsForUnit,
  toPath,
  type CourseProgress,
  type IdentityPort,
  type KnowledgeAlbum,
  type Mistake,
  type PaymentPort,
  type PresencePort,
  type ProgressDocument,
  type ProgressPort,
  type ReviewReminderPort,
  type View,
} from "@pieai/university-core";
import { LoadingTrivia } from "@pieai/university-ui/loading/LoadingTrivia.js";
import {
  AccountPanel,
  AccountClosurePanel,
  AuthCallbackScreen,
  AuthResetScreen,
  ProfileScreen,
  SettingsScreen,
  type AccountAuthPort,
} from "@pieai/university-ui/navigation/empty.js";
import type { LearnerNavigationFocus } from "@pieai/university-ui/navigation/StudySwitcher.js";
import {
  BadgeWall,
  LeagueScreen,
  LevelProgress,
  PlansScreen,
  SupportScreen,
  QuestsScreen,
} from "@pieai/university-ui/navigation/screens.js";
import { UnitCard } from "@pieai/university-ui/path/UnitCard.js";
import { UnitSkipTest } from "@pieai/university-ui/path/UnitSkipTest.js";
import { MistakeList, MistakesEntry } from "@pieai/university-ui/practice/mistakes.js";
import { pathUnitOf } from "@pieai/university-ui/path/from-course-view.js";
import type { ContentPort, ContentStudy, Shelf } from "@pieai/university-ui/content/port.js";
import type { CourseView, UnitView } from "@pieai/university-ui/view/lesson-view.js";
import {
  PlanetStage,
  type PlanetStudy,
  type PlanetStudyDomain,
} from "@pieai/university-world/planet.js";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import { EmblemImage } from "@pieai/university-world";
import type { WorldMap } from "@pieai/university-world/WorldMapCanvas.js";

import {
  clearLearningReturn,
  continueLearningView,
  readLearningReturn,
} from "../account/continue-learning";
import { AUTHORING } from "../mode";
import { SettingsLab } from "../authoring/SettingsLab.js";
import { MapGuideDetails } from "../guide/MapGuideDetails.js";
import { StudioScreen } from "../authoring/index";
import { MapStudioScreen } from "../authoring/map-studio";
import type { CourseNode } from "@pieai/university-world/course.js";
import { AvatarLab } from "../screens/AvatarLab";
import {
  AntiPatternEntryHost,
  ConceptEntryHost,
  CourseCatalog,
  LibraryHost,
  PracticeHost,
  RouteFallback,
  SettlementHost,
  TermEntryHost,
} from "../screens/lazy";
import { MapBreadcrumbs } from "./MapBreadcrumbs.js";
import type { PathOverlay } from "./world-model";

const WardrobeScreen = lazy(() => import("../screens/WardrobeScreen.js"));
const PlayCatalogRoute = lazy(() => import("../play-catalog/PlayCatalogRoute.js"));
const ToyPlayLabRoute = lazy(() => import("../play-catalog/ArcadeRoute.js"));
const PropFinishRoute = lazy(() => import("../play-catalog/PropFinishRoute.js"));
const RetiredAppearanceRoute = lazy(() => import("../play-catalog/RetiredAppearanceRoute.js"));
const MapLearningNodeHost = lazy(() => import("../map-nodes/MapLearningNodeHost.js"));
const PrimmGameLab = lazy(() =>
  import("@pieai/university-ui/learning-play/PrimmGameLab.js").then((mod) => ({
    default: mod.PrimmGameLab,
  })),
);
const LearningPlayLab = lazy(() =>
  import("@pieai/university-ui/learning-play/LearningPlayLab.js").then((mod) => ({
    default: mod.LearningPlayLab,
  })),
);

const ProfileAvatar = lazy(() =>
  import("./ProfileAvatar.js").then((mod) => ({ default: mod.ProfileAvatar })),
);

interface MainRouterProps {
  readonly album?: KnowledgeAlbum;
  readonly planetReadiness?: ComponentProps<typeof PlanetStage>["readiness"];
  readonly sceneAttempt?: number;
  readonly contentPort: ContentPort;
  readonly course: CourseView | null;
  readonly focusedStudyId: string | null;
  readonly focusStudy: (studyId: string) => void;
  readonly grewFrom: { readonly key: string; readonly doneBefore: number } | null;
  /** The finished lesson's chest, opening on the island: the lesson's page waits for it (V7). */
  readonly chestOverlay?: ReactNode;
  readonly reviewReminderDismissedFor: string | null;
  readonly onDismissReviewReminder: (key: string) => void;
  readonly avatarRecipe: AvatarRecipe | null;
  readonly avatarEditingRecipe: AvatarRecipe | null;
  readonly avatarSignedIn: boolean;
  readonly avatarPanel?: ReactNode;
  readonly onAvatarRecipeChange: (recipe: AvatarRecipe) => void;
  readonly onWorthwhileProgress?: () => void;
  readonly identityPort: IdentityPort;
  readonly authPort: AccountAuthPort | null;
  readonly accountFocusRequest: number;
  readonly paymentPort: PaymentPort;
  readonly mistakes: readonly Mistake[];
  readonly nextUpProgress: CourseProgress | null;
  readonly pathOverlay: PathOverlay | null;
  readonly pathUnit: UnitView | undefined;
  readonly planetStudies: readonly PlanetStudy[];
  readonly planetDomainCatalog?: readonly PlanetStudyDomain[];
  readonly selectedPlanetDomainId?: string | null;
  readonly selectedPlanetStudyId?: string | null;
  readonly onEnterPlanetStudy?: (studyId: string) => void;
  readonly onClearPlanetPick?: () => void;
  readonly onSelectPlanetDomain?: (domainId: string) => void;
  readonly onSelectPlanetStudy?: (studyId: string) => void;
  readonly presencePort: PresencePort;
  readonly reviewReminderPort: ReviewReminderPort;
  readonly profileStats: {
    readonly coursesFinished: number;
    readonly lessonsCompleted: number;
    readonly passagesRead: number;
  };
  readonly progress: ProgressDocument;
  readonly progressPort: ProgressPort;
  readonly setNavigationFocus: Dispatch<SetStateAction<LearnerNavigationFocus>>;
  readonly setPathOverlay: Dispatch<SetStateAction<PathOverlay | null>>;
  readonly setView: (next: View) => void;
  readonly shelf: Shelf | null;
  readonly studies: Shelf["studies"];
  readonly nodes: readonly CourseNode[] | null;
  readonly world: WorldMap | null;
  readonly courseProgress: (node: CourseNode) => number;
  readonly stage: ReactNode;
  readonly studyNames: readonly ContentStudy[];
  readonly todayNode: CourseNode | null;
  readonly todaySection: ReactNode;
  readonly uncorrectedMistakeCount: number;
  readonly view: View;
}

export function MainRouter({
  album,
  planetReadiness,
  sceneAttempt,
  contentPort,
  course,
  focusedStudyId,
  focusStudy,
  grewFrom,
  chestOverlay = null,
  reviewReminderDismissedFor,
  onDismissReviewReminder,
  avatarRecipe,
  avatarEditingRecipe,
  avatarSignedIn,
  avatarPanel,
  onAvatarRecipeChange,
  onWorthwhileProgress,
  identityPort,
  authPort,
  accountFocusRequest,
  paymentPort,
  mistakes,
  nextUpProgress,
  pathOverlay,
  pathUnit,
  planetStudies,
  planetDomainCatalog,
  selectedPlanetDomainId,
  selectedPlanetStudyId,
  onEnterPlanetStudy,
  onClearPlanetPick,
  onSelectPlanetDomain,
  onSelectPlanetStudy,
  presencePort,
  reviewReminderPort,
  profileStats,
  progress,
  progressPort,
  setNavigationFocus,
  setPathOverlay,
  setView,
  shelf,
  studies,
  nodes,
  world,
  courseProgress,
  stage,
  studyNames,
  todayNode,
  todaySection,
  uncorrectedMistakeCount,
  view,
}: MainRouterProps) {
  const interfaceTranslator = useI18n();
  const i18n = useI18n();
  const accountIdentity = identityPort.status();
  const continueView = continueLearningView(
    readLearningReturn(),
    nextUpProgress?.next ?? null,
    (target) => {
      const available = shelf?.studies
        .find((item) => item.id === target.studyId)
        ?.courses.find((item) => item.id === target.courseId);
      if (!available) return false;
      return (
        target.kind === "course" ||
        available.units.some(
          (unit) =>
            unit.id === target.unitId &&
            unit.lessons.some((lesson) => lesson.id === target.lessonId),
        )
      );
    },
  );
  const continueHref = toPath(continueView);
  const goContinueLearning = () => {
    clearLearningReturn();
    setView(continueView);
  };
  return (
    <>
      {/*
        The campus record is still opening.

        Not decoration and not only for the learner: until the shelf has been
        named there is no series for the capsule to show, so the picker beside
        「University」 is missing and the two builds genuinely do not look alike.
        The delivery build ships its catalogue and never renders this line; the
        authoring build has to ask a loopback server, and saying so is what
        makes 「the chrome is the same」 a claim about the settled screen instead
        of a race against a fetch.
      */}
      {studyNames.length === 0 && !shelf ? (
        <p className="loading-copy">
          {interfaceTranslator.t("app.app.mainRouter.copy.正在打开校园档案")}
        </p>
      ) : null}
      {view.kind === "planet" || view.kind === "world" || view.kind === "course" ? (
        <MapBreadcrumbs
          layer={view.kind}
          studyTitle={studies.find((study) => study.id === focusedStudyId)?.title}
          courseTitle={view.kind === "course" ? course?.title : undefined}
          onNavigate={setView}
        />
      ) : null}
      {stage ? <div className="learn-stage">{stage}</div> : null}
      {view.kind === "play-lab" ? (
        <Suspense fallback={<RouteFallback />}>
          {view.collection === "catalog" ? (
            <PlayCatalogRoute />
          ) : view.collection === "prop-finish" ? (
            <PropFinishRoute />
          ) : view.collection === "wax-island" ? (
            <RetiredAppearanceRoute />
          ) : view.collection === "toy-3d" ? (
            <ToyPlayLabRoute />
          ) : view.collection === "primm" ? (
            <PrimmGameLab />
          ) : (
            <LearningPlayLab
              key={view.collection ?? "foundations"}
              collection={view.collection ?? "foundations"}
            />
          )}
        </Suspense>
      ) : null}
      {view.kind === "wardrobe" ? (
        <Suspense fallback={<RouteFallback />}>
          <WardrobeScreen avatarRecipe={avatarRecipe} signedIn={avatarSignedIn} onOpen={setView} />
        </Suspense>
      ) : null}
      {view.kind === "avatar-lab" ? (
        <Suspense fallback={<RouteFallback />}>
          <AvatarLab
            avatarRecipe={avatarEditingRecipe}
            onRecipeChange={onAvatarRecipeChange}
            onOpen={setView}
          />
        </Suspense>
      ) : null}

      {view.kind === "course" && course && pathOverlay?.kind === "learning-node" ? (
        <Suspense fallback={null}>
          <MapLearningNodeHost
            studyId={view.studyId}
            courseId={view.courseId}
            segment={pathOverlay.segment}
            kind={pathOverlay.nodeKind}
            identityPort={identityPort}
            progressPort={progressPort}
            contentPort={contentPort}
            returnFocusTo={pathOverlay.returnFocusTo}
            outline={course.units.flatMap((unit) =>
              unit.lessons.map((lesson) => ({ unitId: unit.id, lessonId: lesson.id })),
            )}
            avatarRecipe={avatarSignedIn ? avatarRecipe : null}
            onClose={() => setPathOverlay(null)}
            onOpenLesson={(locator) => {
              setPathOverlay(null);
              setView({ kind: "lesson", ...locator });
            }}
          />
        </Suspense>
      ) : null}

      {view.kind === "course" && course && pathOverlay?.kind === "unit" && pathUnit ? (
        <UnitCard
          open
          unit={pathUnitOf(pathUnit)}
          /*
            V5 §12 决定 D: 「每个单元入口都有一个『我会了』」 — on the unit's own
            entry, always, not only at the start of a course. 「人的能力是一路
            长的，只在进门时测一次，等于假定他一年后还是进门那天的样子。」

            The same component the course-opening recommender renders. The two
            are the same mechanism with two entrances, so there is one of it.
          */
          skipTest={
            <UnitSkipTest
              studyId={view.studyId}
              courseId={view.courseId}
              unit={pathUnit}
              content={contentPort}
              proven={provenIdsForUnit(
                new Set(Object.keys(progress.provenLessons ?? {})),
                { studyId: view.studyId, courseId: view.courseId },
                pathUnit.lessons.map((lesson) => lesson.id),
              )}
              onProven={(lessonIds) =>
                progressPort.markLessonsProven({
                  studyId: view.studyId,
                  courseId: view.courseId,
                  unitId: pathUnit.id,
                  lessonIds,
                })
              }
              onOpenLesson={(locator) => {
                setPathOverlay(null);
                setView({ kind: "lesson", ...locator });
              }}
            />
          }
          onClose={() => setPathOverlay(null)}
          onStart={() => {
            const first = pathUnit.lessons[0];
            if (!first) return;
            setPathOverlay(null);
            setView({
              kind: "lesson",
              studyId: view.studyId,
              courseId: view.courseId,
              unitId: pathUnit.id,
              lessonId: first.id,
            });
          }}
          returnFocusTo={pathOverlay.returnFocusTo}
        />
      ) : null}

      {view.kind === "settled" && course && chestOverlay ? chestOverlay : null}
      {view.kind === "settled" && course && !chestOverlay ? (
        <Suspense
          fallback={
            <RouteFallback copy={interfaceTranslator.t("app.lesson.settlement.copy.读完了")} />
          }
        >
          <SettlementHost
            course={course}
            grewFrom={grewFrom}
            reviewReminderDismissedFor={reviewReminderDismissedFor}
            onDismissReviewReminder={onDismissReviewReminder}
            locator={{
              studyId: view.studyId,
              courseId: view.courseId,
              unitId: view.unitId,
              lessonId: view.lessonId,
            }}
            onMap={() =>
              setView({ kind: "course", studyId: view.studyId, courseId: view.courseId })
            }
            onNext={(unitId, lessonId) =>
              setView({
                kind: "lesson",
                studyId: view.studyId,
                courseId: view.courseId,
                unitId,
                lessonId,
              })
            }
            onIncomplete={() =>
              setView({
                kind: "lesson",
                studyId: view.studyId,
                courseId: view.courseId,
                unitId: view.unitId,
                lessonId: view.lessonId,
              })
            }
            onWorthwhileProgress={onWorthwhileProgress}
          />
        </Suspense>
      ) : null}

      {view.kind === "review" ? (
        <div className="review-page">
          {todaySection}
          <section className="review-door__practice" data-review-practice>
            <h2>{interfaceTranslator.t("doors.practice.title")}</h2>
            <p>{interfaceTranslator.t("doors.practice.description")}</p>
            <nav
              className="learner-destinations"
              aria-label={interfaceTranslator.t("doors.practice.title")}
            >
              <a href="/practice" data-review-practice-entry>
                {interfaceTranslator.t("doors.practice.start")}
              </a>
              <a href="/practice?mode=free">{interfaceTranslator.t("doors.practice.free")}</a>
            </nav>
            <MistakesEntry count={uncorrectedMistakeCount} hasMistakes={mistakes.length > 0} />
          </section>
        </div>
      ) : null}

      {view.kind === "mistakes" ? (
        <MistakeList
          mistakes={mistakes}
          content={contentPort}
          onOpenLesson={(locator) => setView({ kind: "lesson", ...locator })}
        />
      ) : null}

      {view.kind === "term" ? (
        <Suspense fallback={<RouteFallback />}>
          <TermEntryHost senseId={view.senseId} onOpen={setView} />
        </Suspense>
      ) : null}

      {LIBRARY_VIEW_TAB[view.kind] ? (
        <Suspense fallback={<RouteFallback />}>
          <LibraryHost
            key={progressPort.syncState().userId ?? "guest"}
            tab={libraryTabOf(view)}
            studyId={focusedStudyId}
            onOpen={setView}
            album={album}
            sound={progress.account.preferences.soundEnabled}
          />
        </Suspense>
      ) : null}

      {view.kind === "concept" ? (
        <Suspense fallback={<RouteFallback />}>
          <ConceptEntryHost id={view.id} onOpen={setView} />
        </Suspense>
      ) : null}

      {view.kind === "practice" ? (
        <Suspense fallback={<RouteFallback />}>
          <PracticeHost onOpen={setView} studies={studies} ready={shelf !== null} />
        </Suspense>
      ) : null}

      {view.kind === "catalog" ? (
        <Suspense fallback={<RouteFallback />}>
          <CourseCatalog onOpen={setView} />
        </Suspense>
      ) : null}

      {view.kind === "anti-pattern-entry" ? (
        <Suspense fallback={<RouteFallback />}>
          <AntiPatternEntryHost id={view.id} onOpen={setView} />
        </Suspense>
      ) : null}

      {/*
        These three read the same progress document the learning screens write,
        through the same `useSyncExternalStore` subscription — so a quest cannot
        show 0/1 next to a lesson that was just finished. Nothing about them is
        stored; see packages/core progress/goals.ts.
      */}
      {/*
        Only the globe here. The list is in the shell's aside, where the map
        puts 「今天」 — so stepping out to the planet keeps the frame and
        changes the world inside it, instead of swapping a world for a page.
      */}
      {view.kind === "planet" ? (
        <div className="planet-page__globe" data-planet-globe="true">
          <PlanetStage
            studies={planetStudies}
            key={sceneAttempt}
            readiness={planetReadiness}
            domainCatalog={planetDomainCatalog}
            explicitSelection
            selectedId={selectedPlanetStudyId ?? null}
            selectedDomainId={selectedPlanetDomainId}
            onSelectDomain={onSelectPlanetDomain}
            onSelect={onSelectPlanetStudy ?? setNavigationFocus}
            onEnterStudy={onEnterPlanetStudy}
            onClearSelection={onClearPlanetPick}
            avatarRecipe={avatarRecipe}
            avatarSignedIn={avatarSignedIn}
          />
        </div>
      ) : null}
      {/*
        The workbench. `AUTHORING` is a build-time constant, so this branch and
        everything `../authoring/` imports are gone from a delivery bundle —
        which is also why `/studio` lands on the map there rather than on an
        empty column.
      */}
      {AUTHORING && view.kind === "studio" && view.section === "map" ? (
        <MapStudioScreen
          studies={studies}
          nodes={nodes}
          world={world}
          courseProgress={courseProgress}
          progressPort={progressPort}
          focusedStudyId={focusedStudyId}
          planetStudies={planetStudies}
          planetDomainCatalog={planetDomainCatalog}
          onSelectStudy={focusStudy}
        />
      ) : null}
      {AUTHORING && view.kind === "studio" && view.section !== "map" ? (
        <StudioScreen
          studyId={focusedStudyId}
          onSelectStudy={focusStudy}
          onOpenLesson={(locator) => setView({ kind: "lesson", ...locator })}
        />
      ) : null}
      {view.kind === "league" ? (
        <>
          <LeagueScreen
            document={progress}
            signedIn={avatarSignedIn}
            emblem={(tierId) => <EmblemImage kind="rank" id={tierId} size={96} />}
          />
          <details className="product-details" data-growth-goals>
            <summary>{interfaceTranslator.t("doors.growth.details")}</summary>
            <LevelProgress totalXp={progress.totalXp} />
            <QuestsScreen document={progress} learnHref={continueHref} />
          </details>
          <BadgeWall
            embedded
            document={progress}
            coursesFinished={album?.coursesFinished ?? profileStats.coursesFinished}
            pathsFinished={album?.pathsFinished ?? 0}
            emblem={(badge) => (
              <EmblemImage kind="badge" id={badge.id} locked={!badge.earned} size={96} />
            )}
          />
        </>
      ) : null}
      {view.kind === "quests" ? (
        <QuestsScreen
          document={progress}
          learnHref={
            nextUpProgress?.next
              ? toPath({ kind: "lesson", ...nextUpProgress.next })
              : toPath({ kind: "catalog" })
          }
        />
      ) : null}
      {view.kind === "plans" ? (
        <PlansScreen key={progressPort.syncState().userId ?? "guest"} paymentPort={paymentPort} />
      ) : null}
      {view.kind === "support" ? (
        <SupportScreen
          key={view.page}
          page={view.page}
          saveStatus={
            <LearningSaveStatus
              key={progressPort.syncState().userId ?? "guest"}
              progress={progressPort}
            />
          }
        />
      ) : null}
      {view.kind === "settings" ? (
        <SettingsScreen
          presence={presencePort}
          progress={progressPort}
          reminders={reviewReminderPort}
          guide={<MapGuideDetails />}
          laboratory={AUTHORING ? <SettingsLab /> : undefined}
        />
      ) : null}
      {view.kind === "me" ? (
        <ProfileScreen
          accountEmail={accountIdentity.kind === "signed_in" ? accountIdentity.user.email : null}
          onOpenWardrobe={() => setView({ kind: "wardrobe" })}
          avatar={
            avatarPanel ?? (
              <Suspense
                fallback={
                  <div className="profile-avatar">
                    <LoadingTrivia />
                  </div>
                }
              >
                <ProfileAvatar avatarRecipe={avatarRecipe} signedIn={avatarSignedIn} />
              </Suspense>
            )
          }
          saveStatus={
            <LearningSaveStatus
              key={progressPort.syncState().userId ?? "guest"}
              progress={progressPort}
              allowGuestImport
            />
          }
          account={
            <>
              <AccountPanel
                identity={identityPort}
                auth={authPort}
                focusRequest={accountFocusRequest}
                continueLearningHref={continueHref}
                onContinueLearning={goContinueLearning}
              />
              <AccountClosurePanel
                identity={identityPort}
                auth={authPort}
                confirmationPhrase={ACCOUNT_CLOSURE_CONFIRMATION}
                requestClosure={accountClosurePort?.request ?? null}
              />
            </>
          }
          reviewCardCount={Object.keys(progress.cards).length}
          passagesRead={profileStats.passagesRead}
          lessonsCompleted={profileStats.lessonsCompleted}
          nextHref={
            nextUpProgress?.next
              ? toPath({
                  kind: "lesson",
                  studyId: nextUpProgress.next.studyId,
                  courseId: nextUpProgress.next.courseId,
                  unitId: nextUpProgress.next.unitId,
                  lessonId: nextUpProgress.next.lessonId,
                })
              : todayNode
                ? toPath({
                    kind: "course",
                    studyId: todayNode.studyId,
                    courseId: todayNode.courseId,
                  })
                : "/"
          }
        />
      ) : null}
      {view.kind === "auth-callback" ? (
        <AuthCallbackScreen auth={authPort} locale={i18n.locale} onContinue={goContinueLearning} />
      ) : null}
      {view.kind === "auth-reset" ? (
        <AuthResetScreen auth={authPort} locale={i18n.locale} onUpdated={goContinueLearning} />
      ) : null}
    </>
  );
}
