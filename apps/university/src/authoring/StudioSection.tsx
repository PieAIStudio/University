import type {
  BootstrapData,
  LessonRef,
  StudySummary,
  StudyView,
} from "@pieai/university-ui/view/lesson-view.js";

import { CourseRouteQuiz } from "./CourseRouteQuiz.js";
import { EmptyCampus } from "./EmptyCampus.js";
import { KnowledgeNotesSection } from "./KnowledgeNotesSection.js";
import { StudyAnalysisPanel } from "./StudyDetail.js";
import { StudyShelf } from "./StudyShelf.js";
import { UaDashboardButton } from "./UaDashboardButton.js";

/**
 * Local-only authoring surfaces, reached from 更多 → 作者工作台.
 *
 * Registration, UA coverage, the route quiz and knowledge notes used to live
 * on the study page. They are a mode, not a ninth nav slot.
 */
export function StudioSection({
  data,
  selectedStudyId,
  studyView,
  summary,
  studiesRootLabel,
  onSelectStudy,
  onOpenLesson,
}: {
  readonly data: BootstrapData;
  readonly selectedStudyId: string | null;
  readonly studyView: StudyView | null;
  readonly summary: StudySummary | null;
  readonly studiesRootLabel: string;
  readonly onSelectStudy: (studyId: string) => void;
  readonly onOpenLesson: (locator: LessonRef) => void;
}) {
  const routeCourse = studyView?.courses.find((course) => course.id === "foundations-before-zero");
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
          {routeCourse ? (
            <CourseRouteQuiz
              studyId={studyView.study.id}
              course={routeCourse}
              onOpenLesson={onOpenLesson}
            />
          ) : null}
          <KnowledgeNotesSection studyId={studyView.study.id} notes={studyView.notes} />
        </>
      ) : null}
    </div>
  );
}
