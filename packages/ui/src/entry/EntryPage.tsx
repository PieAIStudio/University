import { translate } from "../i18n/index.js";
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
import { EntryFloatNav, type EntryNeighbourPair } from "./EntryFloatNav.js";
import { PronunciationButton } from "./PronunciationButton.js";
import {
  foldEntryMarkdown,
  getSectionRenderer,
  type EntryRenderContext,
  type SenseTarget,
} from "./section-registry.js";

export type { EntryNeighbour, EntryNeighbourPair } from "./EntryFloatNav.js";

/**
 * Breadcrumb root labels. One shell, two collections; a second page component
 * for anti-patterns would be SPEC-0004 failing.
 */
export const COLLECTION_LABEL: { readonly [C in CollectionId]: string } = {
  terms: translate("ui.entry.entryPage.copy.术语图鉴"),
  "anti-patterns": translate("ui.entry.entryPage.copy.防止-AI-味儿"),
  concepts: translate("ui.entry.entryPage.copy.概念图解"),
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
  readonly resolveSense?: (senseId: string) => SenseTarget | undefined;
  readonly onOpenSense?: (senseId: string) => void;
  /**
   * C23. Neighbours of *this* entry in its collection. Terms and anti-patterns
   * pass the same shape; the chrome does not know which collection it is on.
   */
  readonly neighbours?: EntryNeighbourPair;
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
 * a different head into the same shell. Favourite is later chrome, not a
 * reason to fork this.
 */
export function EntryPage({
  breadcrumb,
  head,
  sections,
  headMarkdown,
  lexicon,
  resolveSense,
  onOpenSense,
  neighbours,
}: EntryPageProps) {
  const markdown = foldEntryMarkdown(headMarkdown, sections);
  const context: EntryRenderContext = { lexicon, resolveSense, onOpenSense };

  return (
    <article className="entry-page">
      {neighbours ? <EntryFloatNav neighbours={neighbours} /> : null}
      <header className="entry-page__topbar">
        <nav
          className="entry-page__breadcrumb"
          aria-label={translate("ui.entry.entryPage.copy.面包屑")}
        >
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
        <CopyTextButton
          text={markdown}
          idleLabel={translate("ui.entry.entryPage.copy.复制为-Markdown")}
          copiedLabel={translate("ui.entry.entryPage.copy.已复制")}
        />
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
      <div className="entry-head__title">
        <h1>
          <span className="entry-head__headword" lang="en">
            {entry.headword}
          </span>
        </h1>
        <PronunciationButton word={entry.headword} />
      </div>
      <p className="entry-head__meta">
        <span className="entry-head__phonetic">{entry.phonetic}</span>
        <span className="entry-head__pos">{entry.partOfSpeech}</span>
      </p>
      {/*
        Only the first phrasing is shown. The rest exist so the search can be
        found by more than one person's words; printing all of them here would
        be showing the reader the index instead of the entry.
      */}
      {entry.colloquial && entry.colloquial.length > 0 ? (
        <p className="entry-head__colloquial">
          <span className="entry-head__colloquial-label">
            {translate("ui.entry.entryPage.copy.你可能会说")}
          </span>
          {entry.colloquial[0]}
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
  resolveSense,
  onOpenSense,
  neighbours,
}: {
  readonly entry: TermEntry;
  readonly collectionHref?: string;
  readonly lexicon?: ReadonlyMap<string, LexiconEntry>;
  readonly resolveSense?: (senseId: string) => SenseTarget | undefined;
  readonly onOpenSense?: (senseId: string) => void;
  readonly neighbours?: EntryNeighbourPair;
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
      resolveSense={resolveSense}
      onOpenSense={onOpenSense}
      neighbours={neighbours}
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
        <span className="entry-head__colloquial-label">
          {translate("ui.entry.entryPage.copy.你正常说就行")}
        </span>
        {head.complaint}
      </p>
    </header>
  );
}

export function AntiPatternEntryPage({
  entry,
  collectionHref,
  lexicon,
  resolveSense,
  onOpenSense,
  neighbours,
}: {
  readonly entry: AntiPatternEntry;
  readonly collectionHref?: string;
  readonly lexicon?: ReadonlyMap<string, LexiconEntry>;
  readonly resolveSense?: (senseId: string) => SenseTarget | undefined;
  readonly onOpenSense?: (senseId: string) => void;
  readonly neighbours?: EntryNeighbourPair;
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
      resolveSense={resolveSense}
      onOpenSense={onOpenSense}
      neighbours={neighbours}
    />
  );
}
