import { useMemo, useSyncExternalStore } from "react";
import { LessonPracticeSurface } from "@pieai/university-ui";
import type { View } from "@pieai/university-core";
import type { Shelf } from "@pieai/university-ui/content/port.js";
import { progressPort } from "../progress/store";
import { contentPort } from "../ports/index.js";

/** Practice reads the already-loaded, shared course shelf. It never imports
 * the global concept-quiz catalogue, nor fetches a second catalogue. */
export function PracticeHost({
  onOpen,
  studies,
  ready,
}: {
  readonly onOpen: (view: View) => void;
  readonly studies: Shelf["studies"];
  readonly ready: boolean;
}) {
  useSyncExternalStore(progressPort.subscribe, progressPort.snapshot);
  const owner = progressPort.syncState().userId;
  const courses = useMemo(
    () =>
      studies.flatMap((study) =>
        study.courses.map((course) => ({
          studyId: study.id,
          id: course.id,
          title: course.title,
          units: course.units,
        })),
      ),
    [studies],
  );
  const mode = new URLSearchParams(location.search).get("mode") === "free" ? "free" : "round";
  return (
    <LessonPracticeSurface
      key={owner ?? "guest"}
      courses={courses}
      ready={ready}
      progress={progressPort}
      content={contentPort}
      initialMode={mode}
      onOpenLesson={(locator) => onOpen({ kind: "lesson", ...locator })}
      onBack={() => onOpen({ kind: "review" })}
    />
  );
}
