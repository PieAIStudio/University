import type { View, PresencePort } from "@pieai/university-core";
import { PresenceLayer, type PresenceSurface } from "@pieai/university-ui/presence.js";
import { CourseScene, type LessonPlacement, type Marker } from "@pieai/university-world/Maps.js";
import { CompanionProbe } from "@pieai/university-world/companion-probe.js";
import {
  WorldMapCanvas,
  type MapViewportCommands,
  type WorldMap,
} from "@pieai/university-world/WorldMapCanvas.js";
import type { IslandLookDebugOptions } from "@pieai/university-world/island-look.js";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import type { ReactNode, RefObject } from "react";

import { COURSE_POLAR, WORLD_POLAR } from "@pieai/university-world/controls.js";
import { useIslandLookStage } from "./island-look-view";

type CanvasProps = Parameters<typeof WorldMapCanvas>[0];
type CourseProps = Parameters<typeof CourseScene>[0];

const NO_MARKERS: readonly never[] = [];

/**
 * The map's rendering boundary.
 *
 * App prepares learner state and feature-owned cards; this component owns the
 * scene assembly itself. Keeping the canvas, course scene, companion probe and
 * presence overlay together means a future renderer change has one owner and
 * does not turn App into a second scene implementation.
 */
interface WorldSurfaceProps {
  readonly inCourse: boolean;
  readonly openingOnMap: boolean;
  readonly view: View;
  readonly sceneView: View;
  readonly lessons: readonly LessonPlacement[];
  readonly world: WorldMap | null;
  readonly wide: boolean;
  readonly lookDebug: IslandLookDebugOptions | null;
  readonly sceneAttempt: number;
  readonly waitingForData: boolean;
  readonly showMap: boolean;
  readonly commandsRef: RefObject<MapViewportCommands | null>;
  readonly sceneKey?: string;
  readonly cameraFrom: CanvasProps["cameraFrom"];
  readonly lookAt: CanvasProps["lookAt"];
  readonly learnerAt: CanvasProps["learnerAt"];
  readonly avatarRecipe: AvatarRecipe | null;
  readonly avatarSignedIn: boolean;
  readonly selectedCourseKey: string | null;
  readonly skyStudyId: string | null;
  readonly markers: readonly Marker[];
  readonly followId: string | null;
  readonly followNode: { readonly current: HTMLElement | null };
  readonly onPick: CanvasProps["onPick"];
  readonly onHover: CanvasProps["onHover"];
  readonly onInteract: CanvasProps["onInteract"];
  readonly onSceneReady: CanvasProps["onSceneReady"];
  readonly onSceneBusy: CanvasProps["onSceneBusy"];
  readonly onSceneProgress: CanvasProps["onSceneProgress"];
  readonly onContextLost: CanvasProps["onContextLost"];
  readonly onContextRestored: CanvasProps["onContextRestored"];
  readonly onRendererUnavailable: CanvasProps["onRendererUnavailable"];
  readonly onPointerMissed: CanvasProps["onPointerMissed"];
  readonly onPickLesson: CourseProps["onPick"];
  readonly onPickNode: CourseProps["onPickNode"];
  readonly onCourseHover: CourseProps["onHover"];
  readonly avatarLessonId: string | null;
  readonly avatarNodeId: string | null;
  readonly opening: CourseProps["opening"];
  readonly introductoryLessonId: string | null;
  readonly onIntroductionReady: CourseProps["onIntroductionReady"];
  readonly reviewDue: readonly string[] | null;
  readonly cosmeticOrnamentId: string | null;
  readonly weeklyBoss: CourseProps["weeklyBoss"];
  readonly weeklyWins: CourseProps["weeklyWins"];
  readonly onPickWeeklyBoss: CourseProps["onPickWeeklyBoss"];
  readonly companionAnchors: readonly {
    readonly id: string;
    readonly position: { x: number; y: number; z: number };
  }[];
  readonly companionNodes: Map<string, HTMLElement>;
  readonly presencePort: PresencePort;
  readonly presenceSurface: PresenceSurface;
  readonly presenceViewKey: string;
  readonly attachPresence: (userId: string, element: HTMLElement | null) => void;
  readonly overlay: ReactNode;
  readonly weeklyOverlay: ReactNode;
  readonly chestOverlay: ReactNode;
  readonly guide: ReactNode;
  readonly loading: ReactNode;
  readonly hoverHint: ReactNode;
  readonly controlsHint: ReactNode;
  readonly controlsHintVisible: boolean;
}

export function WorldSurface({
  inCourse,
  openingOnMap,
  view,
  sceneView,
  lessons,
  world,
  wide,
  lookDebug,
  sceneAttempt,
  waitingForData,
  showMap,
  commandsRef,
  sceneKey,
  cameraFrom,
  lookAt,
  learnerAt,
  avatarRecipe,
  avatarSignedIn,
  selectedCourseKey,
  skyStudyId,
  markers,
  followId,
  followNode,
  onPick,
  onHover,
  onInteract,
  onSceneReady,
  onSceneBusy,
  onSceneProgress,
  onContextLost,
  onContextRestored,
  onRendererUnavailable,
  onPointerMissed,
  onPickLesson,
  onPickNode,
  onCourseHover,
  avatarLessonId,
  avatarNodeId,
  opening,
  introductoryLessonId,
  onIntroductionReady,
  reviewDue,
  cosmeticOrnamentId,
  weeklyBoss,
  weeklyWins,
  onPickWeeklyBoss,
  companionAnchors,
  companionNodes,
  presencePort,
  presenceSurface,
  presenceViewKey,
  attachPresence,
  overlay,
  weeklyOverlay,
  chestOverlay,
  guide,
  loading,
  hoverHint,
  controlsHint,
  controlsHintVisible,
}: WorldSurfaceProps) {
  const { lookSource, fixedCamera } = useIslandLookStage({
    inCourse,
    lessons,
    lookDebug,
    viewKind: sceneView.kind,
    world,
    wide,
  });
  const stage = (
    <WorldMapCanvas
      commandsRef={commandsRef}
      sceneKey={sceneKey}
      dataReady={!waitingForData}
      key={sceneAttempt}
      hidden={!showMap}
      paused={!showMap}
      polar={view.kind === "world" ? WORLD_POLAR : COURSE_POLAR}
      world={view.kind === "world" ? world : null}
      courseViewKey={view.kind === "course" ? `${view.studyId}/${view.courseId}` : null}
      cameraFrom={fixedCamera?.cameraFrom ?? cameraFrom}
      lookAt={fixedCamera?.lookAt ?? lookAt}
      learnerAt={learnerAt}
      avatarRecipe={avatarRecipe}
      avatarSignedIn={avatarSignedIn}
      selectedCourseKey={selectedCourseKey}
      skyStudyId={skyStudyId}
      markers={openingOnMap ? NO_MARKERS : markers}
      followId={followId}
      followNode={followNode}
      onPick={onPick}
      onHover={onHover}
      onInteract={onInteract}
      onSceneReady={view.kind === "planet" ? undefined : onSceneReady}
      onSceneBusy={view.kind === "planet" ? undefined : onSceneBusy}
      onSceneProgress={view.kind === "planet" ? undefined : onSceneProgress}
      onContextLost={onContextLost}
      onContextRestored={onContextRestored}
      onRendererUnavailable={onRendererUnavailable}
      onPointerMissed={onPointerMissed}
      fixedCamera={fixedCamera}
      postProcessing={import.meta.env.DEV && lookDebug?.shot ? lookDebug.post : true}
      lookSource={lookSource}
      stageChildren={
        <>
          <CompanionProbe anchors={companionAnchors} nodes={companionNodes} />
          {inCourse && lessons.length > 0 ? (
            <CourseScene
              lessons={lessons}
              avatarRecipe={avatarRecipe}
              avatarSignedIn={avatarSignedIn}
              avatarLessonId={avatarLessonId}
              avatarNodeId={avatarNodeId}
              onPick={onPickLesson}
              onPickNode={onPickNode}
              onHover={onCourseHover}
              skyStudyId={
                view.kind === "course" || view.kind === "lesson" || view.kind === "settled"
                  ? view.studyId
                  : null
              }
              opening={openingOnMap ? opening : null}
              introductoryLessonId={introductoryLessonId}
              onIntroductionReady={onIntroductionReady}
              reviewDue={reviewDue}
              cosmeticOrnamentId={cosmeticOrnamentId}
              weeklyBoss={weeklyBoss}
              weeklyWins={weeklyWins}
              onPickWeeklyBoss={onPickWeeklyBoss}
            />
          ) : null}
        </>
      }
      overlay={
        <>
          {weeklyOverlay}
          {chestOverlay}
          <PresenceLayer
            port={presencePort}
            surface={presenceSurface}
            viewKey={presenceViewKey}
            attach={attachPresence}
          />
          {overlay}
        </>
      }
      hoverHint={hoverHint}
      controlsHint={controlsHint}
      controlsHintVisible={controlsHintVisible}
      guide={guide}
      loading={loading}
    />
  );

  return stage;
}
