import type { ShelfStudy } from "../content/port.js";

// Known sample identities include retired lessons for historical/test catalogues.
// An identity is offered only when that exact lesson exists on the loaded shelf.
const SAMPLE_PATHS = [
  {
    id: "ask-about-a-picture",
    unitId: "first-useful-step",
  },
  {
    id: "sound-words-and-meaning",
    unitId: "first-useful-step",
  },
  {
    id: "name-the-result",
    unitId: "first-useful-step",
  },
] as const;

export function samplePathsOf(studies: readonly ShelfStudy[]) {
  const course = studies
    .find((study) => study.id === "ai-literacy")
    ?.courses.find((course) => course.id === "understanding-ai");
  return SAMPLE_PATHS.filter((path) =>
    course?.units.some(
      (unit) => unit.id === path.unitId && unit.lessons.some((lesson) => lesson.id === path.id),
    ),
  );
}
