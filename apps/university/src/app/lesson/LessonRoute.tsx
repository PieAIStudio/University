import type { LessonRef, PresenceLocation, PresencePort } from "@pieai/university-core";
import type { EntitlementReader } from "@pieai/university-ui/capability/ai-entitlements.js";
import { LINK_RETURN_DEPTH } from "@pieai/university-ui/lesson/LessonReader.js";
import type { LessonLinkTarget } from "@pieai/university-ui/markdown/remark-lesson-links.js";
import { PresenceSession } from "@pieai/university-ui/presence.js";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import { Suspense, useState, type ReactNode } from "react";

import { LessonScreen, RouteFallback } from "../../screens/lazy";

interface LessonRouteProps {
  readonly locator: LessonRef;
  readonly course: CourseView | null;
  readonly studyTitle?: string;
  readonly presencePort: PresencePort;
  readonly presenceLocation: PresenceLocation | null;
  readonly presenceViewKey: string;
  readonly onNavigate: (next: LessonRef) => void;
  readonly onBack: () => void;
  readonly onSettled: (locator: LessonRef, doneBefore: number) => void;
  readonly onWorthwhileProgress?: () => void;
  readonly readEntitlements?: EntitlementReader;
  readonly avatarRecipe?: AvatarRecipe | null;
  readonly feedbackSurface: ReactNode;
}

/** The lesson's route state belongs with the reader, rather than App's map composition. */
export function LessonRoute({
  locator,
  course,
  studyTitle,
  presencePort,
  presenceLocation,
  presenceViewKey,
  onNavigate,
  onBack,
  onSettled,
  onWorthwhileProgress,
  readEntitlements,
  avatarRecipe,
  feedbackSurface,
}: LessonRouteProps) {
  const [returnStack, setReturnStack] = useState<readonly LessonRef[]>([]);

  const followLink = (target: LessonLinkTarget) => {
    setReturnStack((current) => [...current, locator].slice(-LINK_RETURN_DEPTH));
    onNavigate({
      studyId: locator.studyId,
      courseId: target.courseId,
      unitId: target.unitId,
      lessonId: target.lessonId,
    });
  };
  const returnToPrevious = () => {
    const previous = returnStack.at(-1);
    if (!previous) return;
    setReturnStack((current) => current.slice(0, -1));
    onNavigate(previous);
  };
  const openAdjacentLesson = (next: LessonRef) => {
    setReturnStack([]);
    onNavigate(next);
  };

  return (
    <>
      <div className="app app--lesson">
        <PresenceSession
          port={presencePort}
          location={presenceLocation}
          viewKey={presenceViewKey}
        />
        <Suspense fallback={<RouteFallback />}>
          <LessonScreen
            locator={locator}
            course={course}
            studyTitle={studyTitle}
            returnDepth={returnStack.length}
            onFollowLink={followLink}
            onReturn={returnToPrevious}
            onOpenLesson={openAdjacentLesson}
            onBack={onBack}
            onWorthwhileProgress={onWorthwhileProgress}
            readEntitlements={readEntitlements}
            avatarRecipe={avatarRecipe}
            onSettled={(doneBefore) => onSettled(locator, doneBefore)}
          />
        </Suspense>
      </div>
      {feedbackSurface}
    </>
  );
}
