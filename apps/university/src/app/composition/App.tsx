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
import { arriveAt } from "../../house/store";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  activeIdForView,
  isBareView,
  learningNodeId,
  learningSegments,
  lessonsWithDueCards,
  progressSourceOf,
  type View,
  keepsakeForLesson,
} from "@pieai/university-core";
import { useMapCoverState } from "@pieai/university-ui/loading/LoadingTrivia.js";
import "@pieai/university-ui/loading/loading-trivia.css";
import { RecoveryState, type RecoveryReason } from "@pieai/university-ui/loading/RecoveryState.js";
import { UniversityShell } from "@pieai/university-ui/navigation/UniversityShell.js";
import {
  StudySwitcher,
  type LearnerNavigationFocus,
} from "@pieai/university-ui/navigation/StudySwitcher.js";
import { SettingsSubnav } from "@pieai/university-ui/navigation/empty.js";
import { MapEntryAction, type MapEntryLock } from "@pieai/university-ui/path/MapEntryAction.js";
import {
  MapInformation,
  courseInformation,
  lessonInformation,
  planetInformation,
  studyInformation,
  type MapInformationData,
} from "../map/MapInformation";
import {
  MapQuickActions,
  mapDestinations,
  mapQuickCommands,
  useMapShortcuts,
} from "../map/MapQuickActions";
import type { LessonPlacement } from "@pieai/university-world/Maps.js";
import {
  learningSiteLocked,
  monsterAtStop,
  type MonsterRole,
} from "@pieai/university-world/learning-nodes.js";
import { type CourseNode } from "@pieai/university-world/course.js";

import { CAMPUS_NAME, EMPTY_SHELF_HINT } from "../../mode";
import { contentPort, feedbackPort, reviewReminderPort, sourceAccessPort } from "../../ports/index";
import { identityPort, paymentPort } from "../../account/identity";
import { captureLearningReturn } from "../../account/continue-learning";
import { bindProgressToIdentity } from "../../account/session";
import { presencePort } from "../../presence/store";
import {
  dueCards,
  progressPort,
  progressRemoteStore,
  snapshot,
  subscribe,
} from "../../progress/store";
import { FeedbackNote } from "@pieai/university-ui/feedback/FeedbackNote.js";

import { TodaySection } from "@pieai/university-ui/today/TodaySection.js";
import { MapControlsHint } from "@pieai/university-world/controls.js";
import { MapGuide } from "../../guide/MapGuide";
import { mapGuideScope, type MapGuideMap } from "../../guide/map-guide";
import { CourseIsland, type CourseIslandProps } from "../map/CourseIsland";
import { useChestOpening } from "../journey/use-chest-opening";
import { useJourney } from "../journey/use-journey";
import { useWeeklyBoss } from "../journey/use-weekly-boss";
import { SHOWS_THE_MAP } from "../map/map-controls";
import { useCourseProgress } from "../../progress/course-progress";
import { shellConfigForView, useMinWidth } from "./shell-route";
import { useProfileStats } from "../learner/profile-stats";
import { useKnowledgeAlbum } from "../learner/use-knowledge-album";
import { RankPromotion } from "../../progress/RankPromotion";
import { rankPromotions } from "../../progress/store";
import { useRoute } from "./use-route";
import { useShelf } from "../../catalog/use-shelf";
import { useWorldMarkers, useWorldModel, type PathOverlay } from "../map/world-model";
import { universityCounters } from "@pieai/university-ui/navigation/counters.js";
import { PresenceSession } from "@pieai/university-ui/presence.js";
import { watchThemePreference } from "@pieai/university-ui/theme.js";
import { bindWorldStylePreference, WorldStyleControl } from "@pieai/university-ui/world-style.js";
import { resolveIslandLookDebug } from "@pieai/university-world/island-look.js";
import type { MapViewportCommands } from "@pieai/university-world/WorldMapCanvas.js";
import { resetWebGLContextProbe } from "@pieai/university-world/webgl-capability.js";
import { MainRouter } from "./MainRouter";
import { usePageMetadata } from "./page-metadata";
import { WorldSourceControls } from "../../learner/WorldSourceControls";
import { useAnalyticsPorts } from "../../analytics/analytics-ports";
import { useAvatarPreferences } from "../learner/avatar-preferences";
import { useCosmetics } from "../../cosmetics/use-cosmetics";
import { CosmeticAppearanceProvider } from "@pieai/university-ui";
import { AvatarChip, cosmeticAvatarRecipe } from "@pieai/university-world/avatar.js";
import { useSkipTest } from "../../assessment/skip-test";
import { useCoursePathActions } from "../map/course-path-actions";
import { useIslandLookView } from "../map/island-look-view";
import { WorldSurface } from "../map/WorldSurface";
import { useMistakeSummary } from "../learner/mistake-summary";
import { useSceneCamera } from "../map/scene-camera";
import { sceneKeyForView, useSceneInteraction } from "../map/scene-interaction";
import { useStudyContext } from "../map/study-context";
import { readNavigationFocus } from "../map/navigation-focus";
import { DomainInterest } from "../learner/DomainInterest";
import { useTodaySectionData } from "../learner/today-section-data";
import { OpeningSplash, useOpeningAdmission } from "../journey/OpeningSplash";
import { splashProgress } from "../journey/splash-policy";
import { useWelcome } from "../journey/use-welcome";
import { useFeedbackContext } from "../../feedback/feedback-context";
import { useFirstMeeting } from "../journey/use-first-meeting";
import { useCourseAvatarTarget } from "../map/use-course-avatar-target";
import { usePlanetChoice } from "../map/use-planet-choice";
import { useContinueOnReturn, useFrameLessonOnce } from "../map/map-arrival";
import { usePresenceAnchors } from "../map/presence-anchors";
import { useReviewDueAnalytics, useRouteAnalytics } from "../../analytics/route-analytics";
import { isMapEscape } from "../map/map-keyboard";
import { LearnerAvatarDialog, LearnerAvatarPanel } from "../learner/LearnerAvatarPanel";
import { LessonRoute } from "../lesson/LessonRoute";
import type { LessonRef } from "@pieai/university-core";

export function App() {
  const interfaceTranslator = useI18n();
  const progress = useSyncExternalStore(subscribe, snapshot);
  const identityStatus = useSyncExternalStore(
    identityPort.subscribe,
    identityPort.status,
    identityPort.status,
  );
  const avatarSignedIn = identityStatus.kind === "anonymous" || identityStatus.kind === "signed_in";
  const { avatarRecipe: baseAvatarRecipe, saveAvatarRecipe } = useAvatarPreferences({
    accountAvatarRecipe: progress.account.preferences.avatarRecipe,
    signedIn: avatarSignedIn,
  });
  const cosmeticData = useCosmetics();
  const avatarRecipe = useMemo(
    () => cosmeticAvatarRecipe(baseAvatarRecipe, cosmeticData?.equipped.avatar),
    [baseAvatarRecipe, cosmeticData?.equipped.avatar],
  );
  useEffect(
    () =>
      progressPort.subscribe(() =>
        presencePort.setSharesPresence(progressPort.accountData().preferences.sharesPresence),
      ),
    [],
  );
  const { shelf, studyNames, shelfError, retryShelf, studies, nodes, courseOf } = useShelf();
  const { view: routeView, setView } = useRoute();
  const welcome = useWelcome(routeView, progress, identityStatus.kind);
  const admission = useOpeningAdmission(routeView);
  const [avatarPanelOpen, setAvatarPanelOpen] = useState<string | null>(null);
  const wide = useMinWidth(768);
  // The look judge is a DEV-only URL input. A seed identifies the course whose
  // existing blueprint should be measured; it never creates a second course or
  // a second layout source.
  const lookDebug = import.meta.env.DEV ? resolveIslandLookDebug() : null;
  const { lookSeedNode, view } = useIslandLookView({ lookDebug, nodes, routeView });
  const shellConfig = shellConfigForView(view);
  const mapMode = view.kind === "planet" || view.kind === "world" || view.kind === "course";
  const mapRouteKey =
    view.kind === "course" ? `${view.kind}:${view.studyId}/${view.courseId}` : view.kind;
  const shortcuts = useMapShortcuts(mapMode && !welcome.visible && !admission.pending, mapRouteKey);
  /**
   * The learner's tab-local navigation choice. `undefined` means "not chosen
   * yet" — fall back to the learner's next course so the name, the sky and the
   * eye agree. Same-tab session memory carries only this ID across native
   * links; it is never written to the authoring config or account data.
   */
  const [navigationFocus, setNavigationFocus] =
    useState<LearnerNavigationFocus>(readNavigationFocus);
  const [hovered, setHovered] = useState<string | null>(null);
  /** The island-entry action stays discoverable until the learner picks once. */
  const {
    mapInteracted,
    sceneReady,
    sceneFailure,
    sceneProgress,
    onSceneProgress,
    sceneAttempt,
    onSceneReady,
    onSceneBusy,
    onContextLost,
    onContextRestored,
    onRendererUnavailable,
    retryScene: retrySceneState,
    onMapInteract,
  } = useSceneInteraction(sceneKeyForView(view));
  const retryScene = useCallback(() => {
    resetWebGLContextProbe();
    retrySceneState();
  }, [retrySceneState]);
  const [picked, setPicked] = useState<CourseNode | null>(null);
  const pickedCourse = picked ? courseOf(picked.studyId, picked.courseId) : null;
  const avatarTarget = useCourseAvatarTarget(view);
  /*
    V5 §12 decision C′: a locked stop's card — lesson, gate, pennant or board —
    says why and offers the current lesson or the current stretch's checkpoint
    test, never "Enter".
  */
  /** The monster on a stop, as the card names it (V7). */
  const guardOf = (role: MonsterRole | null) =>
    role
      ? {
          name: interfaceTranslator.t(`map.monster.${role}.name`),
          fear: interfaceTranslator.t(`map.monster.${role}.fear`),
        }
      : undefined;
  const lockedEntry = (locked: boolean): MapEntryLock | undefined => {
    if (view.kind !== "course" || !course) return undefined;
    const live = lessons.find((item) => item.state === "live");
    if (!locked || !live) return undefined;
    const segment = learningSegments(course).find(
      (item) => item.unitId === live.unitId && item.lessonIds.includes(live.lessonId),
    );
    return {
      current: live.lessonTitle,
      onGoToCurrent: () => goToLesson(live),
      onTest: segment
        ? () => {
            avatarTarget.rememberNode(learningNodeId(segment, "checkpoint"));
            setPathOverlay({
              kind: "learning-node",
              segment,
              nodeKind: "checkpoint",
              unitId: segment.unitId,
              returnFocusTo: null,
            });
          }
        : undefined,
    };
  };
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
  /** Counts avatar clicks so the account door also responds while already on `/me`. */
  const [accountFocusRequest, setAccountFocusRequest] = useState(0);
  const openAccount = useCallback(() => {
    captureLearningReturn(routeView);
    setAccountFocusRequest((current) => current + 1);
    setView({ kind: "me" });
  }, [routeView, setView]);
  const readEntitlements = useCallback(() => paymentPort.readEntitlements(), []);
  const source = useMemo(() => progressSourceOf(progressPort), []);
  const knowledge = useKnowledgeAlbum(shelf, progressPort, source, progress);
  const {
    analyticsIdentityPort,
    analyticsAuthPort,
    analyticsPaymentPort,
    onWorthwhileProgress,
    guestAdoption,
  } = useAnalyticsPorts();
  const { mistakes, uncorrectedMistakeCount } = useMistakeSummary(progress);

  useEffect(
    () =>
      bindProgressToIdentity(progressPort, identityPort, progressRemoteStore, async () => {
        const result = await paymentPort.readEntitlements();
        return result.kind === "value" ? result.value : null;
      }),
    [],
  );

  useEffect(() => bindWorldStylePreference(progressPort), []);

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

  useEffect(() => {
    if (view.kind === "lesson") void import("../../screens/SettlementHost");
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
  const feedback = useFeedbackContext(view, course, progress, avatarSignedIn);

  const {
    lessonsDone,
    courseProgress,
    courseProgressForNode,
    lessons,
    viewedProgress,
    nextUpProgress,
    todayNode,
  } = useCourseProgress({ course, courseOf, nodes, progress, source, view });

  /*
    V7 station 4: finishing a lesson opens its chest on the island before the
    lesson's page. The hook remembers the record as the lesson opened, so the
    chest can only announce what the lesson added.
  */
  const journey = useJourney({
    view,
    identity: identityStatus,
    progress: progressPort,
    document: progress,
    payment: paymentPort,
    courseOf,
    onMap: (locator) => {
      setPathOverlay(null);
      setNavigationFocus(locator.studyId);
      setView({ kind: "course", studyId: locator.studyId, courseId: locator.courseId });
    },
    onLesson: (locator) => setView({ kind: "lesson", ...locator }),
    onAccount: openAccount,
    onMember: () => setView({ kind: "plans" }),
    onReview: () => setView({ kind: "review" }),
  });
  const chest = useChestOpening({
    guestAdoption,
    lessonOpen:
      view.kind === "lesson"
        ? {
            studyId: view.studyId,
            courseId: view.courseId,
            unitId: view.unitId,
            lessonId: view.lessonId,
          }
        : null,
    lessons,
    guardName: (role) => guardOf(role)?.name ?? "",
    onLessonDone: journey.afterLesson,
    completionAvatar:
      cosmeticData && avatarRecipe ? (
        <AvatarChip recipe={avatarRecipe} signedIn={avatarSignedIn} size={80} />
      ) : null,
    readAlbum: knowledge.read,
    courseTitle: course?.title,
    keepsakeOf: (locator) => {
      const owning = courseOf(locator.studyId, locator.courseId);
      return owning
        ? keepsakeForLesson(
            { studyId: locator.studyId, id: owning.id, units: owning.units },
            locator.lessonId,
          )
        : undefined;
    },
    onKeepsake: (keepsake) => {
      arriveAt(keepsake.id);
      setView({ kind: "house" });
    },
  });
  const openingOnMap = chest.active && view.kind === "settled";
  // The island the chest opens on is the lesson's own course map: while it
  // plays, the scene reads the settled view as the lesson it came from.
  const sceneView: View =
    openingOnMap && view.kind === "settled" ? { ...view, kind: "lesson" } : view;
  /** The map's shell (rails, information) shows on map views and over the chest's island. */
  const mapShell = mapMode || openingOnMap;

  const labelNodes = useRef(new Map<string, HTMLElement>());
  const pickCardRef = useRef<HTMLElement | null>(null);
  const mapCommands = useRef<MapViewportCommands | null>(null);
  const dismissPick = useCallback(() => {
    setPicked(null);
    setPathOverlay(null);
    avatarTarget.forget();
  }, [avatarTarget.forget]);
  /** Move the camera to a lesson stone and open its card; a locked stone explains, the avatar stays put. */
  const goToLesson = (placement: LessonPlacement) => {
    if (placement.state !== "locked") avatarTarget.rememberLesson(placement);
    mapCommands.current?.focus(placement.position.toArray());
    setPathOverlay({
      kind: "node",
      unitId: placement.unitId,
      lessonId: placement.lessonId,
      returnFocusTo: null,
    });
  };
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

  const planet = usePlanetChoice({
    planetStudies,
    focusedStudyId,
    viewKind: view.kind,
    setNavigationFocus,
    setView,
  });

  const { projectName, focusedTodayNode, focusedNextUpProgress, focusStudy } = useStudyContext({
    courseProgress,
    courseProgressForNode,
    focusedStudyId,
    navigationFocus,
    nodes,
    setNavigationFocus,
    setView,
    studies,
    view,
  });

  const profileStats = useProfileStats({ progress, courseOf });

  const markers = useWorldMarkers({
    course,
    proofs: progress.provenLessons,
    labelNodes,
    lessons,
    setCourseAvatarTarget: avatarTarget.rememberLesson,
    setCourseAvatarNode: avatarTarget.rememberNode,
    setPathOverlay,
    setPicked,
    view: sceneView,
    world,
  });

  const guideUser =
    identityStatus.kind === "signed_in" || identityStatus.kind === "anonymous"
      ? identityStatus.user.id
      : "guest";
  useEffect(() => setAvatarPanelOpen(null), [guideUser, view.kind]);
  const firstMeeting = useFirstMeeting({
    guideUser,
    view,
    studies,
    welcome,
    sceneAttempt,
    setNavigationFocus,
    setView,
    setPathOverlay,
    openAccount,
  });
  const guideMap = useMemo<MapGuideMap | null>(
    () =>
      view.kind === "world" || view.kind === "course"
        ? {
            view: view.kind,
            scope: mapGuideScope([
              guideUser,
              view.kind === "course" ? view.studyId : focusedStudyId,
              view.kind,
              view.kind === "course" ? view.courseId : null,
            ]),
            markers,
            lessonTitle: (lessonId) =>
              lessons.find((lesson) => lesson.lessonId === lessonId)?.lessonTitle,
            courseProgress: (courseId) => {
              const node = world?.placements.find(
                (placement) => placement.node.courseId === courseId,
              )?.node;
              return node ? courseProgressForNode(node) : null;
            },
          }
        : null,
    [view, markers, lessons, guideUser, focusedStudyId, world, courseProgressForNode],
  );

  const due = dueCards();
  const { todayCard, todayData, todayReview, todayVocabularyReview } = useTodaySectionData({
    due,
    focusedNextUpProgress,
    studies,
  });
  /** The same lesson the Today panel offers, used by map recovery's exit. */
  const todayLesson = todayData.nextLesson;
  const continueToTodayLesson = useCallback(() => {
    if (!todayLesson) return;
    setView({
      kind: "lesson",
      studyId: todayLesson.studyId,
      courseId: todayLesson.courseId,
      unitId: todayLesson.unitId,
      lessonId: todayLesson.lessonId,
    });
  }, [setView, todayLesson]);
  const showMap = SHOWS_THE_MAP.has(view.kind) || openingOnMap;
  useEffect(() => {
    if (!mapMode) return;
    const cancel = (event: KeyboardEvent) => {
      if (!isMapEscape(event)) return;
      if (view.kind === "planet") planet.clear();
      else dismissPick();
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [mapMode, view.kind, planet.clear, dismissPick]);
  const reviewVisible = showMap || view.kind === "review";
  useRouteAnalytics(view);
  useReviewDueAnalytics(due.length, reviewVisible && Boolean(todayCard));

  // Suspense reports the models; this reports the JSON they stand on. Either
  // one alone still paints an empty sea, which is the same broken-page read.
  const waitingForData =
    (view.kind === "planet" && shelf === null) ||
    (view.kind === "world" && !world) ||
    ((view.kind === "course" || view.kind === "lesson" || openingOnMap) && lessons.length === 0);
  const { cover: mapCover, timedOut: mapTimedOut } = useMapCoverState(
    (mapMode || openingOnMap) && (!sceneReady || waitingForData),
    sceneAttempt,
  );
  const mapRecoveryReason: RecoveryReason | null =
    mapMode || openingOnMap ? (sceneFailure ?? (mapTimedOut ? "scene-timeout" : null)) : null;
  const splashReady = sceneReady && !waitingForData;
  useContinueOnReturn({
    viewKind: view.kind,
    admissionPending: admission.pending,
    splashReady,
    identityStatus,
    welcomeVisible: welcome.visible,
    todayLesson,
    progress,
    continueAt: journey.continueAt,
  });
  const arrival = { guideUser, sceneAttempt, splashReady, lessons, mapCommands };
  useFrameLessonOnce(journey.target, arrival);
  // The learner explicitly chose this route: frame that real stone once.
  useFrameLessonOnce(firstMeeting.here?.lesson ?? null, arrival);
  const loadProgress = splashProgress(
    !waitingForData,
    sceneProgress.loaded,
    sceneProgress.total,
    sceneReady,
  );
  const showOpeningSplash = admission.pending && mapMode && !mapRecoveryReason;
  /*
    The campus record is still opening.

    Until the shelf has been named there is no series for the capsule to show,
    so the picker beside 「University」 is missing and the two builds genuinely
    do not look alike. The delivery build ships its catalogue and never shows
    this; the authoring build has to ask a loopback server, and saying so is
    what makes 「the chrome is the same」 a claim about the settled screen
    instead of a race against a fetch.

    It is said in the slot the picker will fill, not above the page. As a line
    at the top of the content it pushed every screen down until the shelf
    arrived and then let it jump back up — 54 px on 「关于」 at 320 px, under a
    finger already on its way to a link (2026-10-01).
  */
  const campusOpening = studyNames.length === 0 && !shelf;
  const counters = universityCounters({
    projectName: campusOpening
      ? interfaceTranslator.t("app.app.mainRouter.copy.正在打开校园档案")
      : projectName,
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
    viewKind: sceneView.kind,
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
  // V7 mechanic 8: this week's boss, on the course island you last finished a lesson on.
  const weekly = useWeeklyBoss({
    progress,
    showWorld: view.kind === "world",
    island:
      view.kind === "course" && course ? { studyId: view.studyId, courseId: course.id } : null,
    lessons,
    courseOf,
    onOpenLesson: openCourseLesson,
    onChest: chest.beginWeekly,
  });
  const labelMarkers = useMemo(() => {
    if (firstMeeting.here) {
      // One named place in this one-step tour. Other normal map labels return
      // on dismissal; their competing kind icons do not cover this close-up.
      return markers
        .filter((marker) => marker.id === firstMeeting.here?.lesson.lessonId)
        .map((marker) => ({
          ...marker,
          text: interfaceTranslator.t("map.stop.lesson", { number: 1 }),
          position: marker.position.clone().setY(marker.position.y + 1.3),
        }));
    }
    const withBoss =
      weekly.availableIsland && view.kind === "world"
        ? markers.map((marker) =>
            marker.kind === "course" &&
            marker.id === weekly.availableIsland?.courseId &&
            focusedStudyId === weekly.availableIsland.studyId
              ? {
                  ...marker,
                  weeklyBoss: true,
                  label: `${marker.text} · ${interfaceTranslator.t("weeklyBoss.name")}`,
                }
              : marker,
          )
        : markers;
    return weekly.marker ? [...withBoss, weekly.marker] : withBoss;
  }, [
    markers,
    weekly.marker,
    weekly.availableIsland,
    firstMeeting.here,
    interfaceTranslator,
    view.kind,
    focusedStudyId,
  ]);
  const { markUnitProven, provenLessonKeys, unmetFor } = useSkipTest({
    nodes,
    progress,
    courseProgress,
  });
  const courseIslandProps: CourseIslandProps | null =
    view.kind === "course" && course
      ? {
          course,
          studyId: view.studyId,
          viewedProgress,
          pathUnit,
          unitOverlayOpen: pathOverlay?.kind === "unit",
          backToMapLabel,
          contentPort,
          provenLessonKeys,
          onProven: markUnitProven,
          unmetPrerequisites: unmetFor(course, view.studyId),
          onOpenCourse: (courseId: string) =>
            setView({ kind: "course", studyId: view.studyId, courseId }),
          onOpenUnitOverlay: (...args: Parameters<typeof openUnitOverlay>) => {
            shortcuts.close();
            openUnitOverlay(...args);
          },
          onOpenLearningNode: (segment, nodeKind, returnFocusTo) => {
            shortcuts.close();
            avatarTarget.rememberNode(learningNodeId(segment, nodeKind));
            setPathOverlay({
              kind: "learning-node",
              segment,
              nodeKind,
              unitId: segment.unitId,
              returnFocusTo,
            });
          },
          onBackToMap: backToCourseMap,
          onOpenLesson: openCourseLesson,
        }
      : null;

  const presence = usePresenceAnchors({ view, sceneView, lessons, focusedTodayNode, world });

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
  const inCourse = view.kind === "course" || view.kind === "lesson" || openingOnMap;
  const reviewDue = useMemo(() => {
    if (!inCourse || !course || !("studyId" in view)) return null;
    const due = lessonsWithDueCards(
      progress,
      { studyId: view.studyId, courseId: course.id },
      Date.now(),
    );
    return lessons
      .filter((lesson) => lesson.state === "done" && due.has(lesson.lessonId))
      .map((lesson) => lesson.lessonId);
  }, [inCourse, course, view, progress, lessons]);

  const entryOverlay = (
    <>
      {view.kind === "world" && picked && pickedCourse ? (
        <MapEntryAction
          title={picked.title}
          onEnter={() =>
            setView({
              kind: "course",
              studyId: picked.studyId,
              courseId: picked.courseId,
            })
          }
          actionRef={pickCardRef}
        />
      ) : null}
      {view.kind === "course" && pathOverlay?.kind === "stop" ? (
        <MapEntryAction
          eyebrow={`${interfaceTranslator.t(`mapNodes.${pathOverlay.nodeKind}`)} · ${interfaceTranslator.t(
            "mapNodes.range",
            {
              first: pathOverlay.segment.firstIndex + 1,
              last: pathOverlay.segment.lastIndex + 1,
            },
          )}`}
          title={interfaceTranslator.t(`mapNodes.${pathOverlay.nodeKind}Pitch`)}
          actionRef={pickCardRef}
          locked={lockedEntry(pathOverlay.locked)}
          guard={guardOf(
            monsterAtStop(lessons, {
              siteId: learningNodeId(pathOverlay.segment, pathOverlay.nodeKind),
            }),
          )}
          onEnter={() => setPathOverlay({ ...pathOverlay, kind: "learning-node" })}
        />
      ) : null}
      {view.kind === "course" && pathOverlay?.kind === "node" && pathUnit && pathLesson ? (
        <MapEntryAction
          eyebrow={interfaceTranslator.t("map.stop.lesson", {
            number: lessons.findIndex((item) => item.lessonId === pathLesson.id) + 1,
          })}
          title={pathLesson.title}
          actionRef={pickCardRef}
          locked={lockedEntry(
            lessons.find((item) => item.lessonId === pathLesson.id)?.state === "locked",
          )}
          guard={guardOf(monsterAtStop(lessons, { lessonId: pathLesson.id }))}
          onEnter={() => {
            setPathOverlay(null);
            setView({
              kind: "lesson",
              studyId: view.studyId,
              courseId: view.courseId,
              unitId: pathUnit.id,
              lessonId: pathLesson.id,
            });
          }}
        />
      ) : null}
    </>
  );
  const stageGuide = guideMap ? (
    <MapGuide
      map={guideMap}
      ready={splashReady && !admission.pending && !mapCover}
      invitation={firstMeeting.invitation}
      firstStone={firstMeeting.firstStone}
      journey={journey.opening}
      onShortcuts={shortcuts.show}
      onOpenDetails={() => setView({ kind: "settings" })}
    />
  ) : null;
  const stageLoading = mapRecoveryReason ? (
    <RecoveryState
      reason={mapRecoveryReason}
      onRetry={retryScene}
      onContinue={todayLesson ? continueToTodayLesson : undefined}
      overlay
    />
  ) : mapCover && !showOpeningSplash ? (
    <OpeningSplash mode="transition" progress={loadProgress} ready={splashReady} />
  ) : null;
  const stageRoute =
    view.kind === "avatar-lab" ||
    view.kind === "play-lab" ||
    (view.kind === "library" && view.tab === "courseware") ||
    (view.kind === "studio" && view.section === "map");
  const stage = stageRoute ? null : (
    <WorldSurface
      inCourse={inCourse}
      openingOnMap={openingOnMap}
      view={view}
      sceneView={sceneView}
      lessons={lessons}
      world={world}
      wide={wide}
      lookDebug={lookDebug}
      sceneAttempt={sceneAttempt}
      waitingForData={waitingForData}
      showMap={showMap}
      commandsRef={mapCommands}
      sceneKey={inCourse ? sceneKeyForView(view) : undefined}
      cameraFrom={cameraFrom}
      lookAt={lookAt}
      learnerAt={learnerAt}
      avatarRecipe={avatarRecipe}
      avatarSignedIn={avatarSignedIn}
      selectedCourseKey={
        view.kind === "world" && picked ? `${picked.studyId}/${picked.courseId}` : null
      }
      skyStudyId={focusedStudyId}
      markers={labelMarkers}
      followId={
        view.kind === "world" && picked
          ? picked.courseId
          : view.kind === "course" && pathOverlay?.kind === "node"
            ? markers.some((marker) => marker.id === `kind:${pathOverlay.lessonId}`)
              ? `kind:${pathOverlay.lessonId}`
              : pathOverlay.lessonId
            : view.kind === "course" && pathOverlay?.kind === "stop"
              ? learningNodeId(pathOverlay.segment, pathOverlay.nodeKind)
              : null
      }
      followNode={pickCardRef}
      onPick={setPicked}
      onHover={(node) => setHovered(node ? node.title : null)}
      onInteract={onMapInteract}
      onSceneReady={onSceneReady}
      onSceneBusy={onSceneBusy}
      onSceneProgress={onSceneProgress}
      onContextLost={onContextLost}
      onContextRestored={onContextRestored}
      onRendererUnavailable={onRendererUnavailable}
      onPointerMissed={dismissPick}
      onPickLesson={(lesson) => {
        if (view.kind !== "course") return;
        if (lesson.state !== "locked") avatarTarget.rememberLesson(lesson);
        setPathOverlay({
          kind: "node",
          unitId: lesson.unitId,
          lessonId: lesson.lessonId,
          returnFocusTo: labelNodes.current.get(lesson.lessonId) ?? null,
        });
      }}
      onPickNode={(site) => {
        if (view.kind !== "course" || !course) return;
        const segment = learningSegments(course).find((item) => item.id === site.segment.id);
        if (!segment) return;
        const locked = learningSiteLocked(site, lessons);
        if (!locked) avatarTarget.rememberNode(site.id);
        setPathOverlay({
          kind: "stop",
          segment,
          nodeKind: site.kind,
          unitId: segment.unitId,
          locked,
          returnFocusTo: labelNodes.current.get(site.id) ?? null,
        });
      }}
      onCourseHover={(lesson) => setHovered(lesson ? lesson.lessonId : null)}
      avatarLessonId={firstMeeting.here?.lesson.lessonId ?? avatarTarget.lessonId}
      avatarNodeId={avatarTarget.nodeId}
      opening={chest.opening}
      introductoryLessonId={firstMeeting.here?.lesson.lessonId ?? null}
      onIntroductionReady={firstMeeting.introductionReady}
      reviewDue={reviewDue}
      cosmeticOrnamentId={cosmeticData?.equipped.island ?? null}
      weeklyBoss={weekly.scene}
      weeklyWins={weekly.history.weeks}
      onPickWeeklyBoss={weekly.open}
      companionAnchors={presence.anchors}
      companionNodes={companionNodes.current}
      presencePort={presencePort}
      presenceSurface={presence.surface}
      presenceViewKey={presence.viewKey}
      attachPresence={(userId, element) => {
        if (element) companionNodes.current.set(userId, element);
        else companionNodes.current.delete(userId);
      }}
      overlay={entryOverlay}
      weeklyOverlay={weekly.overlay}
      chestOverlay={chest.weekly ? chest.overlay : null}
      guide={stageGuide}
      loading={stageLoading}
      hoverHint={hovered}
      controlsHint={<MapControlsHint />}
      controlsHintVisible={!mapInteracted && !hovered}
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
      key={guideUser}
      data={todayData}
      reviewOnly={view.kind === "review"}
      review={todayReview}
      readEntitlements={readEntitlements}
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

  const mapInfo: MapInformationData =
    view.kind === "planet"
      ? planetInformation(planet.selectedStudy, planet.selectedDomain, planetStudies)
      : (view.kind === "course" || openingOnMap) && course
        ? view.kind === "course" && pathOverlay?.kind === "node" && pathLesson && pathUnit
          ? lessonInformation(pathUnit, pathLesson)
          : courseInformation(
              course,
              viewedProgress?.done ?? lessons.filter((lesson) => lesson.state === "done").length,
            )
        : picked && pickedCourse
          ? courseInformation(
              pickedCourse,
              courseProgressForNode(picked)?.done ?? 0,
              unmetFor(picked, picked.studyId),
            )
          : studyInformation(
              focusedStudyId,
              studies.find((study) => study.id === focusedStudyId),
            );

  const destinations = mapDestinations(
    view.kind === "planet"
      ? { level: "planet", domains: planet.catalog }
      : view.kind === "course" && course
        ? { level: "course", course }
        : {
            level: "world",
            courses: (nodes ?? []).filter((node) => node.studyId === focusedStudyId),
          },
    {
      domain: planet.selectDomain,
      lesson: (lessonId) => {
        const placement = lessons.find((item) => item.lessonId === lessonId);
        if (placement) goToLesson(placement);
      },
      course: (node) => {
        const placement = world?.placements.find(
          (entry) => entry.node.courseId === node.courseId && entry.node.studyId === node.studyId,
        );
        if (placement) mapCommands.current?.focus(placement.position.toArray());
        setPicked(node);
      },
    },
  );
  const quickCommands = mapQuickCommands({
    weeklyBoss: weekly.marker ? weekly.open : null,
    camera: showMap
      ? {
          overview: () => mapCommands.current?.overview(),
          learningView: () => mapCommands.current?.learningView(),
        }
      : null,
    back:
      view.kind !== "planet"
        ? () => setView({ kind: view.kind === "course" ? "world" : "planet" })
        : null,
    clear:
      picked || pathOverlay?.kind === "node" || pathOverlay?.kind === "stop" || planet.domainId
        ? () => {
            dismissPick();
            planet.clear();
          }
        : null,
  });
  const aside = (
    <>
      {mapShell ? (
        <>
          <MapInformation data={mapInfo} />
          {view.kind === "planet" &&
          planet.selectedDomain &&
          !planetStudies.some((study) => study.domain?.id === planet.selectedDomain?.id) ? (
            <DomainInterest
              key={`${guideUser}:${planet.selectedDomain.id}`}
              domainId={planet.selectedDomain.id}
              progress={progressPort}
            />
          ) : null}
          {view.kind === "world" ? (
            <nav
              className="learner-destinations"
              aria-label={interfaceTranslator.t("doors.findCourse")}
            >
              <a href="/catalog" data-find-course>
                {interfaceTranslator.t("doors.findCourse")}
              </a>
            </nav>
          ) : null}
        </>
      ) : null}
      {view.kind === "settings" ? <SettingsSubnav /> : null}
    </>
  );

  const openAccountFromPanel = () => {
    setAvatarPanelOpen(null);
    openAccount();
  };
  const avatarPanel = (inDialog: boolean) => (
    <LearnerAvatarPanel
      progress={progress}
      avatarRecipe={avatarRecipe}
      signedIn={avatarSignedIn}
      opensDialog={!wide && !inDialog}
      onOpenDialog={() => setAvatarPanelOpen(guideUser)}
      onOpenAccount={openAccountFromPanel}
      onOpenHouse={() => {
        setAvatarPanelOpen(null);
        setView({ kind: "house" });
      }}
    />
  );
  const main = (
    <CosmeticAppearanceProvider equipped={cosmeticData?.equipped}>
      <MainRouter
        album={knowledge.album}
        avatarPanel={view.kind === "me" ? avatarPanel(true) : undefined}
        contentPort={contentPort}
        sceneAttempt={sceneAttempt}
        planetReadiness={{
          dataReady: !waitingForData,
          onSceneReady,
          onSceneBusy,
          onSceneProgress,
          onContextLost,
          onContextRestored,
          onRendererUnavailable,
        }}
        course={course}
        focusedStudyId={focusedStudyId}
        focusStudy={focusStudy}
        grewFrom={grewFrom}
        chestOverlay={openingOnMap ? chest.overlay : null}
        avatarEditingRecipe={baseAvatarRecipe}
        avatarRecipe={avatarRecipe}
        avatarSignedIn={avatarSignedIn}
        onAvatarRecipeChange={saveAvatarRecipe}
        onWorthwhileProgress={onWorthwhileProgress}
        reviewReminderDismissedFor={reviewReminderDismissedFor}
        onDismissReviewReminder={setReviewReminderDismissedFor}
        identityPort={analyticsIdentityPort}
        authPort={analyticsAuthPort}
        accountFocusRequest={accountFocusRequest}
        paymentPort={analyticsPaymentPort}
        mistakes={mistakes}
        nextUpProgress={nextUpProgress}
        pathOverlay={pathOverlay}
        pathUnit={pathUnit}
        planetStudies={planetStudies}
        planetDomainCatalog={planet.catalog}
        selectedPlanetDomainId={planet.domainId}
        selectedPlanetStudyId={planet.studyId}
        onEnterPlanetStudy={planet.enterStudy}
        onClearPlanetPick={planet.clear}
        onSelectPlanetDomain={planet.selectDomain}
        onSelectPlanetStudy={planet.selectStudy}
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
        stage={stage}
        todayNode={todayNode}
        todaySection={todaySection}
        uncorrectedMistakeCount={uncorrectedMistakeCount}
        view={view}
      />
    </CosmeticAppearanceProvider>
  );
  const feedbackSurface = (
    <FeedbackNote
      key={guideUser}
      shell={CAMPUS_NAME}
      port={feedbackPort}
      context={feedback.context}
      lessonTitle={feedback.lessonTitle}
      surface={feedback.surface}
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
  const canReadLessonWithoutShelf = isBareView(view) && view.kind === "lesson";
  if ((shelfError || (shelf && shelf.studies.length === 0)) && !canReadLessonWithoutShelf) {
    return (
      <>
        <main className="empty">
          {shelfError ? (
            <RecoveryState
              reason="content"
              onRetry={retryShelf}
              retryLabel={interfaceTranslator.t("ui.recovery.recoveryState.copy.重试课程资料")}
              onContinue={() => setView({ kind: "catalog" })}
              continueLabel={interfaceTranslator.t("ui.recovery.recoveryState.copy.先看课程列表")}
            />
          ) : (
            <>
              <h1>{interfaceTranslator.t("app.app.app.copy.书架上还没有课")}</h1>
              <p>{EMPTY_SHELF_HINT}</p>
            </>
          )}
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
      <LessonRoute
        locator={reading}
        course={course}
        studyTitle={studies.find((study) => study.id === view.studyId)?.title ?? view.studyId}
        presencePort={presencePort}
        presenceLocation={presence.location}
        presenceViewKey={presence.viewKey}
        onNavigate={(next) => setView({ kind: "lesson", ...next })}
        onBack={() => {
          if (avatarTarget.lessonId === view.lessonId) {
            setPathOverlay({
              kind: "node",
              unitId: view.unitId,
              lessonId: view.lessonId,
              returnFocusTo: null,
            });
          }
          setView({ kind: "course", studyId: view.studyId, courseId: view.courseId });
        }}
        onWorthwhileProgress={onWorthwhileProgress}
        readEntitlements={readEntitlements}
        avatarRecipe={avatarRecipe}
        feedbackSurface={feedbackSurface}
        onSettled={(settled, doneBefore) => {
          const key = `${settled.studyId}/${settled.courseId}/${settled.lessonId}`;
          setGrewFrom({ key, doneBefore });
          setReviewReminderDismissedFor(null);
          setView({
            kind: "settled",
            studyId: settled.studyId,
            courseId: settled.courseId,
            unitId: settled.unitId,
            lessonId: settled.lessonId,
          });
          chest.begin(settled);
        }}
      />
    );
  }

  return (
    <>
      <div
        inert={showOpeningSplash || undefined}
        className={
          view.kind === "me" || view.kind === "auth-callback" || view.kind === "auth-reset"
            ? "app app--account"
            : view.kind === "settled" && !openingOnMap
              ? "app app--lesson"
              : "app"
        }
      >
        <UniversityShell
          activeId={activeIdForView(view)}
          mapMode={mapShell}
          asideTitle={mapShell ? mapInfo.title : undefined}
          contextActions={
            mapMode
              ? [
                  {
                    id: "map-shortcuts",
                    label: interfaceTranslator.t("map.shortcuts"),
                    href: "#map-shortcuts",
                    icon: <span aria-hidden="true">⌘</span>,
                    onActivate: shortcuts.show,
                  },
                ]
              : []
          }
          counters={
            shellConfig.showLearnerChrome
              ? mapMode
                ? // The streak sits on the avatar's face right above; twice is noise.
                  counters.filter((counter) => !counter.control && counter.id !== "streak")
                : counters
              : undefined
          }
          identity={shellConfig.showLearnerChrome ? avatarPanel(false) : null}
          aside={shellConfig.showContextAside ? aside : undefined}
          asideLabel={
            mapMode
              ? interfaceTranslator.t("map.information")
              : view.kind === "settings"
                ? interfaceTranslator.t("app.app.app.copy.设置")
                : interfaceTranslator.t("app.app.app.copy.今天")
          }
          showAsideOnPhone={view.kind === "planet"}
        >
          <PresenceSession
            port={presencePort}
            location={presence.location}
            viewKey={presence.viewKey}
          />
          {view.kind === "world" ? (
            <h1 className="app__screen-title">
              {interfaceTranslator.t("product.navigation.mapHeading")}
            </h1>
          ) : null}
          {main}
        </UniversityShell>
      </div>
      {mapMode ? (
        <MapQuickActions
          open={shortcuts.open}
          onClose={shortcuts.close}
          destinations={destinations}
          commands={quickCommands}
          sourceControls={
            showMap && focusedStudyId ? (
              <WorldSourceControls
                key={focusedStudyId}
                studyId={focusedStudyId}
                sourceAccess={sourceAccessPort}
              />
            ) : undefined
          }
          appearance={mapMode ? <WorldStyleControl compact /> : undefined}
          route={
            courseIslandProps ? (
              <CourseIsland
                key={`${courseIslandProps.studyId}/${courseIslandProps.course.id}`}
                {...courseIslandProps}
              />
            ) : undefined
          }
        />
      ) : null}
      {avatarPanelOpen === guideUser && shellConfig.showLearnerChrome ? (
        <LearnerAvatarDialog
          onClose={() => setAvatarPanelOpen(null)}
          onOpenAccount={openAccountFromPanel}
        >
          {avatarPanel(true)}
        </LearnerAvatarDialog>
      ) : null}
      <RankPromotion promotions={rankPromotions} owner={progressPort.syncState().userId} />
      {showOpeningSplash ? null : feedbackSurface}
      {showOpeningSplash ? (
        <OpeningSplash progress={loadProgress} ready={splashReady} onStart={admission.enter} />
      ) : view.kind === "planet" && mapRecoveryReason ? (
        <RecoveryState
          reason={mapRecoveryReason}
          onRetry={retryScene}
          onContinue={() => {
            admission.enter();
            setView({ kind: "catalog" });
          }}
          overlay
        />
      ) : view.kind === "planet" && mapCover ? (
        <OpeningSplash mode="transition" progress={loadProgress} ready={splashReady} />
      ) : null}
    </>
  );
}
