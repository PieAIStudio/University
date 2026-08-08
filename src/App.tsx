import { useEffect, useMemo, useRef, useState } from "react";
import { GameBadge, GameCallout, GameTabs } from "@pieai/swimmer-ui-kit";

import { Tip } from "./Tip.js";
import { lessonPath, readJson } from "./api/client.js";
import type { LessonLinkTarget } from "./markdown/remark-lesson-links.js";
import { formatAddress, parseAddress, type AppAddress } from "./url-state.js";
import { LINK_RETURN_DEPTH, LessonReader } from "./lesson/LessonReader.js";
import { lessonNeighbours } from "./lesson/LessonNav.js";
import { EmptyCampus } from "./shell/EmptyCampus.js";
import { recentStudies, StudyShelf } from "./shell/StudyShelf.js";
import { StudyDetail } from "./shell/StudyDetail.js";
import { TodaySection } from "./shell/TodaySection.js";

type SectionId = "today" | "studies";

import type { LessonLocator, BootstrapData, StudyView, LessonView } from "./view/lesson-view.js";

const tabs = [
  { id: "today", label: "今日学习", panelId: "panel-today" },
  { id: "studies", label: "学习项目", panelId: "panel-studies" },
] as const;

export function App() {
  // Seeded from the address bar, so a refresh or a pasted link lands where it
  // says it will rather than dropping the reader back on Today.
  const initialAddress = useMemo(() => parseAddress(window.location.pathname), []);
  const [activeSection, setActiveSection] = useState<SectionId>(initialAddress.section);
  const [data, setData] = useState<BootstrapData | null>(null);
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(initialAddress.studyId);
  const [studyView, setStudyView] = useState<StudyView | null>(null);
  const [lessonLocator, setLessonLocator] = useState<LessonLocator | null>(initialAddress.lesson);
  /** Lessons a cross-lesson link led away from, innermost last. */
  const [returnStack, setReturnStack] = useState<readonly LessonLocator[]>([]);
  const [lessonView, setLessonView] = useState<LessonView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);

  // Monotonic request ids. Every study/lesson response is checked against the
  // latest issued id before it is allowed to touch state, so a slow response
  // for the study or lesson the learner just navigated away from can never
  // overwrite the one they are actually looking at.
  const studyRequestId = useRef(0);
  const lessonRequestId = useRef(0);
  const mainRef = useRef<HTMLElement>(null);

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
    setStudyView(next);
  }

  async function loadLesson(locator: LessonLocator, signal?: AbortSignal) {
    const requestId = (lessonRequestId.current += 1);
    const next = await readJson<LessonView>(await fetch(lessonPath(locator), { signal }));
    if (lessonRequestId.current !== requestId) return;
    setLessonView(next);
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
    if (activeSection !== "studies" || !selectedStudyId) return;
    const controller = new AbortController();
    // Drop the previous study's detail immediately, so the header never shows
    // one project's metrics next to another project's units.
    setStudyView(null);
    void loadStudy(selectedStudyId, controller.signal)
      .then(() => setError(null))
      .catch((reason: unknown) => {
        if (isAbort(reason)) return;
        setError(reason instanceof Error ? reason.message : "无法读取学习项目");
      });
    return () => controller.abort();
  }, [activeSection, selectedStudyId]);

  useEffect(() => {
    if (!lessonLocator) {
      setLessonView(null);
      setLessonError(null);
      return;
    }
    const controller = new AbortController();
    setLessonView(null);
    setLessonError(null);
    void loadLesson(lessonLocator, controller.signal)
      .then(() => setError(null))
      .catch((reason: unknown) => {
        if (isAbort(reason)) return;
        setLessonError(reason instanceof Error ? reason.message : "无法读取课程");
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

  // The header counts courses, not studies with courses. It used to read the
  // study's single default course, so the number could never exceed the number
  // of studies no matter how many courses were published.
  const learnableCourses = useMemo(
    () => data?.studies.reduce((total, study) => total + study.activeCourseCount, 0) ?? 0,
    [data],
  );
  const selectedStudySummary = useMemo(
    () => data?.studies.find((study) => study.id === selectedStudyId) ?? null,
    [data, selectedStudyId],
  );

  function openLesson(locator: LessonLocator) {
    setSelectedStudyId(locator.studyId);
    setLessonLocator(locator);
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
    if (lessonLocator) {
      setReturnStack((current) => [...current, lessonLocator].slice(-LINK_RETURN_DEPTH));
    }
    openLesson({ studyId: selectedStudyId ?? "", ...target });
  }

  function goBackFromLink() {
    const previous = returnStack.at(-1);
    if (!previous) return;
    setReturnStack((current) => current.slice(0, -1));
    openLesson(previous);
  }

  async function refreshLearning() {
    await loadBootstrap();
    if (selectedStudyId) await loadStudy(selectedStudyId);
    if (lessonLocator) await loadLesson(lessonLocator);
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
    if (next !== window.location.pathname) window.history.pushState(null, "", next);
  }, [address]);

  useEffect(() => {
    const onPopState = () => {
      const restored = parseAddress(window.location.pathname);
      setActiveSection(restored.section);
      setSelectedStudyId(restored.studyId);
      setLessonLocator(restored.lesson);
      // The detour stack belongs to a reading session, not to a URL. Going Back
      // past the lesson that offered a link makes "回到刚才那一课" meaningless.
      setReturnStack([]);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Reading a lesson is the one screen with a single job. The section tabs and
  // the campus-wide counters answer questions nobody has while they are three
  // paragraphs into an explanation, and they cost the top of every page.
  const reading = activeSection === "studies" && lessonLocator !== null;

  return (
    <div className="campus" data-game-ui-theme="night" data-reading={reading || undefined}>
      <header className="campus-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            U
          </span>
          <div>
            <p>PIE · PERSONAL CAMPUS</p>
            <h1>UniversityLocal</h1>
          </div>
        </div>
        {reading ? null : (
          <div className="campus-status" aria-label="校园状态">
            <Tip term="airlock">
              <GameBadge tone="success">资料仅在本机</GameBadge>
            </Tip>
            <Tip term="study">
              <span>{data?.studies.length ?? 0} 个 study</span>
            </Tip>
            <span>{learnableCourses} 门可学课程</span>
          </div>
        )}
      </header>

      {reading ? null : (
        <nav className="campus-nav" aria-label="UniversityLocal 主导航">
          <GameTabs
            id="campus-section"
            tabs={tabs}
            activeId={activeSection}
            onSelect={(id) => {
              setActiveSection(id as SectionId);
              if (id === "today") setLessonLocator(null);
            }}
          />
        </nav>
      )}

      <main
        ref={mainRef}
        id={`panel-${activeSection}`}
        // Without the tab list on screen there is no tab for this panel to be
        // labelled by, and claiming the role anyway points assistive tech at an
        // element that is not there.
        {...(reading
          ? { "aria-label": "课程正文" }
          : { role: "tabpanel", "aria-labelledby": `campus-section-${activeSection}` })}
        tabIndex={-1}
        className="campus-main"
      >
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
        {data && data.studies.length === 0 ? <EmptyCampus /> : null}
        {data && data.studies.length > 0 && activeSection === "today" ? (
          <TodaySection data={data} onOpenLesson={openLesson} onReviewed={refreshLearning} />
        ) : null}
        {data && data.studies.length > 0 && activeSection === "studies" ? (
          lessonLocator ? (
            <div>
              {lessonView ? (
                <LessonReader
                  locator={lessonLocator}
                  view={lessonView}
                  requestToken={data.requestToken}
                  onLearningChanged={refreshLearning}
                  neighbours={studyView ? lessonNeighbours(studyView.courses, lessonLocator) : null}
                  onOpenLesson={(locator) => {
                    setReturnStack([]);
                    openLesson(locator);
                  }}
                  onBackToCourse={() => {
                    setReturnStack([]);
                    setLessonLocator(null);
                  }}
                  onFollowLink={followLessonLink}
                  onReturn={returnStack.length > 0 ? goBackFromLink : undefined}
                />
              ) : lessonError ? (
                <GameCallout heading="这节课打不开" tone="warning" role="alert">
                  {lessonError}
                </GameCallout>
              ) : (
                <p className="loading-copy">正在打开这节课…</p>
              )}
            </div>
          ) : (
            <div className="studies-layout">
              <StudyShelf
                data={data}
                selectedStudyId={selectedStudyId}
                onSelect={(studyId) => {
                  setSelectedStudyId(studyId);
                  setLessonLocator(null);
                }}
              />
              {studyView && selectedStudySummary ? (
                <StudyDetail
                  view={studyView}
                  summary={selectedStudySummary}
                  onOpenLesson={openLesson}
                />
              ) : null}
            </div>
          )
        ) : null}
      </main>

      <footer className="campus-footer">
        <span>学习资料默认保存在</span>
        <code>{data?.studiesRoot ?? "./studies"}</code>
      </footer>
    </div>
  );
}
