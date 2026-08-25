/**
 * The app. One of it, for both campuses.
 *
 * There were two, and the difference between them had stopped being 「哪来的
 * AI」 long ago: two routers, two shelves, two readers, two answers to what
 * happens when a lesson is finished. None of that was forked on purpose — the
 * compositions simply lived in two app files neither app could import — and the
 * drift rate never fell, because there were two places one decision could be
 * made. There is one now, and the differences that survived are three ports in
 * `src/ports/`, chosen by a build-time constant.
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
} from "react";
import {
  activeIdForView,
  courseShapeOf,
  fromHash,
  isBareView,
  LIBRARY_VIEW_TAB,
  libraryTabOf,
  progressSourceOf,
  readCourseProgress,
  spineOf,
  toHash,
  WORLD,
  type LessonRef,
  type View,
} from "@pieai/university-core";
import { LoadingTrivia, useMapCover } from "@pieai/university-ui/loading/LoadingTrivia.js";
import { spacedName } from "@pieai/university-ui/text/spaced-name.js";
import "@pieai/university-ui/loading/loading-trivia.css";
import { UniversityShell } from "@pieai/university-ui/navigation/UniversityShell.js";
import {
  focusedStudyId as resolveFocusedStudy,
  StudySwitcher,
  type StudySwitchItem,
} from "@pieai/university-ui/navigation/StudySwitcher.js";
import {
  AccountPanel,
  ProfileScreen,
  SettingsScreen,
  SettingsSubnav,
} from "@pieai/university-ui/navigation/empty.js";
import {
  BadgeWall,
  LeagueScreen,
  PlansScreen,
  QuestsScreen,
} from "@pieai/university-ui/navigation/screens.js";
import { CoursePickCard } from "@pieai/university-ui/path/CoursePickCard.js";
import { NodeCard } from "@pieai/university-ui/path/NodeCard.js";
import { UnitCard } from "@pieai/university-ui/path/UnitCard.js";
import {
  CourseScene,
  placeCourse,
  nextCourse,
  placeWorld,
  type LessonPlacement,
  type Marker,
} from "@pieai/university-world/Maps.js";
import { courseMarkers, frameCourse, worldCourse } from "@pieai/university-world/course-map.js";
import { courseNodesOf, type CourseNode } from "@pieai/university-world/course.js";
import { RailIdentity } from "@pieai/university-world/avatar.js";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";
import type { ContentStudy, Shelf } from "@pieai/university-ui/content/port.js";
import { pathLessonOf, pathUnitOf } from "@pieai/university-ui/path/from-course-view.js";

import { AUTHORING } from "../mode";
import { MapNotes, StudioScreen } from "../authoring/index";
import { contentPort } from "../ports/index";
import { identityPort } from "../account/identity";
import { bindProgressToIdentity } from "../account/session";
import { presencePort } from "../presence/store";
import {
  dueCards,
  progressPort,
  progressRemoteStore,
  snapshot,
  subscribe,
} from "../progress/store";
import { AvatarLab } from "../screens/AvatarLab";
import {
  AntiPatternEntryHost,
  ConceptEntryHost,
  CourseCatalog,
  LessonScreen,
  LibraryHost,
  PracticeHost,
  RouteFallback,
  SettlementHost,
  TermEntryHost,
} from "../screens/lazy";

import {
  todayCtaLabel,
  TodaySection,
  todayMeta,
  type TodaySectionData,
} from "@pieai/university-ui/today/TodaySection.js";
import type { TodayCard } from "@pieai/university-ui/view/lesson-view.js";
import { nextLessonOf, todayCardLocatorOf } from "./today-data";
import {
  createReviewCardPort,
  createVocabularyReviewPort,
} from "@pieai/university-ui/review/scheduler-ports.js";
import { LINK_RETURN_DEPTH } from "@pieai/university-ui/lesson/LessonReader.js";
import { LEXICON } from "../lesson/language";
import { EMPTY_SHELF_HINT } from "../mode";
import { COURSE_POLAR, MAP_CONTROLS_HINT, WORLD_POLAR } from "@pieai/university-world/controls.js";
import { frameWorld, roadAhead } from "@pieai/university-world/frame.js";
import { PlanetRail, PlanetStage, type PlanetStudy } from "@pieai/university-world/planet.js";
import { SHOWS_THE_MAP } from "./map-controls";
import { useMinWidth } from "./shell-route";
import { universityCounters } from "@pieai/university-ui/navigation/counters.js";
import { STUDIO_MORE_ITEM } from "@pieai/university-ui/navigation/slots.js";
import { PresenceLayer, PresenceSession, presenceViewKey } from "@pieai/university-ui/presence.js";
import { CompanionProbe } from "@pieai/university-world/companion-probe.js";
import { WorldMapCanvas } from "@pieai/university-world/WorldMapCanvas.js";

const ProfileAvatar = lazy(() =>
  import("./ProfileAvatar.js").then((mod) => ({ default: mod.ProfileAvatar })),
);

/**
 * A destination this build can actually answer.
 *
 * `#/studio` belongs to the shared address space because the workbench is a
 * mode of one product, not a second one — but the workbench needs an authoring
 * pipeline on the other end of the address, and a delivery build has none. So
 * there the hash lands on the map, which is where it landed before the two
 * campuses shared a parser and `studio` read as a study nobody has.
 *
 * One address space is not one set of screens, and this is the whole list of
 * places the two disagree. It is one line long on purpose: a second entry
 * would be a second difference, and V4 allows one.
 */
function routable(view: View): View {
  return view.kind === "studio" && !AUTHORING ? WORLD : view;
}

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
  useEffect(
    () =>
      progressPort.subscribe(() =>
        presencePort.setSharesPresence(progressPort.accountData().preferences.sharesPresence),
      ),
    [],
  );
  /*
    Every series and every course's shape, from whichever source this build has.
    One request: the map, the switcher, the planet, the 2D directory and the
    reader's prev/next all read this, and two of them used to read a different
    one.
  */
  const [shelf, setShelf] = useState<Shelf | null>(null);
  /*
    Who is on the shelf, before anything about it has been counted.

    The capsule at the top of every screen names the series you are in, and it
    must not wait for the authoring server to measure 579 lessons to do it.
    Names arrive first; the counts fill in behind them.
  */
  const [studyNames, setStudyNames] = useState<readonly ContentStudy[]>(
    () => contentPort.knownStudies ?? [],
  );
  const [shelfError, setShelfError] = useState<string | null>(null);
  // The address bar is the source of truth for where the learner is, so a
  // reload lands where they were and a lesson can be sent to someone.
  const [view, setViewState] = useState<View>(() => routable(fromHash(location.hash)));
  const setView = useCallback((next: View) => {
    if (toHash(next) !== location.hash) history.pushState(null, "", toHash(next));
    setViewState(next);
  }, []);
  useEffect(() => {
    const onHash = () => setViewState(routable(fromHash(location.hash)));
    addEventListener("popstate", onHash);
    addEventListener("hashchange", onHash);
    return () => {
      removeEventListener("popstate", onHash);
      removeEventListener("hashchange", onHash);
    };
  }, []);
  const wide = useMinWidth(768);
  /**
   * The study the camera is looking at. `undefined` means "not chosen yet" —
   * fall back to the learner's next course so the name, the sky and the eye
   * agree. `null` is the overview, all four seas.
   */
  const [mapFocus, setMapFocus] = useState<string | null | undefined>(undefined);
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
  /** Lessons a cross-lesson link led away from, innermost last. */
  const [returnStack, setReturnStack] = useState<readonly LessonRef[]>([]);
  // Screen 09. False until the kit models inside Stage have committed. The
  // overlay is DOM, so this flag is the only thing Stage has to say.
  const [sceneReady, setSceneReady] = useState(false);
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  const onSceneBusy = useCallback(() => setSceneReady(false), []);

  useEffect(() => {
    let alive = true;
    void contentPort.studies().then((names) => {
      if (alive) setStudyNames(names);
    });
    void contentPort
      .shelf()
      .then((next) => {
        if (alive) setShelf(next);
      })
      .catch((reason: unknown) => {
        if (alive) setShelfError(reason instanceof Error ? reason.message : "读不到课程");
      });
    return () => {
      alive = false;
    };
  }, []);

  const studies = useMemo(
    () => shelf?.studies ?? studyNames.map((study) => ({ ...study, courses: [] })),
    [shelf, studyNames],
  );
  const nodes = useMemo(() => (shelf ? courseNodesOf(shelf.studies) : null), [shelf]);
  /** One course's shape, by address. Synchronous: the shelf is already here. */
  const courseOf = useCallback(
    (studyId: string, courseId: string): CourseView | null =>
      studies
        .find((study) => study.id === studyId)
        ?.courses.find((entry) => entry.id === courseId) ?? null,
    [studies],
  );
  const source = useMemo(() => progressSourceOf(progressPort), []);

  useEffect(() => bindProgressToIdentity(progressPort, identityPort, progressRemoteStore), []);

  useEffect(() => {
    if (view.kind !== "course") setPathOverlay(null);
    // A leftover pick from the world map is not a choice the learner just
    // made. Coming back from a course with this still set would pop the
    // card without a click.
    if (view.kind !== "world") setPicked(null);
  }, [view.kind]);

  /*
    The course on screen. It used to be state filled by a fetch, with a guard
    against a slow first answer overwriting a later one; the shelf arrives once
    and every course's shape comes with it, so there is no race left to guard.
  */
  const course =
    view.kind === "course" || view.kind === "lesson" || view.kind === "settled"
      ? courseOf(view.studyId, view.courseId)
      : null;

  /** Lessons finished in one course, or 0 for a course not on the shelf yet. */
  const lessonsDone = useCallback(
    (node: CourseNode) => {
      const shape = courseOf(node.studyId, node.courseId);
      if (!shape) return 0;
      return readCourseProgress(courseShapeOf(shape, node.studyId), source).done;
    },
    [courseOf, source, progress],
  );

  // A fraction, not a flag. The world map now shows how far a course got, not
  // only whether it is finished, so a course two lessons in has to be able to
  // say so — that partly-built island is the whole reason to come back.
  const courseProgress = useCallback(
    (node: CourseNode) => {
      const shape = courseOf(node.studyId, node.courseId);
      if (!shape) return 0;
      const { done, total } = readCourseProgress(courseShapeOf(shape, node.studyId), source);
      return total > 0 ? Math.min(1, done / total) : 0;
    },
    [courseOf, source, progress],
  );

  /**
   * The course the learner is actually on, as a node rather than a coordinate.
   *
   * This was already computed and used only to aim the camera at it. Pointing a
   * camera at something is not the same as telling anyone about it: the first
   * frame of the product was four unexplained archipelagos and five equally
   * weighted buttons, and the one thing the app already knew — which course to
   * open — was the one thing it did not say.
   *
   * It is computed across every project on purpose, and it used to fall out of
   * the map for free because the map held every project. Now that the map holds
   * one, the two have to be separated: wandering into Buzz to have a look does
   * not stop a learner being three lessons from finishing TuringPact, and
   * 「今天」 should keep saying so.
   */
  const todayNode = useMemo(
    () => (nodes ? nextCourse(nodes, courseProgress) : null),
    [nodes, courseProgress],
  );

  /**
   * Same `{ done, total }` the course path header prints as 「还剩 N 关」.
   * Null only while the course JSON has not resolved this session — then
   * the card names the project and withholds the count rather than inventing
   * a second source.
   */
  const nextUpProgress = useMemo(() => {
    if (!todayNode) return null;
    const shape = courseOf(todayNode.studyId, todayNode.courseId);
    if (!shape) return null;
    return readCourseProgress(courseShapeOf(shape, todayNode.studyId), source);
  }, [todayNode, courseOf, source, progress]);

  const lessons: readonly LessonPlacement[] = useMemo(() => {
    if (!course || (view.kind !== "course" && view.kind !== "lesson")) return [];
    // `worldCourse`, not the course itself: the scene needs ids, titles and how
    // long each lesson is, and has no business holding the prose.
    return placeCourse(view.studyId, worldCourse(course), source);
  }, [course, view, source, progress]);

  const viewedProgress = useMemo(() => {
    if (!course || (view.kind !== "course" && view.kind !== "lesson")) return null;
    return readCourseProgress(courseShapeOf(course, view.studyId), source);
  }, [course, view, source, progress]);

  const labelNodes = useRef(new Map<string, HTMLElement>());
  const pickCardRef = useRef<HTMLElement | null>(null);
  const dismissPick = useCallback(() => setPicked(null), []);
  const companionNodes = useRef(new Map<string, HTMLElement>());

  /**
   * One state: the study in the top bar is the sea the camera is looking at.
   *
   * These used to be independent, which is how the top bar said TuringPact
   * while the map showed Buzz. A course URL names the study; on the world
   * map the next course is the default until the learner picks another sea
   * or pulls back to all four.
   */
  const focusedStudyId = useMemo(() => {
    /*
      Reading a lesson pins the map to that lesson's project until the learner
      says otherwise — `mapFocus === undefined` is "has not said otherwise",
      which is why it is distinct from null.
    */
    const chosen =
      view.kind === "course" || view.kind === "lesson" || view.kind === "settled"
        ? mapFocus === undefined
          ? view.studyId
          : mapFocus
        : mapFocus;
    /*
      The map shows one project and may never show none, so this can no longer
      resolve to null the way it did when null meant 「看全部四片海」. Today's
      course names the project; an account with nothing started falls back to
      the first project in the catalogue. Null now means one thing only: the
      catalogue is empty.
    */
    return resolveFocusedStudy(
      studies.map((entry) => entry.id),
      chosen,
      todayNode?.studyId,
    );
  }, [view, mapFocus, todayNode, studies]);

  /**
   * One project's islands, at the origin. Never every project at once.
   *
   * The boss worked out why the shared ocean was wrong before we did: drag a
   * little too far and you are among another project's islands while the top
   * bar still names the one you left, and one ground plate stretched over four
   * projects runs out of resolution and starts to repeat. A project is a place
   * now, and the way to another one is to say so.
   */
  const world = useMemo(
    () => (nodes && focusedStudyId ? placeWorld(nodes, courseProgress, focusedStudyId) : null),
    [nodes, courseProgress, focusedStudyId],
  );

  /**
   * Where the little figure stands, which is a question about the project on
   * screen and not about the catalogue. In a project nobody has opened there is
   * no live course, so the head of the road is the honest answer.
   */
  const learnerAt = useMemo(() => {
    if (!world) return null;
    const live = world.placements.find((entry) => entry.state === "live");
    return (live ?? world.placements[0])?.position ?? null;
  }, [world]);

  const studyItems: readonly StudySwitchItem[] = useMemo(
    () =>
      studies.map((study) => {
        const own = (nodes ?? []).filter((node) => node.studyId === study.id);
        const done = own.reduce((sum, node) => sum + lessonsDone(node), 0);
        const total = own.reduce((sum, node) => sum + node.lessons, 0);
        return {
          id: study.id,
          title: study.title,
          courseCount: own.length || study.courses.length,
          done,
          total,
        };
      }),
    [studies, nodes, lessonsDone],
  );

  /**
   * The same four rows the switcher shows, plus what the planet's detail card
   * needs. It is a second projection of one source rather than a second source:
   * every number here is counted off `nodes`, and the course names are the
   * spine order the map already walks.
   *
   * There is no blurb, and there is no place to put one — a study in
   * `imported.json` carries an id, a title, a default course and a course list.
   * The honest introduction is what the data actually knows: how big it is, how
   * far in you are, and what the courses are called. Writing a sentence here
   * would be this shell inventing content, which is the one thing it may not do.
   */
  const planetStudies: readonly PlanetStudy[] = useMemo(
    () =>
      studies.map((study) => {
        const own = (nodes ?? []).filter((node) => node.studyId === study.id);
        const ranked = spineOf(study.id).map((entry) => entry.courseId);
        const rank = new Map(ranked.map((courseId, index) => [courseId, index]));
        const ordered = [...own].sort(
          (a, b) =>
            (rank.get(a.courseId) ?? ranked.length + a.depth) -
            (rank.get(b.courseId) ?? ranked.length + b.depth),
        );
        return {
          id: study.id,
          title: study.title,
          courseCount: own.length || study.courses.length,
          lessonCount: own.reduce((sum, node) => sum + node.lessons, 0),
          lessonsDone: own.reduce((sum, node) => sum + lessonsDone(node), 0),
          courseTitles: ordered.map((node) => node.title),
        };
      }),
    [studies, nodes, lessonsDone],
  );

  /**
   * The way back out of a course.
   *
   * It used to say 「回到世界地图」 and the boss was right that it is not one: a
   * world would be everything, and what is behind this button is one project's
   * islands. A category word alone — 系列地图, 课程地图 — still leaves the reader
   * working out which series, and the name is right there to be used. So the
   * button names the place it goes to.
   */
  const backToMapLabel = useMemo(() => {
    const studyId =
      view.kind === "course" || view.kind === "lesson" || view.kind === "settled"
        ? view.studyId
        : focusedStudyId;
    const title = studies.find((entry) => entry.id === studyId)?.title;
    return title ? `← 回到${spacedName(title)}地图` : "← 回到课程地图";
  }, [view, focusedStudyId, studies]);

  const projectName = useMemo(
    () => studies.find((entry) => entry.id === focusedStudyId)?.title ?? "University",
    [focusedStudyId, studies],
  );

  const focusStudy = useCallback(
    (studyId: string) => {
      setMapFocus(studyId);
      if (view.kind === "course" || view.kind === "lesson" || view.kind === "settled") {
        setView({ kind: "world" });
      }
    },
    [view.kind, setView],
  );

  const profileStats = useMemo(() => {
    let lessonsCompleted = 0;
    let passagesRead = 0;
    for (const [key, lesson] of Object.entries(progress.lessons)) {
      if (lesson.completedAt == null && lesson.progress < 1) continue;
      lessonsCompleted += 1;
      const [studyId, courseId, lessonId] = key.split("/");
      if (!studyId || !courseId || !lessonId) continue;
      const found = courseOf(studyId, courseId)
        ?.units.flatMap((unit) => unit.lessons)
        .find((entry) => entry.id === lessonId);
      /*
        Zero where the shelf cannot count citations, which is the authoring
        build — its API sends a summary, not a body. That build has always
        reported 0 here; it now reports 0 for a stated reason.
      */
      passagesRead += found?.evidenceCount ?? 0;
    }
    /*
      A course counts as finished only when every lesson in it is, which needs
      the course's own shape rather than the progress document alone — the
      document knows what was completed, not how many there were to complete.
      `peekCourse` returns only what has already been loaded, so this is the
      count among courses the learner has actually opened; a course they
      finished on another device and never opened here does not appear until
      it loads, which under-counts rather than over-counts.
    */
    const byCourse = new Map<string, Set<string>>();
    for (const [key, lesson] of Object.entries(progress.lessons)) {
      if (lesson.completedAt == null && lesson.progress < 1) continue;
      const [studyId, courseId, lessonId] = key.split("/");
      if (!studyId || !courseId || !lessonId) continue;
      const at = `${studyId}/${courseId}`;
      const done = byCourse.get(at) ?? new Set<string>();
      done.add(lessonId);
      byCourse.set(at, done);
    }
    let coursesFinished = 0;
    for (const [at, done] of byCourse) {
      const [studyId, courseId] = at.split("/");
      const shape = studyId && courseId ? courseOf(studyId, courseId) : null;
      if (!shape) continue;
      const total = shape.units.reduce((sum, unit) => sum + unit.lessons.length, 0);
      if (total > 0 && done.size >= total) coursesFinished += 1;
    }

    return { lessonsCompleted, passagesRead, coursesFinished };
  }, [progress, courseOf]);

  const markers: readonly Marker[] = useMemo(() => {
    if (view.kind === "course" || view.kind === "lesson") {
      return courseMarkers(lessons, {
        // No picking from inside the reader: choosing a stone you are already
        // standing on is not a choice.
        onPick:
          view.kind === "lesson"
            ? undefined
            : (lesson) =>
                setPathOverlay({
                  kind: "node",
                  unitId: lesson.unitId,
                  lessonId: lesson.lessonId,
                  returnFocusTo: labelNodes.current.get(lesson.lessonId) ?? null,
                }),
      });
    }
    if (!world) return [];
    /*
      The study badge that used to float over each archipelago is gone with the
      shared ocean. It answered "which one of these am I looking at", and there
      is only one now — the capsule at the top already says its name, in a place
      that does not scroll away.
    */
    return world.placements.map((entry) => ({
      id: entry.node.courseId,
      position: entry.position.clone().setY(entry.position.y + entry.radius * 0.4 + 1.4),
      text: entry.node.title,
      kind: "course" as const,
      // Same target as the island, so a label and the shape under it cannot
      // disagree about what selecting a course means.
      activate: () => {
        setPicked(entry.node);
        setMapFocus(entry.node.studyId);
      },
    }));
  }, [world, lessons, view]);

  const due = dueCards();
  /*
    The card the panel offers, with its front.

    The scheduler names a card; the shelf says which unit it is in; the text
    itself is content and comes through the port — which is a fetch in the
    authoring build and a memory read in the delivery one. Held as state rather
    than derived, because a fetch cannot be a `useMemo`.
  */
  const dueLocator = useMemo(
    () => (due[0] ? todayCardLocatorOf(studies, due[0]) : null),
    [studies, due[0]?.cardKey],
  );
  const [todayCard, setTodayCard] = useState<TodayCard | null>(null);
  useEffect(() => {
    const card = due[0];
    if (!dueLocator || !card) {
      setTodayCard(null);
      return;
    }
    let alive = true;
    void contentPort
      .card(dueLocator)
      .then((body) => {
        if (!alive) return;
        setTodayCard({
          ...dueLocator,
          front: body.front,
          contentRevision: body.contentRevision,
          dueAt: new Date(card.dueAt).toISOString(),
        });
      })
      .catch(() => {
        // A card whose body cannot be read is not a card to offer. The panel
        // falls back to the next lesson, which is the honest thing on screen.
        if (alive) setTodayCard(null);
      });
    return () => {
      alive = false;
    };
  }, [dueLocator, due[0]?.dueAt]);

  const todayData = useMemo<TodaySectionData>(
    () => ({
      card: todayCard,
      nextLesson: nextLessonOf(studies, nextUpProgress?.next ?? null, progressPort),
      dueCount: due.length,
      focus: null,
      issues: [],
    }),
    [studies, todayCard, due, nextUpProgress],
  );
  const todayReview = useMemo(() => createReviewCardPort(contentPort, progressPort), []);
  const todayVocabularyReview = useMemo(
    () => createVocabularyReviewPort(progressPort, LEXICON),
    [],
  );
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
    // A picker with nothing to pick is not a control. Null here means the
    // catalogue is empty, which is the only case where no series can be named.
    projectControl: focusedStudyId ? (
      <StudySwitcher
        studies={studyItems}
        focusedId={focusedStudyId}
        onSelect={focusStudy}
        onOpenPlanet={() => setView({ kind: "planet" })}
      />
    ) : undefined,
  });

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
  const framed = useMemo(
    () => frameWorld(learnerAt, roadAhead(world?.placements ?? [], learnerAt)),
    [learnerAt, world],
  );

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
  // `frameCourse`, not a second copy: the authoring shell needs the same shot,
  // and a camera that exists in one app file is a camera the other cannot have.
  const roadCamera = useMemo(
    () => (view.kind === "course" || view.kind === "lesson" ? frameCourse(lessons) : null),
    [view.kind, lessons],
  );

  const cameraFrom: readonly [number, number, number] = roadCamera
    ? roadCamera.cameraFrom
    : framed.cameraFrom;
  const lookAt: readonly [number, number, number] = roadCamera ? roadCamera.lookAt : framed.lookAt;

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
  const nextUpMeta = todayNode ? todayMeta(todayNode.studyTitle, nextUpProgress) : null;
  /** The very lesson the rail's panel offers, so the phone offers the same one. */
  const todayLesson = todayData.nextLesson;

  const presenceView = presenceViewKey(view);
  const presenceLocation = useMemo(() => {
    if (view.kind === "lesson" || view.kind === "settled") {
      return { studyId: view.studyId, courseId: view.courseId, lessonId: view.lessonId };
    }
    if (view.kind === "course") {
      const live = lessons.find((lesson) => lesson.state === "live");
      return {
        studyId: view.studyId,
        courseId: view.courseId,
        lessonId: live?.lessonId ?? null,
      };
    }
    if (todayNode) {
      return {
        studyId: todayNode.studyId,
        courseId: todayNode.courseId,
        lessonId: null,
      };
    }
    return null;
  }, [view, lessons, todayNode]);
  const companionAnchors = useMemo(() => {
    if (view.kind === "course" || view.kind === "lesson") {
      return lessons.map((lesson) => ({
        id: `lesson:${lesson.lessonId}`,
        position: lesson.position,
      }));
    }
    if (!world) return [];
    return world.placements.map((entry) => ({
      id: `course:${entry.node.studyId}/${entry.node.courseId}`,
      position: entry.position,
    }));
  }, [view.kind, lessons, world]);
  const companionSurface = view.kind === "course" || view.kind === "lesson" ? "course" : "world";

  /*
    One stage for every scene, mounted once.

    There used to be two: `sharedWorldStage` for the map and a hand-written
    copy beside it for a course path, swapped by `view.kind`. Swapped, not
    hidden — so stepping from the map into a course tore down a WebGL context
    and built another, on the transition a learner makes more than any other,
    and the seventy lines of label markup underneath were maintained twice.
    The authoring shell had been on the shared component for a while; this is
    the delivery shell catching up to it.
  */
  const inCourse = view.kind === "course" || view.kind === "lesson";
  const stage =
    view.kind === "avatar-lab" ? null : (
      <WorldMapCanvas
        hidden={!SHOWS_THE_MAP.has(view.kind)}
        paused={!showMap}
        // A course path is read at a shallower pitch than a world of islands.
        polar={view.kind === "world" ? WORLD_POLAR : COURSE_POLAR}
        // No world in a course view: the path below replaces it rather than
        // sitting behind it.
        world={view.kind === "world" ? world : null}
        cameraFrom={cameraFrom}
        lookAt={lookAt}
        learnerAt={learnerAt}
        skyStudyId={focusedStudyId}
        markers={markers}
        /*
          This shell's course markers key on `courseId`, and the projector
          looks the same id up in `markers`. Inventing a second key in a course
          view would place the follow card at (0,0), which is why it is null
          there rather than `picked`.
        */
        followId={view.kind === "world" && picked ? picked.courseId : null}
        followNode={pickCardRef}
        onPick={(node) => {
          setPicked(node);
          setMapFocus(node.studyId);
        }}
        onHover={(node) => setHovered(node ? node.title : null)}
        onSceneReady={onSceneReady}
        onSceneBusy={onSceneBusy}
        onPointerMissed={dismissPick}
        stageChildren={
          <>
            {/*
              A separate probe from LabelProbe on purpose: companions must not
              compete with course names for the label budget, and a companion
              that lost that competition would silently stop existing.
            */}
            <CompanionProbe anchors={companionAnchors} nodes={companionNodes.current} />
            {inCourse && lessons.length > 0 ? (
              <CourseScene
                lessons={lessons}
                skyStudyId={inCourse ? view.studyId : null}
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
          </>
        }
        underlay={
          wide ? null : view.kind === "course" && course ? (
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
                {backToMapLabel}
              </button>
            </aside>
          ) : null
        }
        overlay={
          <>
            <PresenceLayer
              port={presencePort}
              surface={companionSurface}
              viewKey={presenceView}
              attach={(userId, element) => {
                if (element) companionNodes.current.set(userId, element);
                else companionNodes.current.delete(userId);
              }}
            />
            {/*
              「今天」 at phone width, where there is no rail to hold the panel.

              It used to name the *course* and open the course path, while the
              rail's panel named the lesson and opened the lesson. One product,
              one button, two different answers to 「今天要做什么」 — decided by
              how wide the window happened to be. It names the lesson now, from
              the same data the panel reads, and goes to the same place.
            */}
            {view.kind === "world" && !wide && todayLesson && !picked ? (
              <aside className="nextup">
                <p className="nextup__eyebrow">
                  {progress.streak.days > 0 ? "接着上次" : "从这里开始"}
                </p>
                <h2 className="nextup__title">{todayLesson.lessonTitle}</h2>
                <p className="nextup__meta">{nextUpMeta}</p>
                <button
                  className="primary block"
                  onClick={() =>
                    setView({
                      kind: "lesson",
                      studyId: todayLesson.studyId,
                      courseId: todayLesson.courseId,
                      unitId: todayLesson.unitId,
                      lessonId: todayLesson.lessonId,
                    })
                  }
                >
                  {/*
                    The same words the rail's 「今天」 panel uses, from the same
                    function. This card is what replaces that panel below the
                    rail's breakpoint, and it used to say 「开始第一节」/「继续」
                    while the panel said 「开始学习」/「继续学习」 — one action,
                    two vocabularies, chosen by window width.
                  */}
                  {todayCtaLabel(todayData.nextLesson?.progress)} →
                </button>
              </aside>
            ) : null}
            {view.kind === "world" && picked ? (
              <CoursePickCard
                title={picked.title}
                studyTitle={picked.studyTitle}
                lessons={picked.lessons}
                depth={picked.depth}
                prerequisiteCount={picked.prerequisiteCourseIds.length}
                onEnter={() =>
                  setView({
                    kind: "course",
                    studyId: picked.studyId,
                    courseId: picked.courseId,
                  })
                }
                onDismiss={dismissPick}
                cardRef={pickCardRef}
              />
            ) : null}
          </>
        }
        /*
          The hint has to describe the controls that exist. It said 「右键旋转」
          for as long as rotation had been disabled — the camera is locked to a
          fixed pitch on purpose, the way a map app locks it, and telling a
          learner to right-drag taught them the app was broken.
        */
        hint={hovered ?? MAP_CONTROLS_HINT}
        loading={mapCover ? <LoadingTrivia /> : null}
      />
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
      {showMap ? (
        <TodaySection
          data={todayData}
          review={todayReview}
          vocabularyReview={todayVocabularyReview}
          onOpenLesson={(locator) =>
            setView({
              kind: "lesson",
              studyId: locator.studyId,
              courseId: locator.courseId,
              unitId: locator.unitId,
              lessonId: locator.lessonId,
            })
          }
          onReviewed={async () => {
            await progressPort.flush();
          }}
        />
      ) : null}
      {view.kind === "planet" ? (
        <PlanetRail
          studies={planetStudies}
          selectedId={focusedStudyId}
          onSelect={setMapFocus}
          onEnter={(studyId) => {
            setMapFocus(studyId);
            setView({ kind: "world" });
          }}
          onClose={() => setView({ kind: "world" })}
        />
      ) : null}
      {view.kind === "settings" ? <SettingsSubnav /> : null}
    </>
  );

  const main = (
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
                  {backToMapLabel}
                </button>
              </aside>
            ) : null}
          </div>
        ) : null}
      </div>
      {/*
        Which version of the project this campus teaches, and the way into the
        UA graph. Under the stage rather than over it: an overlay child fills
        the canvas's box, and a grid with pointer events on it swallows every
        click aimed at an island — measured, by G2 failing to reach a stone.
      */}
      {AUTHORING && view.kind === "world" ? <MapNotes studyId={focusedStudyId} /> : null}
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
          />
        </Suspense>
      ) : null}

      {view.kind === "review" ? (
        <TodaySection
          data={todayData}
          review={todayReview}
          vocabularyReview={todayVocabularyReview}
          onOpenLesson={(locator) =>
            setView({
              kind: "lesson",
              studyId: locator.studyId,
              courseId: locator.courseId,
              unitId: locator.unitId,
              lessonId: locator.lessonId,
            })
          }
          onReviewed={async () => {
            await progressPort.flush();
          }}
        />
      ) : null}

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
        which is also why `#/studio` lands on the map there rather than on an
        empty column.
      */}
      {AUTHORING && view.kind === "studio" ? (
        <StudioScreen
          studyId={focusedStudyId}
          onSelectStudy={focusStudy}
          onOpenLesson={(locator) => setView({ kind: "lesson", ...locator })}
        />
      ) : null}
      {view.kind === "league" ? <LeagueScreen document={progress} /> : null}
      {view.kind === "quests" ? <QuestsScreen document={progress} /> : null}
      {view.kind === "plans" ? <PlansScreen /> : null}
      {view.kind === "settings" ? (
        <SettingsScreen presence={presencePort} progress={progressPort} />
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
              <ProfileAvatar />
            </Suspense>
          }
          account={<AccountPanel identity={identityPort} />}
          badges={<BadgeWall document={progress} coursesFinished={profileStats.coursesFinished} />}
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
              : todayNode
                ? toHash({
                    kind: "course",
                    studyId: todayNode.studyId,
                    courseId: todayNode.courseId,
                  })
                : "#/"
          }
        />
      ) : null}
    </>
  );

  /*
    An empty shelf, after every hook rather than before some of them.

    The delivery build used to answer this from a module constant, so the
    branch could never flip between two renders. The shelf arrives over time
    now — a fetch in delivery, an API in authoring — and an early return above
    the map's `useMemo`s would change the hook count on the render it lands,
    which React reports as "rendered fewer hooks than expected" rather than as
    the routing mistake it is.
  */
  if (shelfError || (shelf && shelf.studies.length === 0)) {
    return (
      <main className="empty">
        <h1>{shelfError ? "课程读不出来" : "书架上还没有课"}</h1>
        <p>{shelfError ?? EMPTY_SHELF_HINT}</p>
      </main>
    );
  }

  if (isBareView(view) && view.kind === "lesson") {
    const reading: LessonRef = {
      studyId: view.studyId,
      courseId: view.courseId,
      unitId: view.unitId,
      lessonId: view.lessonId,
    };
    return (
      <div className="app">
        <PresenceSession port={presencePort} location={presenceLocation} viewKey={presenceView} />
        <Suspense fallback={<RouteFallback />}>
          <LessonScreen
            locator={reading}
            course={course}
            returnDepth={returnStack.length}
            onFollowLink={(target) => {
              /*
                A detour is a detour. Jumping to the lesson about how browsers
                parse HTML has to be able to come back, or the reader stops
                clicking and the feature costs nothing but ink.
              */
              setReturnStack((current) => [...current, reading].slice(-LINK_RETURN_DEPTH));
              setView({
                kind: "lesson",
                studyId: view.studyId,
                courseId: target.courseId,
                unitId: target.unitId,
                lessonId: target.lessonId,
              });
            }}
            onReturn={() => {
              const previous = returnStack.at(-1);
              if (!previous) return;
              setReturnStack((current) => current.slice(0, -1));
              setView({ kind: "lesson", ...previous });
            }}
            onOpenLesson={(next) => {
              // Prev/next is a decision to move on, not a detour, so the offer
              // to go back stops pointing at something nobody is thinking about.
              setReturnStack([]);
              setView({ kind: "lesson", ...next });
            }}
            onBack={() => {
              setReturnStack([]);
              setView({ kind: "course", studyId: view.studyId, courseId: view.courseId });
            }}
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
        /*
          The workbench's own way in, behind 更多 and only where there is a
          workbench. `G` compares the rail's own destinations between the two
          builds and deliberately excludes what sits behind 更多 — that is the
          one place a real difference between them is allowed to show.
        */
        {...(AUTHORING ? { extraMoreItems: [STUDIO_MORE_ITEM] } : {})}
        counters={counters}
        identity={<RailIdentity onOpen={() => setView({ kind: "me" })} />}
        aside={aside}
        asideLabel={view.kind === "settings" ? "设置" : view.kind === "planet" ? "选课" : "今天"}
      >
        <PresenceSession port={presencePort} location={presenceLocation} viewKey={presenceView} />
        {main}
      </UniversityShell>
    </div>
  );
}
