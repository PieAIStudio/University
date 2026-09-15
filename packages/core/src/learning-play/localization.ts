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

function rewriteDisplay(value: unknown, rewrite: (text: string) => string, parent = ""): unknown {
  if (Array.isArray(value)) return value.map((item) => rewriteDisplay(item, rewrite, parent));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      // Locale dictionaries are metadata. Never rewrite a dictionary, an ID,
      // an executable program, a source URL, or a learner's submitted data.
      if (key === "locales") return [key, item];
      if (typeof item === "string" && (DISPLAY_FIELDS.has(key) || DISPLAY_MAPS.has(parent))) {
        return [key, rewrite(item)];
      }
      return [key, rewriteDisplay(item, rewrite, key)];
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
