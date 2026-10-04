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
  "make.title",
  "make.scenario",
  "make.goal",
  "make.promptPlaceholder",
  "make.checklist",
  "make.artifactLabel",
  "finish.title",
  "finish.note",
  "finish.didYouKnow.text",
  "finish.today",
  // Version 3 steps. Terms are matched against a live result in the learner's
  // language, so they translate with the lesson; request prompts run as written.
  "requests.prompt",
  "steps.title",
  "steps.after",
  "steps.context",
  "steps.options.label",
  "steps.options.after",
  "steps.attachmentLabel",
  "steps.debriefs.text",
  "steps.wait.text",
  "steps.hint",
  "steps.terms",
  "steps.found",
  "steps.absent",
  "steps.miss",
  "steps.regions.label",
  "steps.buckets.label",
  "steps.cards.text",
  "steps.cards.why",
  "steps.cards.miss",
  "steps.pieces.text",
  "steps.pieces.why",
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

function rewriteDisplay(value: unknown, rewrite: (text: string) => string, parent = ""): unknown {
  if (isRecord(value) && value.kind === "primm") return rewritePrimmDisplay(value, rewrite);
  if (Array.isArray(value)) return value.map((item) => rewriteDisplay(item, rewrite, parent));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      // Locale dictionaries are metadata. Never rewrite a dictionary, an ID,
      // an executable program, a source URL, or a learner's submitted data.
      if (key === "locales") return [key, item];
      if (
        typeof item === "string" &&
        (DISPLAY_FIELDS.has(key) ||
          DISPLAY_MAPS.has(parent) ||
          (key === "text" && parent === "reference"))
      )
        return [key, rewrite(item)];
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
