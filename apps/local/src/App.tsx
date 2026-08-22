import { useEffect, useMemo, useRef, useState } from "react";
import { GameCallout } from "@pieai/swimmer-ui-kit";
import { UniversityShell } from "@pieai/university-ui/navigation/UniversityShell.js";
import {
  LeagueEmpty,
  NextStepEmpty,
  PlansEmpty,
  ProfileScreen,
  QuestsEmpty,
  SettingsScreen,
  SettingsSubnav,
} from "@pieai/university-ui/navigation/empty.js";
import { FavouritesEmpty } from "@pieai/university-ui";
import { STUDIO_MORE_ITEM } from "@pieai/university-ui/navigation/slots.js";
import { universityCounters } from "@pieai/university-ui/navigation/counters.js";
import { isCurrentLessonCompleted } from "@pieai/university-ui/view/lesson-view.js";

import { lessonRefKey } from "@pieai/university-core";
import { armSoundUnlock } from "@pieai/university-ui/sound/index.js";
import { lessonPath, readJson } from "@pieai/university-ui/api/client.js";
import type { LessonLinkTarget } from "@pieai/university-ui/markdown/remark-lesson-links.js";
import { LINK_RETURN_DEPTH, LessonReader } from "@pieai/university-ui/lesson/LessonReader.js";
import { lessonNeighbours } from "@pieai/university-ui/lesson/LessonNav.js";
import type {
  BootstrapData,
  LessonRef,
  LessonView,
  StudyView,
} from "@pieai/university-ui/view/lesson-view.js";
import {
  formatAddress,
  parseAddress,
  parseShellHash,
  type AppAddress,
  type ShellSlot,
} from "./url-state.js";
import { EmptyCampus } from "./shell/EmptyCampus.js";
import { recentStudies, StudyShelf } from "./shell/StudyShelf.js";
import { StudioSection } from "./shell/StudioSection.js";
import { StudyDetail } from "./shell/StudyDetail.js";
import { TodaySection } from "./shell/TodaySection.js";

interface DisplayedStudy {
  readonly locator: string;
  readonly view: StudyView;
}

interface DisplayedLesson {
  readonly locatorKey: string;
  readonly locator: LessonRef;
  readonly view: LessonView;
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

  // Seeded from the address bar, so a refresh or a pasted link lands where it
  // says it will rather than dropping the reader back on Today.
  const initialAddress = useMemo(() => parseAddress(window.location.pathname), []);
  const [slot, setSlot] = useState<ShellSlot>(() => parseShellHash(window.location.hash));
  const [activeSection, setActiveSection] = useState(initialAddress.section);
  const [data, setData] = useState<BootstrapData | null>(null);
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(initialAddress.studyId);
  const [displayedStudy, setDisplayedStudy] = useState<DisplayedStudy | null>(null);
  const [pendingStudyId, setPendingStudyId] = useState<string | null>(null);
  const [lessonLocator, setLessonRef] = useState<LessonRef | null>(initialAddress.lesson);
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
    const next = await readJson<StudyView>(await fetch(`/api/studies/${studyId}`, { signal }));
    if (studyRequestId.current !== requestId) return;
    commitView(() => setDisplayedStudy({ locator: studyId, view: next }));
    setPendingStudyId(null);
  }

  async function loadLesson(locator: LessonRef, signal?: AbortSignal) {
    const requestId = (lessonRequestId.current += 1);
    const next = await readJson<LessonView>(await fetch(lessonPath(locator), { signal }));
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
          const fallbackAddress = formatAddress({
            section: "studies",
            studyId: fallback.locator.studyId,
            lesson: fallback.locator,
          });
          window.history.replaceState(null, "", fallbackAddress);
          setSelectedStudyId(fallback.locator.studyId);
          skipLessonLoadRef.current = fallback.locatorKey;
          setLessonRef(fallback.locator);
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
    setLessonRef(locator);
    setActiveSection("studies");
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

  const address: AppAddress = {
    section: activeSection,
    studyId: activeSection === "studies" ? selectedStudyId : null,
    lesson: activeSection === "studies" ? lessonLocator : null,
  };

  // Push on navigation, and listen for the back button.
  //
  // Compared as formatted paths rather than as objects: two states that render
  // the same screen must not stack duplicate history entries, or Back appears
  // to do nothing and the reader presses it again.
  useEffect(() => {
    const next = formatAddress(address);
    if (next === window.location.pathname) return;
    const hash = address.lesson ? "" : window.location.hash;
    window.history.pushState(null, "", next + hash);
  }, [address]);

  useEffect(() => {
    const sync = () => {
      const restored = parseAddress(window.location.pathname);
      setActiveSection(restored.section);
      setSelectedStudyId(restored.studyId);
      setLessonRef(restored.lesson);
      setSlot(parseShellHash(window.location.hash));
      // The detour stack belongs to a reading session, not to a URL. Going Back
      // past the lesson that offered a link makes "回到刚才那一课" meaningless.
      setReturnStack([]);
    };
    const onHash = () => setSlot(parseShellHash(window.location.hash));
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  const reading = lessonLocator !== null;
  const projectName =
    studySummary?.title ??
    data?.studies.find((study) => study.id === selectedStudyId)?.title ??
    "University";
  const lessonsCompleted = studyView
    ? studyView.courses
        .flatMap((course) => course.units.flatMap((unit) => unit.lessons))
        .filter((lesson) => isCurrentLessonCompleted(lesson.progress, lesson.contentRevision))
        .length
    : 0;

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
      {data && data.studies.length > 0 ? (
        <div className="studies-layout">
          <StudyShelf
            data={data}
            selectedStudyId={selectedStudyId}
            onSelect={(studyId) => {
              setSelectedStudyId(studyId);
              setLessonRef(null);
            }}
          />
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
            />
          ) : null}
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
      {lessonView && displayedLesson && data ? (
        <LessonReader
          locator={displayedLesson.locator}
          view={lessonView}
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
            setLessonRef(null);
          }}
          onFollowLink={followLessonLink}
          onReturn={returnStack.length > 0 ? goBackFromLink : undefined}
        />
      ) : !lessonError ? (
        <p className="loading-copy">正在打开这节课…</p>
      ) : null}
    </div>
  );

  if (reading) {
    return (
      <div className="campus" data-game-ui-theme="night" data-reading>
        {alerts}
        <div ref={mainRef} tabIndex={-1} className="campus-main" role="main" aria-label="课程正文">
          {lessonBody}
        </div>
      </div>
    );
  }

  const aside =
    slot === "settings" ? (
      <SettingsSubnav />
    ) : slot === "learn" && data && data.studies.length > 0 ? (
      <TodaySection data={data} onOpenLesson={openLesson} onReviewed={refreshLearning} />
    ) : undefined;

  return (
    <div data-game-ui-theme="night">
      <UniversityShell
        activeId={slot}
        extraMoreItems={[STUDIO_MORE_ITEM]}
        /*
          `streakDays: null` is not a zero. This shell has no streak signal at
          all until ADR-0001's shared progress lands, and it was rendering a
          literal "0" — a number it had no way to know — beside two counters
          for systems that do not exist.
        */
        counters={universityCounters({ projectName, streakDays: null })}
        aside={aside}
        asideLabel={slot === "settings" ? "设置" : "今天"}
      >
        <div ref={mainRef} tabIndex={-1} className="campus-main">
          {alerts}
          {slot === "learn" ? learnBody : null}
          {slot === "studio" && data ? (
            <StudioSection
              data={data}
              selectedStudyId={selectedStudyId}
              studyView={studyView}
              summary={studySummary}
              studiesRootLabel={shortenHomePath(data.studiesRoot)}
              onSelectStudy={(studyId) => {
                setSelectedStudyId(studyId);
                setLessonRef(null);
              }}
              onOpenLesson={openLesson}
            />
          ) : null}
          {slot === "library" ? (
            <NextStepEmpty
              title="图鉴在学习页的对面"
              description="概念、术语和收藏长在投放端的图鉴里。今天该读的那一课，在学习页上等着。"
            />
          ) : null}
          {slot === "practice" ? (
            <NextStepEmpty
              title="练习还没接到这边"
              description="无尽题流在投放端已经能跑。先把今天的那一节读完。"
            />
          ) : null}
          {slot === "league" ? <LeagueEmpty /> : null}
          {slot === "quests" ? <QuestsEmpty /> : null}
          {slot === "plan" ? <PlansEmpty /> : null}
          {slot === "catalog" ? (
            <NextStepEmpty
              title="目录在投放端"
              description="键盘能走到的课程目录长在投放端。这边从书架上的项目进去。"
            />
          ) : null}
          {slot === "review" && data ? (
            <TodaySection data={data} onOpenLesson={openLesson} onReviewed={refreshLearning} />
          ) : null}
          {slot === "favourites" ? (
            <FavouritesEmpty onBrowse={() => (window.location.hash = "#/")} />
          ) : null}
          {slot === "settings" ? <SettingsScreen /> : null}
          {slot === "profile" ? (
            <ProfileScreen passagesRead={0} lessonsCompleted={lessonsCompleted} />
          ) : null}
        </div>
      </UniversityShell>
    </div>
  );
}
