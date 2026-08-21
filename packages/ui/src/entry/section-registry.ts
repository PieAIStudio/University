import type { ReactNode } from "react";
import type { EntrySection, EntrySectionType, LexiconEntry } from "@pieai/university-core";

/**
 * Per-type lookup used by related/prerequisite pointers.
 *
 * Optional because the page is still readable when the caller has not passed a
 * lexicon: the sense id is shown as code, the same way a broken `[[term:]]`
 * stays on the page as text.
 */
export interface EntryRenderContext {
  readonly lexicon?: ReadonlyMap<string, LexiconEntry>;
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
