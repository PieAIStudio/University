/**
 * The authoring shell's world: the same scene as delivery, plus this overlay.
 *
 * Canvas answers "where do I go". DOM answers "what is true right now".
 * The 2D catalog stays below until every SPEC-0003 row is visible here;
 * retiring it earlier would trade information for a screenshot.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { LoadingTrivia, useMapCover } from "@pieai/university-ui/loading/LoadingTrivia.js";
import { CoursePickCard } from "@pieai/university-ui/path/CoursePickCard.js";
import type { BootstrapData, LessonRef, StudyView } from "@pieai/university-ui/view/lesson-view.js";
import type { CourseNode } from "@pieai/university-world/course.js";
import {
  Controls,
  Flight,
  LabelProbe,
  MAP_CONTROLS_HINT,
  WORLD_POLAR,
} from "@pieai/university-world/controls.js";
import { frameWorld } from "@pieai/university-world/frame.js";
import { placeWorld, WorldScene, type Marker } from "@pieai/university-world/Maps.js";
import { Stage } from "@pieai/university-world/Stage.js";
import { CompanionProbe } from "@pieai/university-world/companion-probe.js";
import { PresenceLayer } from "@pieai/university-ui/presence.js";
import type { PresencePort } from "@pieai/university-core";

import { AirlockClocks } from "./StudyDetail.js";
import { UaDashboardButton } from "./UaDashboardButton.js";
import { courseNodesFromCatalog, courseProgressOf, resumeOf } from "./world-graph.js";

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
  selectedStudyId,
  onSelectStudy,
  onOpenLesson,
}: {
  readonly data: BootstrapData;
  readonly catalog: ReadonlyMap<string, StudyView>;
  readonly presence: PresencePort;
  readonly selectedStudyId: string | null;
  readonly onSelectStudy: (studyId: string) => void;
  readonly onOpenLesson: (locator: LessonRef) => void;
}) {
  const wide = useMinWidth(768);
  const [hovered, setHovered] = useState<string | null>(null);
  const [picked, setPicked] = useState<CourseNode | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const labelNodes = useRef(new Map<string, HTMLElement>());
  const pickCardRef = useRef<HTMLElement | null>(null);
  const companionNodes = useRef(new Map<string, HTMLElement>());
  const draggedRef = useRef(false);
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);
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

  /**
   * The scene always shows exactly one project, so it always needs to know
   * which. `selectedStudyId` is allowed to be null — nothing picked yet — and
   * the map is not allowed to be empty because of it, so an unpicked map falls
   * back to the project holding today's lesson, and failing that to the first
   * one in the catalogue.
   */
  const shownStudyId = useMemo(
    () =>
      selectedStudyId ??
      data.today.nextLesson?.studyId ??
      worldNodes[0]?.studyId ??
      data.studies[0]?.id ??
      null,
    [selectedStudyId, data.today.nextLesson, data.studies, worldNodes],
  );

  const world = useMemo(
    () =>
      worldNodes.length > 0 && shownStudyId
        ? placeWorld(worldNodes, progressOf, shownStudyId)
        : null,
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

  const nextUp = useMemo(() => {
    if (placements.length === 0) return null;
    const live = placements.find((entry) => entry.state === "live");
    return live ?? placements[0] ?? null;
  }, [placements]);

  const learnerAt = nextUp?.position ?? null;
  const framed = useMemo(
    () => frameWorld(learnerAt ?? placements[0]?.position ?? null),
    [learnerAt, placements],
  );

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

  const waitingForData = world === null;
  const mapCover = useMapCover(!sceneReady || waitingForData);
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  const onSceneBusy = useCallback(() => setSceneReady(false), []);

  const focus = data.today.focus;
  const summary = data.studies.find((study) => study.id === selectedStudyId) ?? null;

  function enter(node: CourseNode) {
    const course = catalog.get(node.studyId)?.courses.find((entry) => entry.id === node.courseId);
    const resume = course ? resumeOf(course) : null;
    if (!resume) {
      onSelectStudy(node.studyId);
      return;
    }
    onOpenLesson({
      studyId: node.studyId,
      courseId: node.courseId,
      unitId: resume.unitId,
      lessonId: resume.lessonId,
    });
  }

  return (
    <div className="world-landing">
      <div
        className="stagewrap world-landing__stage"
        onPointerDownCapture={(event) => {
          pointerOrigin.current = { x: event.clientX, y: event.clientY };
          draggedRef.current = false;
        }}
        onPointerMoveCapture={(event) => {
          const origin = pointerOrigin.current;
          if (!origin || draggedRef.current) return;
          if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 6) {
            draggedRef.current = true;
          }
        }}
      >
        {world ? (
          <Stage
            cameraFrom={framed.cameraFrom}
            lookAt={framed.lookAt}
            onSceneReady={onSceneReady}
            onSceneBusy={onSceneBusy}
            onPointerMissed={dismissPick}
          >
            <Controls target={framed.lookAt} polar={WORLD_POLAR} />
            <Flight to={framed.cameraFrom} look={framed.lookAt} />
            <LabelProbe
              markers={markers}
              limit={9}
              nodes={labelNodes.current}
              // This shell's course markers use `studyId/courseId` as `id`.
              // The projector looks that id up in the same array; inventing
              // a second key here would place the card at (0,0).
              followId={picked ? `${picked.studyId}/${picked.courseId}` : null}
              followNode={pickCardRef}
            />
            {/*
              A separate probe from LabelProbe on purpose: companions must not
              compete with course names for the label budget, and a companion
              that lost that competition would silently stop existing.
            */}
            <CompanionProbe
              anchors={placements.map((entry) => ({
                id: `course:${entry.node.studyId}/${entry.node.courseId}`,
                position: entry.position,
              }))}
              nodes={companionNodes.current}
            />
            <WorldScene
              placements={placements}
              extent={world.extent}
              learnerAt={learnerAt}
              skyStudyId={shownStudyId}
              focus={focus ?? undefined}
              onPick={(node) => {
                setPicked(node);
                onSelectStudy(node.studyId);
              }}
              onHover={(node) => setHovered(node ? node.title : null)}
            />
          </Stage>
        ) : null}

        <nav className="labels" aria-label="地图上的去处">
          {markers.map((marker) => {
            const content = (
              <>
                {marker.text}
                {marker.sub ? <small>{marker.sub}</small> : null}
              </>
            );
            const attach = (element: HTMLElement | null) => {
              if (element) labelNodes.current.set(marker.id, element);
              else labelNodes.current.delete(marker.id);
            };
            const className = ["label", `label--${marker.kind}`].join(" ");
            return marker.activate ? (
              <button
                key={marker.id}
                ref={attach}
                type="button"
                className={className}
                style={{ "--placed": 0 } as CSSProperties}
                onClick={() => {
                  if (draggedRef.current) return;
                  marker.activate?.();
                }}
              >
                {content}
              </button>
            ) : (
              <div
                key={marker.id}
                ref={attach}
                className={className}
                style={{ "--placed": 0 } as CSSProperties}
              >
                {content}
              </div>
            );
          })}
        </nav>
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

        {picked ? (
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

        <p className="hint">{hovered ?? MAP_CONTROLS_HINT}</p>
        {mapCover ? <LoadingTrivia /> : null}
      </div>

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
