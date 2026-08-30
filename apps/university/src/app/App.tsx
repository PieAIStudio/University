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
 * One world renderer at a time, and small avatar viewports alongside it.
 * `Stage` owns the world map and stays mounted across the two map levels; the
 * temporary `/avatar-lab` route unmounts it and mounts its own studio canvas
 * instead of beside it, so two world-sized renderers never share a frame. The
 * avatar viewports are a different thing and do sit alongside: the navigation
 * avatar is mounted on every screen and the profile page adds a third. That is
 * fine — what is not fine is an unnoticed fifth, because that is how you end up
 * with a colour pipeline nobody can count. `Stage.tsx` carries the registry of
 * every mount and `scripts/check-canvas-registry.mjs` fails the build on one
 * that is not in it. A rule that is counted survives a refactor; this comment
 * claimed there was exactly one until somebody counted.
 */
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  activeIdForView,
  isBareView,
  lessonRefKey,
  progressSourceOf,
  type FeedbackContext,
  type LessonRef,
} from "@pieai/university-core";
import { LoadingTrivia, useMapCover } from "@pieai/university-ui/loading/LoadingTrivia.js";
import "@pieai/university-ui/loading/loading-trivia.css";
import { UniversityShell } from "@pieai/university-ui/navigation/UniversityShell.js";
import {
  StudySwitcher,
  type LearnerNavigationFocus,
} from "@pieai/university-ui/navigation/StudySwitcher.js";
import { SettingsSubnav } from "@pieai/university-ui/navigation/empty.js";
import { LevelProgress } from "@pieai/university-ui/navigation/screens.js";
import { CoursePickCard } from "@pieai/university-ui/path/CoursePickCard.js";
import { coursePickStatsOf } from "@pieai/university-ui/path/course-pick-stats.js";
import { CourseScene } from "@pieai/university-world/Maps.js";
import { type CourseNode } from "@pieai/university-world/course.js";
import { RailIdentity } from "@pieai/university-world/avatar.js";

import { AUTHORING, CAMPUS_NAME, EMPTY_SHELF_HINT } from "../mode";
import { contentPort, feedbackPort, reviewReminderPort, sourceAccessPort } from "../ports/index";
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
import { LessonScreen, RouteFallback } from "../screens/lazy";
import { FeedbackNote } from "@pieai/university-ui/feedback/FeedbackNote.js";

import { todayCtaLabel, TodaySection, todayMeta } from "@pieai/university-ui/today/TodaySection.js";
import { LINK_RETURN_DEPTH } from "@pieai/university-ui/lesson/LessonReader.js";
import { COURSE_POLAR, MAP_CONTROLS_HINT, WORLD_POLAR } from "@pieai/university-world/controls.js";
import { CourseIsland } from "./CourseIsland.js";
import { PlanetRail } from "@pieai/university-world/planet.js";
import { SHOWS_THE_MAP } from "./map-controls";
import { useCourseProgress } from "./course-progress";
import { shellConfigForView, useMinWidth } from "./shell-route";
import { useProfileStats } from "./profile-stats";
import { useRoute } from "./use-route";
import { useShelf } from "./use-shelf";
import { useWorldMarkers, useWorldModel, type PathOverlay } from "./world-model";
import { universityCounters } from "@pieai/university-ui/navigation/counters.js";
import { STUDIO_MORE_ITEM } from "@pieai/university-ui/navigation/slots.js";
import { PresenceLayer, PresenceSession, presenceViewKey } from "@pieai/university-ui/presence.js";
import { watchThemePreference } from "@pieai/university-ui/theme.js";
import { CompanionProbe } from "@pieai/university-world/companion-probe.js";
import {
  islandLookCameraForShot,
  resolveIslandLookDebug,
} from "@pieai/university-world/island-look.js";
import { WorldMapCanvas } from "@pieai/university-world/WorldMapCanvas.js";
import { MainRouter } from "./MainRouter";
import { usePageMetadata } from "./page-metadata";
import { WorldSourceControls } from "../learner/WorldSourceControls";
import { useAnalyticsPorts } from "./analytics-ports";
import { useAvatarPreferences } from "./avatar-preferences";
import { useCoursePathActions } from "./course-path-actions";
import { useIslandLookSource, useIslandLookView } from "./island-look-view";
import { useMistakeSummary } from "./mistake-summary";
import { useSceneCamera } from "./scene-camera";
import { useSceneInteraction } from "./scene-interaction";
import { useStudyContext } from "./study-context";
import { useTodaySectionData } from "./today-section-data";
import { trackEvent, type AnalyticsEvent } from "../analytics/productAnalytics";

type FeedbackContextSeed = Pick<
  FeedbackContext,
  "locator" | "contentRevision" | "exerciseAttemptCount" | "signedIn"
>;

export function App() {
  const progress = useSyncExternalStore(subscribe, snapshot);
  const identityStatus = useSyncExternalStore(
    identityPort.subscribe,
    identityPort.status,
    identityPort.status,
  );
  const avatarSignedIn = identityStatus.kind === "anonymous" || identityStatus.kind === "signed_in";
  const { avatarRecipe, saveAvatarRecipe } = useAvatarPreferences({
    accountAvatarRecipe: progress.account.preferences.avatarRecipe,
    signedIn: avatarSignedIn,
  });
  useEffect(
    () =>
      progressPort.subscribe(() =>
        presencePort.setSharesPresence(progressPort.accountData().preferences.sharesPresence),
      ),
    [],
  );
  const { shelf, studyNames, shelfError, studies, nodes, courseOf } = useShelf();
  const { view: routeView, setView } = useRoute();
  const wide = useMinWidth(768);
  // The look judge is a DEV-only URL input. A seed identifies the course whose
  // existing blueprint should be measured; it never creates a second course or
  // a second layout source.
  const lookDebug = import.meta.env.DEV ? resolveIslandLookDebug() : null;
  const { lookSeedNode, view } = useIslandLookView({ lookDebug, nodes, routeView });
  const shellConfig = shellConfigForView(view);
  /**
   * The learner's transient navigation choice. `undefined` means "not chosen
   * yet" — fall back to the learner's next course so the name, the sky and the
   * eye agree. It is never written to the authoring config or account data.
   */
  const [navigationFocus, setNavigationFocus] = useState<LearnerNavigationFocus>(undefined);
  const [hovered, setHovered] = useState<string | null>(null);
  const { mapInteracted, sceneReady, onSceneReady, onSceneBusy, onMapInteract } =
    useSceneInteraction();
  const [picked, setPicked] = useState<CourseNode | null>(null);
  const pickedCourse = picked ? courseOf(picked.studyId, picked.courseId) : null;
  const pickedStats = pickedCourse ? coursePickStatsOf(pickedCourse) : null;
  // Screen 02/03: a path card sits on the course map. It is not a route —
  // confirming is what changes the URL, not pointing at a stone.
  const [pathOverlay, setPathOverlay] = useState<PathOverlay | null>(null);
  // How many lessons were finished the moment a lesson was passed. Held here
  // rather than derived later, and deliberately absent when the settlement is
  // reached by its own URL — arriving at `/done` from a bookmark is not
  // evidence that anything just grew, so that screen stays quiet about the map.
  const [grewFrom, setGrewFrom] = useState<{ key: string; doneBefore: number } | null>(null);
  // 「以后再说」 belongs to this completion event, not to the component mount.
  // Leaving a settlement and coming back must not turn the same value into a
  // second prompt; a later completed lesson resets the key below.
  const [reviewReminderDismissedFor, setReviewReminderDismissedFor] = useState<string | null>(null);
  /** Lessons a cross-lesson link led away from, innermost last. */
  const [returnStack, setReturnStack] = useState<readonly LessonRef[]>([]);
  /** Counts avatar clicks so the account door also responds while already on `/me`. */
  const [accountFocusRequest, setAccountFocusRequest] = useState(0);
  const openAccount = useCallback(() => {
    setAccountFocusRequest((current) => current + 1);
    setView({ kind: "me" });
  }, [setView]);
  const lastRouteAnalyticsKey = useRef<string | null>(null);
  const reviewDueAnalyticsReported = useRef(false);
  const source = useMemo(() => progressSourceOf(progressPort), []);
  const { analyticsIdentityPort, analyticsPaymentPort, onWorthwhileProgress } = useAnalyticsPorts();
  const { mistakes, uncorrectedMistakeCount } = useMistakeSummary(progress);

  useEffect(() => bindProgressToIdentity(progressPort, identityPort, progressRemoteStore), []);

  useEffect(
    () => watchThemePreference(progress.account.preferences.theme),
    [progress.account.preferences.theme],
  );

  useEffect(() => {
    if (view.kind !== "course") setPathOverlay(null);
    if (view.kind !== "settled") {
      // The settlement is the only place that can prove a fresh value event.
      // Once the learner leaves it, an old URL must not make the reminder ask
      // again when the learner later returns to that lesson.
      setGrewFrom(null);
      setReviewReminderDismissedFor(null);
    }
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
  usePageMetadata(view, course);

  const feedbackLocator: LessonRef | null =
    view.kind === "lesson" || view.kind === "settled"
      ? {
          studyId: view.studyId,
          courseId: view.courseId,
          unitId: view.unitId,
          lessonId: view.lessonId,
        }
      : null;
  const feedbackLesson = feedbackLocator
    ? (course?.units
        .find((unit) => unit.id === feedbackLocator.unitId)
        ?.lessons.find((lesson) => lesson.id === feedbackLocator.lessonId) ?? null)
    : null;
  const feedbackContext = useMemo<FeedbackContextSeed>(() => {
    const contentRevision = feedbackLesson?.contentRevision ?? null;
    const exerciseAttemptCount =
      feedbackLocator && contentRevision !== null
        ? Object.values(progress.exerciseAttempts).filter(
            (attempt) =>
              lessonRefKey(attempt.locator) === lessonRefKey(feedbackLocator) &&
              attempt.contentRevision === contentRevision,
          ).length
        : 0;
    return {
      locator: feedbackLocator,
      contentRevision,
      exerciseAttemptCount,
      signedIn: avatarSignedIn,
    };
  }, [avatarSignedIn, feedbackLesson, feedbackLocator, progress.exerciseAttempts]);

  const {
    lessonsDone,
    courseProgress,
    courseProgressForNode,
    lessons,
    viewedProgress,
    nextUpProgress,
    todayNode,
  } = useCourseProgress({ course, courseOf, nodes, progress, source, view });

  const labelNodes = useRef(new Map<string, HTMLElement>());
  const pickCardRef = useRef<HTMLElement | null>(null);
  const dismissPick = useCallback(() => setPicked(null), []);
  const companionNodes = useRef(new Map<string, HTMLElement>());

  const { focusedStudyId, world, learnerAt, studyItems, planetStudies, backToMapLabel } =
    useWorldModel({
      courseProgress,
      lessonsDone,
      navigationFocus:
        import.meta.env.DEV && lookDebug?.shot === "world-design"
          ? (lookSeedNode?.studyId ?? navigationFocus)
          : navigationFocus,
      nodes,
      studies,
      todayNode,
      view,
    });

  const { projectName, focusedTodayNode, focusedNextUpProgress, focusStudy } = useStudyContext({
    courseProgress,
    courseProgressForNode,
    focusedStudyId,
    nodes,
    setNavigationFocus,
    setView,
    studies,
    view,
  });

  const profileStats = useProfileStats({ progress, courseOf });

  const markers = useWorldMarkers({
    labelNodes,
    lessons,
    setPathOverlay,
    setPicked,
    view,
    world,
  });

  const due = dueCards();
  const { todayCard, todayData, todayReview, todayVocabularyReview } = useTodaySectionData({
    due,
    focusedNextUpProgress,
    studies,
  });
  const showMap = SHOWS_THE_MAP.has(view.kind);
  const studioMap = view.kind === "studio" && view.section === "map";
  const reviewVisible = showMap || view.kind === "review";

  useEffect(() => {
    let event: AnalyticsEvent | null = null;
    let key: string | null = null;
    if (view.kind === "course") {
      key = `course:${view.studyId}/${view.courseId}`;
      event = {
        name: "course_opened",
        studyId: view.studyId,
        courseId: view.courseId,
      };
    } else if (view.kind === "lesson") {
      key = `lesson:${view.studyId}/${view.courseId}/${view.lessonId}`;
      event = {
        name: "lesson_opened",
        studyId: view.studyId,
        courseId: view.courseId,
        lessonId: view.lessonId,
      };
    } else if (view.kind === "settled") {
      key = `settled:${view.studyId}/${view.courseId}/${view.lessonId}`;
      event = {
        name: "settlement_shown",
        studyId: view.studyId,
        courseId: view.courseId,
        lessonId: view.lessonId,
      };
    } else if (view.kind === "plans") {
      key = "plans";
      event = { name: "plans_opened" };
    }
    if (!event) {
      lastRouteAnalyticsKey.current = null;
      return;
    }
    if (key === lastRouteAnalyticsKey.current) return;
    lastRouteAnalyticsKey.current = key;
    trackEvent(event);
  }, [view]);

  useEffect(() => {
    if (due.length === 0) {
      reviewDueAnalyticsReported.current = false;
      return;
    }
    if (!reviewVisible || !todayCard || reviewDueAnalyticsReported.current) return;
    reviewDueAnalyticsReported.current = true;
    trackEvent({ name: "review_due_opened", cardCount: due.length });
  }, [due.length, reviewVisible, todayCard]);

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

  const { cameraFrom, lookAt } = useSceneCamera({
    learnerAt,
    lessons,
    viewKind: view.kind,
    world,
    wide,
  });

  const pathUnitId =
    pathOverlay?.unitId ??
    lessons.find((lesson) => lesson.state === "live")?.unitId ??
    course?.units[0]?.id;
  const pathUnit = course?.units.find((unit) => unit.id === pathUnitId);
  const pathLesson =
    pathOverlay?.kind === "node"
      ? pathUnit?.lessons.find((lesson) => lesson.id === pathOverlay.lessonId)
      : undefined;

  const { openUnitOverlay, openCourseLesson, backToCourseMap } = useCoursePathActions({
    setPathOverlay,
    setView,
  });
  const courseIslandProps =
    view.kind === "course" && course
      ? {
          course,
          studyId: view.studyId,
          viewedProgress,
          pathUnit,
          unitOverlayOpen: pathOverlay?.kind === "unit",
          backToMapLabel,
          onOpenUnitOverlay: openUnitOverlay,
          onBackToMap: backToCourseMap,
          onOpenLesson: openCourseLesson,
        }
      : null;

  // One sentence, both widths. The rail's TodayCard and the floating .nextup
  // overlay used to format this independently, and the overlay kept quoting
  // the catalogue size after the rail had stopped.
  const nextUpMeta = focusedTodayNode
    ? todayMeta(focusedTodayNode.studyTitle, focusedNextUpProgress)
    : null;
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
    if (focusedTodayNode) {
      return {
        studyId: focusedTodayNode.studyId,
        courseId: focusedTodayNode.courseId,
        lessonId: null,
      };
    }
    return null;
  }, [view, lessons, focusedTodayNode]);
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
  const lookShotIsCourse = import.meta.env.DEV && (lookDebug?.shot?.startsWith("course-") ?? false);
  const lookViewport = {
    width: typeof window === "undefined" ? (wide ? 1440 : 390) : window.innerWidth,
    // The phone shell gives the stage `min(70dvh, 720px)`, so the browser
    // viewport is taller than the WebGL drawing surface used by the camera.
    // Fit the debug shot to the actual stage envelope, not to the DOM below it.
    height:
      typeof window === "undefined"
        ? wide
          ? 900
          : Math.min(844 * 0.7, 720)
        : wide
          ? window.innerHeight
          : Math.min(window.innerHeight * 0.7, 720),
  };
  const lookBounds = lookShotIsCourse
    ? {
        halfX: lessons[0]?.blueprint.bounds.halfX ?? 1,
        halfZ: lessons[0]?.blueprint.bounds.halfZ ?? 1,
        outline: lessons[0]?.blueprint.outline,
      }
    : { halfX: world?.extent ?? 1, halfZ: world?.extent ?? 1 };
  const fixedCamera =
    import.meta.env.DEV &&
    lookDebug?.shot &&
    ((lookShotIsCourse && inCourse) || (lookDebug.shot === "world-design" && view.kind === "world"))
      ? islandLookCameraForShot(lookDebug.shot, lookBounds, lookViewport)
      : null;
  const stageCameraFrom = fixedCamera?.cameraFrom ?? cameraFrom;
  const stageLookAt = fixedCamera?.lookAt ?? lookAt;
  const lookSource = useIslandLookSource({
    inCourse,
    lessons,
    lookDebug,
    lookShotIsCourse,
    viewKind: view.kind,
    world,
  });
  const stage =
    view.kind === "avatar-lab" || studioMap ? null : (
      <WorldMapCanvas
        hidden={!SHOWS_THE_MAP.has(view.kind)}
        paused={!showMap}
        // A course path is read at a shallower pitch than a world of islands.
        polar={view.kind === "world" ? WORLD_POLAR : COURSE_POLAR}
        // No world in a course view: the path below replaces it rather than
        // sitting behind it.
        world={view.kind === "world" ? world : null}
        cameraFrom={stageCameraFrom}
        lookAt={stageLookAt}
        learnerAt={learnerAt}
        avatarRecipe={avatarRecipe}
        avatarSignedIn={avatarSignedIn}
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
        }}
        onHover={(node) => setHovered(node ? node.title : null)}
        onInteract={onMapInteract}
        onSceneReady={onSceneReady}
        onSceneBusy={onSceneBusy}
        onPointerMissed={dismissPick}
        fixedCamera={fixedCamera}
        postProcessing={import.meta.env.DEV && lookDebug?.shot ? lookDebug.post : true}
        lookSource={lookSource}
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
                avatarRecipe={avatarRecipe}
                avatarSignedIn={avatarSignedIn}
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
        underlay={wide ? null : courseIslandProps ? <CourseIsland {...courseIslandProps} /> : null}
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
                <div className="nextup__context-row">
                  <p className="nextup__meta">{nextUpMeta}</p>
                  <WorldSourceControls studyId={focusedStudyId} sourceAccess={sourceAccessPort} />
                </div>
                <GameButton
                  variant="primary"
                  className="nextup__primary"
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
                </GameButton>
              </aside>
            ) : null}
            {view.kind === "world" && picked && pickedCourse && pickedStats ? (
              <CoursePickCard
                title={picked.title}
                studyTitle={picked.studyTitle}
                depth={picked.depth}
                prerequisiteCount={picked.prerequisiteCourseIds.length}
                objectives={pickedCourse.objectives}
                stats={pickedStats}
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
        hintVisible={Boolean(hovered) || !mapInteracted}
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
  /*
    One 「今天」 panel, in two places it can appear.

    It hangs off the rail while the map is up, and it is the body of the
    review page. Those are two placements, not two panels — the element was
    written out twice with byte-identical props, which is how the course
    island came to have a 分级测验 on one side and not the other.
  */
  const todaySection = (
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
      contextAction={
        showMap && wide && focusedStudyId ? (
          <WorldSourceControls studyId={focusedStudyId} sourceAccess={sourceAccessPort} />
        ) : null
      }
    />
  );

  const aside = (
    <>
      {showMap ? todaySection : null}
      {view.kind === "planet" ? (
        <PlanetRail
          studies={planetStudies}
          selectedId={focusedStudyId}
          onSelect={setNavigationFocus}
          onEnter={(studyId) => {
            setNavigationFocus(studyId);
            setView({ kind: "world" });
          }}
          onClose={() => setView({ kind: "world" })}
        />
      ) : null}
      {view.kind === "settings" ? <SettingsSubnav /> : null}
    </>
  );

  const main = (
    <MainRouter
      contentPort={contentPort}
      course={course}
      courseIslandProps={courseIslandProps}
      focusedStudyId={focusedStudyId}
      focusStudy={focusStudy}
      grewFrom={grewFrom}
      avatarRecipe={avatarRecipe}
      avatarSignedIn={avatarSignedIn}
      onAvatarRecipeChange={saveAvatarRecipe}
      onWorthwhileProgress={onWorthwhileProgress}
      reviewReminderDismissedFor={reviewReminderDismissedFor}
      onDismissReviewReminder={setReviewReminderDismissedFor}
      identityPort={analyticsIdentityPort}
      accountFocusRequest={accountFocusRequest}
      paymentPort={analyticsPaymentPort}
      mistakes={mistakes}
      nextUpProgress={nextUpProgress}
      pathLesson={pathLesson}
      pathOverlay={pathOverlay}
      pathUnit={pathUnit}
      planetStudies={planetStudies}
      presencePort={presencePort}
      reviewReminderPort={reviewReminderPort}
      profileStats={profileStats}
      progress={progress}
      progressPort={progressPort}
      setNavigationFocus={setNavigationFocus}
      setPathOverlay={setPathOverlay}
      setView={setView}
      shelf={shelf}
      studies={studies}
      nodes={nodes}
      world={world}
      courseProgress={courseProgress}
      showMap={showMap}
      stage={stage}
      studyNames={studyNames}
      todayNode={todayNode}
      todaySection={todaySection}
      uncorrectedMistakeCount={uncorrectedMistakeCount}
      view={view}
      wide={wide}
    />
  );
  const feedbackSurface = (
    <FeedbackNote
      shell={CAMPUS_NAME}
      port={feedbackPort}
      context={feedbackContext}
      lessonTitle={feedbackLesson?.title ?? null}
    />
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
      <>
        <main className="empty">
          <h1>{shelfError ? "课程读不出来" : "书架上还没有课"}</h1>
          <p>{shelfError ?? EMPTY_SHELF_HINT}</p>
        </main>
        {feedbackSurface}
      </>
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
      <>
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
              onWorthwhileProgress={onWorthwhileProgress}
              onSettled={(doneBefore) => {
                const key = `${view.studyId}/${view.courseId}/${view.lessonId}`;
                setGrewFrom({ key, doneBefore });
                setReviewReminderDismissedFor(null);
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
        {feedbackSurface}
      </>
    );
  }

  return (
    <>
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
          counters={shellConfig.showLearnerChrome ? counters : undefined}
          identity={
            shellConfig.showLearnerChrome ? (
              <>
                <RailIdentity
                  recipe={avatarRecipe}
                  signedIn={avatarSignedIn}
                  onOpen={openAccount}
                />
                <LevelProgress totalXp={progress.totalXp} rail />
              </>
            ) : null
          }
          aside={shellConfig.showContextAside ? aside : undefined}
          asideLabel={view.kind === "settings" ? "设置" : view.kind === "planet" ? "选课" : "今天"}
        >
          <PresenceSession port={presencePort} location={presenceLocation} viewKey={presenceView} />
          {main}
        </UniversityShell>
      </div>
      {feedbackSurface}
    </>
  );
}
