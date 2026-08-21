/**
 * The app.
 *
 * Four surfaces and one rule about which is which: the canvas owns the world
 * and the level, the DOM owns everything a learner reads, types or is charged
 * for. That split is not taste — a Chinese IME, selectable code, a screen
 * reader and a phone keyboard all degrade to nothing inside WebGL.
 *
 * There is exactly one `<Canvas>`, in `Stage`, and it stays mounted across the
 * two map levels. Mounting a second one per view would be the fastest way to
 * end up with two renderers and a colour pipeline nobody can count.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { MapControls } from "three/addons/controls/MapControls.js";

import {
  ANTI_PATTERN_ENTRIES,
  CONCEPT_ENTRIES,
  antiPatternHeadToMarkdown,
  assemblePracticeQuestion,
  conceptHeadToMarkdown,
  conceptNeighbours,
  getConceptEntry as lookupConcept,
  getAntiPatternEntry,
  getConceptEntry,
  assembleTermEntry,
  hasFavourite,
  listGroupedByTrack,
  termHeadToMarkdown,
  toggleFavourite,
} from "@pieai/university-core";
import { readCourseProgress } from "@pieai/university-core";
import {
  EntryPage,
  FavouriteStar,
  FavouritesEmpty,
  TermIndex,
  AntiPatternIndex,
  ConceptIndex,
  PracticeStream,
  createLocalPracticeRecentStore,
  createLocalFavouritesStore,
} from "@pieai/university-ui";

import {
  hasContent,
  library,
  loadCourse,
  loadGraph,
  peekCourse,
  type Course,
  type CourseNode,
} from "./content/library";
import { LEXICON } from "./lesson/language";
import { LessonScreen } from "./lesson/Lesson";
import { Settlement } from "./lesson/Settlement";
import { fromHash, toHash, WORLD, LIBRARY_TABS, type LibraryTab, type View } from "./url-state";
import { placeLabels, type LabelCandidate } from "./world/labels";
import { courseShapeOf, progressSource } from "./progress/source";
import {
  advanceLesson,
  dropCards,
  dueCards,
  dueTomorrow,
  gradeCard,
  lessonKey,
  snapshot,
  subscribe,
} from "./progress/store";
import {
  CourseScene,
  placeCourse,
  placeWorld,
  settlementSize,
  WorldScene,
  type LessonPlacement,
  type Marker,
} from "./world/Maps";
import { Stage } from "./world/Stage";

/**
 * Camera rig. Still MapControls, but with the map idiom's two habits removed.
 *
 * This used to be free-orbit with the tilt allowed down to 83°, and the eye
 * deliberately placed low so the horizon was in shot. That was a considered
 * choice for a landscape, and it is the wrong one for a screen whose job is
 * "where do I go now". Level-select maps that answer that in eight seconds —
 * Duolingo, Mario's world map, Candy Crush — all refuse to let you turn the
 * map, because the answer has to be in the same place every time you look.
 *
 * Three specific things went wrong when the map could be turned:
 *
 *  - The lit beacon marking the next course has an orientation. Turn far
 *    enough and it is behind its own island.
 *  - Every change of azimuth re-lays out all 41 DOM labels, which is part of
 *    why they were seen stacking.
 *  - On a trackpad the rotation was not even requested. MapControls binds
 *    right-drag to rotate, a two-finger tap *is* a right-click, and a pinch is
 *    `TOUCH.DOLLY_ROTATE`, so any twist during a zoom turns the world.
 *
 * Mapbox ships an official "disable rotation" example and Apple Maps hides
 * rotation behind the compass rather than putting it on the trackpad. This
 * follows them.
 */
function Controls({
  target,
  polar,
}: {
  target: readonly [number, number, number];
  /** The one tilt this view is allowed, in radians from straight down. */
  polar: number;
}) {
  const { camera, gl } = useThree();
  const controls = useRef<MapControls | null>(null);

  useEffect(() => {
    const instance = new MapControls(camera, gl.domElement);
    instance.enableDamping = true;
    instance.dampingFactor = 0.08;
    instance.enableRotate = false;
    instance.minDistance = 6;
    instance.maxDistance = 460;
    // Two fingers zoom. They do not also rotate, which is what DOLLY_ROTATE
    // would do with any accidental twist.
    instance.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controls.current = instance;
    return () => instance.dispose();
  }, [camera, gl]);

  // Pinning both ends is what makes the tilt a property of the view rather
  // than of whatever the last drag happened to leave behind.
  useEffect(() => {
    const instance = controls.current;
    if (!instance) return;
    instance.minPolarAngle = polar;
    instance.maxPolarAngle = polar;
  }, [polar]);

  /**
   * A two-finger trackpad swipe pans.
   *
   * The browser reports that swipe as a `wheel` event, and MapControls reads
   * every `wheel` as zoom — so on a laptop, the gesture every Mac user makes
   * to move a map was zooming it instead. A pinch is distinguishable: the
   * browser sets `ctrlKey` on it, which is how Apple Maps and Mapbox tell the
   * two apart, so a pinch still falls through to the zoom MapControls does.
   *
   * The listener sits on the canvas's parent in the capture phase because
   * MapControls binds its own to the canvas. Registering on the same element
   * would leave the order to chance.
   */
  useEffect(() => {
    const canvas = gl.domElement;
    const host = canvas.parentElement;
    if (!host) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // a pinch — let it zoom
      const instance = controls.current;
      if (!instance) return;
      event.preventDefault();
      event.stopPropagation();
      // Pan in the ground plane, scaled by how far away the camera is, so the
      // gesture moves the same amount of *map* at every zoom level.
      const reach = camera.position.distanceTo(instance.target) * 0.0016;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward).setY(0).normalize();
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const shift = right
        .multiplyScalar(event.deltaX * reach)
        .addScaledVector(forward, -event.deltaY * reach);
      camera.position.add(shift);
      instance.target.add(shift);
    };
    host.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => host.removeEventListener("wheel", onWheel, { capture: true });
  }, [camera, gl]);

  useEffect(() => {
    controls.current?.target.set(...target);
  }, [target]);

  useFrame(() => controls.current?.update());
  return null;
}

/**
 * The tilt each view is locked to, in radians from straight down.
 *
 * 54° is between true isometric (54.7°) and the angle Mapbox's own 3D examples
 * use (60°). The course map sits slightly more overhead because its 41 lessons
 * snake away from the camera, and every degree of extra tilt compresses the
 * far rows further into each other.
 */
/** What the map actually responds to. Kept next to the controls it describes. */
/**
 * The only two views the 3D map is part of.
 *
 * This used to be the opposite list — every view that had to *hide* the stage,
 * enumerated one `||` at a time. That shape is wrong in a way that is invisible
 * when you write it and expensive later: a new route is correct only if
 * whoever adds it remembers to come back here, and `concepts` and `concept`
 * were both added without that, so two full-page surfaces spent their life
 * rendering on top of a live WebGL canvas nobody could see.
 *
 * Stated as "who uses the map", a forgotten route hides the canvas, which is
 * the safe direction to be wrong in.
 */
const SHOWS_THE_MAP = new Set<View["kind"]>(["world", "course"]);

const MAP_CONTROLS_HINT = "拖动平移 · 滚轮缩放 · 点岛进入";

const WORLD_POLAR = THREE.MathUtils.degToRad(54);
const COURSE_POLAR = THREE.MathUtils.degToRad(50);

/**
 * A camera move, eased, with no tween library.
 *
 * The drill-down from world to level is the one motion this product has to get
 * right, because it is what tells a learner that the lesson they are entering
 * is the island they just pointed at.
 */
function Flight({
  to,
  look,
}: {
  to: readonly [number, number, number];
  look: readonly [number, number, number];
}) {
  const { camera } = useThree();
  const from = useRef({ position: new THREE.Vector3(), target: new THREE.Vector3(), elapsed: 0 });
  const first = useRef(true);

  // Keyed on the numbers, not on the arrays.
  //
  // `to` and `look` are array literals, so they are a new identity on every
  // render. With them as dependencies this effect re-fired constantly, resetting
  // `elapsed` to zero and the start point to wherever the camera had crept to —
  // a tween that restarts sixty times a second never arrives. It was invisible
  // while every view change came from a click that also changed something else;
  // opening a course straight from a URL made it obvious, as a camera still
  // framed on the world map staring at empty water.
  const key = `${to.join()}|${look.join()}`;
  useEffect(() => {
    from.current = {
      position: camera.position.clone(),
      target: new THREE.Vector3(...look),
      elapsed: 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, camera]);

  useFrame((_, delta) => {
    const flight = from.current;
    if (flight.elapsed >= 1) return;
    // Arriving from a URL has no previous shot to fly out of, so there is
    // nothing to animate — snap, and let the flight be for navigation the
    // learner actually performed.
    if (first.current) {
      first.current = false;
      camera.position.set(...to);
      flight.elapsed = 1;
      return;
    }
    flight.elapsed = Math.min(1, flight.elapsed + delta / 0.85);
    const raw = flight.elapsed;
    const eased = raw < 0.5 ? 4 * raw ** 3 : 1 - (-2 * raw + 2) ** 3 / 2;
    camera.position.lerpVectors(flight.position, new THREE.Vector3(...to), eased);
  });
  return null;
}

/**
 * Names, projected out of the scene and written straight to the DOM.
 *
 * Not through React state, and that is the whole point of the file. Positions
 * change every frame; routing them through `setState` re-renders the tree sixty
 * times a second, which here fed back into the camera memo and sent the view
 * drifting off to the horizon on its own. Per-frame data belongs on refs.
 *
 * The component sits inside the Canvas so it can read the camera and renders
 * nothing there. Baseline rule 7 in one place: geometry moves the eye, the DOM
 * carries the words.
 */
function LabelProbe({
  markers,
  limit,
  nodes,
}: {
  markers: readonly Marker[];
  limit: number;
  nodes: Map<string, HTMLElement>;
}) {
  const { camera, size } = useThree();
  const scratch = useRef(new THREE.Vector3());

  useFrame(() => {
    // Project first, then let `placeLabels` decide who survives.
    //
    // The old pass ranked by depth and kept the nearest few, which on a
    // forty-one-lesson course map produced a legible top and an unreadable
    // stack at the bottom — the names were all "near", they were just on top of
    // one another. Overlap is a screen-space problem and has to be solved in
    // screen space, with the boxes the labels actually occupy.
    const candidates: LabelCandidate[] = [];
    for (const marker of markers) {
      const projected = scratch.current.copy(marker.position).project(camera);
      if (projected.z >= 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) continue;
      const element = nodes.get(marker.id);
      if (!element) continue;
      candidates.push({
        id: marker.id,
        x: ((projected.x + 1) / 2) * size.width,
        y: ((1 - projected.y) / 2) * size.height,
        z: projected.z,
        // Measured, not guessed: a Chinese lesson title and a study name are
        // different widths, and a fixed box would either clip or over-reserve.
        width: element.offsetWidth,
        height: element.offsetHeight,
        // A study name orients the whole view, so it outranks any one course.
        weight: marker.kind === "study" ? 2 : marker.kind === "lesson" ? 0 : 1,
      });
    }

    for (const placement of placeLabels(
      candidates,
      { width: size.width, height: size.height },
      {
        maxVisible: limit,
      },
    )) {
      const element = nodes.get(placement.id);
      if (!element) continue;
      element.style.transform = `translate(${placement.x}px, ${placement.y}px) translate(-50%, -50%)`;
      element.style.opacity = placement.visible ? "1" : "0";
    }
    // Anything that did not project at all this frame is behind the camera or
    // off the far plane, and must not keep the position it had last frame.
    const seen = new Set(candidates.map((entry) => entry.id));
    for (const [id, element] of nodes) {
      if (!seen.has(id)) element.style.opacity = "0";
    }
  }, 2);

  return null;
}

export function App() {
  const progress = useSyncExternalStore(subscribe, snapshot);
  const [nodes, setNodes] = useState<readonly CourseNode[] | null>(null);
  // The address bar is the source of truth for where the learner is, so a
  // reload lands where they were and a lesson can be sent to someone.
  const [view, setViewState] = useState<View>(() => fromHash(location.hash));
  const setView = useCallback((next: View) => {
    if (toHash(next) !== location.hash) history.pushState(null, "", toHash(next));
    setViewState(next);
  }, []);
  useEffect(() => {
    const onPop = () => setViewState(fromHash(location.hash));
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  const [course, setCourse] = useState<Course | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [picked, setPicked] = useState<CourseNode | null>(null);
  // How many lessons were finished the moment a lesson was passed. Held here
  // rather than derived later, and deliberately absent when the settlement is
  // reached by its own URL — arriving at `/done` from a bookmark is not
  // evidence that anything just grew, so that screen stays quiet about the map.
  const [grewFrom, setGrewFrom] = useState<{ key: string; doneBefore: number } | null>(null);

  useEffect(() => {
    if (!hasContent) return;
    void loadGraph().then(setNodes);
  }, []);

  useEffect(() => {
    if (view.kind !== "course" && view.kind !== "lesson") return;
    // Whichever course was asked for last is the one that gets rendered, even
    // if an earlier request answers after it. Courses are fetched once and
    // cached, so this only bites on a first visit over a slow connection — and
    // there it bites as "I tapped this island and got the other one's
    // lessons", which reads as corrupted data rather than as a late reply.
    let current = true;
    void loadCourse(view.studyId, view.courseId).then((loaded) => {
      if (current) setCourse(loaded);
    });
    return () => {
      current = false;
    };
  }, [view]);

  // A fraction, not a flag. The world map now shows how far a course got, not
  // only whether it is finished, so a course two lessons in has to be able to
  // say so — that partly-built island is the whole reason to come back.
  const courseProgress = useCallback(
    (node: CourseNode) => {
      const loaded = peekCourse(node.studyId, node.courseId);
      if (!loaded) return 0;
      const { done, total } = readCourseProgress(
        courseShapeOf(loaded, node.studyId),
        progressSource(),
      );
      return total > 0 ? Math.min(1, done / total) : 0;
    },
    [progress],
  );

  const world = useMemo(
    () => (nodes ? placeWorld(nodes, courseProgress) : null),
    [nodes, courseProgress],
  );

  /**
   * The course the learner is actually on, as a node rather than a coordinate.
   *
   * This was already computed and used only to aim the camera at it. Pointing a
   * camera at something is not the same as telling anyone about it: the first
   * frame of the product was four unexplained archipelagos and five equally
   * weighted buttons, and the one thing the app already knew — which course to
   * open — was the one thing it did not say.
   */
  const nextUp = useMemo(() => {
    if (!world) return null;
    const live = world.placements.find((entry) => entry.state === "live");
    return live ?? world.placements[0] ?? null;
  }, [world]);

  const learnerAt = nextUp?.position ?? null;

  const lessons: readonly LessonPlacement[] = useMemo(() => {
    if (!course || (view.kind !== "course" && view.kind !== "lesson")) return [];
    return placeCourse(view.studyId, course, progressSource());
  }, [course, view, progress]);

  const viewedProgress = useMemo(() => {
    if (!course || (view.kind !== "course" && view.kind !== "lesson")) return null;
    return readCourseProgress(courseShapeOf(course, view.studyId), progressSource());
  }, [course, view, progress]);

  const labelNodes = useRef(new Map<string, HTMLElement>());

  /**
   * Whether the pointer travelled far enough since it went down to count as a
   * drag rather than a click.
   *
   * A ref rather than state on purpose: this is read inside a click handler and
   * must never cause a render. Six pixels is the usual slop for a hand resting
   * on a trackpad — below it, people believe they clicked.
   */
  const draggedRef = useRef(false);
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);

  const markers: readonly Marker[] = useMemo(() => {
    if (view.kind === "course" || view.kind === "lesson") {
      return lessons.map((lesson) => ({
        id: lesson.lessonId,
        position: lesson.position.clone().setY(lesson.position.y + 1.6),
        text: lesson.lessonTitle,
        kind: "lesson" as const,
        activate:
          view.kind === "lesson"
            ? undefined
            : () =>
                setView({
                  kind: "lesson",
                  studyId: view.studyId,
                  courseId: view.courseId,
                  unitId: lesson.unitId,
                  lessonId: lesson.lessonId,
                }),
      }));
    }
    if (!world) return [];
    const studyMarkers: Marker[] = [...world.centres.entries()].map(([studyId, centre]) => {
      const own = world.placements.filter((entry) => entry.node.studyId === studyId);
      return {
        id: `study:${studyId}`,
        position: centre.clone().setY(centre.y + 9),
        text: own[0]?.node.studyTitle ?? studyId,
        sub: `${own.length} 门课 · ${own.reduce((sum, entry) => sum + entry.node.lessons, 0)} 节`,
        kind: "study" as const,
      };
    });
    return [
      ...studyMarkers,
      ...world.placements.map((entry) => ({
        id: entry.node.courseId,
        position: entry.position.clone().setY(entry.position.y + entry.radius * 0.4 + 1.4),
        text: entry.node.title,
        kind: "course" as const,
        // Same target as the island, so a label and the shape under it cannot
        // disagree about what selecting a course means.
        activate: () => setPicked(entry.node),
      })),
    ];
  }, [world, lessons, view]);

  const due = dueCards();

  if (!hasContent) {
    return (
      <main className="empty">
        <h1>还没有导入任何课程</h1>
        <p>
          先跑 <code>pnpm content</code>，它会从 UniversityLocal 的导出包里取课程。 没有
          UniversityLocal 的检出时它会干净退出——这个产品不生产内容，只投放内容。
        </p>
      </main>
    );
  }

  /*
   * The default view stands beside the learner, not above the library.
   *
   * A world map is not meant to be read all at once. The first attempt put the
   * camera at a fixed point over the origin while the learner stood in a study
   * a hundred units away, and the result was a black frame with five specks in
   * it. Framing from where the learner is standing — back along the direction
   * they came, up, and off the axis so the road does not stack into a column of
   * discs — is what makes the map answer "where am I" in one glance.
   */
  const eye = useMemo((): readonly [number, number, number] => {
    if (!world || !learnerAt) return [0, 90, 110] as const;
    const centre = world.centres.get(
      world.placements.find((entry) => entry.position === learnerAt)?.node.studyId ?? "",
    );
    const away = learnerAt
      .clone()
      .sub(centre ?? new THREE.Vector3())
      .setY(0);
    if (away.lengthSq() < 0.01) away.set(0, 0, 1);
    away.normalize();
    // This used to sit low and off to one side, with the horizon deliberately
    // in shot, and the note here argued for it: a high camera makes islands
    // flat shapes and hides the modelling. That reasoning is sound about a
    // landscape and wrong about a map. At 16 units of height against a 40-unit
    // standoff the eye was 68° from vertical — a holiday photograph of an
    // archipelago, on the screen that has to answer "where do I go now".
    //
    // 54° is between true isometric and Mapbox's 3D examples, and the standoff
    // grows with it because the field of view narrowed from 45° to 34°; a
    // narrower lens sees less, so the same islands need more distance.
    const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(15);
    const spot = learnerAt
      .clone()
      .addScaledVector(away, 45)
      .add(side)
      .setY(learnerAt.y + 34);
    return [spot.x, spot.y, spot.z];
  }, [world, learnerAt]);

  // Was [0, 40, 46] onto [0, 4, -18]: 60.6° from vertical. Held at the same
  // look-at, 50° with the narrower lens puts the eye here instead.
  const cameraFrom: readonly [number, number, number] =
    view.kind === "course" || view.kind === "lesson" ? [0, 68, 58] : eye;
  const lookAt: readonly [number, number, number] =
    view.kind === "course" || view.kind === "lesson"
      ? [0, 4, -18]
      : learnerAt
        ? [learnerAt.x, learnerAt.y, learnerAt.z]
        : [0, 0, 0];

  return (
    <div className="app">
      <nav className="topbar">
        <button className="brand" onClick={() => setView({ kind: "world" })}>
          University
        </button>
        <span className="topbar__stat">
          {library.studies.length} 个世界 ·{" "}
          {library.studies.reduce((sum, study) => sum + study.courses.length, 0)} 门课
        </span>
        <span className="spacer" />
        <span className="topbar__stat">连击 {progress.streak.days} 天</span>
        {/*
          The term index is reachable from everywhere on purpose. A learner
          who cannot remember which lesson a word came from is exactly the
          person it is for, so making them find the right course first would
          defeat it.
        */}
        <button className="ghost" onClick={() => setView({ kind: "library", tab: "concepts" })}>
          图鉴
        </button>
        <button className="ghost" onClick={() => setView({ kind: "practice" })}>
          练习
        </button>
        <button
          className={due.length > 0 ? "primary" : "ghost"}
          onClick={() => setView({ kind: "review" })}
        >
          复习 {due.length > 0 ? `· ${due.length} 张到期` : `· 明天 ${dueTomorrow()} 张`}
        </button>
      </nav>

      <div
        className="stagewrap"
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
        hidden={!SHOWS_THE_MAP.has(view.kind)}
      >
        <Stage cameraFrom={cameraFrom} lookAt={lookAt}>
          <Controls
            target={lookAt}
            polar={view.kind === "course" || view.kind === "lesson" ? COURSE_POLAR : WORLD_POLAR}
          />
          <Flight to={cameraFrom} look={lookAt} />
          <LabelProbe markers={markers} limit={9} nodes={labelNodes.current} />
          {view.kind === "world" && world ? (
            <WorldScene
              placements={world.placements}
              centres={world.centres}
              ring={world.ring}
              learnerAt={learnerAt}
              onPick={(node) => setPicked(node)}
              onHover={(node) => setHovered(node ? node.courseId : null)}
            />
          ) : null}
          {(view.kind === "course" || view.kind === "lesson") && lessons.length > 0 ? (
            <CourseScene
              lessons={lessons}
              onPick={(lesson) =>
                view.kind !== "lesson" &&
                setView({
                  kind: "lesson",
                  studyId: view.studyId,
                  courseId: view.courseId,
                  unitId: lesson.unitId,
                  lessonId: lesson.lessonId,
                })
              }
              onHover={(lesson) => setHovered(lesson ? lesson.lessonId : null)}
            />
          ) : null}
        </Stage>

        {/*
          The first thing to do, said out loud.

          It sits opposite the selection panel rather than in a dismissible
          first-run modal: someone returning on day nine needs "where was I"
          just as much as a stranger needs "what is this", and a modal answers
          only the second and only once.
        */}
        {view.kind === "world" && nextUp && !picked ? (
          <aside className="nextup">
            <p className="nextup__eyebrow">
              {progress.streak.days > 0 ? "接着上次" : "从这里开始"}
            </p>
            <h2 className="nextup__title">{nextUp.node.title}</h2>
            <p className="nextup__meta">
              {nextUp.node.studyTitle} · {nextUp.node.lessons} 节
            </p>
            <button
              className="primary block"
              onClick={() =>
                setView({
                  kind: "course",
                  studyId: nextUp.node.studyId,
                  courseId: nextUp.node.courseId,
                })
              }
            >
              {progress.streak.days > 0 ? "继续" : "开始第一节"} →
            </button>
          </aside>
        ) : null}

        {view.kind === "world" ? (
          <aside className="picked" hidden={!picked}>
            {picked ? (
              <>
                <h3>{picked.title}</h3>
                <p className="picked__study">{picked.studyTitle}</p>
                <dl>
                  <dt>课时</dt>
                  <dd>{picked.lessons}</dd>
                  <dt>层</dt>
                  <dd>{picked.depth + 1}</dd>
                  <dt>先修</dt>
                  <dd>{picked.prerequisiteCourseIds.length || "无"}</dd>
                </dl>
                <button
                  className="primary block"
                  onClick={() =>
                    setView({ kind: "course", studyId: picked.studyId, courseId: picked.courseId })
                  }
                >
                  进入这门课 →
                </button>
              </>
            ) : null}
          </aside>
        ) : null}

        {view.kind === "course" && course ? (
          <aside className="picked picked--left">
            <h3>{course.title}</h3>
            <p className="picked__study">
              {course.units.length} 单元 · {viewedProgress?.total ?? 0} 关 · 还剩{" "}
              {viewedProgress ? viewedProgress.total - viewedProgress.done : 0} 关
            </p>
            <button className="ghost block" onClick={() => setView({ kind: "world" })}>
              ← 回到世界地图
            </button>
          </aside>
        ) : null}

        {/*
          The map's names, and — where the thing under them can be entered —
          the way you enter it.

          This layer used to be `aria-hidden` divs with `pointer-events: none`,
          which meant the only way into any course in the product was clicking a
          shape inside the canvas. That is a mouse-only affordance, so keyboard
          and screen-reader users had no path into a single lesson. Rule 7 of
          the Web3D baseline says readable text is DOM; it is worth just as
          little if the *reachable* control stays in the canvas.

          A label that can be entered is a real `<button>`. A label that names a
          world is not, because a world is not somewhere you go.
        */}
        <nav className="labels" aria-label="世界地图上的去处">
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
            const className = `label label--${marker.kind}`;
            return marker.activate ? (
              <button
                key={marker.id}
                ref={attach}
                type="button"
                className={className}
                style={{ opacity: 0 }}
                onClick={() => {
                  // A drag that happens to end on a label is a pan, not a
                  // choice. Without this, moving the map by grabbing near a
                  // course name would open that course.
                  if (draggedRef.current) return;
                  marker.activate?.();
                }}
              >
                {content}
              </button>
            ) : (
              <div key={marker.id} ref={attach} className={className} style={{ opacity: 0 }}>
                {content}
              </div>
            );
          })}
        </nav>

        {/*
          The hint has to describe the controls that exist. It said 「右键旋转」
          for as long as rotation had been disabled — the camera is locked to a
          fixed pitch on purpose, the way a map app locks it, and telling a
          learner to right-drag taught them the app was broken.
        */}
        <p className="hint">{hovered ? hovered : MAP_CONTROLS_HINT}</p>
      </div>

      {view.kind === "lesson" && course ? (
        <LessonReaderHost
          course={course}
          studyId={view.studyId}
          unitId={view.unitId}
          lessonId={view.lessonId}
          onFollowLink={(target) =>
            setView({
              kind: "lesson",
              studyId: view.studyId,
              courseId: target.courseId,
              unitId: target.unitId,
              lessonId: target.lessonId,
            })
          }
          onBack={() => setView({ kind: "course", studyId: view.studyId, courseId: view.courseId })}
          onSettled={(doneBefore) => {
            setGrewFrom({ key: `${view.studyId}/${view.courseId}/${view.lessonId}`, doneBefore });
            setView({
              kind: "settled",
              studyId: view.studyId,
              courseId: view.courseId,
              unitId: view.unitId,
              lessonId: view.lessonId,
            });
          }}
        />
      ) : null}

      {view.kind === "settled" && course ? (
        <SettlementHost
          course={course}
          grewFrom={grewFrom}
          studyId={view.studyId}
          unitId={view.unitId}
          lessonId={view.lessonId}
          onMap={() => setView({ kind: "course", studyId: view.studyId, courseId: view.courseId })}
          onNext={(unitId, lessonId) =>
            setView({
              kind: "lesson",
              studyId: view.studyId,
              courseId: view.courseId,
              unitId,
              lessonId,
            })
          }
        />
      ) : null}

      {view.kind === "review" ? <ReviewHost onDone={() => setView(WORLD)} /> : null}

      {view.kind === "term" ? <TermEntryHost senseId={view.senseId} onOpen={setView} /> : null}

      {LIBRARY_VIEW_TAB[view.kind] ? (
        <LibraryHost tab={libraryTabOf(view)} onOpen={setView} />
      ) : null}

      {view.kind === "concept" ? <ConceptEntryHost id={view.id} onOpen={setView} /> : null}

      {view.kind === "practice" ? <PracticeHost onOpen={setView} /> : null}

      {view.kind === "anti-pattern-entry" ? (
        <AntiPatternEntryHost id={view.id} onOpen={setView} />
      ) : null}
    </div>
  );
}

/** Which library tab a legacy single-segment route lands on. */
const LIBRARY_VIEW_TAB: Partial<Record<View["kind"], LibraryTab>> = {
  library: "concepts",
  concepts: "concepts",
  terms: "terms",
  "anti-pattern": "flavour",
  favourites: "favourites",
};

function libraryTabOf(view: View): LibraryTab {
  return view.kind === "library" ? view.tab : (LIBRARY_VIEW_TAB[view.kind] ?? "concepts");
}

const LIBRARY_TAB_LABEL: Record<LibraryTab, string> = {
  concepts: "概念图解",
  terms: "词义索引",
  flavour: "防 AI 味儿",
  favourites: "收藏",
};

/**
 * One door for everything that is looked up rather than worked through.
 *
 * These were four top-bar buttons of equal weight, which is the arrangement the
 * product's own 「按钮」 entry warns about: several controls of the same weight
 * mean none of them is the answer. Worse, it made a claim that was not true —
 * that looking up a word, browsing a concept, checking a verbal tic and
 * re-reading a saved entry are four different kinds of activity. They are one,
 * and the three collections have shared one index component since SPEC-0004.
 *
 * Each tab renders the collection's existing adapter. There is no new index
 * here, and there must not be one.
 */
function LibraryHost({ tab, onOpen }: { tab: LibraryTab; onOpen: (view: View) => void }) {
  return (
    <main className="terms">
      <button className="linkish" onClick={() => onOpen(WORLD)}>
        ← 关卡地图
      </button>
      <nav className="library-tabs" aria-label="图鉴">
        {LIBRARY_TABS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={candidate === tab ? "library-tabs__tab is-current" : "library-tabs__tab"}
            aria-current={candidate === tab ? "page" : undefined}
            onClick={() => onOpen({ kind: "library", tab: candidate })}
          >
            {LIBRARY_TAB_LABEL[candidate]}
          </button>
        ))}
      </nav>
      {tab === "concepts" ? (
        <ConceptIndex
          entries={CONCEPT_ENTRIES}
          onOpen={(entry) => onOpen({ kind: "concept", id: entry.head.id })}
        />
      ) : null}
      {tab === "terms" ? (
        <TermIndex
          entries={LEXICON}
          onOpenFull={(entry) => onOpen({ kind: "term", senseId: entry.senseId })}
        />
      ) : null}
      {tab === "flavour" ? (
        <AntiPatternIndex
          entries={ANTI_PATTERN_ENTRIES}
          onOpen={(entry) => onOpen({ kind: "anti-pattern-entry", id: entry.head.id })}
        />
      ) : null}
      {tab === "favourites" ? <FavouritesHost onOpen={onOpen} /> : null}
    </main>
  );
}

function LessonReaderHost({
  course,
  studyId,
  unitId,
  lessonId,
  onBack,
  onSettled,
  onFollowLink,
}: {
  course: Course;
  studyId: string;
  unitId: string;
  lessonId: string;
  onBack: () => void;
  onSettled: (doneBefore: number) => void;
  onFollowLink: (target: {
    readonly courseId: string;
    readonly unitId: string;
    readonly lessonId: string;
  }) => void;
}) {
  const unit = course.units.find((entry) => entry.id === unitId) ?? course.units[0]!;
  const lesson = unit.lessons.find((entry) => entry.id === lessonId) ?? unit.lessons[0]!;
  const flat = course.units.flatMap((entry) => entry.lessons);
  const index = flat.findIndex((entry) => entry.id === lesson.id);

  return (
    <main className="reader">
      <LessonScreen
        lesson={lesson}
        course={course}
        unitId={unit.id}
        courseTitle={course.title}
        unitTitle={unit.title}
        position={`${index + 1}/${flat.length}`}
        onFollowLink={onFollowLink}
        onBack={onBack}
        onPass={() => {
          const key = lessonKey(studyId, course.id, lesson.id);
          // Counted before the write, because that is the only moment the
          // previous number exists. Deriving it afterwards as `done - 1` was
          // wrong on a lesson finished twice: the count does not move, but the
          // subtraction invented a step and the settlement announced growth the
          // map had not made.
          const doneBefore = readCourseProgress(
            courseShapeOf(course, studyId),
            progressSource(),
          ).done;
          advanceLesson(key, 1);
          // The drop is the reason to come back tomorrow, so it happens the
          // moment the lesson is passed rather than on some later screen.
          dropCards(
            studyId,
            course.id,
            lesson.id,
            lesson.cards.map((card) => card.id),
          );
          // The reward is the point of the loop, so it gets its own screen
          // rather than a line of green text under a text box.
          onSettled(doneBefore);
        }}
      />
    </main>
  );
}

/**
 * Reads the reward out of real state rather than being handed it.
 *
 * The settlement runs after `advanceLesson` and `dropCards` have already
 * committed, so everything it reports is what the store actually holds. A
 * screen that took its numbers as props from the thing that produced them
 * could congratulate a learner for a card that failed to save.
 */
function SettlementHost({
  course,
  grewFrom,
  studyId,
  unitId,
  lessonId,
  onMap,
  onNext,
}: {
  course: Course;
  grewFrom: { key: string; doneBefore: number } | null;
  studyId: string;
  unitId: string;
  lessonId: string;
  onMap: () => void;
  onNext: (unitId: string, lessonId: string) => void;
}) {
  const progress = useSyncExternalStore(subscribe, snapshot);
  const unit = course.units.find((entry) => entry.id === unitId) ?? course.units[0]!;
  const lesson = unit.lessons.find((entry) => entry.id === lessonId) ?? unit.lessons[0]!;
  const flat = course.units.flatMap((entry) =>
    entry.lessons.map((item) => ({ unitId: entry.id, lesson: item })),
  );
  const index = flat.findIndex((entry) => entry.lesson.id === lesson.id);
  // The button is "the lesson after this one", not the world's accent.
  // `readCourseProgress().next` is the first unfinished lesson in reading
  // order; using it here would send a learner who skipped ahead back to the
  // gap they left, which is the map's job and not this screen's.
  const next = flat[index + 1] ?? null;

  const prefix = `${studyId}/${course.id}/`;
  const { done: doneAfter, total: lessons } = readCourseProgress(
    courseShapeOf(course, studyId),
    progressSource(),
  );

  const dropped = lesson.cards
    .map((card) => ({ card, state: progress.cards[`${prefix}${lesson.id}/${card.id}`] }))
    .flatMap((entry) => (entry.state ? [{ card: entry.card, dueAt: entry.state.dueAt }] : []));

  // Both counts go through the map's own measurement, so the sentence about the
  // island can only say what the island did. With no observed "before" — a
  // reload, a shared link — they are equal and the screen says nothing.
  const doneBefore =
    grewFrom?.key === `${studyId}/${course.id}/${lesson.id}` ? grewFrom.doneBefore : doneAfter;
  const grown = (done: number) =>
    lessons > 0 ? settlementSize(studyId, course.id, lessons, done / lessons).built : 0;

  return (
    <Settlement
      lessonTitle={lesson.title}
      courseTitle={course.title}
      dropped={dropped}
      builtBefore={grown(doneBefore)}
      builtAfter={grown(doneAfter)}
      doneAfter={doneAfter}
      lessons={lessons}
      streakDays={progress.streak.days}
      nextTitle={next?.lesson.title ?? null}
      onNext={next ? () => onNext(next.unitId, next.lesson.id) : null}
      onMap={onMap}
    />
  );
}

function ReviewHost({ onDone }: { onDone: () => void }) {
  const progress = useSyncExternalStore(subscribe, snapshot);
  const [revealed, setRevealed] = useState(false);
  const [cards, setCards] = useState<
    Record<string, { front: string; back: string; course: string }>
  >({});
  const queue = dueCards();
  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    void loadCourse(current.studyId, current.courseId).then((course) => {
      const lesson = course.units
        .flatMap((unit) => unit.lessons)
        .find((entry) => entry.id === current.lessonId);
      const cardId = current.cardKey.split("/").pop();
      const card = lesson?.cards.find((entry) => entry.id === cardId);
      if (card) {
        setCards((existing) => ({
          ...existing,
          [current.cardKey]: { front: card.front, back: card.back, course: course.title },
        }));
      }
    });
  }, [current, progress]);

  if (!current) {
    return (
      <main className="review">
        <div className="review__done">
          <b>今天没有到期卡片</b>
          <p>学一节新课，它会掉落新的卡片，明天就有事做了。</p>
          <button className="primary" onClick={onDone}>
            回到世界地图
          </button>
        </div>
      </main>
    );
  }

  const card = cards[current.cardKey];

  return (
    <main className="review">
      <div className="review__bar">
        <span>还剩 {queue.length} 张</span>
        <button className="linkish" onClick={onDone}>
          稍后再复习
        </button>
      </div>
      <div className="review__card">
        <p className="review__from">来自 {card?.course ?? "…"}</p>
        <div className="review__front">{card?.front ?? "读取中…"}</div>
        {revealed ? <div className="review__back">{card?.back}</div> : null}
        {revealed ? (
          <div className="review__grades">
            {(
              [
                // "没想起来" rather than "忘了": FSRS reads this rating as the
                // card not arriving in time, not as a failure, and the word on
                // the button is the only place a learner meets that difference.
                ["again", "没想起来"],
                ["hard", "有点吃力"],
                ["good", "想起来了"],
                ["easy", "很轻松"],
              ] as const
            ).map(([rating, label]) => (
              <button
                key={rating}
                onClick={() => {
                  gradeCard(current.cardKey, rating);
                  setRevealed(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <button className="primary block" onClick={() => setRevealed(true)}>
            显示答案
          </button>
        )}
      </div>
    </main>
  );
}

/**
 * One term's full entry.
 *
 * No term carries sections yet, so today this renders the head and nothing
 * else — which is the case SPEC-0004 insisted stay valid, because it is what
 * lets all 267 existing entries keep working on the day the registry lands.
 * A term that gains sections starts showing them here with no change to this
 * file.
 */
function TermEntryHost({ senseId, onOpen }: { senseId: string; onOpen: (view: View) => void }) {
  const { state: favouriteState, toggle: toggleFavouriteFor } = useFavourites();
  const entry = LEXICON.find((item) => item.senseId === senseId);
  if (!entry) {
    return (
      <main className="terms">
        <button className="linkish" onClick={() => onOpen({ kind: "terms" })}>
          ← 词义索引
        </button>
        <p className="reference-panel__note">词库里没有这个词义。</p>
      </main>
    );
  }
  const assembled = assembleTermEntry(entry, []);
  return (
    <main className="terms">
      <EntryPage
        breadcrumb={[{ label: "词义索引", href: "#/terms" }, { label: entry.headword }]}
        head={
          <>
            <h1 lang="en">
              {entry.headword}
              <FavouriteStar
                senseId={entry.senseId}
                headword={entry.headword}
                pressed={hasFavourite(favouriteState, entry.senseId)}
                onToggle={toggleFavouriteFor}
              />
            </h1>
            <p className="reference-panel__meta">
              <span className="reference-panel__phonetic">{entry.phonetic}</span>
              <span className="reference-panel__pos">{entry.partOfSpeech}</span>
            </p>
            <p className="reference-panel__gloss">{entry.gloss}</p>
            <p className="reference-panel__usage">{entry.usage}</p>
          </>
        }
        sections={assembled.entry.sections}
        headMarkdown={termHeadToMarkdown(entry)}
        lexicon={LEXICON_BY_SENSE}
        onOpenSense={(id) => onOpen({ kind: "term", senseId: id })}
      />
    </main>
  );
}

const LEXICON_BY_SENSE = new Map(LEXICON.map((entry) => [entry.senseId, entry]));
const LEXICON_SENSE_IDS = new Set(LEXICON.map((entry) => entry.senseId));

/**
 * One store for the whole session.
 *
 * Favourites are a shortlist a learner builds by hand, so they must survive a
 * reload; they live in localStorage today and behind an interface, which is
 * what makes the account-backed version a different adapter rather than a
 * rewrite of everything that reads them.
 */
const favourites = createLocalFavouritesStore();

function useFavourites() {
  const [state, setState] = useState(() => favourites.read());
  const toggle = useCallback((senseId: string) => {
    setState((current) => {
      // `now` is a parameter rather than something the model reads off the
      // clock, which is what makes the model pure and its tests reproducible.
      const next = toggleFavourite(current, senseId, LEXICON_SENSE_IDS, new Date().toISOString());
      favourites.write(next);
      return next;
    });
  }, []);
  return { state, toggle };
}

/** The learner's shortlist, grouped the same way the index groups. */
function FavouritesHost({ onOpen }: { onOpen: (view: View) => void }) {
  const { state, toggle } = useFavourites();
  const groups = listGroupedByTrack(state, LEXICON);
  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);

  return (
    <>
      <h1>收藏</h1>
      {total === 0 ? (
        <FavouritesEmpty onBrowse={() => onOpen({ kind: "library", tab: "terms" })} />
      ) : (
        groups.map((group) => (
          <section key={group.track}>
            <h2>
              {group.track} <span className="term-index__count">{group.entries.length}</span>
            </h2>
            <ul className="term-index__list">
              {group.entries.map((entry) => (
                <li key={entry.senseId}>
                  <button
                    className="term-index__hit"
                    onClick={() => onOpen({ kind: "term", senseId: entry.senseId })}
                  >
                    <span lang="en">{entry.headword}</span>
                    <span>{entry.gloss}</span>
                  </button>
                  <FavouriteStar
                    senseId={entry.senseId}
                    headword={entry.headword}
                    pressed
                    onToggle={toggle}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

/**
 * One concept, on the same EntryPage a term and an anti-pattern use.
 *
 * Third collection, third head adapter, still one page component — which is
 * the claim SPEC-0004 made and this is the first time it has been tested by a
 * collection large enough to tempt someone into a special case.
 *
 * It is also the first page to pass `neighbours`. C23 shipped unmounted, and an
 * unmounted component is a component nobody has checked.
 */
function ConceptEntryHost({ id, onOpen }: { id: string; onOpen: (view: View) => void }) {
  const entry = getConceptEntry(id);
  if (!entry) {
    return (
      <main className="terms">
        <button className="linkish" onClick={() => onOpen({ kind: "concepts" })}>
          ← 概念图解
        </button>
        <p className="reference-panel__note">没有这一条。</p>
      </main>
    );
  }
  const { previous, next } = conceptNeighbours(id);
  return (
    <main className="terms">
      <EntryPage
        breadcrumb={[
          { label: "概念图解", href: "#/concepts" },
          { label: entry.head.group },
          { label: entry.head.zh },
        ]}
        head={
          <>
            <h1>
              {entry.head.zh}
              {entry.head.en ? (
                <span className="reference-panel__pos" lang="en">
                  {entry.head.en}
                </span>
              ) : null}
            </h1>
            <p className="reference-panel__gloss">{entry.head.tagline}</p>
          </>
        }
        sections={entry.sections}
        headMarkdown={conceptHeadToMarkdown(entry.head)}
        lexicon={LEXICON_BY_SENSE}
        {...CONCEPT_POINTERS(onOpen)}
        neighbours={{
          previous: previous
            ? {
                label: previous.head.zh,
                onOpen: () => onOpen({ kind: "concept", id: previous.head.id }),
              }
            : null,
          next: next
            ? { label: next.head.zh, onOpen: () => onOpen({ kind: "concept", id: next.head.id }) }
            : null,
        }}
      />
    </main>
  );
}

/**
 * The endless sitting, drawing on the questions the concept entries already
 * carry.
 *
 * There is no second question bank and there is not going to be one. Every
 * question here is the same record the entry's own 「小测」 renders, which is
 * the architecture worth copying from the site this catalogue came from: their
 * question ids prove the practice bank *is* the per-entry quiz. A separate
 * corpus would drift from the entries within one authoring pass.
 *
 * The reward is the concept page itself, passed as a render prop, because
 * SPEC-0004 forbids a second detail page for a collection that already has one.
 */
function PracticeHost({ onOpen }: { onOpen: (view: View) => void }) {
  const questions = useMemo(() => {
    const built = [];
    for (const entry of CONCEPT_ENTRIES) {
      const quiz = entry.sections.find((section) => section.type === "quiz");
      if (quiz?.type !== "quiz") continue;
      const assembled = assemblePracticeQuestion(
        entry,
        {
          prompt: quiz.payload.question,
          options: quiz.payload.options,
          correctOptionId: quiz.payload.correctOptionId,
        },
        { category: entry.head.category, id: entry.head.id },
      );
      if (assembled.ok) built.push(assembled.question);
    }
    return built;
  }, []);

  return (
    <main className="terms">
      <button className="linkish" onClick={() => onOpen(WORLD)}>
        ← 关卡地图
      </button>
      <PracticeStream
        questions={questions}
        store={PRACTICE_STORE}
        onBrowse={() => onOpen({ kind: "concepts" })}
        renderReward={(question) => (
          <EntryPage
            breadcrumb={[
              { label: "概念图解", href: "#/concepts" },
              { label: question.entry.head.zh },
            ]}
            head={
              <>
                <h1>{question.entry.head.zh}</h1>
                <p className="reference-panel__gloss">{question.entry.head.tagline}</p>
              </>
            }
            sections={question.entry.sections}
            headMarkdown={conceptHeadToMarkdown(question.entry.head)}
            lexicon={LEXICON_BY_SENSE}
            {...CONCEPT_POINTERS(onOpen)}
          />
        )}
      />
    </main>
  );
}

/** One store for the whole session, same shape as the favourites store. */
const PRACTICE_STORE = createLocalPracticeRecentStore();

/**
 * How a concept page resolves its own 「先知道」 and 「相关」 pointers.
 *
 * Concepts point at concepts. Handing the page only the lexicon — which is what
 * it got at first — resolved none of them, so every pointer on all 281 pages
 * rendered as a bare id while every test passed, because the ids were valid
 * concept ids and the tests checked exactly that. The lexicon stays as the
 * fallback, since an entry is allowed to point at an English sense.
 */
function CONCEPT_POINTERS(onOpen: (view: View) => void) {
  return {
    resolveSense: (id: string) => {
      const target = lookupConcept(id);
      return target ? { title: target.head.zh, subtitle: target.head.tagline } : undefined;
    },
    onOpenSense: (id: string) =>
      onOpen(lookupConcept(id) ? { kind: "concept", id } : { kind: "term", senseId: id }),
  };
}

/**
 * One anti-pattern, rendered by the same EntryPage a term uses.
 *
 * That reuse is the point rather than a saving. SPEC-0004 says a second detail
 * page for this collection is the design failing, because the two pages would
 * drift on the day someone adds a section type to one of them.
 */
function AntiPatternEntryHost({ id, onOpen }: { id: string; onOpen: (view: View) => void }) {
  const entry = getAntiPatternEntry(id);
  if (!entry) {
    return (
      <main className="terms">
        <button className="linkish" onClick={() => onOpen({ kind: "anti-pattern" })}>
          ← 防 AI 味儿
        </button>
        <p className="reference-panel__note">没有这一条。</p>
      </main>
    );
  }
  return (
    <main className="terms">
      <EntryPage
        breadcrumb={[{ label: "防 AI 味儿", href: "#/flavour" }, { label: entry.head.name }]}
        head={
          <>
            <h1>{entry.head.name}</h1>
            <p className="reference-panel__gloss">{entry.head.complaint}</p>
          </>
        }
        sections={entry.sections}
        headMarkdown={antiPatternHeadToMarkdown(entry.head)}
        lexicon={LEXICON_BY_SENSE}
        onOpenSense={(senseId) => onOpen({ kind: "term", senseId })}
      />
    </main>
  );
}
