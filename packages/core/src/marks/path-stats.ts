import { parseLessonLinks, tokenKind } from "./references.js";

/**
 * Facts derived from lesson prose that cross the shelf boundary.
 *
 * The browser path cards and the Node importer must count the same tokens.
 * Keeping these pure parsers in core gives them one implementation while
 * keeping the UI-only labels and layout calculations in `packages/ui`.
 */

/** Count a wiki-token prefix exactly as written. Fences are not skipped. */
export function tokenPrefixCount(content: string, prefix: string): number {
  if (prefix.length === 0) return 0;
  return content.split(prefix).length - 1;
}

export function evidenceCount(content: string): number {
  return tokenPrefixCount(content, "[[evidence:");
}

export function unlockEntryCount(content: string): number {
  return tokenPrefixCount(content, "[[term:") + tokenPrefixCount(content, "[[concept:");
}

/** Coordinates only: `path:start-end`, without exposing a private source path elsewhere. */
export function evidenceLocatorOf(rawTarget: string): string | null {
  if (!rawTarget.startsWith("evidence:")) return null;
  const rest = rawTarget.slice("evidence:".length).trim();
  return rest.length > 0 ? rest : null;
}

/** The unique evidence coordinates a lesson's prose cites, in source order. */
export function evidenceLocatorsIn(content: string): readonly string[] {
  const seen = new Set<string>();
  const locators: string[] = [];
  for (const link of parseLessonLinks(content)) {
    if (tokenKind(link) !== "evidence") continue;
    const locator = evidenceLocatorOf(link.rawTarget);
    if (!locator || seen.has(locator)) continue;
    seen.add(locator);
    locators.push(locator);
  }
  return locators;
}
