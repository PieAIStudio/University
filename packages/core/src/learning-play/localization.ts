import { contrastCaseAgrees, type ContrastActivity } from "./contrast.js";
import type { ActivityBase } from "./types.js";

/** These are presentation fields, never identifiers, thresholds or rule inputs. */
const DISPLAY_FIELDS = new Set([
  "title",
  "brief",
  "goal",
  "takeaway",
  "hint",
  "label",
  "note",
  "detail",
  "why",
  "question",
  "explanation",
  "whyNot",
  "unit",
  "modelNote",
  "rule",
  "outputLabel",
]);
const DISPLAY_MAPS = new Set(["outcomes", "costOfOther"]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// A closed list translates the authored starter shown and executed in each locale,
// never learner inputs or runtime results. Arrays omit numeric indexes.
const PRIMM_DISPLAY_PATHS = new Set([
  "title",
  "brief",
  "goal",
  "takeaway",
  "hint",
  "source.label",
  "intro.situation",
  "intro.need",
  "intro.connection",
  "sources.reference.label",
  "sources.note",
  "sources.summary",
  "sources.limitation",
  "sources.date",
  "starter.prompt",
  "materials.label",
  "materials.text",
  "predict.question",
  "predict.options.label",
  "run.title",
  "run.note",
  "run.attachmentLabel",
  "run.debrief",
  "investigate.title",
  "investigate.brief",
  "investigate.explanation",
  "investigate.more.question",
  "investigate.more.answer",
  "investigate.game.instruction",
  "investigate.game.regions.label",
  "investigate.game.regions.note",
  "investigate.game.buckets.label",
  "investigate.game.cards.label",
  "investigate.game.cards.text",
  "investigate.game.cards.why",
  "investigate.game.items.label",
  "investigate.game.items.text",
  "investigate.game.items.expected",
  "investigate.game.items.why",
  "investigate.game.formats.label",
  "investigate.game.sentences.text",
  "investigate.game.replacementHint",
  "modify.title",
  "modify.brief",
  "modify.goal",
  "modify.suggestion",
  "modify.debrief",
  "modify.workbench.instruction",
  "modify.workbench.pieces.label",
  "modify.workbench.pieces.text",
  "make.title",
  "make.scenario",
  "make.goal",
  "make.promptPlaceholder",
  "make.checklist",
  "make.artifactLabel",
  "finish.title",
  "finish.note",
]);

function rewritePrimmDisplay(
  value: unknown,
  rewrite: (text: string) => string,
  path = "",
): unknown {
  if (typeof value === "string") return PRIMM_DISPLAY_PATHS.has(path) ? rewrite(value) : value;
  if (Array.isArray(value)) return value.map((item) => rewritePrimmDisplay(item, rewrite, path));
  if (!isRecord(value) || path === "locales") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      rewritePrimmDisplay(item, rewrite, path ? `${path}.${key}` : key),
    ]),
  );
}

function rewriteDisplay(
  value: unknown,
  rewrite: (text: string) => string,
  parent = "",
  isPath = isRecord(value) && value.kind === "interaction-path",
): unknown {
  if (isRecord(value) && value.kind === "primm") return rewritePrimmDisplay(value, rewrite);
  if (Array.isArray(value))
    return value.map((item) => rewriteDisplay(item, rewrite, parent, isPath));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      // Locale dictionaries are metadata. Never rewrite a dictionary, an ID,
      // an executable program, a source URL, or a learner's submitted data.
      if (key === "locales") return [key, item];
      const pathCopy =
        isPath &&
        ((parent === "context" && (key === "introduction" || key === "task")) ||
          (parent === "sources" && ["summary", "limitation", "date"].includes(key)) ||
          (parent === "steps" && key === "simulationNote") ||
          (parent === "materials" && key === "text") ||
          (parent === "cases" && (key === "text" || key === "feedback")));
      if (
        typeof item === "string" &&
        (pathCopy ||
          DISPLAY_FIELDS.has(key) ||
          DISPLAY_MAPS.has(parent) ||
          (key === "text" && parent === "reference"))
      ) {
        return [key, rewrite(item)];
      }
      return [key, rewriteDisplay(item, rewrite, key, isPath)];
    }),
  );
}

/** The exact strings a translator may change, including nested activity copy. */
export function activityDisplayStrings(activity: unknown): readonly string[] {
  const strings = new Set<string>();
  rewriteDisplay(activity, (text) => {
    strings.add(text);
    return text;
  });
  return [...strings];
}

function translatedPayload<T extends ActivityBase>(activity: T, locale: string): T {
  const translation = activity.locales?.[locale];
  if (!translation) return activity;
  const dictionary = translation.strings ?? {};
  const rewritten = rewriteDisplay(activity, (text) =>
    Object.prototype.hasOwnProperty.call(dictionary, text) ? dictionary[text]! : text,
  ) as T;
  const { sourceLabel } = translation;
  const frame = Object.fromEntries(
    ["title", "brief", "goal", "takeaway", "hint"].flatMap((key) => {
      const value = (translation as Readonly<Record<string, unknown>>)[key];
      return typeof value === "string" ? [[key, value]] : [];
    }),
  );
  return {
    ...rewritten,
    ...frame,
    source: sourceLabel ? { ...rewritten.source, label: sourceLabel } : rewritten.source,
  };
}

/** A translated contrast must not silently change which answers count as equal. */
export function activityTranslationIssues(activity: unknown): string[] {
  if (!isRecord(activity) || !isRecord(activity.locales)) return [];
  const permitted = new Set(activityDisplayStrings(activity));
  const issues: string[] = [];
  for (const [locale, candidate] of Object.entries(activity.locales)) {
    if (!isRecord(candidate)) continue; // The wire schema diagnoses shape errors.
    if (isRecord(candidate.strings)) {
      for (const key of Object.keys(candidate.strings)) {
        if (!permitted.has(key))
          issues.push(`${locale}: translation key is not display text: ${key}`);
      }
    }
    if (
      activity.kind === "contrast" &&
      Array.isArray(activity.cases) &&
      Array.isArray(activity.approaches)
    ) {
      const original = activity as unknown as ContrastActivity;
      const translated = translatedPayload(original, locale);
      for (let index = 0; index < original.cases.length; index += 1) {
        const before = original.cases[index]!;
        const after = translated.cases[index]!;
        if (contrastCaseAgrees(original, before) !== contrastCaseAgrees(translated, after)) {
          issues.push(`${locale}: translation changes contrast outcome equality: ${before.id}`);
        }
      }
    }
  }
  return issues;
}

/** Both shells use the same copy transform; activity identity and grading stay intact. */
export function localizeActivity<T extends ActivityBase>(activity: T, requestedLocale: string): T {
  const locale = activity.locales?.[requestedLocale]
    ? requestedLocale
    : requestedLocale.split("-")[0]!;
  if (!activity.locales?.[locale]) return activity;
  const issues = activityTranslationIssues(activity);
  if (issues.length) throw new Error(issues.join("; "));
  return translatedPayload(activity, locale);
}
