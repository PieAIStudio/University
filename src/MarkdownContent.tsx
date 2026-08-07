import { Children, isValidElement, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { MermaidDiagram } from "./MermaidDiagram.js";
import { WordAnchor, type LexiconEntry, type VocabularyStage } from "./language/WordPopover.js";
import { remarkLanguageAnchors, type LanguageRange } from "./language/remark-language-anchors.js";

function codeText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
    .join("")
    .replace(/\n$/, "");
}

/**
 * UniversityLocal is a local-only product: nothing it renders should reach the
 * network on its own. Lesson and note Markdown is generated from a studied
 * repository, so its links and images are effectively third-party content.
 * An `![](https://…)` image fetches the moment a lesson opens — no click, no
 * consent — which quietly turns "资料仅在本机" into a page beacon.
 *
 * Relative and in-page URLs stay as they are; anything that would leave the
 * machine is handled by the `a` and `img` components below.
 */
export function isLocalUrl(url: string): boolean {
  if (url === "") return true;
  // Protocol-relative (`//host/x`) is remote despite starting like a path, so
  // it has to be rejected before the leading-slash check.
  if (url.startsWith("//")) return false;
  if (url.startsWith("#") || url.startsWith("/")) return true;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return true;
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "localhost" ||
        parsed.hostname === "::1")
    );
  } catch {
    return false;
  }
}

const markdownComponents: Components = {
  a({ children, node: _node, href, ...props }) {
    if (href === undefined || isLocalUrl(href)) {
      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    }
    // Opening is still the learner's choice, but it is an explicit one, and
    // the destination never learns where the click came from.
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener external"
        className="markdown-external-link"
        {...props}
      >
        {children}
        <span className="markdown-external-link__mark" aria-label="外部链接">
          ↗
        </span>
      </a>
    );
  },
  img({ node: _node, src, alt, ...props }) {
    const source = typeof src === "string" ? src : "";
    if (isLocalUrl(source)) return <img src={source} alt={alt ?? ""} {...props} />;
    // Not rendered: an external image would load itself. Show what it was
    // instead, so the lesson still reads and nothing is hidden.
    return (
      <span className="markdown-blocked-image">
        <strong>外部图片已拦截</strong>
        {alt ? <span>{alt}</span> : null}
        <code>{source}</code>
      </span>
    );
  },
  pre({ children, node: _node, ...props }) {
    const childrenArray = Children.toArray(children);
    const code = childrenArray.length === 1 ? childrenArray[0] : undefined;

    if (
      isValidElement<{ className?: string; children?: ReactNode }>(code) &&
      code.type === "code" &&
      code.props.className?.split(/\s+/).includes("language-mermaid")
    ) {
      return <MermaidDiagram source={codeText(code.props.children)} />;
    }

    return <pre {...props}>{children}</pre>;
  },
};

export interface LanguageLayer {
  readonly status: "annotated" | "not-annotated" | "stale";
  readonly ranges: readonly LanguageRange[];
  readonly lexicon: readonly LexiconEntry[];
  /** senseId → why the word is on the page. Absent on older responses. */
  readonly reasons?: Readonly<Record<string, "new" | "learning" | "familiar">>;
}

/**
 * Renders lesson Markdown, optionally with the English layer switched on.
 *
 * The layer is additive by construction: with it off, or absent, the output is
 * exactly what it was before. That is not a convenience — it is why turning
 * English mode on can never cost a content revision, and so can never send a
 * finished lesson back to unfinished.
 */
export function MarkdownContent({
  children,
  language,
  englishEnabled = false,
  vocabularyStages,
  onStageWord,
  inline = false,
}: {
  readonly children: string;
  readonly language?: LanguageLayer;
  readonly englishEnabled?: boolean;
  readonly vocabularyStages?: ReadonlyMap<string, string>;
  readonly onStageWord?: (senseId: string, stage: VocabularyStage) => void;
  /**
   * Drop the paragraph wrapper, for a question or prompt that is already inside
   * its own styled element. The Markdown still parses — which is the point:
   * these strings are authored with backticks around identifiers, and rendering
   * them as plain text put the literal ` characters on screen, where a CJK font
   * draws them as a stray accent over the next letter.
   */
  readonly inline?: boolean;
}) {
  const active = englishEnabled && language?.status === "annotated" ? language : null;

  const lexicon = useMemo(
    () => new Map((active?.lexicon ?? []).map((entry) => [entry.senseId, entry])),
    [active],
  );

  const components = useMemo<Components>(
    () => ({
      ...markdownComponents,
      ...(inline
        ? { p: ({ children }: { readonly children?: ReactNode }) => <>{children}</> }
        : {}),
      // The key is the hast element name the plugin's `data.hName` produces —
      // react-markdown dispatches on that, never on the mdast node type.
      "word-anchor"({
        node,
        children,
      }: {
        readonly node?: { readonly properties?: { readonly senseId?: unknown } };
        readonly children?: ReactNode;
      }) {
        const value = children;
        const senseId =
          typeof node?.properties?.senseId === "string" ? node.properties.senseId : "";
        const entry = lexicon.get(senseId);
        if (!entry) return <>{value}</>;
        return (
          <WordAnchor
            entry={entry}
            original={value}
            stage={vocabularyStages?.get(senseId)}
            reason={active?.reasons?.[senseId]}
            {...(onStageWord
              ? { onStage: (stage: VocabularyStage) => onStageWord(senseId, stage) }
              : {})}
          />
        );
      },
    }),
    [lexicon, vocabularyStages, onStageWord, inline, active],
  );

  const plugins = useMemo(
    () =>
      active
        ? [remarkGfm, [remarkLanguageAnchors, { ranges: active.ranges }] as const]
        : [remarkGfm],
    [active],
  );

  return (
    <ReactMarkdown components={components} remarkPlugins={plugins as never}>
      {children}
    </ReactMarkdown>
  );
}
