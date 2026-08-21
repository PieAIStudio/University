import type { ReactNode } from "react";
import type { EntrySection, EntrySectionType, LexiconEntry } from "@pieai/university-core";

/**
 * What a related/prerequisite pointer resolves to, whichever collection it
 * points into. A term supplies headword and gloss; a concept supplies its
 * Chinese name and tagline; the renderer does not need to know which.
 */
export interface SenseTarget {
  readonly title: string;
  readonly subtitle: string;
  /** Set when the title is not Chinese, so a screen reader says it correctly. */
  readonly lang?: string;
}

/**
 * Per-type lookup used by related/prerequisite pointers.
 *
 * Everything is optional because the page stays readable when the caller has
 * not passed a lookup: the id is shown as code, the same way a broken
 * `[[term:]]` stays on the page as text.
 *
 * `resolveSense` exists because `lexicon` was the wrong shape the moment a
 * third collection arrived. A concept page's 「相关」 points at concepts, and
 * handing it the 267-entry lexicon resolved none of them — every pointer
 * rendered as a bare id, on every one of 281 pages, while all the tests passed
 * because the ids were perfectly valid. It took opening the page to see it.
 */
export interface EntryRenderContext {
  readonly lexicon?: ReadonlyMap<string, LexiconEntry>;
  readonly resolveSense?: (senseId: string) => SenseTarget | undefined;
  readonly onOpenSense?: (senseId: string) => void;
}

/**
 * A section type is a registered renderer, and `toMarkdown` is not optional.
 *
 * Copy-as-Markdown is a fold over this map. A type that can render but cannot
 * serialise would grow a block on the page and silently omit it from the
 * clipboard — the failure SPEC-0004 exists to make a registration error
 * instead of a learner-facing surprise. TypeScript requires the field;
 * `registerSectionRenderer` still checks at runtime for the object-literal
 * that was cast through.
 */
export interface SectionRenderer<T extends EntrySectionType = EntrySectionType> {
  readonly type: T;
  readonly render: (
    section: Extract<EntrySection, { type: T }>,
    context: EntryRenderContext,
  ) => ReactNode;
  readonly toMarkdown: (section: Extract<EntrySection, { type: T }>) => string;
}

const registry = new Map<EntrySectionType, SectionRenderer>();

export function registerSectionRenderer<T extends EntrySectionType>(
  renderer: SectionRenderer<T>,
): void {
  if (typeof renderer.toMarkdown !== "function") {
    throw new Error(
      `Section type "${String((renderer as { type?: string }).type)}" cannot register without toMarkdown. Copy-as-Markdown is a fold over the registry; a type that cannot serialise itself would fail in the learner's clipboard.`,
    );
  }
  if (typeof renderer.render !== "function") {
    throw new Error(
      `Section type "${String((renderer as { type?: string }).type)}" cannot register without render.`,
    );
  }
  registry.set(renderer.type, renderer as unknown as SectionRenderer);
}

export function getSectionRenderer(type: EntrySectionType): SectionRenderer | undefined {
  return registry.get(type);
}

/**
 * C3. Head plus each registered renderer's own Markdown, in page order.
 *
 * A section whose type has no renderer is skipped rather than thrown: the same
 * degrade-to-head contract as a payload that failed validation. The default
 * set is required to cover every core type, so a skip here is a missing
 * register, caught by tests.
 */
export function foldEntryMarkdown(headMarkdown: string, sections: readonly EntrySection[]): string {
  const chunks: string[] = [];
  const head = headMarkdown.trim();
  if (head) chunks.push(head);
  for (const section of sections) {
    const renderer = registry.get(section.type);
    if (!renderer) continue;
    const text = renderer.toMarkdown(section).trim();
    if (text) chunks.push(text);
  }
  return chunks.join("\n\n");
}
