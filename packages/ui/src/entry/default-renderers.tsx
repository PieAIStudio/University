import type { ReactNode } from "react";
import { GameCallout } from "@pieai/swimmer-ui-kit";
import {
  FLOW_CAPTION,
  SECTION_HEADING,
  SECTION_TYPES,
  sectionToMarkdown,
  type EntrySection,
  type EntrySectionType,
} from "@pieai/university-core";

import { CopyTextButton } from "./CopyTextButton.js";
import {
  registerSectionRenderer,
  type EntryRenderContext,
  type SectionRenderer,
} from "./section-registry.js";

function SectionFrame({
  section,
  children,
}: {
  readonly section: EntrySection;
  readonly children: ReactNode;
}) {
  const headingId = `entry-section-${section.id}`;
  return (
    <section
      className={`entry-section entry-section--${section.type}`}
      data-section-type={section.type}
      data-section-id={section.id}
      aria-labelledby={headingId}
    >
      <h2 id={headingId}>{SECTION_HEADING[section.type]}</h2>
      {children}
    </section>
  );
}

function SenseList({
  senseIds,
  context,
}: {
  readonly senseIds: readonly string[];
  readonly context: EntryRenderContext;
}) {
  return (
    <ol className="entry-section__senses">
      {senseIds.map((senseId, index) => {
        const entry = context.lexicon?.get(senseId);
        const content = entry ? (
          <>
            <span lang="en">{entry.headword}</span>
            <span className="entry-section__sense-gloss">{entry.gloss}</span>
          </>
        ) : (
          <code>{senseId}</code>
        );
        return (
          <li key={`${senseId}-${index}`}>
            {context.onOpenSense ? (
              <button
                type="button"
                className="entry-section__sense"
                onClick={() => context.onOpenSense?.(senseId)}
              >
                {content}
              </button>
            ) : (
              <span className="entry-section__sense">{content}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const DEFAULT_BY_TYPE = {
  colloquial: {
    type: "colloquial",
    toMarkdown: sectionToMarkdown,
    render: (section) => (
      <SectionFrame section={section}>
        <GameCallout tone="info">{section.payload.text}</GameCallout>
      </SectionFrame>
    ),
  },
  definition: {
    type: "definition",
    toMarkdown: sectionToMarkdown,
    render: (section) => (
      <SectionFrame section={section}>
        <p className="entry-section__definition">
          {section.payload.statement ? <strong>{section.payload.statement}</strong> : null}
          {section.payload.statement && section.payload.not ? (
            <span className="entry-section__dot" aria-hidden="true">
              {" "}
              ·{" "}
            </span>
          ) : null}
          {section.payload.not ? <span>它不是：{section.payload.not}</span> : null}
        </p>
      </SectionFrame>
    ),
  },
  aliases: {
    type: "aliases",
    toMarkdown: sectionToMarkdown,
    render: (section) => (
      <SectionFrame section={section}>
        <ul className="entry-section__aliases">
          {section.payload.names.map((name) => (
            <li key={name}>
              <em>{name}</em>
            </li>
          ))}
        </ul>
      </SectionFrame>
    ),
  },
  prerequisites: {
    type: "prerequisites",
    toMarkdown: sectionToMarkdown,
    render: (section, context) => (
      <SectionFrame section={section}>
        <SenseList senseIds={section.payload.senseIds} context={context} />
      </SectionFrame>
    ),
  },
  anatomy: {
    type: "anatomy",
    toMarkdown: sectionToMarkdown,
    render: (section) => (
      <SectionFrame section={section}>
        <ol className="entry-section__parts">
          {section.payload.parts.map((part, index) => (
            <li key={`${part.name}-${index}`}>
              <span className="entry-section__part-index" aria-hidden="true">
                {index + 1}
              </span>
              <strong>{part.name}</strong>
              <span>{part.note}</span>
            </li>
          ))}
        </ol>
      </SectionFrame>
    ),
  },
  flow: {
    type: "flow",
    toMarkdown: sectionToMarkdown,
    render: (section) => (
      <SectionFrame section={section}>
        <p className="entry-section__flow-title">{section.payload.title}</p>
        <p className="entry-section__flow-caption">{FLOW_CAPTION}</p>
        {/*
          A real ordered list, not a drawing of one. The visual rail is CSS on
          top of `<ol>`; without CSS the learner still gets numbered steps,
          selectable text, and a screen reader that can walk the path. Mermaid
          and WebGL would throw all three away, which is why they are not used.
        */}
        <ol className="entry-section__flow">
          {section.payload.steps.map((step, index) => (
            <li
              key={`${step.label}-${index}`}
              className={
                step.current ? "entry-section__flow-step is-current" : "entry-section__flow-step"
              }
              data-current={step.current ? "true" : undefined}
            >
              <span className="entry-section__part-index" aria-hidden="true">
                {index + 1}
              </span>
              <span className="entry-section__flow-head">
                <strong>{step.label}</strong>
                {step.current ? <em className="entry-section__flow-mark">本页重点</em> : null}
              </span>
              <span>{step.description}</span>
            </li>
          ))}
        </ol>
      </SectionFrame>
    ),
  },
  variants: {
    type: "variants",
    toMarkdown: sectionToMarkdown,
    render: (section) => (
      <SectionFrame section={section}>
        <ul className="entry-section__variants">
          {section.payload.items.map((item) => (
            <li key={item.name}>
              <strong>{item.name}</strong>
              <p>
                <span className="entry-section__when-label">什么时候用它</span>
                {item.when}
              </p>
            </li>
          ))}
        </ul>
      </SectionFrame>
    ),
  },
  "use-dont": {
    type: "use-dont",
    toMarkdown: sectionToMarkdown,
    render: (section) => (
      <SectionFrame section={section}>
        <div className="entry-section__split">
          <GameCallout heading="该用" tone="success">
            <ul>
              {section.payload.use.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </GameCallout>
          <GameCallout heading="不该用" tone="danger">
            <ul>
              {section.payload.dont.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </GameCallout>
        </div>
      </SectionFrame>
    ),
  },
  distinction: {
    type: "distinction",
    toMarkdown: sectionToMarkdown,
    render: (section) => (
      <SectionFrame section={section}>
        <ul className="entry-section__pairs">
          {section.payload.pairs.map((pair) => (
            <li key={`${pair.left}-${pair.right}`}>
              <p className="entry-section__neq">
                <strong>{pair.left}</strong>
                <span aria-hidden="true"> ≠ </span>
                <strong>{pair.right}</strong>
              </p>
              <p>{pair.how}</p>
            </li>
          ))}
        </ul>
      </SectionFrame>
    ),
  },
  plain: {
    type: "plain",
    toMarkdown: sectionToMarkdown,
    render: (section) => (
      <SectionFrame section={section}>
        {section.payload.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </SectionFrame>
    ),
  },
  "agent-prompt": {
    type: "agent-prompt",
    toMarkdown: sectionToMarkdown,
    render: (section) => (
      <SectionFrame section={section}>
        <div className="entry-section__prompt">
          <blockquote>{section.payload.text}</blockquote>
          <CopyTextButton
            text={section.payload.text}
            idleLabel="复制提示词"
            copiedLabel="已复制"
            variant="ghost"
          />
        </div>
      </SectionFrame>
    ),
  },
  related: {
    type: "related",
    toMarkdown: sectionToMarkdown,
    render: (section, context) => (
      <SectionFrame section={section}>
        <SenseList senseIds={section.payload.senseIds} context={context} />
      </SectionFrame>
    ),
  },
  "before-after": {
    type: "before-after",
    toMarkdown: sectionToMarkdown,
    render: (section) => (
      <SectionFrame section={section}>
        <div className="entry-section__split">
          <figure className="entry-section__rewrite">
            <figcaption>改前</figcaption>
            <p>{section.payload.before}</p>
          </figure>
          <figure className="entry-section__rewrite entry-section__rewrite--after">
            <figcaption>改后</figcaption>
            <p>{section.payload.after}</p>
          </figure>
        </div>
      </SectionFrame>
    ),
  },
  "when-not": {
    type: "when-not",
    toMarkdown: sectionToMarkdown,
    render: (section) => (
      <SectionFrame section={section}>
        <GameCallout tone="warning">
          <ul>
            {section.payload.cases.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </GameCallout>
      </SectionFrame>
    ),
  },
} satisfies { [T in EntrySectionType]: SectionRenderer<T> };

export const DEFAULT_SECTION_RENDERERS: readonly SectionRenderer[] = SECTION_TYPES.map(
  (type) => DEFAULT_BY_TYPE[type] as SectionRenderer,
);

export function registerDefaultSectionRenderers(): void {
  for (const renderer of DEFAULT_SECTION_RENDERERS) {
    registerSectionRenderer(renderer);
  }
}

registerDefaultSectionRenderers();
