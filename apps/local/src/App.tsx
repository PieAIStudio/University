import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { GameCallout } from "@pieai/swimmer-ui-kit";
import { bindProgressToIdentity } from "@pieai/university-backend/session.js";
import { UniversityShell } from "@pieai/university-ui/navigation/UniversityShell.js";
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
import { PracticeSurface, createProgressPracticeRecentStore } from "@pieai/university-ui";
import { STUDIO_MORE_ITEM } from "@pieai/university-ui/navigation/slots.js";
import { universityCounters } from "@pieai/university-ui/navigation/counters.js";
import {
  focusedStudyId as resolveFocusedStudy,
  StudySwitcher,
  type StudySwitchItem,
} from "@pieai/university-ui/navigation/StudySwitcher.js";
import {
  activeIdForView,
  completedLessons,
  fromHash,
  lessonKey,
  type LessonDocumentKey,
  lessonKeyOf,
  lessonRefKey,
  studyIdOfView,
  toHash,
  WORLD,
  type CardProgress,
  type ProgressPort,
  type View,
} from "@pieai/university-core";
import type { LexiconEntry } from "@pieai/university-core";
import { armSoundUnlock, SoundToggle } from "@pieai/university-ui/sound/index.js";
import { cardContentPath, lessonPath, readJson } from "@pieai/university-ui/api/client.js";
import type { LessonLinkTarget } from "@pieai/university-ui/markdown/remark-lesson-links.js";
import { LINK_RETURN_DEPTH, LessonReader } from "@pieai/university-ui/lesson/LessonReader.js";
import { lessonNeighbours } from "@pieai/university-ui/lesson/LessonNav.js";
import { createHttpGradingPort } from "./ports/http-grading.js";
import { createHttpReaderPort } from "./ports/http-reader.js";
import { createHttpReviewPort, createLocalVocabularyReviewPort } from "./ports/http-review.js";
import type {
  BootstrapData,
  CourseReviewCardLocator,
  LessonRef,
  LessonView,
  NextLesson,
  StudyView,
  TodayCard,
} from "@pieai/university-ui/view/lesson-view.js";
import { legacyAddressOf } from "./legacy-address.js";
import { progressPort } from "./progress/store.js";
import { cloudProgressRemoteStore } from "./progress/store.js";
import { identityPort } from "./account/identity.js";
import { presencePort } from "./presence/store.js";
import { PresenceSession, presenceViewKey } from "@pieai/university-ui/presence.js";
import { TodaySection, type TodaySectionData } from "@pieai/university-ui/today/TodaySection.js";
import { EmptyCampus } from "./shell/EmptyCampus.js";
import { libraryOpening, LibraryScreen } from "./screens/LibraryScreen.js";
import { LocalCatalog } from "./screens/LocalCatalog.js";
import { recentStudies, StudyShelf } from "./shell/StudyShelf.js";
import { StudioSection } from "./shell/StudioSection.js";
import { StudyDetail } from "./shell/StudyDetail.js";
import { RailIdentity } from "@pieai/university-world/avatar.js";
import { PlanetRail, PlanetStage, type PlanetStudy } from "@pieai/university-world/planet.js";
import lexiconFile from "../data/vocabulary/en.json";

import { WorldLanding } from "./shell/WorldLanding.js";
import { lessonsDoneOf } from "./shell/world-graph.js";

const LOCAL_LEXICON = lexiconFile.entries as readonly LexiconEntry[];
const LOCAL_PRACTICE_STORE = createProgressPracticeRecentStore(progressPort);

interface DisplayedStudy {
  readonly locator: string;
  readonly view: StudyView;
}

interface DisplayedLesson {
  readonly locatorKey: string;
  readonly locator: LessonRef;
  readonly view: LessonView;
}

function todayDataOf(
  data: BootstrapData,
  progress: ProgressPort,
  cloudCard: TodayCard | null,
  catalog: ReadonlyMap<string, StudyView>,
): TodaySectionData {
  const due = progress.dueCards();
  const cloudDocumentIsActive =
    progress.syncState().userId !== null || Object.keys(progress.snapshot().cards).length > 0;
  return {
    card: cloudCard ?? (!cloudDocumentIsActive ? data.today.card : null),
    nextLesson: localNextLessonOf(data, progress, catalog),
    dueCount: cloudDocumentIsActive ? due.length : data.today.dueCount,
    focus: data.today.focus
      ? {
          study:
            data.studies.find((study) => study.id === data.today.focus?.studyId)?.title ??
            data.today.focus.studyId,
          detail: data.today.focus.courseIds.join(" · "),
        }
      : null,
    issues: data.today.issues,
  };
}

function localNextLessonOf(
  data: BootstrapData,
  progress: ProgressPort,
  catalog: ReadonlyMap<string, StudyView>,
): NextLesson | null {
  for (const study of data.studies) {
    const view = catalog.get(study.id);
    if (!view) continue;
    for (const course of view.courses) {
      for (const unit of course.units) {
        for (const lesson of unit.lessons) {
          const state = progress.lessonState(lessonKey(study.id, course.id, lesson.id));
          const readConfirmed =
            state.readConfirmed === true &&
            (state.readConfirmedRevision === undefined ||
              state.readConfirmedRevision === lesson.contentRevision);
          const legacyComplete = state.readConfirmed === undefined && state.progress >= 1;
          if (state.progress >= 1 && (readConfirmed || legacyComplete)) continue;
          return {
            studyId: study.id,
            studyTitle: study.title,
            courseId: course.id,
            courseTitle: course.title,
            unitId: unit.id,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            contentRevision: lesson.contentRevision,
            progress:
              state.progress <= 0
                ? state.readConfirmed === true
                  ? {
                      contentRevision: lesson.contentRevision,
                      status: "in-progress",
                      progress: state.progress,
                      updatedAt: new Date().toISOString(),
                      readConfirmed: true,
                    }
                  : null
                : {
                    contentRevision: lesson.contentRevision,
                    status: state.progress >= 1 ? "completed" : "in-progress",
                    progress: state.progress,
                    updatedAt: new Date(state.completedAt ?? Date.now()).toISOString(),
                    readConfirmed: readConfirmed || legacyComplete,
                  },
          };
        }
      }
    }
  }
  return data.today.nextLesson;
}

function localCardLocatorOf(
  card: CardProgress | null,
  catalog: ReadonlyMap<string, StudyView>,
): CourseReviewCardLocator | null {
  if (!card) return null;
  const parts = card.cardKey.split("/");
  const cardId = parts.at(-1);
  const course = catalog.get(card.studyId)?.courses.find((item) => item.id === card.courseId);
  const lesson = course?.units
    .flatMap((unit) => unit.lessons.map((item) => ({ unit, item })))
    .find(({ item }) => item.id === card.lessonId);
  if (!lesson || !cardId) return null;
  return {
    kind: "course-card",
    studyId: card.studyId,
    courseId: card.courseId,
    unitId: lesson.unit.id,
    lessonId: card.lessonId,
    cardId,
    // Lesson summaries intentionally do not carry card bodies. The review
    // port resolves the body through the shell's content route, which also
    // works when this scheduler state came from another computer.
    front: "",
    contentRevision: card.contentRevision ?? 1,
  };
}

function todayCardKey(card: TodayCard): string {
  if (card.kind !== "course-card") return "";
  return `${card.studyId}/${card.courseId}/${card.lessonId}/${card.cardId}`;
}

interface LocalLearningExport {
  readonly studies: readonly {
    readonly studyId: string;
    readonly lessons: readonly {
      readonly lessonKey: string;
      readonly contentRevision: number;
      readonly status: "not-started" | "in-progress" | "completed";
      readonly progress: number;
      readonly updatedAt: string;
      readonly readConfirmed?: boolean;
    }[];
    readonly cards: readonly {
      readonly studyId: string;
      readonly cardKey: string;
      readonly contentRevision: number;
      readonly dueAt: string;
      readonly stability: number;
      readonly difficulty: number;
      readonly elapsedDays: number;
      readonly scheduledDays: number;
      readonly learningSteps: number;
      readonly reps: number;
      readonly lapses: number;
      readonly state: number;
      readonly lastReviewAt?: string;
    }[];
    readonly exercises: readonly {
      readonly commandId: string;
      readonly exerciseKey: string;
      readonly contentRevision: number;
      readonly score: number;
      readonly maxScore: number;
      readonly response: unknown;
      readonly occurredAt: string;
    }[];
    readonly retrievalAttempts: readonly {
      readonly commandId: string;
      readonly cardKey: string;
      readonly contentRevision: number;
      readonly answer: string;
      readonly revealedAt: string;
      readonly durationMs: number;
      readonly usedHint: boolean;
      readonly confidence?: number;
    }[];
    readonly readerMarks: readonly {
      readonly markId: string;
      readonly lessonKey: string;
      readonly contentRevision: number;
      readonly kind: "question" | "highlight";
      readonly quote: { readonly exact: string; readonly prefix: string; readonly suffix: string };
      readonly sectionTitle: string | null;
      readonly note: string | null;
      readonly createdAt: string;
      readonly resolvedAt: string | null;
    }[];
  }[];
  readonly vocabulary: readonly {
    readonly senseId: string;
    readonly stage: "candidate" | "learning" | "familiar" | "stable" | "paused";
    readonly dueAt: string | null;
    readonly reps: number;
    readonly lapses: number;
    readonly updatedAt: string;
  }[];
}

function cardProgressFromExport(
  card: LocalLearningExport["studies"][number]["cards"][number],
): CardProgress | null {
  const parts = card.cardKey.split("/");
  if (parts.length !== 4) return null;
  const [courseId, , lessonId, cardId] = parts;
  if (!courseId || !lessonId || !cardId) return null;
  return {
    cardKey: `${card.studyId}/${courseId}/${lessonId}/${cardId}`,
    studyId: card.studyId,
    courseId,
    lessonId,
    dueAt: Date.parse(card.dueAt),
    fsrs: {
      due: card.dueAt,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: card.elapsedDays,
      scheduled_days: card.scheduledDays,
      learning_steps: card.learningSteps,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state as CardProgress["fsrs"]["state"],
      ...(card.lastReviewAt ? { last_review: card.lastReviewAt } : {}),
    },
  };
}

function importLocalLearningExport(exported: LocalLearningExport, progress: ProgressPort): void {
  for (const study of exported.studies) {
    for (const lesson of study.lessons) {
      const [courseId, , lessonId] = lesson.lessonKey.split("/");
      if (!courseId || !lessonId) continue;
      const key = lessonKey(study.studyId, courseId, lessonId);
      if (lesson.progress > progress.lessonState(key).progress) {
        progress.advanceLesson(key, lesson.progress);
      }
      if (lesson.readConfirmed) {
        progress.confirmLessonRead(key, lesson.contentRevision);
      }
    }
    for (const card of study.cards) {
      const imported = cardProgressFromExport(card);
      if (imported) progress.importCard(imported);
    }
    for (const attempt of study.exercises) {
      const [courseId, unitId, lessonId, exerciseId] = attempt.exerciseKey.split("/");
      if (!courseId || !unitId || !lessonId || !exerciseId) continue;
      const response =
        attempt.response && typeof attempt.response === "object"
          ? (attempt.response as Record<string, unknown>)
          : {};
      const answer = typeof response.answer === "string" ? response.answer : "";
      const hostGrade =
        response.phase === "host-grade"
          ? {
              passed: attempt.score >= attempt.maxScore,
              evaluation: typeof response.evaluation === "string" ? response.evaluation : "",
              extensions: Array.isArray(response.extensions)
                ? response.extensions.filter((item): item is string => typeof item === "string")
                : [],
              host: typeof response.host === "string" ? response.host : null,
              learnerAnswer: answer,
              occurredAt: attempt.occurredAt,
            }
          : null;
      progress.recordExerciseAttempt({
        commandId: attempt.commandId,
        locator: {
          studyId: study.studyId,
          courseId,
          unitId,
          lessonId,
        },
        exerciseId,
        contentRevision: attempt.contentRevision,
        answer,
        score: attempt.score,
        maxScore: attempt.maxScore,
        hostGrade,
        occurredAt: attempt.occurredAt,
      });
    }
    for (const attempt of study.retrievalAttempts) {
      progress.recordRetrievalAttempt({
        commandId: attempt.commandId,
        cardKey: attempt.cardKey,
        contentRevision: attempt.contentRevision,
        answer: attempt.answer,
        revealedAt: attempt.revealedAt,
        durationMs: attempt.durationMs,
        usedHint: attempt.usedHint,
        ...(attempt.confidence === undefined ? {} : { confidence: attempt.confidence }),
      });
    }
    for (const mark of study.readerMarks) {
      progress.saveReaderMark({
        markId: mark.markId,
        lessonKey: `${study.studyId}/${mark.lessonKey}`,
        contentRevision: mark.contentRevision,
        kind: mark.kind,
        quote: mark.quote,
        sectionTitle: mark.sectionTitle,
        note: mark.note,
        createdAt: mark.createdAt,
        resolvedAt: mark.resolvedAt,
      });
      if (mark.resolvedAt) progress.resolveReaderMark(study.studyId, mark.markId);
    }
  }
  for (const word of exported.vocabulary) {
    if (word.stage === "candidate") continue;
    progress.importWord({
      senseId: word.senseId,
      stage: word.stage === "stable" ? "familiar" : word.stage,
      dueAt: word.dueAt === null ? null : Date.parse(word.dueAt),
      lapses: word.lapses,
      fsrs: null,
    });
  }
}

/**
 * Move the old per-study SQLite read model into the shared cloud document on
 * first sight, then read the cloud document back into the local view.
 *
 * The server still owns authoring content and the clipboard host workflow. It
 * no longer owns the learner's cross-device standing; that is the one place
 * this overlay deliberately crosses the local HTTP boundary.
 */
function syncStudyProgressToCloud(view: StudyView, progress: ProgressPort): void {
  for (const course of view.courses) {
    for (const unit of course.units) {
      for (const lesson of unit.lessons) {
        const local = lesson.progress;
        if (!local) continue;
        const key = lessonKey(view.study.id, course.id, lesson.id);
        if (local.progress > progress.lessonState(key).progress) {
          progress.advanceLesson(key, local.progress);
        }
        if (local.readConfirmed) {
          progress.confirmLessonRead(key, local.contentRevision);
        }
      }
    }
  }
}

function cloudLessonProgress(
  current: StudyView["courses"][number]["units"][number]["lessons"][number]["progress"],
  progress: ProgressPort,
  key: LessonDocumentKey,
): typeof current {
  const state = progress.lessonState(key);
  const readConfirmed =
    state.readConfirmed === true &&
    (state.readConfirmedRevision === undefined ||
      state.readConfirmedRevision === (current?.contentRevision ?? 1));
  if (state.progress <= 0 && !readConfirmed) return current;
  const completed = state.progress >= 1 && (readConfirmed || state.readConfirmed === undefined);
  return {
    contentRevision: current?.contentRevision ?? 1,
    status: completed ? "completed" : "in-progress",
    progress: state.progress,
    updatedAt: new Date(state.completedAt ?? Date.now()).toISOString(),
    readConfirmed: readConfirmed || current?.readConfirmed === true,
  };
}

function overlayStudyProgress(view: StudyView, progress: ProgressPort): StudyView {
  return {
    ...view,
    courses: view.courses.map((course) => ({
      ...course,
      units: course.units.map((unit) => ({
        ...unit,
        lessons: unit.lessons.map((lesson) => ({
          ...lesson,
          progress: cloudLessonProgress(
            lesson.progress,
            progress,
            lessonKey(view.study.id, course.id, lesson.id),
          ),
        })),
      })),
    })),
  };
}

function syncLessonRecordToCloud(
  view: LessonView,
  locator: LessonRef,
  progress: ProgressPort,
): void {
  const local = view.lesson.progress;
  const key = lessonKey(locator.studyId, locator.courseId, locator.lessonId);
  if (local && local.progress > progress.lessonState(key).progress) {
    progress.advanceLesson(key, local.progress);
  }
  if (local?.readConfirmed) {
    progress.confirmLessonRead(key, local.contentRevision);
  }
  if (local?.status === "completed" && local.readConfirmed) {
    progress.dropCards(
      locator.studyId,
      locator.courseId,
      locator.lessonId,
      view.lesson.cards.map((card) => card.id),
    );
  }
  for (const exercise of view.lesson.exercises) {
    const answer = exercise.latestSubmission?.answer ?? exercise.hostGrade?.learnerAnswer ?? null;
    if (answer === null && !exercise.hostGrade) continue;
    const occurredAt = exercise.hostGrade?.occurredAt ?? exercise.latestSubmission?.occurredAt;
    if (!occurredAt) continue;
    progress.recordExerciseAttempt({
      commandId: `local-view:${locator.studyId}/${locator.courseId}/${locator.unitId}/${locator.lessonId}/${exercise.id}@${exercise.contentRevision}`,
      locator,
      exerciseId: exercise.id,
      contentRevision: exercise.contentRevision,
      answer: answer ?? "",
      score: exercise.hostGrade?.passed ? 1 : 0,
      maxScore: 1,
      hostGrade: exercise.hostGrade
        ? {
            passed: exercise.hostGrade.passed,
            evaluation: exercise.hostGrade.evaluation,
            extensions: exercise.hostGrade.extensions,
            host: exercise.hostGrade.host,
            learnerAnswer: exercise.hostGrade.learnerAnswer,
            occurredAt: exercise.hostGrade.occurredAt,
          }
        : null,
      occurredAt,
    });
  }
}

function overlayLessonRecord(
  view: LessonView,
  locator: LessonRef,
  progress: ProgressPort,
): LessonView {
  return {
    ...view,
    lesson: {
      ...view.lesson,
      progress: cloudLessonProgress(
        view.lesson.progress,
        progress,
        lessonKey(locator.studyId, locator.courseId, locator.lessonId),
      ),
      exercises: view.lesson.exercises.map((exercise) => {
        const latest = progress.latestExerciseAttempt(
          locator,
          exercise.id,
          exercise.contentRevision,
        );
        if (!latest) return exercise;
        const localAt = Date.parse(
          exercise.hostGrade?.occurredAt ?? exercise.latestSubmission?.occurredAt ?? "",
        );
        if (Number.isFinite(localAt) && localAt > Date.parse(latest.occurredAt)) return exercise;
        return {
          ...exercise,
          awaitingHostGrade: latest.hostGrade?.passed !== true,
          latestSubmission: { answer: latest.answer, occurredAt: latest.occurredAt },
          hostGrade: latest.hostGrade
            ? {
                passed: latest.hostGrade.passed,
                evaluation: latest.hostGrade.evaluation,
                extensions: latest.hostGrade.extensions,
                host: latest.hostGrade.host,
                learnerAnswer: latest.hostGrade.learnerAnswer,
                occurredAt: latest.hostGrade.occurredAt,
              }
            : null,
        };
      }),
    },
  };
}

/**
 * `/Users/name/…` and `/home/name/…` collapsed to `~/…`.
 *
 * Matched on the shape of the path rather than against a home directory the
 * browser cannot see. Anything that does not look like a home path is returned
 * untouched, so a studies root somewhere else stays fully spelled out.
 */
export function shortenHomePath(path: string): string {
  const match = /^\/(?:Users|home)\/[^/]+(?=\/|$)/.exec(path);
  return match ? `~${path.slice(match[0].length)}` : path;
}

/**
 * Where this document opens.
 *
 * One address now — the hash — so this also translates the pathname the
 * authoring campus used to carry. `replaceState`, not `pushState`: the old
 * form is not a place anyone should be able to press Back into. Idempotent, so
 * StrictMode's double render is not a second migration.
 */
function openingAddress(): { readonly view: View; readonly studyId: string | null } {
  const legacy = legacyAddressOf(window.location.pathname);
  const view = routable(legacy?.view ?? fromHash(window.location.hash));
  if (legacy) window.history.replaceState(null, "", `/${toHash(view)}`);
  return { view, studyId: legacy?.studyId ?? studyIdOfView(view) };
}

/**
 * A destination this campus can actually answer.
 *
 * The settlement screen and the gloss-avatar lab are delivery surfaces; this
 * campus has never had either. One address space does not mean one set of
 * screens, so a hash with nothing behind it here lands on the nearest place
 * that does — which is what it did before, when an unknown segment simply read
 * as the learn slot.
 */
function routable(view: View): View {
  if (view.kind === "settled") {
    return { kind: "course", studyId: view.studyId, courseId: view.courseId };
  }
  return view.kind === "avatar-lab" ? WORLD : view;
}

function commitView(update: () => void): void {
  const documentWithTransition = document as Document & {
    startViewTransition?: (callback: () => void) => {
      readonly ready?: Promise<unknown>;
      readonly finished?: Promise<unknown>;
    };
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (documentWithTransition.startViewTransition && !reducedMotion) {
    const transition = documentWithTransition.startViewTransition(update);
    /*
      An interrupted transition is normal, not a failure. Opening a lesson while
      the previous transition is still running skips the first one, and the spec
      rejects its `ready` and `finished` promises when that happens — which,
      unhandled, surfaced as `Uncaught (in promise) InvalidStateError` on every
      quick second navigation. The DOM update is unaffected: a skipped
      transition still runs its callback, so only the animation is lost.

      Deliberately not catching `updateCallbackDone`: that one carries errors
      thrown by `update` itself, and those are real.
    */
    transition?.ready?.catch(() => undefined);
    transition?.finished?.catch(() => undefined);
    return;
  }
  update();
}

export function App() {
  // Same latch as the delivery shell, for the same reason: the browser will not
  // start an AudioContext until a gesture, and this is where the gesture is
  // noticed. Authoring and delivery share one implementation of this, which is
  // the point of `packages/ui`.
  useEffect(() => armSoundUnlock(), []);

  // Same document the delivery shell reads, same subscription. A quest that
  // took its numbers from a hardcoded empty object would compile and still be
  // the invented answer this campus used to refuse to give.
  const progress = useSyncExternalStore(progressPort.subscribe, progressPort.snapshot);

  // Local and online use the same account-to-cloud binding. The local host
  // grading path remains different; the learner's data path does not.
  useEffect(() => bindProgressToIdentity(progressPort, identityPort, cloudProgressRemoteStore), []);
  useEffect(
    () =>
      progressPort.subscribe(() =>
        presencePort.setSharesPresence(progressPort.accountData().preferences.sharesPresence),
      ),
    [],
  );

  // Seeded from the address bar, so a refresh or a pasted link lands where it
  // says it will rather than dropping the reader back on Today.
  const opening = useMemo(openingAddress, []);
  const [view, setViewState] = useState<View>(opening.view);
  const [data, setData] = useState<BootstrapData | null>(null);
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(opening.studyId);
  const [displayedStudy, setDisplayedStudy] = useState<DisplayedStudy | null>(null);
  const [catalog, setCatalog] = useState<ReadonlyMap<string, StudyView>>(() => new Map());
  const [cloudTodayCard, setCloudTodayCard] = useState<TodayCard | null>(null);
  const [pendingStudyId, setPendingStudyId] = useState<string | null>(null);
  /*
    The lesson on screen, and the island you are standing on — read off the
    address rather than kept beside it. They were two pieces of state and one
    of them (the island) was not in any URL at all, so the level between a
    project and a lesson could not be linked, bookmarked or reloaded here while
    it could in the delivery campus.
  */
  const lessonLocator = useMemo<LessonRef | null>(
    () =>
      view.kind === "lesson"
        ? {
            studyId: view.studyId,
            courseId: view.courseId,
            unitId: view.unitId,
            lessonId: view.lessonId,
          }
        : null,
    [view],
  );
  const openCourseId = view.kind === "course" ? view.courseId : null;
  /** Lessons a cross-lesson link led away from, innermost last. */
  const [returnStack, setReturnStack] = useState<readonly LessonRef[]>([]);
  const [displayedLesson, setDisplayedLesson] = useState<DisplayedLesson | null>(null);
  const [pendingLessonKey, setPendingLessonKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);

  // Monotonic request ids. Every study/lesson response is checked against the
  // latest issued id before it is allowed to touch state, so a slow response
  // for the study or lesson the learner just navigated away from can never
  // overwrite the one they are actually looking at.
  const studyRequestId = useRef(0);
  const lessonRequestId = useRef(0);
  // A failed navigation is reverted to the last good lesson so the learner
  // keeps a usable screen and a retry affordance. That state change itself
  // would normally trigger the lesson loader again; mark the one intentional
  // fallback so the error stays visible instead of immediately replacing it
  // with a second request for the old lesson.
  const skipLessonLoadRef = useRef<string | null>(null);
  const pendingSectionIdRef = useRef<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const learningMigrationRef = useRef<string | null>(null);

  async function loadBootstrap() {
    const next = await readJson<BootstrapData>(await fetch("/api/bootstrap"));
    setData(next);
    // Open on the project last worked in. Falling straight to `studies[0]` meant
    // the shelf always landed on whichever title sorts first, so the learner's
    // first act every session was to navigate away from it.
    setSelectedStudyId(
      (current) => current ?? recentStudies(next.studies)[0]?.id ?? next.studies[0]?.id ?? null,
    );
  }

  async function loadStudy(studyId: string, signal?: AbortSignal) {
    const requestId = (studyRequestId.current += 1);
    const fetched = await readJson<StudyView>(await fetch(`/api/studies/${studyId}`, { signal }));
    syncStudyProgressToCloud(fetched, progressPort);
    const next = overlayStudyProgress(fetched, progressPort);
    if (studyRequestId.current !== requestId) return;
    commitView(() => setDisplayedStudy({ locator: studyId, view: next }));
    setPendingStudyId(null);
  }

  async function loadLesson(locator: LessonRef, signal?: AbortSignal) {
    const requestId = (lessonRequestId.current += 1);
    const fetched = await readJson<LessonView>(await fetch(lessonPath(locator), { signal }));
    syncLessonRecordToCloud(fetched, locator, progressPort);
    const next = overlayLessonRecord(fetched, locator, progressPort);
    if (lessonRequestId.current !== requestId) return;
    commitView(() =>
      setDisplayedLesson({ locatorKey: lessonRefKey(locator), locator, view: next }),
    );
    setPendingLessonKey(null);
  }

  /** Ignore the rejection an in-flight fetch produces when we abort it. */
  function isAbort(reason: unknown): boolean {
    return reason instanceof DOMException && reason.name === "AbortError";
  }

  useEffect(() => {
    void loadBootstrap()
      .then(() => setError(null))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "无法连接 UniversityLocal 服务"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!data) return;
    const controller = new AbortController();
    void Promise.all(
      data.studies.map(async (study) => {
        const fetched = await readJson<StudyView>(
          await fetch(`/api/studies/${study.id}`, { signal: controller.signal }),
        );
        syncStudyProgressToCloud(fetched, progressPort);
        return [study.id, overlayStudyProgress(fetched, progressPort)] as const;
      }),
    )
      .then((entries) => setCatalog(new Map(entries)))
      .catch((reason: unknown) => {
        if (isAbort(reason)) return;
      });
    return () => controller.abort();
  }, [data]);

  const dueCard = progressPort.dueCards()[0] ?? null;
  const dueCardLocator = useMemo(
    () => localCardLocatorOf(dueCard, catalog),
    [catalog, dueCard?.cardKey],
  );

  // A cloud card may have been enrolled on another computer, so it is not
  // guaranteed to exist in this machine's SQLite overview. Resolve its
  // published/local content through the same card route the review port uses.
  useEffect(() => {
    if (!dueCard || !dueCardLocator) {
      setCloudTodayCard(null);
      return;
    }
    const legacy = data?.today.card;
    if (legacy && todayCardKey(legacy) === dueCard.cardKey) {
      setCloudTodayCard(legacy);
      return;
    }
    let cancelled = false;
    void fetch(cardContentPath(dueCardLocator))
      .then((response) =>
        readJson<{
          readonly front: string;
          readonly contentRevision: number;
        }>(response),
      )
      .then((content) => {
        if (cancelled) return;
        setCloudTodayCard({
          ...dueCardLocator,
          front: content.front,
          contentRevision: content.contentRevision,
          dueAt: new Date(dueCard.dueAt).toISOString(),
        });
      })
      .catch(() => {
        if (!cancelled) setCloudTodayCard(null);
      });
    return () => {
      cancelled = true;
    };
  }, [data, dueCard?.cardKey, dueCard?.dueAt, dueCardLocator]);

  const progressUserId = progressPort.syncState().userId;
  useEffect(() => {
    if (!data || !progressUserId) return;
    const migrationKey = `${progressUserId}:${data.requestToken}`;
    if (learningMigrationRef.current === migrationKey) return;
    let cancelled = false;
    void fetch("/api/learning/export")
      .then((response) => readJson<LocalLearningExport>(response))
      .then((exported) => {
        if (cancelled) return;
        importLocalLearningExport(exported, progressPort);
        learningMigrationRef.current = migrationKey;
        return progressPort.flush();
      })
      .catch(() => {
        // The export is a compatibility bridge. A missing/old local database
        // must not prevent a signed-in learner from opening the campus.
      });
    return () => {
      cancelled = true;
    };
  }, [data, progressUserId]);

  useEffect(() => {
    if (!displayedStudy) return;
    setCatalog((current) => {
      if (current.get(displayedStudy.locator) === displayedStudy.view) return current;
      const next = new Map(current);
      next.set(displayedStudy.locator, displayedStudy.view);
      return next;
    });
  }, [displayedStudy]);

  useEffect(() => {
    if (!selectedStudyId) return;
    const controller = new AbortController();
    const expectedRequestId = studyRequestId.current + 1;
    setPendingStudyId(selectedStudyId);
    void loadStudy(selectedStudyId, controller.signal)
      .then(() => setError(null))
      .catch((reason: unknown) => {
        if (isAbort(reason)) return;
        if (studyRequestId.current !== expectedRequestId) return;
        setPendingStudyId(null);
        setError(reason instanceof Error ? reason.message : "无法读取学习项目");
      });
    return () => controller.abort();
  }, [selectedStudyId]);

  useEffect(() => {
    if (!lessonLocator) {
      setPendingLessonKey(null);
      setLessonError(null);
      return;
    }
    const controller = new AbortController();
    const requestedKey = lessonRefKey(lessonLocator);
    if (skipLessonLoadRef.current === requestedKey) {
      skipLessonLoadRef.current = null;
      setPendingLessonKey(null);
      return;
    }
    const expectedRequestId = lessonRequestId.current + 1;
    setPendingLessonKey(requestedKey);
    setLessonError(null);
    void loadLesson(lessonLocator, controller.signal)
      .then(() => setError(null))
      .catch((reason: unknown) => {
        if (isAbort(reason)) return;
        if (lessonRequestId.current !== expectedRequestId) return;
        setPendingLessonKey(null);
        setLessonError(reason instanceof Error ? reason.message : "无法读取课程");
        const fallback = displayedLesson;
        if (fallback && fallback.locatorKey !== requestedKey) {
          const fallbackView: View = { kind: "lesson", ...fallback.locator };
          window.history.replaceState(null, "", toHash(fallbackView));
          setSelectedStudyId(fallback.locator.studyId);
          skipLessonLoadRef.current = fallback.locatorKey;
          setViewState(fallbackView);
        }
      });
    return () => controller.abort();
  }, [lessonLocator]);

  // Closing a lesson unmounts the button that was focused, which drops focus
  // to <body>. Hand it to the panel the learner lands on instead. This runs
  // as an effect rather than after requestAnimationFrame on the click: rAF
  // does not fire while the tab is hidden, so the focus move would silently
  // be skipped for anyone who switched away and back.
  const lessonWasOpen = useRef(false);
  useEffect(() => {
    const lessonIsOpen = lessonLocator !== null;
    if (lessonWasOpen.current && !lessonIsOpen) mainRef.current?.focus();
    lessonWasOpen.current = lessonIsOpen;
  }, [lessonLocator]);

  const studyView = displayedStudy?.view ?? null;
  const readerPort = useMemo(
    () =>
      data
        ? createHttpReaderPort({
            requestToken: data.requestToken,
            progress: progressPort,
            onLessonComplete: (locator) => {
              progressPort.advanceLesson(lessonKeyOf(locator), 1);
            },
          })
        : null,
    [data],
  );
  const gradingPort = useMemo(
    () =>
      data
        ? createHttpGradingPort({ requestToken: data.requestToken, progress: progressPort })
        : null,
    [data],
  );
  const reviewPort = useMemo(() => createHttpReviewPort(progressPort), []);
  const vocabularyReviewPort = useMemo(() => createLocalVocabularyReviewPort(progressPort), []);
  /*
    The counters come from the shelf, not from the study page.

    `/api/studies/:id` returns a study's identity and its courses; the snapshot
    and UA-analysis counts are only ever computed by `/api/bootstrap`. The page
    used to read them off its own study object, which was *typed* as the full
    summary but had never carried those fields — so both counters rendered as
    empty `<strong>` elements. Looking them up here keeps one source for them.
  */
  const studySummary = useMemo(
    () => data?.studies.find((study) => study.id === studyView?.study.id) ?? null,
    [data, studyView],
  );
  const lessonView = displayedLesson?.view ?? null;
  const displayedLessonIsCurrent = Boolean(
    displayedLesson && lessonLocator && displayedLesson.locatorKey === lessonRefKey(lessonLocator),
  );

  function openLesson(locator: LessonRef, sectionId?: string) {
    pendingSectionIdRef.current = sectionId ?? null;
    setSelectedStudyId(locator.studyId);
    setView({ kind: "lesson", ...locator });
  }

  /**
   * Following a cross-lesson link, with a way back.
   *
   * The whole promise of the linear-plus-associative design is that a detour
   * is a detour. Without the stack, jumping to the lesson about how browsers
   * parse HTML abandons the lesson that sent you — and next time the reader
   * will not click, which costs the feature.
   *
   * Prev/next and the shelf deliberately clear the stack: those are decisions
   * to move on, not detours, and a "return to" offer that survives them would
   * be pointing somewhere the reader has stopped thinking about.
   */
  function followLessonLink(target: LessonLinkTarget) {
    const sourceLesson = displayedLesson?.locator ?? lessonLocator;
    if (sourceLesson) {
      setReturnStack((current) => [...current, sourceLesson].slice(-LINK_RETURN_DEPTH));
    }
    openLesson({ studyId: selectedStudyId ?? "", ...target }, target.targetSectionId);
  }

  function goBackFromLink() {
    const previous = returnStack.at(-1);
    if (!previous) return;
    setReturnStack((current) => current.slice(0, -1));
    openLesson(previous);
  }

  useEffect(() => {
    const sectionId = pendingSectionIdRef.current;
    if (!sectionId || !displayedLessonIsCurrent) return;
    pendingSectionIdRef.current = null;
    const reveal = () => {
      const heading = [...document.querySelectorAll<HTMLElement>("[data-section-id]")].find(
        (candidate) => candidate.dataset.sectionId === sectionId,
      );
      heading?.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(reveal);
    else reveal();
  }, [displayedLessonIsCurrent, displayedLesson?.locatorKey]);

  async function refreshLearning() {
    await loadBootstrap();
    if (selectedStudyId) await loadStudy(selectedStudyId);
    if (lessonLocator) await loadLesson(lessonLocator);
  }

  function retryLesson() {
    if (!lessonLocator) return;
    const requested = lessonLocator;
    const expectedRequestId = lessonRequestId.current + 1;
    setLessonError(null);
    setPendingLessonKey(lessonRefKey(requested));
    void loadLesson(requested)
      .then(() => setLessonError(null))
      .catch((reason: unknown) => {
        if (lessonRequestId.current !== expectedRequestId || isAbort(reason)) return;
        setPendingLessonKey(null);
        setLessonError(reason instanceof Error ? reason.message : "无法读取课程");
      });
  }

  /*
    Move by writing the address, never by setting state beside it.

    The rail's own entries are `<a href="#/…">`, so a state-only navigation
    would give the same destination two behaviours depending on how you reached
    it — one linkable and one not. Compared as formatted hashes rather than as
    objects: two states that render the same screen must not stack duplicate
    history entries, or Back appears to do nothing and the reader presses it
    again.
  */
  const setView = useCallback((next: View) => {
    if (toHash(next) !== window.location.hash) {
      window.history.pushState(null, "", toHash(next));
    }
    setViewState(next);
  }, []);

  /*
    Back, forward, and any `<a href="#/…">` in the chrome.

    This campus used to carry two addresses — a pathname for study+lesson and a
    hash for the rail slot — and Chrome fires `popstate` for a same-document
    fragment change too, so writing the hash ran the pathname restore as a side
    effect and threw the chosen project away. One address removes the whole
    class: there is nothing left for the hash to speak over.
  */
  useEffect(() => {
    const sync = () => {
      const restored = routable(fromHash(window.location.hash));
      setViewState(restored);
      const study = studyIdOfView(restored);
      if (study) setSelectedStudyId(study);
      // The detour stack belongs to a reading session, not to a URL. Going Back
      // past the lesson that offered a link makes "回到刚才那一课" meaningless.
      setReturnStack([]);
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  /**
   * Look at another series.
   *
   * Standing on an island belonging to the series you just left is not a place;
   * the delivery campus pulls back to the map for the same reason, in the same
   * shape.
   */
  const focusStudy = useCallback(
    (studyId: string) => {
      setSelectedStudyId(studyId);
      if (view.kind === "course" || view.kind === "lesson" || view.kind === "settled") {
        setView(WORLD);
      }
    },
    [view.kind, setView],
  );

  const libraryView = libraryOpening(view);
  const reading = lessonLocator !== null;
  const studyItems: readonly StudySwitchItem[] = useMemo(() => {
    if (!data) return [];
    return data.studies.map((study) => {
      const catalogued = catalog.get(study.id);
      const courses = catalogued?.courses ?? [];
      const done = courses.reduce((sum, course) => sum + lessonsDoneOf(course), 0);
      const total = courses.reduce(
        (sum, course) => sum + course.units.reduce((count, unit) => count + unit.lessons.length, 0),
        0,
      );
      return {
        id: study.id,
        title: study.title,
        courseCount: courses.length,
        done,
        total,
      };
    });
  }, [data, catalog]);

  /**
   * The same rows plus what the planet's detail card needs. Counted off the
   * catalogue this shell already has; there is no blurb because a study record
   * has no blurb field, and inventing one here would be the authoring shell
   * writing content outside the authoring pipeline.
   */
  const planetStudies: readonly PlanetStudy[] = useMemo(() => {
    if (!data) return [];
    return data.studies.map((study) => {
      const courses = catalog.get(study.id)?.courses ?? [];
      return {
        id: study.id,
        title: study.title,
        courseCount: courses.length,
        lessonCount: courses.reduce(
          (sum, course) =>
            sum + course.units.reduce((count, unit) => count + unit.lessons.length, 0),
          0,
        ),
        lessonsDone: courses.reduce((sum, course) => sum + lessonsDoneOf(course), 0),
        courseTitles: courses.map((course) => course.title),
      };
    });
  }, [data, catalog]);

  /*
    Which series is on screen — one answer, shared by the capsule, the map, the
    sky and the back button.

    It used to be resolved inside `WorldLanding`, where only the map could see
    it, while the capsule was handed the raw `selectedStudyId`. So on every
    screen but the map the capsule read 「选一个项目」 with a project plainly
    drawn behind it. The delivery shell had resolved it at the top the whole
    time; this is that same decision, now in one function both shells call.
  */
  const shownStudyId = useMemo(
    () =>
      resolveFocusedStudy(
        (data?.studies ?? []).map((study) => study.id),
        selectedStudyId,
        data?.today.nextLesson?.studyId,
      ),
    [data, selectedStudyId],
  );

  /*
    No 「四片海」 fallback any more: the map shows one project and picks a default
    when nothing is selected, so a capsule reading 「四片海」 would be naming a
    place that is not on screen.
  */
  const projectName =
    data?.studies.find((study) => study.id === shownStudyId)?.title ??
    studySummary?.title ??
    "University";
  const alerts = (
    <>
      {error ? (
        <GameCallout
          heading="有一项操作没有完成"
          tone="warning"
          className="global-error"
          role="alert"
        >
          {error}
        </GameCallout>
      ) : null}
      {data && data.shelfIssues.length > 0 ? (
        <GameCallout heading="书架上有资料读不出来" tone="warning" className="global-error">
          {data.shelfIssues.join("；")}
        </GameCallout>
      ) : null}
      {loading ? <p className="loading-copy">正在打开校园档案…</p> : null}
    </>
  );

  const learnBody = (
    <>
      {data && data.studies.length === 0 ? <EmptyCampus /> : null}
      {data && data.studies.length > 0 && shownStudyId ? (
        <div className="learn-layout">
          <WorldLanding
            data={data}
            catalog={catalog}
            presence={presencePort}
            progressPort={progressPort}
            shownStudyId={shownStudyId}
            openCourseId={openCourseId}
            onOpenCourse={(studyId, courseId) => setView({ kind: "course", studyId, courseId })}
            onCloseCourse={() => setView(WORLD)}
            onSelectStudy={focusStudy}
            onOpenLesson={openLesson}
          />
          <div className="studies-layout">
            <StudyShelf data={data} selectedStudyId={selectedStudyId} onSelect={focusStudy} />
            {pendingStudyId && displayedStudy && pendingStudyId !== displayedStudy.locator ? (
              <p className="loading-copy" role="status" aria-live="polite">
                正在打开另一个学习项目；当前项目仍保留在屏幕上。
              </p>
            ) : null}
            {studyView ? (
              <StudyDetail
                view={studyView}
                summary={studySummary}
                focus={data?.today.focus ?? null}
                onOpenLesson={openLesson}
                showCourseEntry={false}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );

  const lessonBody = (
    <div>
      {pendingLessonKey && !displayedLessonIsCurrent ? (
        <p className="loading-copy" role="status" aria-live="polite">
          正在打开下一节课；当前内容仍保留在屏幕上。
        </p>
      ) : null}
      {lessonError ? (
        <GameCallout heading="这节课打不开" tone="warning" role="alert">
          <p>{lessonError}</p>
          <button type="button" className="text-button" onClick={retryLesson}>
            重试这节课
          </button>
        </GameCallout>
      ) : null}
      {lessonView && displayedLesson && data && readerPort && gradingPort ? (
        <LessonReader
          locator={displayedLesson.locator}
          view={lessonView}
          reader={readerPort}
          grading={gradingPort}
          progress={progressPort}
          review={reviewPort}
          toolbarExtras={<SoundToggle progress={progressPort} />}
          requestToken={data.requestToken}
          onLearningChanged={refreshLearning}
          neighbours={
            studyView ? lessonNeighbours(studyView.courses, displayedLesson.locator) : null
          }
          onOpenLesson={(locator) => {
            setReturnStack([]);
            openLesson(locator);
          }}
          onBackToCourse={() => {
            setReturnStack([]);
            setView({
              kind: "course",
              studyId: displayedLesson.locator.studyId,
              courseId: displayedLesson.locator.courseId,
            });
          }}
          onFollowLink={followLessonLink}
          onReturn={returnStack.length > 0 ? goBackFromLink : undefined}
        />
      ) : !lessonError ? (
        <p className="loading-copy">正在打开这节课…</p>
      ) : null}
    </div>
  );

  const presenceLocation = lessonLocator
    ? {
        studyId: lessonLocator.studyId,
        courseId: lessonLocator.courseId,
        lessonId: lessonLocator.lessonId,
      }
    : (data?.today.nextLesson ?? null);
  const presenceView = lessonLocator
    ? presenceViewKey({ kind: "lesson", ...lessonLocator })
    : "world";

  if (reading) {
    return (
      <div className="campus" data-game-ui-theme="night" data-reading>
        <PresenceSession port={presencePort} location={presenceLocation} viewKey={presenceView} />
        {alerts}
        <div ref={mainRef} tabIndex={-1} className="campus-main" role="main" aria-label="课程正文">
          {lessonBody}
        </div>
      </div>
    );
  }

  const aside =
    view.kind === "settings" ? (
      <SettingsSubnav />
    ) : view.kind === "planet" && data ? (
      /*
        The list goes where 「今天」 goes, and the globe goes where the islands
        go — the same two slots the map uses, so stepping out to the planet
        keeps the frame and changes only the world inside it.
      */
      <PlanetRail
        studies={planetStudies}
        selectedId={shownStudyId}
        onSelect={setSelectedStudyId}
        onEnter={(studyId) => {
          setSelectedStudyId(studyId);
          setView(WORLD);
        }}
        onClose={() => setView(WORLD)}
      />
    ) : (view.kind === "world" || view.kind === "course") && data && data.studies.length > 0 ? (
      <TodaySection
        data={todayDataOf(data, progressPort, cloudTodayCard, catalog)}
        requestToken={data.requestToken}
        review={reviewPort}
        vocabularyReview={vocabularyReviewPort}
        onOpenLesson={openLesson}
        onReviewed={refreshLearning}
      />
    ) : undefined;

  return (
    <div data-game-ui-theme="night">
      <PresenceSession port={presencePort} location={presenceLocation} viewKey={presenceView} />
      <UniversityShell
        activeId={activeIdForView(view)}
        extraMoreItems={[STUDIO_MORE_ITEM]}
        /*
          The streak is a question asked of the same cloud-backed document the
          quest screen reads. The local SQLite projection may be imported once,
          but it is never a second source of learner truth.
        */
        counters={universityCounters({
          projectName,
          streakDays: progress.streak.days,
          projectControl:
            data && studyItems.length > 0 && shownStudyId ? (
              <StudySwitcher
                studies={studyItems}
                focusedId={shownStudyId}
                onSelect={focusStudy}
                onOpenPlanet={() => setView({ kind: "planet" })}
              />
            ) : undefined,
        })}
        /*
          The face at the foot of the rail. It was missing here and present in
          the delivery shell, and the boss found it by opening both — the one
          divergence the two campuses are allowed is where the AI comes from,
          and this was not that. Nothing had been forked: `identity` is an
          optional slot on a shared component, and an optional slot left empty
          is invisible to the compiler and to anyone reading one file.
        */
        identity={<RailIdentity onOpen={() => setView({ kind: "me" })} />}
        aside={aside}
        asideLabel={view.kind === "settings" ? "设置" : view.kind === "planet" ? "选课" : "今天"}
      >
        <div ref={mainRef} tabIndex={-1} className="campus-main">
          {alerts}
          {view.kind === "world" || view.kind === "course" ? learnBody : null}
          {/*
            A route, not a piece of state. It was `planetOpen` here and
            `#/planet` in the delivery shell, which meant the same page could be
            linked, bookmarked and reloaded in one campus and not the other —
            and typing `#/planet` here silently landed you on the map instead.
          */}
          {view.kind === "planet" && data ? (
            <div className="planet-page__globe" data-planet-globe="true">
              <PlanetStage
                studies={planetStudies}
                selectedId={shownStudyId}
                onSelect={setSelectedStudyId}
              />
            </div>
          ) : null}
          {view.kind === "studio" && data ? (
            <StudioSection
              data={data}
              selectedStudyId={selectedStudyId}
              studyView={studyView}
              summary={studySummary}
              studiesRootLabel={shortenHomePath(data.studiesRoot)}
              onSelectStudy={focusStudy}
              onOpenLesson={openLesson}
            />
          ) : null}
          {/*
            One branch for the whole library, the way the delivery campus routes
            it. Seven addresses land here and only two of them used to be
            wired — `#/terms`, `#/concepts` and every entry address fell through
            to the map, because this campus read a rail slot out of the hash and
            had no slot by those names. The key re-seeds the surface when the
            address changes and leaves it alone when the learner moves around
            inside it.
          */}
          {libraryView ? (
            <LibraryScreen
              key={toHash(view)}
              onBack={() => setView(WORLD)}
              initialTab={libraryView.tab}
              initialEntry={libraryView.entry}
            />
          ) : null}
          {view.kind === "practice" ? (
            <PracticeSurface
              store={LOCAL_PRACTICE_STORE}
              lexicon={LOCAL_LEXICON}
              onOpenWorld={() => setView(WORLD)}
              onBrowse={() => setView(WORLD)}
            />
          ) : null}
          {view.kind === "league" ? <LeagueScreen document={progress} /> : null}
          {view.kind === "quests" ? <QuestsScreen document={progress} /> : null}
          {/*
            The same component the delivery shell renders, from the same prices
            in `@pieai/university-core`. A pricing page that disagreed with
            itself between two shells is the exact failure V4's one-law rule
            exists to prevent, and it needs no progress document to be correct.

            League, quests and the badge wall now read the shared progress
            document too — the same `ProgressPort` the delivery shell
            constructs, injected with the same cloud adapter and offline cache.
            They can answer "did you finish a lesson today" without inventing a
            number. The old authoring SQLite projection is imported through the
            one-time migration bridge, not read as a competing source.
          */}
          {view.kind === "plans" ? <PlansScreen /> : null}
          {view.kind === "catalog" ? (
            data ? (
              <LocalCatalog
                data={data}
                catalog={catalog}
                onBack={() => setView(WORLD)}
                onOpenLesson={openLesson}
              />
            ) : (
              <p className="loading-copy">正在读入本地课程目录…</p>
            )
          ) : null}
          {view.kind === "review" && data ? (
            <TodaySection
              data={todayDataOf(data, progressPort, cloudTodayCard, catalog)}
              requestToken={data.requestToken}
              review={reviewPort}
              vocabularyReview={vocabularyReviewPort}
              onOpenLesson={openLesson}
              onReviewed={refreshLearning}
            />
          ) : null}

          {view.kind === "settings" ? (
            <SettingsScreen presence={presencePort} progress={progressPort} />
          ) : null}
          {view.kind === "me" ? (
            <ProfileScreen
              avatar={<RailIdentity onOpen={() => setView({ kind: "me" })} />}
              account={<AccountPanel identity={identityPort} />}
              passagesRead={0}
              lessonsCompleted={completedLessons(progress)}
              badges={<BadgeWall document={progress} />}
            />
          ) : null}
        </div>
      </UniversityShell>
    </div>
  );
}
