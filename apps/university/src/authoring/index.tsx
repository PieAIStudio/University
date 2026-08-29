/**
 * The authoring campus's own surfaces, and the only place they are mounted.
 *
 * Everything under this directory is dropped from a delivery build: `AUTHORING`
 * is a build-time constant, so the `AUTHORING ?` branches in `App.tsx` fold to
 * `false` and Rollup takes this module and its whole subtree with them.
 * `check-authoring-excluded.mjs` measures that rather than trusting it.
 *
 * These are not the workbench that writes courses — writing a course is the CLI
 * and a directory of files. What is here is what a person needs while doing
 * that: which projects are on the shelf, which files a course has cited, how
 * far behind the airlock is, and the way into the UA graph.
 */
import { useEffect, useState } from "react";
import type { LessonRef } from "@pieai/university-core";
import { readJson } from "@pieai/university-ui/api/client.js";
import type {
  BootstrapData,
  StudySummary,
  StudyView,
} from "@pieai/university-ui/view/lesson-view.js";

import { localBootstrap } from "../ports/local/content.js";
import { feedbackReviewSource } from "./feedback-source.js";
import { StudioSection } from "./StudioSection.js";
import { AirlockClocks, StudyDetail } from "./StudyDetail.js";
import { shortenHomePath } from "./studies-root.js";

export { shortenHomePath } from "./studies-root.js";

/** What the workbench reads. Its own fetch, because only this build makes it. */
function useShelfRecord(studyId: string | null): {
  readonly data: BootstrapData | null;
  readonly view: StudyView | null;
  readonly summary: StudySummary | null;
} {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [view, setView] = useState<StudyView | null>(null);

  useEffect(() => {
    let cancelled = false;
    void localBootstrap().then((boot) => {
      if (!cancelled) setData(boot);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!studyId) {
      setView(null);
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const next = await readJson<StudyView>(
          await fetch(`/api/studies/${encodeURIComponent(studyId)}`, {
            signal: controller.signal,
          }),
        );
        setView(next);
      } catch {
        // A study that cannot be read is an empty workbench, not a broken
        // campus: the map beside it is drawn from the shelf and still works.
      }
    })();
    return () => controller.abort();
  }, [studyId]);

  return {
    data,
    view,
    summary: data?.studies.find((study) => study.id === studyId) ?? null,
  };
}

/**
 * `/studio`. A mode, not a ninth rail slot — which is why it lives behind
 * 更多, and why the delivery build sends this path to the map instead.
 */
export function StudioScreen({
  studyId,
  onSelectStudy,
  onOpenLesson,
}: {
  readonly studyId: string | null;
  readonly onSelectStudy: (studyId: string) => void;
  readonly onOpenLesson: (locator: LessonRef) => void;
}) {
  const { data, view, summary } = useShelfRecord(studyId);
  if (!data) return <p className="loading-copy">正在打开校园档案…</p>;
  return (
    <>
      <StudioSection
        data={data}
        selectedStudyId={studyId}
        studyView={view}
        summary={summary}
        studiesRootLabel={shortenHomePath(data.studiesRoot)}
        onSelectStudy={onSelectStudy}
        feedbackSource={feedbackReviewSource}
      />
      {/*
        The course list with the pinned run first. It used to sit under the map
        on the learn route, where the map and the 2D directory already answer
        「这个项目有哪些课」 twice over. Here it answers the question the
        workbench asks: which courses this project publishes, and which of them
        the learner pinned.
      */}
      {view ? (
        <StudyDetail
          view={view}
          summary={summary}
          authoringFocus={data.today.focus}
          onOpenLesson={onOpenLesson}
          showCourseEntry={false}
        />
      ) : null}
    </>
  );
}

/**
 * The two authoring facts that belong on the map rather than behind a door.
 *
 * Which version of the project this campus is teaching, and the way into the UA
 * graph. Both are about the series on screen, so they sit with it.
 */
export function AuthoringMapNotes({ studyId }: { readonly studyId: string | null }) {
  if (!studyId) return null;
  return (
    <div className="world-landing__authoring">
      <AirlockClocks studyId={studyId} />
    </div>
  );
}
