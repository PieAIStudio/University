import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { View } from "@pieai/university-core";
import type { ShelfStudy } from "@pieai/university-ui/content/port.js";
import {
  welcomeDestinations,
  type FirstStoneInvitation,
  type WelcomeDestination,
  type WelcomeInvitation,
} from "../guide/first-meeting.js";
import type { useWelcome } from "./use-welcome.js";
import type { PathOverlay } from "./world-model.js";

interface FirstMeetingOptions {
  /** The learner the tour belongs to; another account never inherits it. */
  readonly guideUser: string;
  readonly view: View;
  readonly studies: readonly ShelfStudy[];
  readonly welcome: ReturnType<typeof useWelcome>;
  readonly sceneAttempt: number;
  readonly setNavigationFocus: (studyId: string) => void;
  readonly setView: (next: View) => void;
  readonly setPathOverlay: Dispatch<SetStateAction<PathOverlay | null>>;
  readonly openAccount: () => void;
}

/**
 * The first meeting: the welcome's two paths, and the one-step tour to the
 * chosen path's first stone. It ends the moment the learner leaves that course.
 */
export function useFirstMeeting({
  guideUser,
  view,
  studies,
  welcome,
  sceneAttempt,
  setNavigationFocus,
  setView,
  setPathOverlay,
  openAccount,
}: FirstMeetingOptions) {
  const [firstMeeting, setFirstMeeting] = useState<{
    owner: string;
    destination: WelcomeDestination;
    /** A restored canvas must frame the pair again before the guide points. */
    framedAttempt: number | null;
  } | null>(null);
  const paths = useMemo(() => welcomeDestinations(studies), [studies]);
  const here =
    firstMeeting?.owner === guideUser &&
    view.kind === "course" &&
    view.studyId === firstMeeting.destination.lesson.studyId &&
    view.courseId === firstMeeting.destination.lesson.courseId
      ? firstMeeting.destination
      : null;
  useEffect(() => {
    if (firstMeeting && !here) setFirstMeeting(null);
  }, [firstMeeting, here]);

  const choose = (destination: WelcomeDestination, assessment: boolean) => {
    // Re-resolve the real shelf identity, not an object retained from an older opening.
    const current = paths.find((path) => path.id === destination.id);
    if (!current || !welcome.visible) return;
    welcome.dismiss("lesson");
    setNavigationFocus(current.lesson.studyId);
    setFirstMeeting(
      assessment ? null : { owner: guideUser, destination: current, framedAttempt: null },
    );
    setView({ kind: "course", studyId: current.lesson.studyId, courseId: current.lesson.courseId });
    setPathOverlay(
      assessment ? { kind: "unit", unitId: current.lesson.unitId, returnFocusTo: null } : null,
    );
  };

  useEffect(() => {
    const only = paths.length === 1 ? paths[0] : undefined;
    if (welcome.visible && only) choose(only, false);
  }, [welcome.visible, paths]);

  /** The scene has framed the first stone on this attempt; the guide may point at it. */
  const introductionReady = (lessonId: string) => {
    setFirstMeeting((current) =>
      current &&
      current.framedAttempt !== sceneAttempt &&
      current.owner === guideUser &&
      current.destination === here &&
      current.destination.lesson.lessonId === lessonId
        ? { ...current, framedAttempt: sceneAttempt }
        : current,
    );
  };

  const invitation: WelcomeInvitation | null =
    welcome.visible && paths.length > 1
      ? {
          choices: paths,
          onChoose: choose,
          onBrowse: () => {
            welcome.dismiss("map");
            setView({ kind: "planet" });
          },
          onSignIn: () => {
            welcome.dismiss("account");
            openAccount();
          },
          onDismiss: () => welcome.dismiss("map"),
        }
      : null;

  const firstStone: FirstStoneInvitation | null = here
    ? {
        id: `${guideUser}:${here.lesson.studyId}:${here.lesson.courseId}:${here.lesson.lessonId}`,
        lessonId: here.lesson.lessonId,
        ready: firstMeeting?.framedAttempt === sceneAttempt,
        onDismiss: () => setFirstMeeting(null),
        onEnter: () => {
          setFirstMeeting(null);
          setView({ kind: "lesson", ...here.lesson });
        },
      }
    : null;

  return { here, invitation, firstStone, introductionReady };
}
