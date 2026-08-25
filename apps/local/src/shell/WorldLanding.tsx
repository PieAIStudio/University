/**
 * The authoring shell's world: the same scene as delivery, plus this overlay.
 *
 * Canvas answers "where do I go". DOM answers "what is true right now".
 * The 2D catalog is a separate keyboard-complete route; this component owns
 * the world view and the authoring overlay only.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { LoadingTrivia, useMapCover } from "@pieai/university-ui/loading/LoadingTrivia.js";
import { CoursePickCard } from "@pieai/university-ui/path/CoursePickCard.js";
import { NodeCard } from "@pieai/university-ui/path/NodeCard.js";
import { spacedName } from "@pieai/university-ui/text/spaced-name.js";
import type { BootstrapData, LessonRef, StudyView } from "@pieai/university-ui/view/lesson-view.js";
import type { CourseNode } from "@pieai/university-world/course.js";
import { COURSE_POLAR, MAP_CONTROLS_HINT, WORLD_POLAR } from "@pieai/university-world/controls.js";
import { frameWorld, roadAhead } from "@pieai/university-world/frame.js";
import {
  placeCourse,
  placeWorld,
  type LessonPlacement,
  type Marker,
} from "@pieai/university-world/Maps.js";
import { courseMarkers, frameCourse, worldCourse } from "@pieai/university-world/course-map.js";
import { CourseScene } from "@pieai/university-world/Maps.js";
import { WorldMapCanvas } from "@pieai/university-world/WorldMapCanvas.js";
import { CompanionProbe } from "@pieai/university-world/companion-probe.js";
import { PresenceLayer } from "@pieai/university-ui/presence.js";
import { progressSourceOf, type PresencePort, type ProgressPort } from "@pieai/university-core";

import { AirlockClocks } from "./StudyDetail.js";
import { UaDashboardButton } from "./UaDashboardButton.js";
import { courseNodesFromCatalog, courseProgressOf } from "./world-graph.js";

function useMinWidth(px: number): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window.matchMedia !== "function") return () => undefined;
      const mq = window.matchMedia(`(min-width: ${px}px)`);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () =>
      typeof window.matchMedia === "function"
        ? window.matchMedia(`(min-width: ${px}px)`).matches
        : false,
    () => false,
  );
}

export function WorldLanding({
  data,
  catalog,
  presence,
  progressPort,
  shownStudyId,
  onSelectStudy,
  openCourseId,
  onOpenCourse,
  onCloseCourse,
  onOpenLesson,
}: {
  readonly data: BootstrapData;
  readonly catalog: ReadonlyMap<string, StudyView>;
  readonly presence: PresencePort;
  readonly progressPort: ProgressPort;
  /**
   * The series to draw, already resolved by the shell — never a raw pick.
   *
   * This component used to take the raw pick and fall back on its own, which
   * meant the map knew which project it was drawing and the capsule above it
   * did not. One resolution, at the top, and both read the same value.
   */
  readonly shownStudyId: string;
  readonly onSelectStudy: (studyId: string) => void;
  /**
   * The course whose island you are standing on, or null out on the map.
   *
   * This shell used to have no such state: picking an island jumped straight
   * to the resume lesson, so the level between a project and a lesson — the
   * island seen from inside, with a stone per lesson — existed in the delivery
   * shell only. Same scene, same camera, same labels; the pieces come from
   * `@pieai/university-world/course-map.js` so there is one of each.
   */
  readonly openCourseId: string | null;
  readonly onOpenCourse: (studyId: string, courseId: string) => void;
  readonly onCloseCourse: () => void;
  readonly onOpenLesson: (locator: LessonRef) => void;
}) {
  const wide = useMinWidth(768);
  const [hovered, setHovered] = useState<string | null>(null);
  const [picked, setPicked] = useState<CourseNode | null>(null);
  const [pickedLesson, setPickedLesson] = useState<LessonPlacement | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const pickCardRef = useRef<HTMLElement | null>(null);
  const companionNodes = useRef(new Map<string, HTMLElement>());
  const dismissPick = useCallback(() => setPicked(null), []);

  const progressOf = useCallback(
    (node: CourseNode) => {
      const course = catalog.get(node.studyId)?.courses.find((entry) => entry.id === node.courseId);
      return course ? courseProgressOf(course) : 0;
    },
    [catalog],
  );

  const worldNodes = useMemo(
    () => courseNodesFromCatalog(data.studies, catalog),
    [data.studies, catalog],
  );

  const world = useMemo(
    () => (worldNodes.length > 0 ? placeWorld(worldNodes, progressOf, shownStudyId) : null),
    [worldNodes, progressOf, shownStudyId],
  );

  const nextLesson = data.today.nextLesson;
  const placements = useMemo(() => {
    if (!world) return [];
    if (!nextLesson) return world.placements;
    return world.placements.map((entry) => {
      const isNext =
        entry.node.studyId === nextLesson.studyId && entry.node.courseId === nextLesson.courseId;
      if (isNext) return { ...entry, state: "live" as const };
      if (entry.state === "live") return { ...entry, state: "open" as const };
      return entry;
    });
  }, [world, nextLesson]);

  const renderWorld = useMemo(() => (world ? { ...world, placements } : null), [world, placements]);

  const nextUp = useMemo(() => {
    if (placements.length === 0) return null;
    const live = placements.find((entry) => entry.state === "live");
    return live ?? placements[0] ?? null;
  }, [placements]);

  const learnerAt = nextUp?.position ?? null;
  const framed = useMemo(() => {
    const standingAt = learnerAt ?? placements[0]?.position ?? null;
    return frameWorld(standingAt, roadAhead(placements, standingAt));
  }, [learnerAt, placements]);

  /*
    No study badge floating in the sea any more.

    It named which archipelago you were looking at, which was a real question
    while four of them shared one ocean. There is one project in the scene now
    and the top capsule already names it, so the badge would be the same word
    twice — once in a place you can read and once in a place that scrolls away.
  */
  const markers: readonly Marker[] = useMemo(() => {
    if (!world) return [];
    return placements.map((entry) => ({
      id: `${entry.node.studyId}/${entry.node.courseId}`,
      position: entry.position.clone().setY(entry.position.y + entry.radius * 0.4 + 1.4),
      text: entry.node.title,
      kind: "course" as const,
      activate: () => {
        setPicked(entry.node);
        onSelectStudy(entry.node.studyId);
      },
    }));
  }, [world, placements, onSelectStudy]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => window.cancelAnimationFrame(id);
  }, [world]);

  const openCourse = useMemo(
    () =>
      openCourseId
        ? (catalog.get(shownStudyId)?.courses.find((entry) => entry.id === openCourseId) ?? null)
        : null,
    [catalog, shownStudyId, openCourseId],
  );

  const courseLessons = useMemo(
    () =>
      openCourse
        ? placeCourse(shownStudyId, worldCourse(openCourse), progressSourceOf(progressPort))
        : [],
    [openCourse, shownStudyId, progressPort],
  );

  const courseCamera = useMemo(
    () => (courseLessons.length > 0 ? frameCourse(courseLessons) : null),
    [courseLessons],
  );

  const courseLabels = useMemo(
    () =>
      openCourse
        ? courseMarkers(courseLessons, { onPick: (lesson) => setPickedLesson(lesson) })
        : [],
    [openCourse, courseLessons],
  );

  const pickedUnit = useMemo(() => {
    if (!openCourse || !pickedLesson) return null;
    const unit = openCourse.units.find((entry) => entry.id === pickedLesson.unitId);
    if (!unit) return null;
    /*
      The card reads a lesson's length and its exercise count to say how long
      this will take. This shell's summaries carry both as numbers rather than
      as the prose itself, so the shapes are rebuilt at the size they describe
      — the card never looks at what is inside either one.
    */
    return {
      id: unit.id,
      title: unit.title,
      objective: unit.objective,
      lessons: unit.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        content: " ".repeat(Math.max(0, lesson.contentChars)),
        exercises: Array.from({ length: lesson.exerciseCount }, () => null),
      })),
    };
  }, [openCourse, pickedLesson]);

  const pickedLessonView = useMemo(
    () => pickedUnit?.lessons.find((lesson) => lesson.id === pickedLesson?.lessonId) ?? null,
    [pickedUnit, pickedLesson],
  );

  const backToMapLabel = useMemo(() => {
    const title = data.studies.find((study) => study.id === shownStudyId)?.title;
    return title ? `← 回到${spacedName(title)}地图` : "← 回到课程地图";
  }, [data.studies, shownStudyId]);

  const waitingForData = world === null;
  const mapCover = useMapCover(!sceneReady || waitingForData);
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  const onSceneBusy = useCallback(() => setSceneReady(false), []);

  const focus = data.today.focus;
  const summary = data.studies.find((study) => study.id === shownStudyId) ?? null;

  /*
    Picking an island opens the island, not a lesson.

    This used to resolve the resume lesson and jump straight into the reader,
    which skipped the level in between — the course seen from inside, one stone
    per lesson, with the next one lit. The delivery shell has always had that
    level; a learner moving between the two campuses met the same island and
    two different products.
  */
  function enter(node: CourseNode) {
    onSelectStudy(node.studyId);
    onOpenCourse(node.studyId, node.courseId);
    setPicked(null);
  }

  function openPickedLesson() {
    if (!pickedLesson) return;
    onOpenLesson({
      studyId: shownStudyId,
      courseId: pickedLesson.courseId,
      unitId: pickedLesson.unitId,
      lessonId: pickedLesson.lessonId,
    });
    setPickedLesson(null);
  }

  return (
    <div className="world-landing">
      <WorldMapCanvas
        className="world-landing__stage"
        // A course view is the same island from inside, so the world under it
        // is not drawn — `stageChildren` carries the road instead.
        world={openCourse ? null : renderWorld}
        polar={openCourse ? COURSE_POLAR : WORLD_POLAR}
        cameraFrom={courseCamera?.cameraFrom ?? framed.cameraFrom}
        lookAt={courseCamera?.lookAt ?? framed.lookAt}
        learnerAt={learnerAt}
        skyStudyId={shownStudyId}
        focus={focus ?? undefined}
        markers={openCourse ? courseLabels : markers}
        followId={!openCourse && picked ? `${picked.studyId}/${picked.courseId}` : null}
        followNode={pickCardRef}
        onPick={(node) => {
          setPicked(node);
          onSelectStudy(node.studyId);
        }}
        onHover={(node) => setHovered(node ? node.title : null)}
        onSceneReady={onSceneReady}
        onSceneBusy={onSceneBusy}
        onPointerMissed={dismissPick}
        stageChildren={
          <>
            <CompanionProbe
              anchors={placements.map((entry) => ({
                id: `course:${entry.node.studyId}/${entry.node.courseId}`,
                position: entry.position,
              }))}
              nodes={companionNodes.current}
            />
            {openCourse && courseLessons.length > 0 ? (
              <CourseScene
                lessons={courseLessons}
                skyStudyId={shownStudyId}
                onPick={(lesson) => setPickedLesson(lesson)}
                onHover={(lesson) => setHovered(lesson ? lesson.lessonTitle : null)}
              />
            ) : null}
          </>
        }
        overlay={
          <>
            <PresenceLayer
              port={presence}
              surface="world"
              viewKey="world"
              attach={(userId, element) => {
                if (element) companionNodes.current.set(userId, element);
                else companionNodes.current.delete(userId);
              }}
            />
            {wide ? null : nextLesson && !picked ? (
              <aside className="nextup">
                <p className="nextup__eyebrow">今天的第一件事</p>
                <h2 className="nextup__title">{nextLesson.lessonTitle}</h2>
                <p className="nextup__meta">
                  {nextLesson.studyTitle} · {nextLesson.courseTitle}
                </p>
                <GameButton variant="primary" onClick={() => onOpenLesson(nextLesson)}>
                  {nextLesson.progress ? "继续学习" : "开始学习"}
                </GameButton>
              </aside>
            ) : null}
            {picked && !openCourse ? (
              <CoursePickCard
                title={picked.title}
                studyTitle={picked.studyTitle}
                lessons={picked.lessons}
                depth={picked.depth}
                prerequisiteCount={picked.prerequisiteCourseIds.length}
                onEnter={() => enter(picked)}
                onDismiss={dismissPick}
                cardRef={pickCardRef}
              />
            ) : null}
            {/*
              Standing on an island: its name, and the way back to the map.
              The same panel the delivery shell shows, in the same corner.
            */}
            {openCourse ? (
              <aside className="picked picked--left">
                <h3>{openCourse.title}</h3>
                <p className="picked__study">
                  {openCourse.units.length} 单元 · {courseLessons.length} 关
                </p>
                <GameButton
                  variant="ghost"
                  onClick={() => {
                    setPickedLesson(null);
                    onCloseCourse();
                  }}
                >
                  {backToMapLabel}
                </GameButton>
              </aside>
            ) : null}
          </>
        }
        hint={hovered ?? MAP_CONTROLS_HINT}
        loading={mapCover ? <LoadingTrivia /> : null}
      />

      {/*
        Choosing a stone opens its card before its lesson — reading is a
        decision, and 「这一关要花多久」 belongs before it rather than after.
      */}
      {openCourse && pickedLesson && pickedUnit && pickedLessonView ? (
        <NodeCard
          open
          lesson={pickedLessonView}
          unit={pickedUnit}
          onClose={() => setPickedLesson(null)}
          onStart={openPickedLesson}
          onStartUnit={() => {
            const first = pickedUnit.lessons[0];
            if (!first) return;
            setPickedLesson(null);
            onOpenLesson({
              studyId: shownStudyId,
              courseId: openCourse.id,
              unitId: pickedUnit.id,
              lessonId: first.id,
            });
          }}
        />
      ) : null}

      <div className="world-landing__authoring">
        {summary ? (
          <>
            <UaDashboardButton studyId={summary.id} available={summary.readyUaAnalysisCount > 0} />
            <AirlockClocks studyId={summary.id} />
          </>
        ) : null}
      </div>
    </div>
  );
}
