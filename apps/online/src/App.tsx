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
  hasContent,
  library,
  loadCourse,
  loadGraph,
  type Course,
  type CourseNode,
} from "./content/library";
import { LessonView } from "./lesson/Lesson";
import { Settlement } from "./lesson/Settlement";
import { fromHash, toHash, WORLD, type View } from "./url-state";
import { placeLabels, type LabelCandidate } from "./world/labels";
import {
  advanceLesson,
  dropCards,
  dueCards,
  dueTomorrow,
  gradeCard,
  lessonKey,
  lessonState,
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

/** Camera rig. Reused rather than written: MapControls is the map idiom. */
function Controls({ target }: { target: readonly [number, number, number] }) {
  const { camera, gl } = useThree();
  const controls = useRef<MapControls | null>(null);

  useEffect(() => {
    const instance = new MapControls(camera, gl.domElement);
    instance.enableDamping = true;
    instance.dampingFactor = 0.08;
    instance.maxPolarAngle = Math.PI * 0.46;
    instance.minDistance = 6;
    instance.maxDistance = 460;
    controls.current = instance;
    return () => instance.dispose();
  }, [camera, gl]);

  useEffect(() => {
    controls.current?.target.set(...target);
  }, [target]);

  useFrame(() => controls.current?.update());
  return null;
}

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
      if (node.lessons <= 0) return 0;
      const prefix = `${node.studyId}/${node.courseId}/`;
      const done = Object.entries(progress.lessons).filter(
        ([key, state]) => key.startsWith(prefix) && state.progress >= 1,
      ).length;
      return Math.min(1, done / node.lessons);
    },
    [progress],
  );

  const world = useMemo(
    () => (nodes ? placeWorld(nodes, courseProgress) : null),
    [nodes, courseProgress],
  );

  const learnerAt = useMemo(() => {
    if (!world) return null;
    const live = world.placements.find((entry) => entry.state === "live");
    return live ? live.position : (world.placements[0]?.position ?? null);
  }, [world]);

  const lessons: readonly LessonPlacement[] = useMemo(() => {
    if (!course || (view.kind !== "course" && view.kind !== "lesson")) return [];
    return placeCourse(
      course.units,
      (unitId, lessonId) =>
        lessonState(lessonKey(view.studyId, course.id, lessonId)).progress >= 1 && unitId !== "",
    );
  }, [course, view]);

  const labelNodes = useRef(new Map<string, HTMLElement>());

  const markers: readonly Marker[] = useMemo(() => {
    if (view.kind === "course" || view.kind === "lesson") {
      return lessons.map((lesson) => ({
        id: lesson.lessonId,
        position: lesson.position.clone().setY(lesson.position.y + 1.6),
        text: lesson.lessonTitle,
        kind: "lesson" as const,
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
    // Low and off to one side, not high and behind. Height thirty against a
    // twenty-eight-unit standoff is a map read from a helicopter: islands
    // become flat shapes, the sea fills the frame, and none of the modelling
    // work is visible. Pulling back and dropping down puts the horizon in shot,
    // which is what gives the archipelago a sense of somewhere to go.
    const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(13);
    const spot = learnerAt
      .clone()
      .addScaledVector(away, 38)
      .add(side)
      .setY(learnerAt.y + 16);
    return [spot.x, spot.y, spot.z];
  }, [world, learnerAt]);

  const cameraFrom: readonly [number, number, number] =
    view.kind === "course" || view.kind === "lesson" ? [0, 40, 46] : eye;
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
        <button
          className={due.length > 0 ? "primary" : "ghost"}
          onClick={() => setView({ kind: "review" })}
        >
          复习 {due.length > 0 ? `· ${due.length} 张到期` : `· 明天 ${dueTomorrow()} 张`}
        </button>
      </nav>

      <div
        className="stagewrap"
        hidden={view.kind === "lesson" || view.kind === "settled" || view.kind === "review"}
      >
        <Stage cameraFrom={cameraFrom} lookAt={lookAt}>
          <Controls target={lookAt} />
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
              {course.units.length} 单元 · {lessons.length} 关 · 还剩{" "}
              {lessons.filter((lesson) => lesson.state !== "done").length} 关
            </p>
            <button className="ghost block" onClick={() => setView({ kind: "world" })}>
              ← 回到世界地图
            </button>
          </aside>
        ) : null}

        <div className="labels" aria-hidden="true">
          {markers.map((marker) => (
            <div
              key={marker.id}
              ref={(element) => {
                if (element) labelNodes.current.set(marker.id, element);
                else labelNodes.current.delete(marker.id);
              }}
              className={`label label--${marker.kind}`}
              style={{ opacity: 0 }}
            >
              {marker.text}
              {marker.sub ? <small>{marker.sub}</small> : null}
            </div>
          ))}
        </div>

        <p className="hint">{hovered ? hovered : "拖动平移 · 右键旋转 · 滚轮缩放 · 点岛进入"}</p>
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
    </div>
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
      <LessonView
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
          const doneBefore = Object.entries(snapshot().lessons).filter(
            ([at, entry]) => at.startsWith(`${studyId}/${course.id}/`) && entry.progress >= 1,
          ).length;
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
  const next = flat[index + 1] ?? null;

  const prefix = `${studyId}/${course.id}/`;
  const doneAfter = Object.entries(progress.lessons).filter(
    ([key, entry]) => key.startsWith(prefix) && entry.progress >= 1,
  ).length;

  const dropped = lesson.cards
    .map((card) => ({ card, state: progress.cards[`${prefix}${lesson.id}/${card.id}`] }))
    .flatMap((entry) => (entry.state ? [{ card: entry.card, dueAt: entry.state.dueAt }] : []));

  // Both counts go through the map's own measurement, so the sentence about the
  // island can only say what the island did. With no observed "before" — a
  // reload, a shared link — they are equal and the screen says nothing.
  const doneBefore =
    grewFrom?.key === `${studyId}/${course.id}/${lesson.id}` ? grewFrom.doneBefore : doneAfter;
  const lessons = flat.length;
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
