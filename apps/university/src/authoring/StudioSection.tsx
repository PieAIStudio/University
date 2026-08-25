import type {
  BootstrapData,
  StudySummary,
  StudyView,
} from "@pieai/university-ui/view/lesson-view.js";

import { EmptyCampus } from "./EmptyCampus.js";
import { StudyAnalysisPanel } from "./StudyDetail.js";
import { StudyShelf } from "./StudyShelf.js";
import { UaDashboardButton } from "./UaDashboardButton.js";

/**
 * Local-only authoring surfaces, reached from 更多 → 作者工作台.
 *
 * Registration and UA coverage. What is here is here because only an author
 * has any use for it; the route quiz and the knowledge notes were here too,
 * and they were the two things on this page a *learner* needed — so they left,
 * to the course island and to the library's fifth collection. Anything added
 * here has to answer the same question: is this something only the person
 * making a course would ever open?
 */
export function StudioSection({
  data,
  selectedStudyId,
  studyView,
  summary,
  studiesRootLabel,
  onSelectStudy,
}: {
  readonly data: BootstrapData;
  readonly selectedStudyId: string | null;
  readonly studyView: StudyView | null;
  readonly summary: StudySummary | null;
  readonly studiesRootLabel: string;
  readonly onSelectStudy: (studyId: string) => void;
}) {
  return (
    <div className="studio-section">
      <header className="studio-section__header">
        <p className="eyebrow">作者工作台</p>
        <h1>本机上的课从这里长出来</h1>
        <p>
          学习资料默认保存在 <code>{studiesRootLabel}</code>
          。源码不会被学习资料污染。
        </p>
      </header>
      {data.studies.length === 0 ? <EmptyCampus /> : null}
      {data.studies.length > 0 ? (
        <StudyShelf data={data} selectedStudyId={selectedStudyId} onSelect={onSelectStudy} />
      ) : null}
      {studyView ? (
        <>
          <UaDashboardButton
            studyId={studyView.study.id}
            available={(summary?.readyUaAnalysisCount ?? 0) > 0}
          />
          <StudyAnalysisPanel studyId={studyView.study.id} summary={summary} />
        </>
      ) : null}
    </div>
  );
}
