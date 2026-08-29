import { lazy, Suspense, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  LIBRARY_VIEW_TAB,
  libraryTabOf,
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
  ProfileScreen,
  SettingsScreen,
} from "@pieai/university-ui/navigation/empty.js";
import {
  BadgeWall,
  LeagueScreen,
  PlansScreen,
  QuestsScreen,
} from "@pieai/university-ui/navigation/screens.js";
import { NodeCard } from "@pieai/university-ui/path/NodeCard.js";
import { UnitCard } from "@pieai/university-ui/path/UnitCard.js";
import { MistakeList, MistakesEntry } from "@pieai/university-ui/practice/mistakes.js";
import { pathLessonOf, pathUnitOf } from "@pieai/university-ui/path/from-course-view.js";
import type { ContentPort, ContentStudy, Shelf } from "@pieai/university-ui/content/port.js";
import type { CourseView, UnitView } from "@pieai/university-ui/view/lesson-view.js";
import { PlanetStage, type PlanetStudy } from "@pieai/university-world/planet.js";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import type { WorldMap } from "@pieai/university-world/WorldMapCanvas.js";

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
import type { PathOverlay } from "./world-model";

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
  readonly paymentPort: PaymentPort;
  readonly mistakes: readonly Mistake[];
  readonly nextUpProgress: CourseProgress | null;
  readonly pathLesson: PathLesson | undefined;
  readonly pathOverlay: PathOverlay | null;
  readonly pathUnit: UnitView | undefined;
  readonly planetStudies: readonly PlanetStudy[];
  readonly presencePort: PresencePort;
  readonly reviewReminderPort: ReviewReminderPort;
  readonly profileStats: {
    readonly coursesFinished: number;
    readonly lessonsCompleted: number;
    readonly passagesRead: number;
  };
  readonly progress: ProgressDocument;
  readonly progressPort: ProgressPort;
  readonly setMapFocus: Dispatch<SetStateAction<string | null | undefined>>;
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
  paymentPort,
  mistakes,
  nextUpProgress,
  pathLesson,
  pathOverlay,
  pathUnit,
  planetStudies,
  presencePort,
  reviewReminderPort,
  profileStats,
  progress,
  progressPort,
  setMapFocus,
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
      {studyNames.length === 0 && !shelf ? <p className="loading-copy">正在打开校园档案…</p> : null}
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
        <Suspense fallback={<RouteFallback />}>
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
          <PlanetStage studies={planetStudies} selectedId={focusedStudyId} onSelect={setMapFocus} />
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
      {view.kind === "quests" ? <QuestsScreen document={progress} /> : null}
      {view.kind === "plans" ? <PlansScreen paymentPort={paymentPort} /> : null}
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
          account={<AccountPanel identity={identityPort} />}
          totalXp={progress.totalXp}
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
    </>
  );
}
