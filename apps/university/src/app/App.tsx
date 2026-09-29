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
import { useI18n } from "@pieai/university-ui/i18n.js";
import { GameButton, GameModal } from "@pieai/swimmer-ui-kit";
import {
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
  isBareView,
  learningNodeId,
  leagueStanding,
  learningSegments,
  lessonRefKey,
  lessonsWithDueCards,
  questsForToday,
  studyWeek,
  todayGoalProgress,
  toPath,
  progressSourceOf,
  restTicketBalance,
  type FeedbackContext,
  type LessonRef,
  type View,
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
import { LevelProgress } from "@pieai/university-ui/navigation/screens.js";
import { MapEntryAction, type MapEntryLock } from "@pieai/university-ui/path/MapEntryAction.js";
import {
  MapInformation,
  courseInformation,
  lessonInformation,
  type MapInformationData,
} from "./MapInformation.js";
import {
  MapQuickActions,
  useMapShortcuts,
  type MapDestination,
  type MapQuickCommand,
} from "./MapQuickActions.js";
import { CourseScene, type LessonPlacement } from "@pieai/university-world/Maps.js";
import {
  learningSiteLocked,
  monsterAtStop,
  type MonsterRole,
} from "@pieai/university-world/learning-nodes.js";
import { type CourseNode } from "@pieai/university-world/course.js";
import { RailIdentity } from "@pieai/university-world/avatar.js";

import { AUTHORING, CAMPUS_NAME, EMPTY_SHELF_HINT } from "../mode";
import { contentPort, feedbackPort, reviewReminderPort, sourceAccessPort } from "../ports/index";
import { identityPort, paymentPort } from "../account/identity";
import { captureLearningReturn } from "../account/continue-learning";
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

import { TodaySection } from "@pieai/university-ui/today/TodaySection.js";
import { LINK_RETURN_DEPTH } from "@pieai/university-ui/lesson/LessonReader.js";
import { COURSE_POLAR, MapControlsHint, WORLD_POLAR } from "@pieai/university-world/controls.js";
import { MapGuide } from "../guide/MapGuide.js";
import { mapGuideScope, type MapGuideMap } from "../guide/map-guide.js";
import { CourseIsland, type CourseIslandProps } from "./CourseIsland.js";
import { useChestOpening } from "./use-chest-opening.js";
import { useJourney } from "./use-journey.js";
import { useWeeklyBoss } from "./use-weekly-boss.js";
import { AvatarPanel } from "@pieai/university-ui/navigation/AvatarPanel.js";
import { leagueTierName } from "@pieai/university-ui/navigation/league-tier-name.js";
import { EmblemImage } from "@pieai/university-world";
import { SHOWS_THE_MAP } from "./map-controls";
import { useCourseProgress } from "./course-progress";
import { shellConfigForView, useMinWidth } from "./shell-route";
import { useProfileStats } from "./profile-stats";
import { useKnowledgeAlbum } from "./use-knowledge-album.js";
import { RankPromotion } from "../progress/RankPromotion.js";
import { rankPromotions } from "../progress/store.js";
import { useRoute } from "./use-route";
import { useShelf } from "./use-shelf";
import { useWorldMarkers, useWorldModel, type PathOverlay } from "./world-model";

/** No labels: the chest's close-up keeps the island to itself. */
const NO_MARKERS: readonly never[] = [];
import { universityCounters } from "@pieai/university-ui/navigation/counters.js";
import { STUDIO_MORE_ITEM } from "@pieai/university-ui/navigation/slots.js";
import { PresenceLayer, PresenceSession, presenceViewKey } from "@pieai/university-ui/presence.js";
import { watchThemePreference } from "@pieai/university-ui/theme.js";
import { bindWorldStylePreference, WorldStyleControl } from "@pieai/university-ui/world-style.js";
import { CompanionProbe } from "@pieai/university-world/companion-probe.js";
import {
  islandLookCameraForShot,
  resolveIslandLookDebug,
} from "@pieai/university-world/island-look.js";
import {
  WorldMapCanvas,
  type MapViewportCommands,
} from "@pieai/university-world/WorldMapCanvas.js";
import { resetWebGLContextProbe } from "@pieai/university-world/webgl-capability.js";
import { MainRouter } from "./MainRouter";
import { usePageMetadata } from "./page-metadata";
import { WorldSourceControls } from "../learner/WorldSourceControls";
import { useAnalyticsPorts } from "./analytics-ports";
import { useAvatarPreferences } from "./avatar-preferences";
import { useSkipTest } from "./skip-test.js";
import { useCoursePathActions } from "./course-path-actions";
import { useIslandLookSource, useIslandLookView } from "./island-look-view";
import { useMistakeSummary } from "./mistake-summary";
import { useSceneCamera } from "./scene-camera";
import { useSceneInteraction } from "./scene-interaction";
import { useStudyContext } from "./study-context";
import { readNavigationFocus } from "./navigation-focus.js";
import { mapDomainCatalog, studyForMapDomain } from "./map-domain-catalog.js";
import { useTodaySectionData } from "./today-section-data";
import { trackEvent, type AnalyticsEvent } from "../analytics/productAnalytics";
import { OpeningSplash, useOpeningAdmission } from "./OpeningSplash.js";
import { splashProgress } from "./splash-policy.js";
import { welcomeDestinations, type WelcomeDestination } from "../guide/first-meeting.js";
import { useWelcome } from "./use-welcome.js";
import { isWelcomeEntry } from "./welcome-policy.js";

type FeedbackContextSeed = Pick<
  FeedbackContext,
  "locator" | "contentRevision" | "exerciseAttemptCount" | "signedIn"
>;

export function App() {
  const interfaceTranslator = useI18n();
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
  const { shelf, studyNames, shelfError, retryShelf, studies, nodes, courseOf } = useShelf();
  const { view: routeView, setView } = useRoute();
  const welcome = useWelcome(routeView, progress, identityStatus.kind);
  const admission = useOpeningAdmission(routeView);
  const [firstMeeting, setFirstMeeting] = useState<{
    owner: string;
    destination: WelcomeDestination;
    /** A restored canvas must frame the pair again before the guide points. */
    framedAttempt: number | null;
  } | null>(null);
  const welcomePaths = useMemo(() => welcomeDestinations(studies), [studies]);
  const [avatarPanelOpen, setAvatarPanelOpen] = useState<string | null>(null);
  const returnEntry = useRef(
    typeof location !== "undefined" && isWelcomeEntry(new URL(location.href)),
  );
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
  } = useSceneInteraction(mapRouteKey);
  const retryScene = useCallback(() => {
    resetWebGLContextProbe();
    retrySceneState();
  }, [retrySceneState]);
  const [picked, setPicked] = useState<CourseNode | null>(null);
  const pickedCourse = picked ? courseOf(picked.studyId, picked.courseId) : null;
  /** The course cell the learner last chose, retained through its settlement. */
  const [courseAvatarTarget, setCourseAvatarTarget] = useState<{
    readonly studyId: string;
    readonly courseId: string;
    readonly lessonId: string | null;
    /** A learning node (gate, pennant or board) the avatar stands at instead of a lesson. */
    readonly nodeId: string | null;
  } | null>(null);
  const rememberCourseAvatarTarget = useCallback((lesson: LessonPlacement) => {
    setCourseAvatarTarget({
      studyId: lesson.studyId,
      courseId: lesson.courseId,
      lessonId: lesson.lessonId,
      nodeId: null,
    });
  }, []);
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
      onGoToCurrent: () => {
        rememberCourseAvatarTarget(live);
        mapCommands.current?.focus(live.position.toArray());
        setPathOverlay({
          kind: "node",
          unitId: live.unitId,
          lessonId: live.lessonId,
          returnFocusTo: null,
        });
      },
      onTest: segment
        ? () => {
            rememberCourseAvatarNode(learningNodeId(segment, "checkpoint"));
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
  const rememberCourseAvatarNode = useCallback(
    (nodeId: string) => {
      if (view.kind !== "course") return;
      setCourseAvatarTarget({
        studyId: view.studyId,
        courseId: view.courseId,
        lessonId: null,
        nodeId,
      });
    },
    [view],
  );
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
    captureLearningReturn(routeView);
    setAccountFocusRequest((current) => current + 1);
    setView({ kind: "me" });
  }, [routeView, setView]);
  const readEntitlements = useCallback(() => paymentPort.readEntitlements(), []);
  const lastRouteAnalyticsKey = useRef<string | null>(null);
  const reviewDueAnalyticsReported = useRef(false);
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
    if (view.kind === "lesson") void import("../screens/SettlementHost.js");
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
    onReview: () => setView({ kind: "practice" }),
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
    readAlbum: knowledge.read,
    courseTitle: course?.title,
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
    setCourseAvatarTarget(null);
  }, []);
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

  // Browsing an empty domain changes the planet focus, never the study/account
  // selection. Both DOM and globe consume this one transient selection owner.
  const planetDomainCatalog = useMemo(() => mapDomainCatalog(), []);
  const [planetDomainChoice, setPlanetDomainChoice] = useState<string | null>(null);
  const [planetStudyChoice, setPlanetStudyChoice] = useState<string | null>(null);
  const lastStudyByDomain = useRef(new Map<string, string>());
  const focusedPlanetDomainId =
    planetStudies.find((study) => study.id === focusedStudyId)?.domain?.id ??
    (focusedStudyId ? "unclassified" : "programming");
  const selectedPlanetDomainId = planetDomainChoice;
  useEffect(() => {
    if (focusedStudyId) lastStudyByDomain.current.set(focusedPlanetDomainId, focusedStudyId);
    if (view.kind !== "planet") {
      setPlanetDomainChoice(null);
      setPlanetStudyChoice(null);
    }
  }, [focusedPlanetDomainId, focusedStudyId, view.kind]);
  const selectPlanetDomain = useCallback(
    (domainId: string) => {
      if (
        !planetDomainCatalog.some((domain) => domain.id === domainId) &&
        !planetStudies.some((study) => (study.domain?.id ?? "unclassified") === domainId)
      )
        return;
      const restored = studyForMapDomain(
        domainId,
        planetStudies,
        focusedStudyId,
        lastStudyByDomain.current.get(domainId),
      );
      setPlanetDomainChoice(domainId);
      setPlanetStudyChoice(null);
      if (restored) setNavigationFocus(restored);
    },
    [focusedStudyId, planetDomainCatalog, planetStudies],
  );
  const selectPlanetStudy = useCallback(
    (studyId: string) => {
      const study = planetStudies.find((entry) => entry.id === studyId);
      if (!study) return;
      lastStudyByDomain.current.set(study.domain?.id ?? "unclassified", studyId);
      setPlanetDomainChoice(study.domain?.id ?? "unclassified");
      setPlanetStudyChoice(studyId);
      setNavigationFocus(studyId);
    },
    [planetStudies],
  );

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
    setCourseAvatarTarget: rememberCourseAvatarTarget,
    setCourseAvatarNode: rememberCourseAvatarNode,
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
  const firstMeetingHere =
    firstMeeting?.owner === guideUser &&
    view.kind === "course" &&
    view.studyId === firstMeeting.destination.lesson.studyId &&
    view.courseId === firstMeeting.destination.lesson.courseId
      ? firstMeeting.destination
      : null;
  useEffect(() => {
    if (firstMeeting && !firstMeetingHere) setFirstMeeting(null);
  }, [firstMeeting, firstMeetingHere]);
  const chooseWelcomePath = (destination: WelcomeDestination, assessment: boolean) => {
    // Re-resolve the real shelf identity, not an object retained from an older opening.
    const current = welcomePaths.find((path) => path.id === destination.id);
    if (!current || !welcome.visible) return;
    welcome.dismiss("lesson");
    setNavigationFocus(current.lesson.studyId);
    setFirstMeeting(
      assessment ? null : { owner: guideUser, destination: current, framedAttempt: null },
    );
    setView({ kind: "course", studyId: current.lesson.studyId, courseId: current.lesson.courseId });
    setPathOverlay(
      assessment ? { kind: "unit", unitId: current.lesson.unitId, returnFocusTo: null } : null,
    );
  };
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
  const clearPlanetPick = useCallback(() => {
    setPlanetDomainChoice(null);
    setPlanetStudyChoice(null);
  }, []);
  const enterPlanetStudy = (studyId: string) => {
    if (!planetStudies.some((study) => study.id === studyId && study.lessonCount > 0)) return;
    setNavigationFocus(studyId);
    setView({ kind: "world" });
  };
  useEffect(() => {
    if (view.kind === "world" || view.kind === "planet") setCourseAvatarTarget(null);
  }, [view.kind]);
  useEffect(() => {
    if (!mapMode) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input,textarea,select,[contenteditable="true"],[role="dialog"],[role="menu"]',
        )
      )
        return;
      if (
        document.querySelector(
          'dialog[open],[aria-modal="true"],.nav-rail__flyout,[data-mobile-panel="rail"],[data-mobile-panel="aside"]',
        )
      )
        return;
      if (view.kind === "planet") clearPlanetPick();
      else dismissPick();
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [mapMode, view.kind, clearPlanetPick, dismissPick]);
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
  useEffect(() => {
    if (!returnEntry.current) return;
    if (view.kind !== "world") {
      returnEntry.current = false;
      return;
    }
    if (admission.pending || !splashReady || identityStatus.kind === "pending") return;
    const owner =
      identityStatus.kind === "signed_in" || identityStatus.kind === "anonymous"
        ? identityStatus.user.id
        : null;
    if (progressPort.syncState().userId !== owner) return;
    if (progressPort.syncState().status === "syncing") return;
    returnEntry.current = false;
    if (welcome.visible || !todayLesson || Object.keys(progress.lessons).length === 0) return;
    journey.continueAt(todayLesson);
  }, [
    view.kind,
    admission.pending,
    splashReady,
    identityStatus,
    welcome.visible,
    todayLesson,
    progress,
    journey.continueAt,
  ]);
  const framedJourney = useRef<string | null>(null);
  useEffect(() => {
    if (!journey.target) {
      framedJourney.current = null;
      return;
    }
    const key = `${guideUser}:${sceneAttempt}:${lessonRefKey(journey.target)}`;
    if (!splashReady || framedJourney.current === key) return;
    const target = lessons.find((lesson) => lesson.lessonId === journey.target?.lessonId);
    if (!target || !mapCommands.current) return;
    framedJourney.current = key;
    mapCommands.current.focus(target.position.toArray());
  }, [journey.target, guideUser, sceneAttempt, splashReady, lessons]);
  const loadProgress = splashProgress(
    !waitingForData,
    sceneProgress.loaded,
    sceneProgress.total,
    sceneReady,
  );
  const showOpeningSplash = admission.pending && mapMode && !mapRecoveryReason;
  const framedFirstStone = useRef<string | null>(null);
  useEffect(() => {
    if (!firstMeetingHere) {
      framedFirstStone.current = null;
      return;
    }
    const key = `${guideUser}:${sceneAttempt}:${lessonRefKey(firstMeetingHere.lesson)}`;
    if (!splashReady || framedFirstStone.current === key) return;
    const stone = lessons.find((lesson) => lesson.lessonId === firstMeetingHere.lesson.lessonId);
    if (!stone || !mapCommands.current) return;
    // The learner explicitly chose this route. Frame that real stone once,
    // rather than the ordinary road's look-ahead point: its chest then stays
    // above the guide's bottom card even on a narrow phone. No scenery moves.
    framedFirstStone.current = key;
    mapCommands.current.focus(stone.position.toArray());
  }, [firstMeetingHere, guideUser, sceneAttempt, splashReady, lessons]);
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
    island:
      view.kind === "course" && course ? { studyId: view.studyId, courseId: course.id } : null,
    lessons,
    courseOf,
    onOpenLesson: openCourseLesson,
    onChest: chest.beginWeekly,
  });
  const labelMarkers = useMemo(() => {
    if (firstMeetingHere) {
      // One named place in this one-step tour. Other normal map labels return
      // on dismissal; their competing kind icons do not cover this close-up.
      return markers
        .filter((marker) => marker.id === firstMeetingHere.lesson.lessonId)
        .map((marker) => ({
          ...marker,
          text: interfaceTranslator.t("map.stop.lesson", { number: 1 }),
          position: marker.position.clone().setY(marker.position.y + 1.3),
        }));
    }
    return weekly.marker ? [...markers, weekly.marker] : markers;
  }, [markers, weekly.marker, firstMeetingHere, interfaceTranslator]);
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
            rememberCourseAvatarNode(learningNodeId(segment, nodeKind));
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
    if (sceneView.kind === "course" || sceneView.kind === "lesson") {
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
  }, [sceneView.kind, lessons, world]);
  const companionSurface =
    sceneView.kind === "course" || sceneView.kind === "lesson" ? "course" : "world";

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
  // V7 decision O1: a wisp comes back to each finished stone whose review cards are due.
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
  const lookSource = useIslandLookSource({
    inCourse,
    lessons,
    lookDebug,
    lookShotIsCourse,
    viewKind: view.kind,
    world,
  });
  const lookBounds = lookShotIsCourse
    ? (lookSource?.detailBounds ?? {
        halfX: lessons[0]?.blueprint.bounds.halfX ?? 1,
        halfZ: lessons[0]?.blueprint.bounds.halfZ ?? 1,
        outline: lessons[0]?.blueprint.outline,
      })
    : { halfX: world?.extent ?? 1, halfZ: world?.extent ?? 1 };
  const fixedCamera =
    import.meta.env.DEV &&
    lookDebug?.shot &&
    ((lookShotIsCourse && inCourse) || (lookDebug.shot === "world-design" && view.kind === "world"))
      ? islandLookCameraForShot(lookDebug.shot, lookBounds, lookViewport)
      : null;
  const stageCameraFrom = fixedCamera?.cameraFrom ?? cameraFrom;
  const stageLookAt = fixedCamera?.lookAt ?? lookAt;
  const stage =
    // Courseware keeps the lab's renderer boundary after moving into the
    // album: its games may own a canvas, so the map must release its own.
    view.kind === "avatar-lab" ||
    view.kind === "play-lab" ||
    (view.kind === "library" && view.tab === "courseware") ||
    studioMap ? null : (
      <WorldMapCanvas
        commandsRef={mapCommands}
        dataReady={!waitingForData}
        key={sceneAttempt}
        hidden={!showMap}
        paused={!showMap}
        // A course path is read at a shallower pitch than a world of islands.
        polar={view.kind === "world" ? WORLD_POLAR : COURSE_POLAR}
        // No world in a course view: the path below replaces it rather than
        // sitting behind it.
        world={view.kind === "world" ? world : null}
        courseViewKey={view.kind === "course" ? `${view.studyId}/${view.courseId}` : null}
        cameraFrom={stageCameraFrom}
        lookAt={stageLookAt}
        learnerAt={learnerAt}
        avatarRecipe={avatarRecipe}
        avatarSignedIn={avatarSignedIn}
        selectedCourseKey={
          view.kind === "world" && picked ? `${picked.studyId}/${picked.courseId}` : null
        }
        skyStudyId={focusedStudyId}
        // The chest's close-up is a moment of its own: no map labels over it.
        markers={openingOnMap ? NO_MARKERS : labelMarkers}
        followId={
          view.kind === "world" && picked
            ? picked.courseId
            : view.kind === "course" && pathOverlay?.kind === "node"
              ? // The live lesson and destinations beyond the bounded kind-icon
                // window use their real lesson label, not an invented icon ID.
                markers.some((marker) => marker.id === `kind:${pathOverlay.lessonId}`)
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
        onSceneReady={view.kind === "planet" ? undefined : onSceneReady}
        onSceneBusy={view.kind === "planet" ? undefined : onSceneBusy}
        onSceneProgress={view.kind === "planet" ? undefined : onSceneProgress}
        onContextLost={onContextLost}
        onContextRestored={onContextRestored}
        onRendererUnavailable={onRendererUnavailable}
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
                avatarLessonId={
                  firstMeetingHere?.lesson.lessonId ??
                  ((view.kind === "course" || view.kind === "lesson" || view.kind === "settled") &&
                  courseAvatarTarget?.studyId === view.studyId &&
                  courseAvatarTarget.courseId === view.courseId
                    ? courseAvatarTarget.lessonId
                    : null)
                }
                avatarNodeId={
                  view.kind === "course" &&
                  courseAvatarTarget?.studyId === view.studyId &&
                  courseAvatarTarget.courseId === view.courseId
                    ? courseAvatarTarget.nodeId
                    : null
                }
                onPickNode={(site) => {
                  if (view.kind !== "course" || !course) return;
                  const segment = learningSegments(course).find(
                    (item) => item.id === site.segment.id,
                  );
                  if (!segment) return;
                  // The same as a lesson stone: a locked stop explains, an open one is hopped to.
                  const locked = learningSiteLocked(site, lessons);
                  if (!locked) rememberCourseAvatarNode(site.id);
                  setPathOverlay({
                    kind: "stop",
                    segment,
                    nodeKind: site.kind,
                    unitId: segment.unitId,
                    locked,
                    returnFocusTo: labelNodes.current.get(site.id) ?? null,
                  });
                }}
                skyStudyId={inCourse ? view.studyId : null}
                onPick={(lesson) => {
                  if (view.kind !== "course") return;
                  // A locked stone opens its explanation; the avatar stays put.
                  if (lesson.state !== "locked") rememberCourseAvatarTarget(lesson);
                  setPathOverlay({
                    kind: "node",
                    unitId: lesson.unitId,
                    lessonId: lesson.lessonId,
                    returnFocusTo: labelNodes.current.get(lesson.lessonId) ?? null,
                  });
                }}
                onHover={(lesson) => setHovered(lesson ? lesson.lessonId : null)}
                opening={openingOnMap || chest.weekly ? chest.opening : null}
                introductoryLessonId={firstMeetingHere?.lesson.lessonId ?? null}
                onIntroductionReady={(lessonId) => {
                  setFirstMeeting((current) =>
                    current &&
                    current.framedAttempt !== sceneAttempt &&
                    current.owner === guideUser &&
                    current.destination === firstMeetingHere &&
                    current.destination.lesson.lessonId === lessonId
                      ? { ...current, framedAttempt: sceneAttempt }
                      : current,
                  );
                }}
                reviewDue={reviewDue}
                weeklyBoss={weekly.scene}
                onPickWeeklyBoss={weekly.open}
              />
            ) : null}
          </>
        }
        overlay={
          <>
            {weekly.overlay}
            {chest.weekly ? chest.overlay : null}
            <PresenceLayer
              port={presencePort}
              surface={companionSurface}
              viewKey={presenceView}
              attach={(userId, element) => {
                if (element) companionNodes.current.set(userId, element);
                else companionNodes.current.delete(userId);
              }}
            />
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
        }
        /*
          These are separate promises with separate retirement rules. Pan and
          zoom can self-teach on the first gesture; the island-entry action
          cannot, so it remains until an actual island pick teaches it — as
          the first sentence of the map's guide (V5 #map-guide).
        */
        hoverHint={hovered}
        controlsHint={<MapControlsHint />}
        controlsHintVisible={!mapInteracted && !hovered}
        guide={
          guideMap ? (
            <MapGuide
              map={guideMap}
              ready={splashReady && !admission.pending && !mapCover}
              invitation={
                welcome.visible && welcomePaths.length > 0
                  ? {
                      choices: welcomePaths,
                      onChoose: chooseWelcomePath,
                      onBrowse: () => {
                        welcome.dismiss("map");
                        setView({ kind: "planet" });
                      },
                      onSignIn: () => {
                        welcome.dismiss("account");
                        openAccount();
                      },
                      onDismiss: () => welcome.dismiss("map"),
                    }
                  : null
              }
              firstStone={
                firstMeetingHere
                  ? {
                      id: `${guideUser}:${firstMeetingHere.lesson.studyId}:${firstMeetingHere.lesson.courseId}:${firstMeetingHere.lesson.lessonId}`,
                      lessonId: firstMeetingHere.lesson.lessonId,
                      ready: firstMeeting?.framedAttempt === sceneAttempt,
                      onDismiss: () => setFirstMeeting(null),
                      onEnter: () => {
                        setFirstMeeting(null);
                        setView({ kind: "lesson", ...firstMeetingHere.lesson });
                      },
                    }
                  : null
              }
              journey={journey.opening}
              onShortcuts={shortcuts.show}
              onOpenDetails={() => setView({ kind: "settings" })}
            />
          ) : null
        }
        loading={
          mapRecoveryReason ? (
            <RecoveryState
              reason={mapRecoveryReason}
              onRetry={retryScene}
              onContinue={todayLesson ? continueToTodayLesson : undefined}
              overlay
            />
          ) : mapCover && !showOpeningSplash ? (
            <OpeningSplash mode="transition" progress={loadProgress} ready={splashReady} />
          ) : null
        }
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

  const selectedDomain = planetDomainCatalog.find((domain) => domain.id === planetDomainChoice);
  const selectedStudy = planetStudies.find((study) => study.id === planetStudyChoice);
  const currentStudy = studies.find((study) => study.id === focusedStudyId);
  const mapInfo: MapInformationData =
    view.kind === "planet"
      ? selectedStudy
        ? {
            id: `study:${selectedStudy.id}`,
            title: selectedStudy.title,
            kind: "study",
            description: selectedStudy.description,
            facts: [
              interfaceTranslator.t("map.counts", {
                courses: selectedStudy.courseCount,
                lessons: selectedStudy.lessonCount,
              }),
            ],
          }
        : selectedDomain
          ? {
              id: `domain:${selectedDomain.id}`,
              title: selectedDomain.title,
              kind: "domain",
              description: selectedDomain.description,
              sections: [
                {
                  title: interfaceTranslator.t("map.study"),
                  lines: planetStudies
                    .filter((study) => (study.domain?.id ?? "unclassified") === selectedDomain.id)
                    .map((study) => study.title),
                },
              ],
              facts: planetStudies.some((study) => study.domain?.id === selectedDomain.id)
                ? [
                    interfaceTranslator.t("map.counts", {
                      courses: planetStudies
                        .filter((study) => study.domain?.id === selectedDomain.id)
                        .reduce((sum, study) => sum + study.courseCount, 0),
                      lessons: planetStudies
                        .filter((study) => study.domain?.id === selectedDomain.id)
                        .reduce((sum, study) => sum + study.lessonCount, 0),
                    }),
                  ]
                : [interfaceTranslator.t("ui.world.domain.unpublished")],
            }
          : {
              id: "planet:none",
              title: interfaceTranslator.t("ui.world.navigation.planets"),
              kind: "none",
              description: interfaceTranslator.t("map.chooseHint"),
            }
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
          : {
              id: `study:${focusedStudyId ?? "none"}`,
              title:
                currentStudy?.title ?? interfaceTranslator.t("ui.world.navigation.archipelago"),
              kind: "study",
              description:
                (currentStudy && "description" in currentStudy ? currentStudy.description : null) ||
                interfaceTranslator.t("map.chooseHint"),
            };

  const destinations: MapDestination[] =
    view.kind === "planet"
      ? planetDomainCatalog.map((domain) => ({
          id: domain.id,
          title: domain.title,
          detail: domain.description,
          select: () => selectPlanetDomain(domain.id),
        }))
      : view.kind === "course" && course
        ? course.units.flatMap((unit) =>
            unit.lessons.map((lesson) => ({
              id: lesson.id,
              title: lesson.title,
              detail: unit.title,
              select: () => {
                const placement = lessons.find((item) => item.lessonId === lesson.id);
                if (!placement) return;
                if (placement.state !== "locked") rememberCourseAvatarTarget(placement);
                mapCommands.current?.focus(placement.position.toArray());
                setPathOverlay({
                  kind: "node",
                  unitId: unit.id,
                  lessonId: lesson.id,
                  returnFocusTo: null,
                });
              },
            })),
          )
        : (nodes ?? [])
            .filter((node) => node.studyId === focusedStudyId)
            .map((node) => ({
              id: node.courseId,
              title: node.title,
              select: () => {
                const placement = world?.placements.find(
                  (entry) =>
                    entry.node.courseId === node.courseId && entry.node.studyId === node.studyId,
                );
                if (placement) mapCommands.current?.focus(placement.position.toArray());
                setPicked(node);
              },
            }));
  const quickCommands: MapQuickCommand[] = [
    ...(showMap
      ? [
          {
            id: "overview",
            title: interfaceTranslator.t("map.overview"),
            run: () => mapCommands.current?.overview(),
          },
          {
            id: "learning-view",
            title: interfaceTranslator.t("map.resetView"),
            run: () => mapCommands.current?.learningView(),
          },
        ]
      : []),
    ...(view.kind !== "planet"
      ? [
          {
            id: "back",
            title: interfaceTranslator.t("map.back"),
            run: () => setView({ kind: view.kind === "course" ? "world" : "planet" }),
          },
        ]
      : []),
    ...(picked || pathOverlay?.kind === "node" || pathOverlay?.kind === "stop" || planetDomainChoice
      ? [
          {
            id: "clear",
            title: interfaceTranslator.t("map.clear"),
            run: () => {
              dismissPick();
              clearPlanetPick();
            },
          },
        ]
      : []),
  ];
  const aside = (
    <>
      {mapShell ? <MapInformation data={mapInfo} /> : null}
      {view.kind === "settings" ? <SettingsSubnav /> : null}
    </>
  );

  const renderAvatarPanel = (inDialog = false) => (
    <AvatarPanel
      avatar={
        <RailIdentity
          recipe={avatarRecipe}
          signedIn={avatarSignedIn}
          label={!wide && !inDialog ? interfaceTranslator.t("journey.avatar.open") : undefined}
          onOpen={() => {
            if (!wide && !inDialog) setAvatarPanelOpen(guideUser);
            else {
              setAvatarPanelOpen(null);
              openAccount();
            }
          }}
        />
      }
      todayProgress={todayGoalProgress(progress, panelNow)}
      streakDays={progress.streak.days}
      rank={{
        name: leagueTierName(standing.tier),
        emblem: <EmblemImage kind="rank" id={standing.tier.id} size={56} />,
      }}
      level={<LevelProgress totalXp={progress.totalXp} rail />}
      week={studyWeek(progress, panelNow)}
      today={{ done: lessonQuest?.done ?? 0, goal: lessonQuest?.goal ?? 1 }}
      rest={{
        balance: restTicketBalance(progress.streak),
        covered: progress.streak.rest?.covered.length ?? 0,
      }}
      membership={{ href: toPath({ kind: "plans" }) }}
    />
  );
  const main = (
    <MainRouter
      album={knowledge.album}
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
      planetDomainCatalog={planetDomainCatalog}
      selectedPlanetDomainId={selectedPlanetDomainId}
      selectedPlanetStudyId={planetStudyChoice}
      onEnterPlanetStudy={enterPlanetStudy}
      onClearPlanetPick={clearPlanetPick}
      onSelectPlanetDomain={selectPlanetDomain}
      onSelectPlanetStudy={selectPlanetStudy}
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
      studyNames={studyNames}
      todayNode={todayNode}
      todaySection={todaySection}
      uncorrectedMistakeCount={uncorrectedMistakeCount}
      view={view}
    />
  );
  // The avatar panel reads the record for today; the rail re-renders with it.
  const panelNow = Date.now();
  const standing = leagueStanding(progress, panelNow);
  const lessonQuest = questsForToday(progress, panelNow).find((quest) => quest.id === "lesson");
  const feedbackSurface = (
    <FeedbackNote
      shell={CAMPUS_NAME}
      port={feedbackPort}
      context={feedbackContext}
      lessonTitle={feedbackLesson?.title ?? null}
      surface={
        view.kind === "me" || view.kind === "auth-callback" || view.kind === "auth-reset"
          ? "account"
          : feedbackLocator
            ? "lesson"
            : "default"
      }
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
      <>
        <div className="app app--lesson">
          <PresenceSession port={presencePort} location={presenceLocation} viewKey={presenceView} />
          <Suspense fallback={<RouteFallback />}>
            <LessonScreen
              locator={reading}
              course={course}
              studyTitle={studies.find((study) => study.id === view.studyId)?.title ?? view.studyId}
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
                if (
                  courseAvatarTarget?.studyId === view.studyId &&
                  courseAvatarTarget.courseId === view.courseId &&
                  courseAvatarTarget.lessonId === view.lessonId
                ) {
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
                chest.begin({
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
          /*
          The workbench's own way in, behind 更多 and only where there is a
          workbench. `G` compares the rail's own destinations between the two
          builds and deliberately excludes what sits behind 更多 — that is the
          one place a real difference between them is allowed to show.
        */
          extraMoreItems={[
            ...(mapMode
              ? [
                  {
                    id: "map-shortcuts",
                    label: interfaceTranslator.t("map.shortcuts"),
                    href: "#map-shortcuts",
                    icon: <span aria-hidden="true">⌘</span>,
                    onActivate: shortcuts.show,
                  },
                ]
              : []),
            ...(AUTHORING ? [STUDIO_MORE_ITEM] : []),
          ]}
          counters={
            shellConfig.showLearnerChrome
              ? mapMode
                ? // The streak sits on the avatar's face right above; twice is noise.
                  counters.filter((counter) => !counter.control && counter.id !== "streak")
                : counters
              : undefined
          }
          identity={shellConfig.showLearnerChrome ? renderAvatarPanel() : null}
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
          <PresenceSession port={presencePort} location={presenceLocation} viewKey={presenceView} />
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
        <GameModal
          open
          className="journey-avatar-modal"
          size="sm"
          title={interfaceTranslator.t("journey.avatar.title")}
          closeLabel={interfaceTranslator.t("journey.avatar.close")}
          onClose={() => setAvatarPanelOpen(null)}
          footer={
            <GameButton
              variant="secondary"
              static
              onClick={() => {
                setAvatarPanelOpen(null);
                openAccount();
              }}
            >
              {interfaceTranslator.t("product.account.open")}
            </GameButton>
          }
        >
          {renderAvatarPanel(true)}
        </GameModal>
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
