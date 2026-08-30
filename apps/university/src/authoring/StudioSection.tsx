import { translate } from "@pieai/university-ui/i18n.js";
import type {
  BootstrapData,
  StudySummary,
  StudyView,
} from "@pieai/university-ui/view/lesson-view.js";
import type { FeedbackReviewSource, ProgressPort } from "@pieai/university-core";

import { AnswerOverview } from "./AnswerOverview.js";
import { EmptyCampus } from "./EmptyCampus.js";
import { FeedbackOverview } from "./FeedbackOverview.js";
import { StudyAnalysisPanel } from "./StudyDetail.js";
import { StudyShelf } from "./StudyShelf.js";
import { UaDashboardButton } from "../learner/UaDashboardButton.js";
import { sourceAccessPort } from "../ports/index.js";

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
  feedbackSource,
  progress,
}: {
  readonly data: BootstrapData;
  readonly selectedStudyId: string | null;
  readonly studyView: StudyView | null;
  readonly summary: StudySummary | null;
  readonly studiesRootLabel: string;
  readonly onSelectStudy: (studyId: string) => void;
  readonly feedbackSource: FeedbackReviewSource;
  readonly progress: ProgressPort;
}) {
  return (
    <div className="studio-section">
      <header className="studio-section__header">
        <p className="eyebrow">{translate("app.authoring.studioSection.copy.作者工作台")}</p>
        <h1>{translate("app.authoring.studioSection.copy.本机上的课从这里长出来")}</h1>
        <p>
          {translate("app.authoring.studioSection.copy.学习资料默认保存在")}{" "}
          <code>{studiesRootLabel}</code>
          {translate("app.authoring.studioSection.copy.源码不会被学习资料污染")}
        </p>
      </header>
      {data.studies.length === 0 ? <EmptyCampus /> : null}
      {data.studies.length > 0 ? (
        <StudyShelf data={data} selectedStudyId={selectedStudyId} onSelect={onSelectStudy} />
      ) : null}
      <div className="studio-section__signals">
        <FeedbackOverview source={feedbackSource} studyView={studyView} />
        <AnswerOverview progress={progress} studyView={studyView} />
      </div>
      {studyView ? (
        <>
          <UaDashboardButton studyId={studyView.study.id} sourceAccess={sourceAccessPort} />
          <StudyAnalysisPanel
            studyId={studyView.study.id}
            summary={summary}
            sourceAccess={sourceAccessPort}
          />
        </>
      ) : null}
    </div>
  );
}
