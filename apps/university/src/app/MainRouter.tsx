import { accountClosurePort, ACCOUNT_CLOSURE_CONFIRMATION } from "../account/account-closure.js";
import { translate, useI18n } from "@pieai/university-ui/i18n.js";
import { LearningSaveStatus } from "@pieai/university-ui/progress/LearningSaveStatus.js";
import { lazy, Suspense, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  LIBRARY_VIEW_TAB,
  libraryTabOf,
  provenIdsForUnit,
  toPath,
  type CourseProgress,
  type IdentityPort,
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
  PlansScreen,
  QuestsScreen,
} from "@pieai/university-ui/navigation/screens.js";
import { NodeCard } from "@pieai/university-ui/path/NodeCard.js";
import { UnitCard } from "@pieai/university-ui/path/UnitCard.js";
import { UnitSkipTest } from "@pieai/university-ui/path/UnitSkipTest.js";
import { MistakeList, MistakesEntry } from "@pieai/university-ui/practice/mistakes.js";
import { pathLessonOf, pathUnitOf } from "@pieai/university-ui/path/from-course-view.js";
import type { ContentPort, ContentStudy, Shelf } from "@pieai/university-ui/content/port.js";
import type { CourseView, UnitView } from "@pieai/university-ui/view/lesson-view.js";
import {
  PlanetStage,
  type PlanetStudy,
  type PlanetStudyDomain,
} from "@pieai/university-world/planet.js";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import type { WorldMap } from "@pieai/university-world/WorldMapCanvas.js";

import {
  clearLearningReturn,
  continueLearningView,
  readLearningReturn,
} from "../account/continue-learning";
import { AUTHORING } from "../mode";
import { AuthoringMapNotes, StudioScreen } from "../authoring/index";
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
import { CourseIsland, type CourseIslandProps } from "./CourseIsland.js";
import { MapBreadcrumbs } from "./MapBreadcrumbs.js";
import type { PathOverlay } from "./world-model";

const PlayCatalogRoute = lazy(() => import("../play-catalog/PlayCatalogRoute.js"));
const ToyPlayLabRoute = lazy(() => import("../play-catalog/ArcadeRoute.js"));
const PropFinishRoute = lazy(() => import("../play-catalog/PropFinishRoute.js"));
const RetiredAppearanceRoute = lazy(() => import("../play-catalog/RetiredAppearanceRoute.js"));
const LearningPlayLab = lazy(() =>
  import("@pieai/university-ui/learning-play/LearningPlayLab.js").then((mod) => ({
    default: mod.LearningPlayLab,
  })),
);

const ProfileAvatar = lazy(() =>
  import("./ProfileAvatar.js").then((mod) => ({ default: mod.ProfileAvatar })),
);

type PathLesson = CourseView["units"][number]["lessons"][number];

interface MainRouterProps {
  readonly contentPort: ContentPort;
  readonly course: CourseView | null;
  readonly courseIslandProps: CourseIslandProps | null;
  readonly focusedStudyId: string | null;
  readonly focusStudy: (studyId: string) => void;
  readonly grewFrom: { readonly key: string; readonly doneBefore: number } | null;
  readonly reviewReminderDismissedFor: string | null;
  readonly onDismissReviewReminder: (key: string) => void;
  readonly avatarRecipe: AvatarRecipe | null;
  readonly avatarSignedIn: boolean;
  readonly onAvatarRecipeChange: (recipe: AvatarRecipe) => void;
  readonly onWorthwhileProgress?: () => void;
  readonly identityPort: IdentityPort;
  readonly authPort: AccountAuthPort | null;
  readonly accountFocusRequest: number;
  readonly paymentPort: PaymentPort;
  readonly mistakes: readonly Mistake[];
  readonly nextUpProgress: CourseProgress | null;
  readonly pathLesson: PathLesson | undefined;
  readonly pathOverlay: PathOverlay | null;
  readonly pathUnit: UnitView | undefined;
  readonly planetStudies: readonly PlanetStudy[];
  readonly planetDomainCatalog?: readonly PlanetStudyDomain[];
  readonly selectedPlanetDomainId?: string | null;
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
  readonly showMap: boolean;
  readonly stage: ReactNode;
  readonly studyNames: readonly ContentStudy[];
  readonly todayNode: CourseNode | null;
  readonly todaySection: ReactNode;
  readonly uncorrectedMistakeCount: number;
  readonly view: View;
  readonly wide: boolean;
}

export function MainRouter({
  contentPort,
  course,
  courseIslandProps,
  focusedStudyId,
  focusStudy,
  grewFrom,
  reviewReminderDismissedFor,
  onDismissReviewReminder,
  avatarRecipe,
  avatarSignedIn,
  onAvatarRecipeChange,
  onWorthwhileProgress,
  identityPort,
  authPort,
  accountFocusRequest,
  paymentPort,
  mistakes,
  nextUpProgress,
  pathLesson,
  pathOverlay,
  pathUnit,
  planetStudies,
  planetDomainCatalog,
  selectedPlanetDomainId,
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
  showMap,
  stage,
  studyNames,
  todayNode,
  todaySection,
  uncorrectedMistakeCount,
  view,
  wide,
}: MainRouterProps) {
  const i18n = useI18n();
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
        <p className="loading-copy">{translate("app.app.mainRouter.copy.正在打开校园档案")}</p>
      ) : null}
      {view.kind === "planet" || view.kind === "world" || view.kind === "course" ? (
        <MapBreadcrumbs
          layer={view.kind}
          studyTitle={studies.find((study) => study.id === focusedStudyId)?.title}
          courseTitle={view.kind === "course" ? course?.title : undefined}
          onNavigate={setView}
        />
      ) : null}
      {stage ? (
        <div className="learn-stage">
          {stage}
          {wide && showMap ? (
            <div className="learn-hud">
              {/*
              No 「next lesson」 card here at this width. The right rail's
              「今天」 already carries the same title, the same metadata and the
              same button, so rendering both put two competing orange calls to
              action on one screen — and this one sat on top of the map,
              covering an island's own label. The rail owns it where the rail
              exists; below 1160 there is no rail and the floating card above
              takes over. One call to action at every width.
            */}
              {courseIslandProps ? <CourseIsland {...courseIslandProps} /> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {AUTHORING && view.kind === "world" ? <AuthoringMapNotes studyId={focusedStudyId} /> : null}
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
          ) : (
            <LearningPlayLab
              key={view.collection ?? "foundations"}
              collection={view.collection ?? "foundations"}
            />
          )}
        </Suspense>
      ) : null}
      {view.kind === "avatar-lab" ? (
        <Suspense fallback={<RouteFallback />}>
          <AvatarLab
            avatarRecipe={avatarRecipe}
            onRecipeChange={onAvatarRecipeChange}
            onOpen={setView}
          />
        </Suspense>
      ) : null}

      {view.kind === "course" &&
      course &&
      pathOverlay?.kind === "node" &&
      pathUnit &&
      pathLesson ? (
        <NodeCard
          open
          /*
            The cards read counts, not prose — one fold, shared with the
            settlement's next-step card, so the two can never quote a different
            cost for the same lesson.
          */
          lesson={pathLessonOf(pathLesson)}
          unit={pathUnitOf(pathUnit)}
          onClose={() => setPathOverlay(null)}
          onStart={() => {
            setPathOverlay(null);
            setView({
              kind: "lesson",
              studyId: view.studyId,
              courseId: view.courseId,
              unitId: pathUnit.id,
              lessonId: pathLesson.id,
            });
          }}
          onStartUnit={() => {
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

      {view.kind === "settled" && course ? (
        <Suspense
          fallback={<RouteFallback copy={translate("app.lesson.settlement.copy.读完了")} />}
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
          <MistakesEntry count={uncorrectedMistakeCount} hasMistakes={mistakes.length > 0} />
          {todaySection}
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
          <LibraryHost tab={libraryTabOf(view)} studyId={focusedStudyId} onOpen={setView} />
        </Suspense>
      ) : null}

      {view.kind === "concept" ? (
        <Suspense fallback={<RouteFallback />}>
          <ConceptEntryHost id={view.id} onOpen={setView} />
        </Suspense>
      ) : null}

      {view.kind === "practice" ? (
        <Suspense fallback={<RouteFallback />}>
          <PracticeHost onOpen={setView} />
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
            domainCatalog={planetDomainCatalog}
            selectedId={focusedStudyId}
            selectedDomainId={selectedPlanetDomainId}
            onSelectDomain={onSelectPlanetDomain}
            onSelect={onSelectPlanetStudy ?? setNavigationFocus}
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
        <LeagueScreen document={progress} signedIn={avatarSignedIn} />
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
      {view.kind === "settings" ? (
        <SettingsScreen
          presence={presencePort}
          progress={progressPort}
          reminders={reviewReminderPort}
        />
      ) : null}
      {view.kind === "me" ? (
        <ProfileScreen
          avatar={
            <Suspense
              fallback={
                <div className="profile-avatar">
                  <LoadingTrivia />
                </div>
              }
            >
              <ProfileAvatar avatarRecipe={avatarRecipe} signedIn={avatarSignedIn} />
            </Suspense>
          }
          account={
            <>
              <LearningSaveStatus
                key={progressPort.syncState().userId ?? "guest"}
                progress={progressPort}
                allowGuestImport
              />
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
          totalXp={progress.totalXp}
          reviewCardCount={Object.keys(progress.cards).length}
          badges={<BadgeWall document={progress} coursesFinished={profileStats.coursesFinished} />}
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
