/**
 * The app.
 *
 * Four surfaces and one rule about which is which: the canvas owns the world
 * and the level, the DOM owns everything a learner reads, types or is charged
 * for. That split is not taste — a Chinese IME, selectable code, a screen
 * reader and a phone keyboard all degrade to nothing inside WebGL.
 *
 * There is exactly one `<Canvas>` at a time. `Stage` owns the world map and
 * stays mounted across the two map levels. The temporary `#/avatar-lab` route
 * unmounts `Stage` and mounts its own studio canvas, so the two never share a
 * frame. Mounting a second one beside the first would be the fastest way to
 * end up with two renderers and a colour pipeline nobody can count.
 */
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import * as THREE from "three";

import { courseShapeOf, readCourseProgress } from "@pieai/university-core";
import { LoadingTrivia, useMapCover } from "@pieai/university-ui/loading/LoadingTrivia.js";
import "@pieai/university-ui/loading/loading-trivia.css";
import { UniversityShell } from "@pieai/university-ui/navigation/UniversityShell.js";
import {
  AccountPanel,
  LeagueEmpty,
  PlansEmpty,
  ProfileScreen,
  QuestsEmpty,
  SettingsScreen,
  SettingsSubnav,
} from "@pieai/university-ui/navigation/empty.js";
import { NodeCard } from "@pieai/university-ui/path/NodeCard.js";
import { UnitCard } from "@pieai/university-ui/path/UnitCard.js";
import {
  CourseScene,
  placeCourse,
  placeWorld,
  WorldScene,
  type LessonPlacement,
  type Marker,
} from "@pieai/university-world/Maps.js";
import { courseSprites } from "@pieai/university-world/path-overlay.js";
import { Stage } from "@pieai/university-world/Stage.js";

import {
  hasContent,
  library,
  loadCourse,
  loadGraph,
  peekCourse,
  type Course,
  type CourseNode,
} from "../content/library";
import { identityPort } from "../account/identity";
import { bindProgressToIdentity } from "../account/session";
import { progressSource } from "../progress/source";
import { dueCards, dueTomorrow, progressPort, snapshot, subscribe } from "../progress/store";
import { AvatarLab } from "../screens/AvatarLab";
import {
  AntiPatternEntryHost,
  ConceptEntryHost,
  CourseCatalog,
  LessonReaderHost,
  LibraryHost,
  PracticeHost,
  RouteFallback,
  SettlementHost,
  TermEntryHost,
} from "../screens/lazy";
import { ReviewHost } from "../screens/ReviewHost";
import { fromHash, LIBRARY_VIEW_TAB, libraryTabOf, toHash, WORLD, type View } from "../url-state";
import { TodayCard, todayMeta } from "./TodayCard";
import { studySub } from "./map-labels";
import {
  Controls,
  COURSE_POLAR,
  Flight,
  LabelProbe,
  MAP_CONTROLS_HINT,
  SHOWS_THE_MAP,
  WORLD_POLAR,
} from "./map-controls";
import { activeIdForView, isBareView, useMinWidth } from "./shell-route";
import { universityCounters } from "@pieai/university-ui/navigation/counters.js";

const ProfileAvatar = lazy(() =>
  import("./ProfileAvatar.js").then((mod) => ({ default: mod.ProfileAvatar })),
);

type PathOverlay =
  | {
      readonly kind: "node";
      readonly unitId: string;
      readonly lessonId: string;
      readonly returnFocusTo: HTMLElement | null;
    }
  | {
      readonly kind: "unit";
      readonly unitId: string;
      readonly returnFocusTo: HTMLElement | null;
    };

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
    const onHash = () => setViewState(fromHash(location.hash));
    addEventListener("popstate", onHash);
    addEventListener("hashchange", onHash);
    return () => {
      removeEventListener("popstate", onHash);
      removeEventListener("hashchange", onHash);
    };
  }, []);
  const wide = useMinWidth(1160);
  const [course, setCourse] = useState<Course | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [picked, setPicked] = useState<CourseNode | null>(null);
  // Screen 02/03: a path card sits on the course map. It is not a route —
  // confirming is what changes the URL, not pointing at a stone.
  const [pathOverlay, setPathOverlay] = useState<PathOverlay | null>(null);
  // How many lessons were finished the moment a lesson was passed. Held here
  // rather than derived later, and deliberately absent when the settlement is
  // reached by its own URL — arriving at `/done` from a bookmark is not
  // evidence that anything just grew, so that screen stays quiet about the map.
  const [grewFrom, setGrewFrom] = useState<{ key: string; doneBefore: number } | null>(null);
  // Screen 09. False until the kit models inside Stage have committed. The
  // overlay is DOM, so this flag is the only thing Stage has to say.
  const [sceneReady, setSceneReady] = useState(false);
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  const onSceneBusy = useCallback(() => setSceneReady(false), []);

  useEffect(() => {
    if (!hasContent) return;
    void loadGraph().then(setNodes);
  }, []);

  useEffect(() => bindProgressToIdentity(progressPort, identityPort, null), []);

  useEffect(() => {
    if (view.kind !== "course") setPathOverlay(null);
  }, [view.kind]);

  useEffect(() => {
    if (view.kind !== "course" && view.kind !== "lesson" && view.kind !== "settled") return;
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

  /** Lessons finished in one course, or 0 for a course not on disk yet. */
  const lessonsDone = useCallback(
    (node: CourseNode) => {
      const loaded = peekCourse(node.studyId, node.courseId);
      if (!loaded) return 0;
      return readCourseProgress(courseShapeOf(loaded, node.studyId), progressSource()).done;
    },
    [progress],
  );

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

  /**
   * Same `{ done, total }` the course path header prints as 「还剩 N 关」.
   * Null only while the course JSON has not resolved this session — then
   * the card names the project and withholds the count rather than inventing
   * a second source.
   */
  const nextUpProgress = useMemo(() => {
    if (!nextUp) return null;
    const loaded = peekCourse(nextUp.node.studyId, nextUp.node.courseId);
    if (!loaded) return null;
    return readCourseProgress(courseShapeOf(loaded, nextUp.node.studyId), progressSource());
  }, [nextUp, progress]);

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

  /**
   * The project's own name, or the first study when nothing is picked.
   * The island counter is a flag slot: no number, just the name.
   */
  const projectName = useMemo(() => {
    const studyId =
      view.kind === "course" || view.kind === "lesson" || view.kind === "settled"
        ? view.studyId
        : /*
             On the world view nothing is picked, and falling back to the first
             study in the catalogue named Buzz while the map was centred on
             TuringPact and the 「今天」 card said TuringPact — three places, two
             answers. The learner's own next course is the one thing all three
             already agree on, so ask it.
          */
          (nextUp?.node.studyId ?? null);
    const study = studyId
      ? library.studies.find((entry) => entry.studyId === studyId)
      : library.studies[0];
    return study?.title ?? "University";
  }, [view, nextUp]);

  const profileStats = useMemo(() => {
    let lessonsCompleted = 0;
    let passagesRead = 0;
    for (const [key, lesson] of Object.entries(progress.lessons)) {
      if (lesson.completedAt == null && lesson.progress < 1) continue;
      lessonsCompleted += 1;
      const [studyId, courseId, lessonId] = key.split("/");
      if (!studyId || !courseId || !lessonId) continue;
      const loaded = peekCourse(studyId, courseId);
      const found = loaded?.units
        .flatMap((unit) => unit.lessons)
        .find((entry) => entry.id === lessonId);
      if (found) passagesRead += found.evidence.length;
    }
    return { lessonsCompleted, passagesRead };
  }, [progress]);

  const pathSprites = useMemo(() => {
    if (view.kind !== "course" && view.kind !== "lesson") return [];
    return courseSprites(lessons);
  }, [view.kind, lessons]);

  const markers: readonly Marker[] = useMemo(() => {
    const fromPath: Marker[] = pathSprites.map((sprite) => ({
      id: sprite.id,
      position: sprite.position,
      text: sprite.text,
      kind: sprite.role === "icon" ? ("icon" as const) : ("unit" as const),
      pinned: sprite.role === "icon",
      origin: sprite.role === "unit" ? ("start" as const) : ("center" as const),
      locked: sprite.locked,
      label: sprite.label,
      weight: sprite.role === "unit" ? 2 : undefined,
    }));
    if (view.kind === "course" || view.kind === "lesson") {
      return [
        ...fromPath,
        ...lessons.map((lesson) => ({
          id: lesson.lessonId,
          // A low lift, because the tilt is shallow. At seventy-four degrees a
          // world-space unit of height travels a long way up the screen, and the
          // bubble that was lifted clear of its own stone arrived next to the
          // following one — pointing at the wrong lesson is worse than sitting a
          // little close to the right one.
          position: lesson.position.clone().setY(lesson.position.y + 1.7),
          // Not the lesson title. Forty-one Chinese titles down a road all
          // truncate, and the reference this is built from does not put them
          // there either: the stone you are on says "start", and what it is
          // called belongs to the card that opens when you choose it.
          text: lesson.state === "live" ? "开始" : lesson.lessonTitle,
          kind: "lesson" as const,
          quiet: lesson.state !== "live",
          weight: lesson.state === "live" ? 3 : 0,
          activate:
            view.kind === "lesson"
              ? undefined
              : () =>
                  setPathOverlay({
                    kind: "node",
                    unitId: lesson.unitId,
                    lessonId: lesson.lessonId,
                    returnFocusTo: labelNodes.current.get(lesson.lessonId) ?? null,
                  }),
        })),
      ];
    }
    if (!world) return [];
    const studyMarkers: Marker[] = [...world.centres.entries()].map(([studyId, centre]) => {
      const own = world.placements.filter((entry) => entry.node.studyId === studyId);
      return {
        id: `study:${studyId}`,
        position: centre.clone().setY(centre.y + 9),
        text: own[0]?.node.studyTitle ?? studyId,
        sub: studySub(
          own.length,
          own.reduce((sum, entry) => sum + lessonsDone(entry.node), 0),
        ),
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
  }, [world, lessons, view, pathSprites]);

  const due = dueCards();
  const dueTomorrowCount = dueTomorrow();
  const showMap = SHOWS_THE_MAP.has(view.kind);
  // Suspense reports the models; this reports the JSON they stand on. Either
  // one alone still paints an empty sea, which is the same broken-page read.
  const waitingForData =
    (view.kind === "world" && !world) ||
    ((view.kind === "course" || view.kind === "lesson") && lessons.length === 0);
  const mapCover = useMapCover(showMap && (!sceneReady || waitingForData));
  const counters = universityCounters({
    projectName,
    streakDays: progress.streak.days,
  });

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

  /**
   * Inside a course the camera stands on the road instead of above it.
   *
   * The overview it replaces framed the whole folded course at once, which is
   * the right shot for a map and the wrong one for a path: every stone sat at
   * the same distance, so none of them was *next*. Standing behind the live
   * stone and looking up the road puts the answer to "what now" in the middle
   * of the frame, and lets the rest recede into the fog the scene already has.
   *
   * The camera tracks half the road's lateral swing rather than all of it. At
   * full swing it moves with the curve, the curve cancels, and the road looks
   * dead straight — the shot would be hiding the one thing it is framing.
   */
  const roadCamera = useMemo(() => {
    if (view.kind !== "course" && view.kind !== "lesson") return null;
    const found = lessons.findIndex((lesson) => lesson.state === "live");
    const liveIndex = found < 0 ? 0 : found;
    const live = lessons[liveIndex];
    if (!live) return null;
    // Stand two stones back and aim four ahead — both are stones, not offsets.
    //
    // The first version of this positioned the eye with hand-tuned distances
    // and trigonometry, and put the live stone exactly on the bottom edge:
    // its label was judged off-screen and the one name that must never be
    // dropped was the one that never appeared. Anchoring both ends of the shot
    // to real positions makes "the live stone is in frame, with road visible
    // behind it" a property of the geometry rather than of a number I guessed.
    const ahead = lessons[Math.min(liveIndex + 4, lessons.length - 1)] ?? live;
    // Only the distance and the compass bearing of this survive.
    //
    // `Controls` pins the tilt, so `MapControls.update()` recomputes the eye
    // from (target, distance, bearing) on the next frame and the height here is
    // discarded. Forty units back is therefore not "forty units up and back",
    // it is the radius that, at the pinned tilt, leaves the live stone about
    // two thirds of the way down the frame with road behind it.
    return {
      from: [live.position.x, live.position.y + 22, live.position.z + 45] as readonly [
        number,
        number,
        number,
      ],
      look: [ahead.position.x * 0.6, ahead.position.y + 1.8, ahead.position.z] as readonly [
        number,
        number,
        number,
      ],
    };
  }, [view.kind, lessons]);

  const cameraFrom: readonly [number, number, number] = roadCamera ? roadCamera.from : eye;
  const lookAt: readonly [number, number, number] = roadCamera
    ? roadCamera.look
    : learnerAt
      ? [learnerAt.x, learnerAt.y, learnerAt.z]
      : [0, 0, 0];

  const pathUnitId =
    pathOverlay?.unitId ??
    lessons.find((lesson) => lesson.state === "live")?.unitId ??
    course?.units[0]?.id;
  const pathUnit = course?.units.find((unit) => unit.id === pathUnitId);
  const pathLesson =
    pathOverlay?.kind === "node"
      ? pathUnit?.lessons.find((lesson) => lesson.id === pathOverlay.lessonId)
      : undefined;

  // One sentence, both widths. The rail's TodayCard and the floating .nextup
  // overlay used to format this independently, and the overlay kept quoting
  // the catalogue size after the rail had stopped.
  const nextUpMeta = nextUp ? todayMeta(nextUp.node.studyTitle, nextUpProgress) : null;

  const todayCard = (
    <TodayCard
      nextTitle={nextUp?.node.title ?? null}
      nextMeta={nextUpMeta}
      continueLabel={progress.streak.days > 0 ? "继续" : "开始第一节"}
      onContinue={() => {
        if (!nextUp) return;
        setView({
          kind: "course",
          studyId: nextUp.node.studyId,
          courseId: nextUp.node.courseId,
        });
      }}
      dueCount={due.length}
      dueTomorrow={dueTomorrowCount}
    />
  );

  const stage =
    view.kind === "avatar-lab" ? null : (
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
        <Stage
          cameraFrom={cameraFrom}
          lookAt={lookAt}
          onSceneReady={onSceneReady}
          onSceneBusy={onSceneBusy}
        >
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
              onPick={(lesson) => {
                if (view.kind === "lesson") return;
                setPathOverlay({
                  kind: "node",
                  unitId: lesson.unitId,
                  lessonId: lesson.lessonId,
                  returnFocusTo: labelNodes.current.get(lesson.lessonId) ?? null,
                });
              }}
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
        {wide ? null : view.kind === "world" && nextUp && !picked ? (
          <aside className="nextup">
            <p className="nextup__eyebrow">
              {progress.streak.days > 0 ? "接着上次" : "从这里开始"}
            </p>
            <h2 className="nextup__title">{nextUp.node.title}</h2>
            <p className="nextup__meta">{nextUpMeta}</p>
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

        {wide ? null : view.kind === "world" ? (
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
                    setView({
                      kind: "course",
                      studyId: picked.studyId,
                      courseId: picked.courseId,
                    })
                  }
                >
                  进入这门课 →
                </button>
              </>
            ) : null}
          </aside>
        ) : null}

        {wide ? null : view.kind === "course" && course ? (
          <aside className="picked picked--left">
            <h3>{course.title}</h3>
            <p className="picked__study">
              {course.units.length} 单元 · {viewedProgress?.total ?? 0} 关 · 还剩{" "}
              {viewedProgress ? viewedProgress.total - viewedProgress.done : 0} 关
            </p>
            {pathUnit ? (
              <div className="unit-strip">
                <p className="unit-strip__name">{pathUnit.title}</p>
                <button
                  type="button"
                  className="unit-strip__list"
                  aria-label="先看这一单元讲什么"
                  aria-haspopup="dialog"
                  aria-expanded={pathOverlay?.kind === "unit" ? true : undefined}
                  onClick={(event) =>
                    setPathOverlay({
                      kind: "unit",
                      unitId: pathUnit.id,
                      returnFocusTo: event.currentTarget,
                    })
                  }
                >
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                    <path
                      d="M3 4.5h10M3 8h10M3 11.5h7"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                </button>
              </div>
            ) : null}
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
            const className = [
              "label",
              `label--${marker.kind}`,
              marker.quiet ? "label--quiet" : "",
              marker.locked ? "is-locked" : "",
            ]
              .filter(Boolean)
              .join(" ");
            if (marker.kind === "icon") {
              return (
                <span
                  key={marker.id}
                  ref={attach}
                  className={className}
                  style={{ "--placed": 0 } as CSSProperties}
                  role="img"
                  aria-label={marker.label ?? marker.text}
                >
                  {marker.text}
                </span>
              );
            }
            return marker.activate ? (
              <button
                key={marker.id}
                ref={attach}
                type="button"
                className={className}
                style={{ "--placed": 0 } as CSSProperties}
                aria-haspopup={marker.kind === "lesson" ? "dialog" : undefined}
                aria-expanded={
                  marker.kind === "lesson" &&
                  pathOverlay?.kind === "node" &&
                  pathOverlay.lessonId === marker.id
                    ? true
                    : undefined
                }
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

        {/*
          The hint has to describe the controls that exist. It said 「右键旋转」
          for as long as rotation had been disabled — the camera is locked to a
          fixed pitch on purpose, the way a map app locks it, and telling a
          learner to right-drag taught them the app was broken.
        */}
        <p className="hint">{hovered ? hovered : MAP_CONTROLS_HINT}</p>
        {mapCover ? <LoadingTrivia /> : null}
      </div>
    );

  /*
    The stage stays in the centre column at every width. v3 draws a small
    persistent island in the right rail, and that is right — but only once the
    centre holds a path of its own. It does not: for us the scene *is* the path,
    so moving it to a 366px rail leaves the main column empty and shrinks the
    thing a learner came for into a thumbnail. The rail gets it back when there
    is a DOM path to take its place.
  */
  const aside = (
    <>
      {showMap ? todayCard : null}
      {view.kind === "settings" ? <SettingsSubnav /> : null}
    </>
  );

  const main = (
    <>
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
            {view.kind === "world" && picked ? (
              <aside className="picked">
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
                    setView({
                      kind: "course",
                      studyId: picked.studyId,
                      courseId: picked.courseId,
                    })
                  }
                >
                  进入这门课 →
                </button>
              </aside>
            ) : null}
            {view.kind === "course" && course ? (
              <aside className="picked picked--left">
                <h3>{course.title}</h3>
                <p className="picked__study">
                  {course.units.length} 单元 · {viewedProgress?.total ?? 0} 关 · 还剩{" "}
                  {viewedProgress ? viewedProgress.total - viewedProgress.done : 0} 关
                </p>
                {pathUnit ? (
                  <div className="unit-strip">
                    <p className="unit-strip__name">{pathUnit.title}</p>
                    <button
                      type="button"
                      className="unit-strip__list"
                      aria-label="先看这一单元讲什么"
                      aria-haspopup="dialog"
                      aria-expanded={pathOverlay?.kind === "unit" ? true : undefined}
                      onClick={(event) =>
                        setPathOverlay({
                          kind: "unit",
                          unitId: pathUnit.id,
                          returnFocusTo: event.currentTarget,
                        })
                      }
                    >
                      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                        <path
                          d="M3 4.5h10M3 8h10M3 11.5h7"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeWidth="1.5"
                        />
                      </svg>
                    </button>
                  </div>
                ) : null}
                <button className="ghost block" onClick={() => setView({ kind: "world" })}>
                  ← 回到世界地图
                </button>
              </aside>
            ) : null}
          </div>
        ) : null}
      </div>
      {view.kind === "avatar-lab" ? (
        <Suspense fallback={<RouteFallback />}>
          <AvatarLab onOpen={setView} />
        </Suspense>
      ) : null}

      {view.kind === "course" &&
      course &&
      pathOverlay?.kind === "node" &&
      pathUnit &&
      pathLesson ? (
        <NodeCard
          open
          lesson={pathLesson}
          unit={pathUnit}
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
          unit={pathUnit}
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
            studyId={view.studyId}
            unitId={view.unitId}
            lessonId={view.lessonId}
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
          />
        </Suspense>
      ) : null}

      {view.kind === "review" ? <ReviewHost onDone={() => setView(WORLD)} /> : null}

      {view.kind === "term" ? (
        <Suspense fallback={<RouteFallback />}>
          <TermEntryHost senseId={view.senseId} onOpen={setView} />
        </Suspense>
      ) : null}

      {LIBRARY_VIEW_TAB[view.kind] ? (
        <Suspense fallback={<RouteFallback />}>
          <LibraryHost tab={libraryTabOf(view)} onOpen={setView} />
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

      {view.kind === "league" ? <LeagueEmpty /> : null}
      {view.kind === "quests" ? <QuestsEmpty /> : null}
      {view.kind === "plans" ? <PlansEmpty /> : null}
      {view.kind === "settings" ? <SettingsScreen /> : null}
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
              <ProfileAvatar />
            </Suspense>
          }
          account={<AccountPanel identity={identityPort} />}
          passagesRead={profileStats.passagesRead}
          lessonsCompleted={profileStats.lessonsCompleted}
          nextHref={
            nextUpProgress?.next
              ? toHash({
                  kind: "lesson",
                  studyId: nextUpProgress.next.studyId,
                  courseId: nextUpProgress.next.courseId,
                  unitId: nextUpProgress.next.unitId,
                  lessonId: nextUpProgress.next.lessonId,
                })
              : nextUp
                ? toHash({
                    kind: "course",
                    studyId: nextUp.node.studyId,
                    courseId: nextUp.node.courseId,
                  })
                : "#/"
          }
        />
      ) : null}
    </>
  );

  if (isBareView(view) && view.kind === "lesson" && course) {
    return (
      <div className="app">
        <Suspense fallback={<RouteFallback />}>
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
            onBack={() =>
              setView({ kind: "course", studyId: view.studyId, courseId: view.courseId })
            }
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
        </Suspense>
      </div>
    );
  }

  return (
    <div className="app">
      <UniversityShell
        activeId={activeIdForView(view)}
        counters={counters}
        aside={aside}
        asideLabel={view.kind === "settings" ? "设置" : "今天"}
      >
        {main}
      </UniversityShell>
    </div>
  );
}
