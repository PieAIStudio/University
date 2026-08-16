import { useEffect, useState } from "react";
import { GamePanel } from "@pieai/swimmer-ui-kit";

import { readJson } from "../api/client.js";
import type { LessonLocator, StudySummary, StudyView } from "../view/lesson-view.js";
import { CourseSection } from "./CourseSection.js";
import { KnowledgeNotesSection } from "./KnowledgeNotesSection.js";
import { StudyMap } from "./StudyMap.js";
import { UaDashboardButton } from "./UaDashboardButton.js";

export function StudyEvidenceStatus({
  snapshotCount,
  readyUaAnalysisCount,
}: {
  readonly snapshotCount: number;
  readonly readyUaAnalysisCount: number;
}) {
  return (
    <section className="study-evidence-status" aria-label="研究证据状态">
      <div className="study-evidence-status__metric">
        <strong>{snapshotCount}</strong>
        <span>份源码快照</span>
      </div>
      <div className="study-evidence-status__metric">
        <strong>{readyUaAnalysisCount}</strong>
        <span>份 UA READY 分析</span>
      </div>
      <p className="study-evidence-status__boundary">
        <strong>资料边界</strong>
        <span>UA 原生地图/导览是课程证据，不是正式课程。</span>
      </p>
    </section>
  );
}

interface AirlockView {
  readonly airlock: boolean;
  readonly verdict?: string;
  readonly problems?: readonly string[];
  readonly promotedCommit?: string;
  readonly upstream?: { readonly headCommit: string; readonly commitsAhead: number | null } | null;
  readonly course?: { readonly matchesAirlock: boolean | null } | null;
}

/**
 * The three clocks, for a study that is being taught out of an airlock.
 *
 * Being behind is the normal, correct state — the campus teaches the last
 * commit that was promoted, not whatever is in the editor right now — so this
 * reads as a fact rather than a warning. What does deserve attention is a seal
 * that no longer matches its checkout, and that is the only thing coloured as a
 * problem.
 */
function AirlockClocks({ studyId }: { readonly studyId: string }) {
  const [view, setView] = useState<AirlockView | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const body = await readJson<AirlockView>(await fetch(`/api/studies/${studyId}/airlock`));
        if (!cancelled) setView(body);
      } catch {
        if (!cancelled) setView({ airlock: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  if (!view?.airlock) return null;
  const ahead = view.upstream?.commitsAhead ?? null;
  return (
    <section className="airlock-clocks">
      <p className="eyebrow">教材版本</p>
      <dl>
        <div>
          <dt>教材钉在</dt>
          <dd>
            <code>{view.promotedCommit?.slice(0, 8)}</code>
          </dd>
        </div>
        <div>
          <dt>上游走到</dt>
          <dd>
            <code>{view.upstream?.headCommit.slice(0, 8) ?? "读不到"}</code>
          </dd>
        </div>
        <div>
          <dt>相差</dt>
          <dd>{ahead === null ? "算不出（上游历史被改写过）" : `${ahead} 个提交`}</dd>
        </div>
        <div>
          <dt>课程快照</dt>
          <dd>{view.course?.matchesAirlock === false ? "落后于 airlock" : "与 airlock 一致"}</dd>
        </div>
      </dl>
      {view.verdict === "blocked" ? (
        <ul className="airlock-clocks__problems">
          {(view.problems ?? []).map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : (
        <p className="airlock-clocks__note">
          落后是正常的：这里教的永远是上一次提升的那个提交，不是你编辑器里那份。
        </p>
      )}
    </section>
  );
}

export function StudyDetail({
  view,
  summary,
  onOpenLesson,
}: {
  readonly view: StudyView;
  /** Null only while the shelf is still loading; the study reads fine without it. */
  readonly summary: StudySummary | null;
  readonly onOpenLesson: (locator: LessonLocator) => void;
}) {
  return (
    <section className="study-detail">
      <header className="study-detail__header">
        <div>
          <p className="eyebrow">项目 · {view.study.id}</p>
          <h2>{view.study.title}</h2>
          <p>{view.study.description}</p>
        </div>
        <UaDashboardButton
          studyId={view.study.id}
          available={(summary?.readyUaAnalysisCount ?? 0) > 0}
        />
      </header>
      {summary ? (
        <StudyEvidenceStatus
          snapshotCount={summary.snapshotCount}
          readyUaAnalysisCount={summary.readyUaAnalysisCount}
        />
      ) : null}
      <AirlockClocks studyId={view.study.id} />
      <StudyMap studyId={view.study.id} />
      {view.courses.length > 0 ? (
        view.courses.map((course) => (
          <CourseSection
            key={course.id}
            studyId={view.study.id}
            course={course}
            onOpenLesson={onOpenLesson}
          />
        ))
      ) : (
        <GamePanel className="formal-course-empty" tone="strong">
          <h2>正式课程尚未发布</h2>
          <p>源码、UA 地图与课堂笔记可以先存在，但它们不会冒充经过编排的正式课程。</p>
        </GamePanel>
      )}
      <KnowledgeNotesSection studyId={view.study.id} notes={view.notes} />
    </section>
  );
}
