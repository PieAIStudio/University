/**
 * The only shape allowed across the publish boundary.
 *
 * Recovery packages are an authoring transport: they carry validation state,
 * source-analysis bindings and the bytes needed to lift an asset out of the
 * package. A customer package is a different DTO. These lists are deliberately
 * explicit so a new authoring field stays private until somebody chooses to
 * publish it here.
 */

function fields(names, why) {
  return Object.freeze({ fields: Object.freeze(names), why });
}

export const PUBLIC_DTO_FIELDS = Object.freeze({
  // Learners need the course identity and route metadata to choose and resume a course.
  course: fields(
    [
      "id",
      "title",
      "description",
      "audience",
      "objectives",
      "prerequisiteCourseIds",
      "trackId",
      "units",
    ],
    "The catalogue and course path use these fields to name a course and place it in a route.",
  ),
  // Learners need unit objectives and ordering to understand the path before opening a lesson.
  unit: fields(
    ["id", "title", "objective", "prerequisiteUnitIds", "lessons"],
    "The course path uses these fields to group lessons and explain what each unit teaches.",
  ),
  // Learners need the lesson itself, its teaching metadata, and every reading activity.
  lesson: fields(
    [
      "id",
      "title",
      "content",
      "contentRevision",
      "sections",
      "variant",
      "evidence",
      "assets",
      "cards",
      "exercises",
    ],
    "The reader uses these fields to render prose, progress sections, source material, media, cards and exercises.",
  ),
  // Learners need both sides of a card and its stable identity when reviewing it.
  card: fields(
    ["id", "kind", "front", "back", "tags", "evidence"],
    "Review needs the prompt, answer, identity and supporting citation without author revision records.",
  ),
  // Learners need a question and a non-reversible grading fingerprint, never the reference answer.
  exercise: fields(
    ["id", "kind", "title", "prompt", "answerKey", "evidence"],
    "The reader needs to ask and grade an exercise while keeping expected answers and rubrics private.",
  ),
  // Learners need a citation they can inspect, not the analysis graph that produced it.
  evidence: fields(
    [
      "kind",
      "sourceCommit",
      "sourcePath",
      "lineStart",
      "lineEnd",
      "note",
      "sourceUrl",
      "sourceTitle",
      "sourceAuthority",
      "snippetUrl",
    ],
    "The reader uses these fields to identify and open the source behind a teaching claim.",
  ),
  // Learners need media display and human-readable provenance, not source files or capture machinery.
  asset: fields(
    [
      "id",
      "kind",
      "mime",
      "url",
      "posterUrl",
      "alt",
      "caption",
      "transcript",
      "sourceCommit",
      "sourceCommitDate",
      "capture",
      "attribution",
      "license",
      "aiNote",
    ],
    "The reader needs to display media accessibly and explain its public provenance.",
  ),
  // A public capture route tells a learner what screen a picture represents.
  capture: fields(
    ["route", "state", "viewport", "locale"],
    "The caption can describe the captured screen without exposing an author machine or recipe.",
  ),
  // The recovery envelope is authoring transport metadata; only the course DTO crosses this boundary.
  package: fields(
    ["course"],
    "The delivery reader consumes the public course and has no need for recovery workflow state.",
  ),
});

function pick(value, spec) {
  if (value === null || typeof value !== "object") return {};
  return Object.fromEntries(
    spec.fields.flatMap((key) =>
      Object.prototype.hasOwnProperty.call(value, key) && value[key] !== undefined
        ? [[key, value[key]]]
        : [],
    ),
  );
}

function publicEvidence(evidence) {
  return pick(evidence, PUBLIC_DTO_FIELDS.evidence);
}

function publicCapture(capture) {
  if (!capture || typeof capture.route !== "string") return null;
  // A file-manager route names the author's machine, even when it uses the
  // portable `<source-root>` placeholder. Drop the whole capture block at the
  // boundary so no renderer can accidentally print a missing route as text.
  if (/^file-manager:/i.test(capture.route)) return null;
  return pick(capture, PUBLIC_DTO_FIELDS.capture);
}

function publicAsset(asset) {
  const metadata = asset?.metadata ?? asset;
  const capture = publicCapture(metadata?.capture);
  const source = metadata?.source;
  const candidate = {
    ...metadata,
    capture: capture ?? undefined,
    ...(asset?.url !== undefined ? { url: asset.url } : {}),
    ...(asset?.mime !== undefined ? { mime: asset.mime } : {}),
    ...(asset?.alt !== undefined ? { alt: asset.alt } : {}),
    ...(capture
      ? {
          capture,
          ...(metadata.capture.sourceCommit ? { sourceCommit: metadata.capture.sourceCommit } : {}),
        }
      : {}),
    ...(source?.attribution ? { attribution: source.attribution } : {}),
    ...(source?.license ? { license: source.license } : {}),
    ...(source?.aiNote ? { aiNote: source.aiNote } : {}),
  };
  return pick(candidate, PUBLIC_DTO_FIELDS.asset);
}

function publicCard(card) {
  const result = pick(card, PUBLIC_DTO_FIELDS.card);
  if (Array.isArray(card?.evidence)) result.evidence = card.evidence.map(publicEvidence);
  return result;
}

function publicExercise(exercise) {
  const result = pick(exercise, PUBLIC_DTO_FIELDS.exercise);
  if (Array.isArray(exercise?.evidence)) result.evidence = exercise.evidence.map(publicEvidence);
  return result;
}

export function requireContentRevision(value, label = "Lesson") {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must include a positive integer contentRevision`);
  }
  return value;
}

function publicLesson(lesson) {
  const contentRevision = requireContentRevision(lesson?.contentRevision);
  const result = pick(lesson, PUBLIC_DTO_FIELDS.lesson);
  result.contentRevision = contentRevision;
  result.evidence = (lesson?.evidence ?? []).map(publicEvidence);
  result.assets = (lesson?.assets ?? []).map(publicAsset);
  result.cards = (lesson?.cards ?? []).map(publicCard);
  result.exercises = (lesson?.exercises ?? []).map(publicExercise);
  return result;
}

function publicUnit(unit) {
  const result = pick(unit, PUBLIC_DTO_FIELDS.unit);
  result.lessons = (unit?.lessons ?? []).map(publicLesson);
  return result;
}

function publicCourse(course) {
  const result = pick(course, PUBLIC_DTO_FIELDS.course);
  result.units = (course?.units ?? []).map(publicUnit);
  return result;
}

export function toPublicPackage(pkg) {
  return {
    course: publicCourse(pkg?.course),
  };
}
