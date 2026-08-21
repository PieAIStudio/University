import { Children, isValidElement, useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";

import type { LanguageLayer, TermRange } from "@pieai/university-core/domain/lesson-marks.js";
import type { LexiconEntry } from "@pieai/university-core/domain/schemas.js";
import { EvidenceInlineSource } from "../evidence/EvidenceInlineSource.js";
import { ReferencePanel, type ReferenceKind } from "../reference/ReferencePanel.js";
import { lessonSectionRole } from "./lesson-sections.js";
import { MermaidDiagram } from "./MermaidDiagram.js";
import {
  evidenceUaLayers,
  type EvidenceView,
  type LessonAssetView,
  type LessonSectionView,
} from "../view/lesson-view.js";
import { WordAnchor, type VocabularyStage } from "../language/WordPopover.js";
import { DEFAULT_FOREIGN_SETTINGS, type ForeignSettings } from "../language/foreign-settings.js";
import { remarkLanguageAnchors } from "../language/remark-language-anchors.js";
import {
  remarkEvidenceAnchors,
  remarkLessonLinks,
  remarkTermLinks,
  type EvidenceAnchorRange,
  type LessonLinkRange,
  type LessonLinkTarget,
} from "./remark-lesson-links.js";
import { remarkUniversityDirectives } from "./remark-university-directives.js";

function directiveProperty(
  node: { readonly properties?: Record<string, unknown> } | undefined,
  key: string,
): string {
  const value = node?.properties?.[key];
  return typeof value === "string" ? value : "";
}

function LessonDetailBlock({
  children,
  title,
  kind,
  detailMode,
}: {
  readonly children?: ReactNode;
  readonly title: string;
  readonly kind: string;
  readonly detailMode: "standard" | "all";
}) {
  const [open, setOpen] = useState(detailMode === "all");
  useEffect(() => setOpen(detailMode === "all"), [detailMode]);
  return (
    <details
      className="lesson-detail"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>{title || "补充说明"}</span>
        <small>{kind}</small>
      </summary>
      <div className="lesson-detail__body">{children}</div>
    </details>
  );
}

/**
 * A commit date as a reader would say it: 「2026年7月22日」, or this year's
 * dates without the year.
 *
 * Falls back to nothing when the date could not be resolved, so the caption
 * reads「来源（3b402e06）」rather than「来源 未知日期（3b402e06）」— an absent
 * date is not worth a word.
 */
function formatCaptureDate(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return sameYear
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function LessonMediaBlock({
  asset,
  children,
  video = false,
}: {
  readonly asset: LessonAssetView | undefined;
  readonly children?: ReactNode;
  readonly video?: boolean;
}) {
  if (!asset) {
    return (
      <div className="lesson-media lesson-media--missing" role="alert">
        这段媒体没有通过当前课文版本的本地资产清单。
      </div>
    );
  }
  const label =
    asset.kind === "real-screenshot"
      ? "真实截图"
      : asset.kind === "ai-illustration"
        ? "示意图 · AI 插图"
        : asset.kind === "diagram"
          ? "结构图"
          : "本地媒体";
  /*
    The directive body wins over the manifest caption, and `children` is kept as
    nodes rather than collapsed to a string.

    Both halves were bugs. `typeof children === "string"` is false the moment the
    caption contains anything inline — a `**bold**`, a `code` span, or an English
    word the language layer has annotated — because react-markdown hands over an
    array of elements, so the authored caption was dropped exactly when it had
    the most in it. And preferring `asset.caption` meant the sentence on screen
    came from the manifest while the sentence the author wrote in Markdown was
    never rendered at all: two captions, one of them invisible.

    That invisibility is what broke vocabulary. The English layer's offsets point
    into the Markdown, so a word inside a figure caption got a real anchor in the
    tree — which was then discarded here. The reader saw no underline, and the
    word list's scroll-to found no `[data-sense-id]` to scroll to.
  */
  const authored = Children.count(children) > 0 ? children : undefined;
  const caption = authored ?? asset.caption;
  return (
    <figure className={`lesson-media lesson-media--${video ? "video" : "figure"}`}>
      {video ? (
        <video controls preload="metadata" poster={asset.posterUrl} aria-label={asset.alt}>
          <source src={asset.url} type={asset.mime} />
          你的浏览器无法播放这段本地录屏。
        </video>
      ) : (
        <img src={asset.url} alt={asset.alt} loading="lazy" />
      )}
      <figcaption>
        <strong>{label}</strong>
        {/*
          A `div`, not a `span`: the authored caption arrives as block content
          (react-markdown wraps a directive body in `<p>`), and `<span><p>` is
          invalid nesting that the parser repairs by tearing the span apart.
          `figcaption` takes flow content, so a div is simply correct here.
        */}
        {caption ? <div className="lesson-media__caption">{caption}</div> : null}
        {asset.capture ? (
          <small>
            {/*
              The date leads and the hash follows, because only one of them can
              be read. `3b402e06` and `54d344a6` look equally current; that they
              are three weeks apart is the fact a reader needs, and it is
              invisible until it is spelled out. The hash stays because it is
              what anyone checking has to type.
            */}
            来源 {formatCaptureDate(asset.sourceCommitDate)}
            {asset.sourceCommit ? `（${asset.sourceCommit.slice(0, 8)}）` : null} ·{" "}
            {asset.capture.route} · {asset.capture.locale} · {asset.capture.viewport.width}×
            {asset.capture.viewport.height}
          </small>
        ) : null}
        {asset.aiNote ? <small>{asset.aiNote}</small> : null}
        {asset.transcript ? (
          <details>
            <summary>文字稿</summary>
            <p>{asset.transcript}</p>
          </details>
        ) : null}
      </figcaption>
    </figure>
  );
}

function codeText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
    .join("")
    .replace(/\n$/, "");
}

type OpenReference =
  | {
      readonly kind: "lesson";
      readonly title: string;
      readonly trigger: HTMLElement;
      readonly target: LessonLinkTarget | null;
    }
  | {
      readonly kind: "term";
      readonly title: string;
      readonly trigger: HTMLElement;
      readonly entry: LexiconEntry | null;
      readonly senseId: string;
    }
  | {
      readonly kind: "evidence";
      readonly title: string;
      readonly trigger: HTMLElement;
      readonly sourcePath: string;
      readonly lines: string;
      readonly evidenceIndex: number | null;
      readonly resolved: boolean;
    };

function markdownText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (isValidElement<{ children?: ReactNode }>(child))
        return markdownText(child.props.children);
      return "";
    })
    .join("")
    .trim();
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
  foreignSettings = DEFAULT_FOREIGN_SETTINGS,
  vocabularyStages,
  onStageWord,
  inline = false,
  lessonLinks,
  onFollowLink,
  evidenceAnchors,
  evidence,
  evidenceBasePath,
  onOpenEvidence,
  termAnchors,
  assets = [],
  sections = [],
  detailMode = "standard",
}: {
  readonly children: string;
  readonly language?: LanguageLayer;
  readonly englishEnabled?: boolean;
  /** How the layer presents words; defaults to the least intrusive preset. */
  readonly foreignSettings?: ForeignSettings;
  readonly vocabularyStages?: ReadonlyMap<string, string>;
  readonly onStageWord?: (senseId: string, stage: VocabularyStage) => void;
  readonly lessonLinks?: readonly LessonLinkRange[];
  readonly onFollowLink?: (target: LessonLinkTarget) => void;
  readonly evidenceAnchors?: readonly EvidenceAnchorRange[];
  readonly evidence?: readonly EvidenceView[];
  readonly evidenceBasePath?: string;
  readonly onOpenEvidence?: (index: number, trigger: HTMLElement) => void;
  readonly termAnchors?: readonly TermRange[];
  readonly assets?: readonly LessonAssetView[];
  readonly sections?: readonly LessonSectionView[];
  readonly detailMode?: "standard" | "all";
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
  const [openReference, setOpenReference] = useState<OpenReference | null>(null);

  const termEntries = useMemo(() => {
    const map = new Map<string, LexiconEntry>();
    for (const range of termAnchors ?? []) {
      if (range.entry) map.set(range.senseId, range.entry);
    }
    return map;
  }, [termAnchors]);

  function toggleReference(next: OpenReference) {
    setOpenReference((current) => {
      if (
        current &&
        current.kind === next.kind &&
        current.trigger === next.trigger &&
        current.title === next.title
      ) {
        return null;
      }
      return next;
    });
  }

  const lexicon = useMemo(
    () => new Map((active?.lexicon ?? []).map((entry) => [entry.senseId, entry])),
    [active],
  );
  const assetsById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  /*
    The lesson header already says which layer of the project this lesson lives
    in. Repeating it above every snippet only says something new when the
    snippets come from more than one layer; on a single-layer lesson it printed
    the identical line five times and taught the reader to skip that row.
  */
  const placeTellsThemApart = useMemo(
    () => evidenceUaLayers(evidence ?? []).length > 1,
    [evidence],
  );
  const sectionsByTitle = useMemo(
    () => new Map(sections.map((section) => [section.title, section.id])),
    [sections],
  );

  const components = useMemo<Components>(
    () => ({
      ...markdownComponents,
      h2({ children, node: _node, ...props }) {
        const title = markdownText(children);
        const sectionId = sectionsByTitle.get(title);
        const role = lessonSectionRole(title);
        return (
          <h2
            {...props}
            {...(sectionId ? { "data-section-id": sectionId } : {})}
            {...(role ? { "data-role": role } : {})}
          >
            {children}
          </h2>
        );
      },
      h3({ children, node: _node, ...props }) {
        const sectionId = sectionsByTitle.get(markdownText(children));
        return (
          <h3 {...props} {...(sectionId ? { "data-section-id": sectionId } : {})}>
            {children}
          </h3>
        );
      },
      ...(inline
        ? { p: ({ children }: { readonly children?: ReactNode }) => <>{children}</> }
        : {}),
      "evidence-anchor"({
        node,
        children,
      }: {
        readonly node?: {
          readonly properties?: {
            readonly sourcePath?: unknown;
            readonly lines?: unknown;
            readonly evidenceIndex?: unknown;
            readonly broken?: unknown;
          };
        };
        readonly children?: ReactNode;
      }) {
        const properties = node?.properties;
        const broken = properties?.broken !== undefined;
        const sourcePath = String(properties?.sourcePath ?? "");
        const lines = String(properties?.lines ?? "");
        const location = `${sourcePath}:${lines}`;
        if (broken) {
          return (
            <span
              className="evidence-anchor evidence-anchor--broken"
              title="这个位置不在本课引用的证据范围内"
            >
              {children}
            </span>
          );
        }
        const evidenceIndex =
          typeof properties?.evidenceIndex === "number" ? properties.evidenceIndex : null;
        return (
          <button
            type="button"
            className="evidence-anchor"
            title={location}
            onClick={(event) =>
              toggleReference({
                kind: "evidence",
                title: location,
                trigger: event.currentTarget,
                sourcePath,
                lines,
                evidenceIndex,
                resolved: true,
              })
            }
          >
            {children}
          </button>
        );
      },
      "lesson-link"({
        node,
        children,
      }: {
        readonly node?: {
          readonly properties?: {
            readonly courseId?: unknown;
            readonly unitId?: unknown;
            readonly lessonId?: unknown;
            readonly targetSectionId?: unknown;
            readonly broken?: unknown;
          };
        };
        readonly children?: ReactNode;
      }) {
        const properties = node?.properties;
        const label = typeof children === "string" ? children : markdownText(children);
        if (properties?.broken !== undefined || typeof properties?.lessonId !== "string") {
          // Visibly wrong, and not clickable. Silently swallowing it would let
          // a bad link ship, since the only person who could notice is reading
          // a page that looks fine.
          return (
            <span className="lesson-link lesson-link--broken" title="链接指向的课程不存在">
              {children}
            </span>
          );
        }
        const target: LessonLinkTarget = {
          courseId: String(properties.courseId),
          unitId: String(properties.unitId),
          lessonId: properties.lessonId,
          title: label,
          ...(typeof properties.targetSectionId === "string"
            ? { targetSectionId: properties.targetSectionId }
            : {}),
        };
        return (
          <button
            type="button"
            className="lesson-link"
            onClick={(event) =>
              toggleReference({
                kind: "lesson",
                title: target.title || label,
                trigger: event.currentTarget,
                target,
              })
            }
          >
            {children}
          </button>
        );
      },
      "term-link"({
        node,
        children,
      }: {
        readonly node?: {
          readonly properties?: {
            readonly senseId?: unknown;
            readonly broken?: unknown;
          };
        };
        readonly children?: ReactNode;
      }) {
        const senseId =
          typeof node?.properties?.senseId === "string" ? node.properties.senseId : "";
        const entry = termEntries.get(senseId) ?? null;
        if (node?.properties?.broken !== undefined || !entry) {
          return (
            <span className="term-link term-link--broken" title="词库里没有这个词义">
              {children}
            </span>
          );
        }
        return (
          <button
            type="button"
            className="term-link"
            onClick={(event) =>
              toggleReference({
                kind: "term",
                title: entry.headword,
                trigger: event.currentTarget,
                entry,
                senseId,
              })
            }
          >
            {children}
          </button>
        );
      },
      "lesson-detail"({
        node,
        children,
      }: {
        readonly node?: { readonly properties?: Record<string, unknown> };
        readonly children?: ReactNode;
      }) {
        return (
          <LessonDetailBlock
            title={directiveProperty(node, "title")}
            kind={directiveProperty(node, "kind")}
            detailMode={detailMode}
          >
            {children}
          </LessonDetailBlock>
        );
      },
      "lesson-figure"({
        node,
        children,
      }: {
        readonly node?: { readonly properties?: Record<string, unknown> };
        readonly children?: ReactNode;
      }) {
        return (
          <LessonMediaBlock asset={assetsById.get(directiveProperty(node, "assetId"))}>
            {children}
          </LessonMediaBlock>
        );
      },
      "lesson-video"({
        node,
        children,
      }: {
        readonly node?: { readonly properties?: Record<string, unknown> };
        readonly children?: ReactNode;
      }) {
        return (
          <LessonMediaBlock video asset={assetsById.get(directiveProperty(node, "assetId"))}>
            {children}
          </LessonMediaBlock>
        );
      },
      "lesson-directive-unsupported"({
        node,
      }: {
        readonly node?: { readonly properties?: Record<string, unknown> };
      }) {
        return (
          <p className="lesson-directive-unsupported" role="note">
            未启用的课程扩展：<code>{directiveProperty(node, "name")}</code>
          </p>
        );
      },
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
            settings={foreignSettings}
            stage={vocabularyStages?.get(senseId)}
            reason={active?.reasons?.[senseId]}
            {...(onStageWord
              ? { onStage: (stage: VocabularyStage) => onStageWord(senseId, stage) }
              : {})}
          />
        );
      },
    }),
    [
      lexicon,
      vocabularyStages,
      onStageWord,
      inline,
      active,
      onFollowLink,
      evidenceBasePath,
      evidence,
      onOpenEvidence,
      assetsById,
      sectionsByTitle,
      detailMode,
      foreignSettings,
      termEntries,
    ],
  );

  const plugins = useMemo(() => {
    const list: unknown[] = [remarkGfm, remarkDirective, remarkUniversityDirectives];
    if (active) list.push([remarkLanguageAnchors, { ranges: active.ranges }]);
    if (lessonLinks && lessonLinks.length > 0) {
      list.push([remarkLessonLinks, { ranges: lessonLinks }]);
    }
    if (evidenceAnchors && evidenceAnchors.length > 0) {
      list.push([remarkEvidenceAnchors, { ranges: evidenceAnchors }]);
    }
    if (termAnchors && termAnchors.length > 0) {
      list.push([remarkTermLinks, { ranges: termAnchors }]);
    }
    return list;
  }, [active, lessonLinks, evidenceAnchors, termAnchors]);

  let fullPage: (() => void) | undefined;
  if (openReference?.kind === "lesson" && openReference.target && onFollowLink) {
    const target = openReference.target;
    fullPage = () => {
      setOpenReference(null);
      onFollowLink(target);
    };
  } else if (
    openReference?.kind === "evidence" &&
    openReference.evidenceIndex !== null &&
    onOpenEvidence
  ) {
    const index = openReference.evidenceIndex;
    const trigger = openReference.trigger;
    fullPage = () => {
      setOpenReference(null);
      onOpenEvidence(index, trigger);
    };
  }

  return (
    <>
      <ReactMarkdown components={components} remarkPlugins={plugins as never}>
        {children}
      </ReactMarkdown>
      <ReferencePanel
        open={openReference !== null}
        title={openReference?.title ?? "引用"}
        kind={(openReference?.kind ?? "lesson") as ReferenceKind}
        trigger={openReference?.trigger ?? null}
        onClose={() => setOpenReference(null)}
        {...(fullPage ? { onOpenFull: fullPage } : {})}
      >
        {openReference ? (
          <ReferenceBody
            reference={openReference}
            evidence={evidence}
            evidenceBasePath={evidenceBasePath}
            placeTellsThemApart={placeTellsThemApart}
          />
        ) : null}
      </ReferencePanel>
    </>
  );
}

function ReferenceBody({
  reference,
  evidence,
  evidenceBasePath,
  placeTellsThemApart,
}: {
  readonly reference: OpenReference;
  readonly evidence: readonly EvidenceView[] | undefined;
  readonly evidenceBasePath: string | undefined;
  readonly placeTellsThemApart: boolean;
}) {
  if (reference.kind === "lesson") {
    if (!reference.target) {
      return <p className="reference-panel__note">这一课还不存在。</p>;
    }
    return (
      <>
        <p className="reference-panel__meta">
          {reference.target.courseId}/{reference.target.unitId}/{reference.target.lessonId}
          {reference.target.targetSectionId ? `#${reference.target.targetSectionId}` : ""}
        </p>
        <p className="reference-panel__note">在侧栏打开，课文的阅读位置留在这里。</p>
      </>
    );
  }
  if (reference.kind === "term") {
    const entry = reference.entry;
    if (!entry) {
      return <p className="reference-panel__note">词库里没有这个词义。</p>;
    }
    return (
      <>
        <p className="reference-panel__meta">
          <span lang="en">{entry.headword}</span>
          <span className="reference-panel__phonetic">{entry.phonetic}</span>
          <span className="reference-panel__pos">{entry.partOfSpeech}</span>
        </p>
        <p className="reference-panel__gloss">{entry.gloss}</p>
        <p className="reference-panel__usage">{entry.usage}</p>
      </>
    );
  }
  const cited =
    reference.evidenceIndex !== null ? (evidence?.[reference.evidenceIndex] ?? null) : null;
  if (reference.evidenceIndex !== null && evidenceBasePath) {
    return (
      <EvidenceInlineSource
        index={reference.evidenceIndex}
        basePath={evidenceBasePath}
        sourcePath={reference.sourcePath}
        lines={reference.lines}
        ua={placeTellsThemApart ? (cited?.ua ?? null) : null}
      />
    );
  }
  return (
    <>
      <p className="reference-panel__meta">
        {reference.sourcePath}:{reference.lines}
        {cited?.sourceCommit ? ` @${cited.sourceCommit.slice(0, 7)}` : ""}
      </p>
      {cited?.note ? <p className="reference-panel__note">{cited.note}</p> : null}
    </>
  );
}
