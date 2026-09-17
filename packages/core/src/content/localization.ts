import { localizeActivity } from "../learning-play/localization.js";
import type { ActivityBase } from "../learning-play/types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const COPY = new Set([
  "title",
  "description",
  "audience",
  "objectives",
  "objective",
  "goals",
  "content",
  "front",
  "back",
  "prompt",
  "options",
  "answerKey",
  "correctAnswer",
  "lessonTitle",
  "sourceTitle",
  "note",
  "publisher",
  "locator",
  "supports",
  "limitations",
  "alt",
  "caption",
  "transcript",
  "attribution",
]);
const CHILDREN = new Set([
  "study",
  "studies",
  "course",
  "courses",
  "unit",
  "units",
  "lesson",
  "lessons",
  "cards",
  "exercises",
  "evidence",
  "provenance",
  "assets",
]);

function localize(value: unknown, locale: string): unknown {
  if (Array.isArray(value)) return value.map((item) => localize(item, locale));
  if (!isRecord(value)) return value;
  const result = { ...value };
  const variants = isRecord(value.locales) ? value.locales : {};
  const candidate = variants[locale] ?? variants[locale.split("-")[0]!];
  if (isRecord(candidate)) {
    for (const [key, translated] of Object.entries(candidate)) {
      if (COPY.has(key) && translated !== undefined) result[key] = translated;
    }
    // Text positions belong to one language's bytes. Do not reuse Chinese
    // highlights, paragraph IDs, or vocabulary offsets against English text.
    if (typeof candidate.content === "string" && candidate.content !== value.content) {
      if ("sections" in value) result.sections = [];
      delete result.language;
      if ("links" in value) result.links = [];
      if ("termAnchors" in value) result.termAnchors = [];
      if ("evidenceAnchors" in value) result.evidenceAnchors = [];
    }
  }
  for (const key of CHILDREN) {
    if (result[key] !== undefined) result[key] = localize(result[key], locale);
  }
  if (Array.isArray(value.activities)) {
    result.activities = value.activities.map((activity) =>
      localizeActivity(activity as ActivityBase, locale),
    );
  }
  return result;
}

/** Localize published learner data, never account state or a source identity. */
export function localizeLearnerContent<T>(value: T, locale: string): T {
  return localize(value, locale) as T;
}
