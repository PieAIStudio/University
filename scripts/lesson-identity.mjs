/**
 * The learner document keys a lesson by study/course/lesson. A course must
 * therefore not reuse one lesson id in two units before it reaches that
 * projection.
 */
export function crossUnitLessonIdentityErrors(course, label) {
  if (!course || !Array.isArray(course.units)) return [];

  const firstUnitByLessonId = new Map();
  const errors = [];
  for (const unit of course.units) {
    if (!unit || typeof unit.id !== "string" || !Array.isArray(unit.lessons)) continue;
    for (const lesson of unit.lessons) {
      if (!lesson || typeof lesson.id !== "string") continue;
      const firstUnitId = firstUnitByLessonId.get(lesson.id);
      if (firstUnitId !== undefined && firstUnitId !== unit.id) {
        errors.push(
          `${label}: lesson id ${lesson.id} is reused in units ${firstUnitId} and ${unit.id}; ` +
            "the progress document key drops unitId",
        );
      } else if (firstUnitId === undefined) {
        firstUnitByLessonId.set(lesson.id, unit.id);
      }
    }
  }
  return errors;
}
