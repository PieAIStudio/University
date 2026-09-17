import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

const digestOf = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function verifiedPackage(readPackage, studyId, entry) {
  try {
    const bytes = readPackage(studyId, entry);
    if (!bytes || digestOf(bytes) !== entry.sha256) return null;
    const value = JSON.parse(bytes.toString("utf8"));
    return value.packageKind === "university-local-course-recovery" &&
      value.course?.id === entry.courseId
      ? value
      : null;
  } catch {
    return null;
  }
}

/**
 * A shorter, newly authored public-source lesson is not missing baked code.
 * Accept that distinction only with both immutable packages and unchanged
 * source/asset bytes and assessment identities. Recovery packages version the
 * complete lesson, not individual embedded cards/questions. Their teaching text
 * may be rewritten in that new lesson revision without freezing the old quiz.
 * Repository lessons retain the strict guard.
 * This intentionally does not authorize removing lessons or evidence.
 */
export function preservesPublicRevisionMaterials(before, after) {
  if (!before?.course || !after?.course) return false;
  const oldUnits = before.course.units;
  const newUnits = after.course.units;
  if (!Array.isArray(oldUnits) || !Array.isArray(newUnits)) return false;
  if (
    !isDeepStrictEqual(
      oldUnits.map((unit) => unit.id),
      newUnits.map((unit) => unit.id),
    )
  )
    return false;
  let revised = false;
  for (let index = 0; index < oldUnits.length; index += 1) {
    const previous = oldUnits[index].lessons;
    const next = newUnits[index].lessons;
    if (!Array.isArray(previous) || !Array.isArray(next)) return false;
    if (
      !isDeepStrictEqual(
        previous.map((lesson) => lesson.id),
        next.map((lesson) => lesson.id),
      )
    )
      return false;
    for (let lessonIndex = 0; lessonIndex < previous.length; lessonIndex += 1) {
      const oldLesson = previous[lessonIndex];
      const newLesson = next[lessonIndex];
      if (
        !Number.isSafeInteger(oldLesson.contentRevision) ||
        !Number.isSafeInteger(newLesson.contentRevision) ||
        newLesson.contentRevision < oldLesson.contentRevision
      )
        return false;
      for (const key of ["evidence", "assets"]) {
        if (!isDeepStrictEqual(oldLesson[key] ?? [], newLesson[key] ?? [])) return false;
      }
      for (const key of ["cards", "exercises"]) {
        if (!preservesAssessmentMaterials(oldLesson[key] ?? [], newLesson[key] ?? [])) return false;
      }
      const evidence = [
        ...(newLesson.evidence ?? []),
        ...(newLesson.cards ?? []).flatMap((card) => card.evidence ?? []),
        ...(newLesson.exercises ?? []).flatMap((exercise) => exercise.evidence ?? []),
      ];
      if (
        evidence.length === 0 ||
        evidence.some((item) => typeof item.sourceUrl !== "string" || "sourcePath" in item)
      )
        return false;
      if (!isDeepStrictEqual(oldLesson, newLesson)) {
        if (newLesson.contentRevision <= oldLesson.contentRevision) return false;
        revised = true;
      }
    }
  }
  return revised;
}

/** Only a newer containing lesson may change wording; no child/source is lost. */
function preservesAssessmentMaterials(before, after) {
  if (!Array.isArray(before) || !Array.isArray(after)) return false;
  const ids = (items) => items.map((item) => item?.id);
  const oldIds = ids(before),
    newIds = ids(after);
  if (
    oldIds.some((id) => typeof id !== "string" || !id) ||
    new Set(oldIds).size !== oldIds.length ||
    !isDeepStrictEqual(oldIds, newIds)
  )
    return false;
  return before.every((previous, index) => {
    const next = after[index];
    if (previous.kind !== next.kind) return false;
    for (const field of ["evidence", "assets"]) {
      if (!isDeepStrictEqual(previous[field] ?? [], next[field] ?? [])) return false;
    }
    if (previous.kind === "choice") {
      if (!Array.isArray(previous.options) || !Array.isArray(next.options)) return false;
      const oldOptions = ids(previous.options),
        newOptions = ids(next.options);
      if (
        oldOptions.some((id) => typeof id !== "string" || !id) ||
        new Set(oldOptions).size !== oldOptions.length ||
        new Set(newOptions).size !== newOptions.length ||
        !isDeepStrictEqual([...oldOptions].sort(), [...newOptions].sort())
      )
        return false;
    }
    return true;
  });
}

/** Per-course checks prevent growth elsewhere from hiding lost evidence. */
export function assertNoUnexplainedShrink(previous, next, readPackage) {
  const explained = [];
  for (const study of previous.studies ?? []) {
    const freshStudy = next.studies?.find((item) => item.studyId === study.studyId);
    for (const oldCourse of study.courses ?? []) {
      const fresh = freshStudy?.courses?.find((item) => item.courseId === oldCourse.courseId);
      const where = `${study.studyId}/${oldCourse.courseId}`;
      if (!fresh) throw new Error(`import-courses: refusing to remove tracked course ${where}`);
      if ((fresh.servedBytes ?? 0) >= (oldCourse.servedBytes ?? 0)) continue;
      const changed = fresh.sha256 !== oldCourse.sha256;
      const before = changed && verifiedPackage(readPackage, study.studyId, oldCourse);
      const after = changed && verifiedPackage(readPackage, study.studyId, fresh);
      if (!preservesPublicRevisionMaterials(before, after)) {
        throw new Error(
          `import-courses: refusing unexplained shrink for ${where} ` +
            `(${oldCourse.servedBytes} -> ${fresh.servedBytes} servedBytes). ` +
            "Check source completeness and baked evidence. A shorter public-source revision " +
            "requires both hash-verified packages, newer changed lesson revisions, retained " +
            "lesson/assessment identities and unchanged sources and assets.",
        );
      }
      explained.push({
        course: where,
        from: oldCourse.sha256,
        to: fresh.sha256,
        removedBytes: oldCourse.servedBytes - fresh.servedBytes,
        reason: "new public-source revision; sources, assets and assessment identities preserved",
      });
    }
  }
  return explained;
}
