import { learningDomainOfStudy, type LessonRef } from "@pieai/university-core";
import type { ShelfStudy } from "@pieai/university-ui/content/port.js";
import type { WelcomePath } from "@pieai/university-ui/onboarding/WelcomeCards.js";

export interface WelcomeDestination extends WelcomePath {
  readonly lesson: LessonRef;
}

/** Real paths only. A second available path restores the approved choice. */
export function welcomeDestinations(studies: readonly ShelfStudy[]): readonly WelcomeDestination[] {
  return studies
    .map((study) => ({
      id: study.id,
      kind:
        learningDomainOfStudy(study.id) === "programming"
          ? ("build" as const)
          : ("basics" as const),
    }))
    .flatMap((choice) => {
      const study = studies.find((entry) => entry.id === choice.id);
      const course = study?.courses.find((entry) =>
        entry.units.some((unit) => unit.lessons.length > 0),
      );
      const unit = course?.units.find((entry) => entry.lessons.length > 0);
      const lesson = unit?.lessons[0];
      if (!study || !course || !unit || !lesson) return [];
      return [
        {
          ...choice,
          firstLessonTitle: lesson.title,
          lessonCount: study.courses.reduce(
            (total, entry) => total + entry.units.reduce((n, item) => n + item.lessons.length, 0),
            0,
          ),
          lesson: { studyId: study.id, courseId: course.id, unitId: unit.id, lessonId: lesson.id },
        },
      ];
    });
}

export interface WelcomeInvitation {
  readonly choices: readonly WelcomeDestination[];
  readonly onChoose: (destination: WelcomeDestination, assessment: boolean) => void;
  readonly onBrowse: () => void;
  readonly onSignIn: () => void;
  readonly onDismiss: () => void;
}

export interface FirstStoneInvitation {
  readonly id: string;
  readonly lessonId: string;
  /** The existing camera has finished framing this destination. */
  readonly ready: boolean;
  readonly onEnter: () => void;
  readonly onDismiss: () => void;
}
