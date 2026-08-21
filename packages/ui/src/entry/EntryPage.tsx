import type { ReactNode } from "react";
import type {
  AntiPatternEntry,
  AntiPatternHead,
  CollectionId,
  EntrySection,
  LexiconEntry,
  TermEntry,
} from "@pieai/university-core";
import {
  ANTI_PATTERN_CATEGORY_LABEL,
  antiPatternHeadToMarkdown,
  termHeadToMarkdown,
} from "@pieai/university-core";

import { CopyTextButton } from "./CopyTextButton.js";
import "./default-renderers.js";
import {
  foldEntryMarkdown,
  getSectionRenderer,
  type EntryRenderContext,
} from "./section-registry.js";

/**
 * Breadcrumb root labels. One shell, two collections; a second page component
 * for anti-patterns would be SPEC-0004 failing.
 */
export const COLLECTION_LABEL: { readonly [C in CollectionId]: string } = {
  terms: "术语图鉴",
  "anti-patterns": "防止 AI 味儿",
};

export interface EntryBreadcrumbItem {
  readonly label: string;
  readonly href?: string;
}

export interface EntryPageProps {
  readonly breadcrumb: readonly EntryBreadcrumbItem[];
  readonly head: ReactNode;
  readonly sections: readonly EntrySection[];
  /** Already-serialised head. The copy button folds this with each renderer's toMarkdown. */
  readonly headMarkdown: string;
  readonly lexicon?: ReadonlyMap<string, LexiconEntry>;
  readonly onOpenSense?: (senseId: string) => void;
}

function SectionView({
  section,
  context,
}: {
  readonly section: EntrySection;
  readonly context: EntryRenderContext;
}) {
  const renderer = getSectionRenderer(section.type);
  if (!renderer) return null;
  return renderer.render(section, context);
}

/**
 * The entry page chrome: breadcrumb, head, sections in order, copy-as-Markdown.
 *
 * Collection-generic on purpose. Terms pass a lexicon head; anti-patterns pass
 * a different head into the same shell. Favourite, pronunciation and prev/next
 * are later chrome, not a reason to fork this.
 */
export function EntryPage({
  breadcrumb,
  head,
  sections,
  headMarkdown,
  lexicon,
  onOpenSense,
}: EntryPageProps) {
  const markdown = foldEntryMarkdown(headMarkdown, sections);
  const context: EntryRenderContext = { lexicon, onOpenSense };

  return (
    <article className="entry-page">
      <header className="entry-page__topbar">
        <nav className="entry-page__breadcrumb" aria-label="面包屑">
          <ol>
            {breadcrumb.map((item, index) => {
              const current = index === breadcrumb.length - 1;
              return (
                <li key={`${item.label}-${index}`} aria-current={current ? "page" : undefined}>
                  {item.href && !current ? (
                    <a href={item.href}>{item.label}</a>
                  ) : (
                    <span>{item.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <CopyTextButton text={markdown} idleLabel="复制为 Markdown" copiedLabel="已复制" />
      </header>
      <div className="entry-page__head">{head}</div>
      {sections.length > 0 ? (
        <div className="entry-page__sections">
          {sections.map((section, index) => (
            <SectionView key={`${section.id}-${index}`} section={section} context={context} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

/**
 * The lexicon record as a page head. Same fields the reference panel already
 * shows, laid out as a title rather than a drawer body. The record is not
 * copied; both surfaces read `LexiconEntry`.
 */
export function TermEntryHead({ entry }: { readonly entry: LexiconEntry }) {
  return (
    <header className="entry-head">
      <h1>
        <span className="entry-head__headword" lang="en">
          {entry.headword}
        </span>
      </h1>
      <p className="entry-head__meta">
        <span className="entry-head__phonetic">{entry.phonetic}</span>
        <span className="entry-head__pos">{entry.partOfSpeech}</span>
      </p>
      {entry.colloquial ? (
        <p className="entry-head__colloquial">
          <span className="entry-head__colloquial-label">你可能会说</span>
          {entry.colloquial}
        </p>
      ) : null}
      <p className="entry-head__gloss">{entry.gloss}</p>
      <p className="entry-head__usage">{entry.usage}</p>
    </header>
  );
}

export function TermEntryPage({
  entry,
  collectionHref,
  lexicon,
  onOpenSense,
}: {
  readonly entry: TermEntry;
  readonly collectionHref?: string;
  readonly lexicon?: ReadonlyMap<string, LexiconEntry>;
  readonly onOpenSense?: (senseId: string) => void;
}) {
  return (
    <EntryPage
      breadcrumb={[
        { label: COLLECTION_LABEL.terms, href: collectionHref },
        { label: entry.head.headword },
      ]}
      head={<TermEntryHead entry={entry.head} />}
      sections={entry.sections}
      headMarkdown={termHeadToMarkdown(entry.head)}
      lexicon={lexicon}
      onOpenSense={onOpenSense}
    />
  );
}

/**
 * The anti-pattern record as a page head. A second page component would be
 * SPEC-0004 failing; this is the head adapter the collection-generic shell
 * already expected.
 */
export function AntiPatternEntryHead({ head }: { readonly head: AntiPatternHead }) {
  return (
    <header className="entry-head">
      <h1>
        <span className="entry-head__headword">{head.name}</span>
      </h1>
      <p className="entry-head__meta">
        <span className="entry-head__pos">{ANTI_PATTERN_CATEGORY_LABEL[head.category]}</span>
      </p>
      <p className="entry-head__colloquial">
        <span className="entry-head__colloquial-label">你正常说就行</span>
        {head.complaint}
      </p>
    </header>
  );
}

export function AntiPatternEntryPage({
  entry,
  collectionHref,
  lexicon,
  onOpenSense,
}: {
  readonly entry: AntiPatternEntry;
  readonly collectionHref?: string;
  readonly lexicon?: ReadonlyMap<string, LexiconEntry>;
  readonly onOpenSense?: (senseId: string) => void;
}) {
  return (
    <EntryPage
      breadcrumb={[
        { label: COLLECTION_LABEL["anti-patterns"], href: collectionHref },
        { label: entry.head.name },
      ]}
      head={<AntiPatternEntryHead head={entry.head} />}
      sections={entry.sections}
      headMarkdown={antiPatternHeadToMarkdown(entry.head)}
      lexicon={lexicon}
      onOpenSense={onOpenSense}
    />
  );
}
