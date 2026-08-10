import { Children, isValidElement, useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";

import type { LanguageLayer } from "../domain/lesson-marks.js";
import { EvidenceInlineSource } from "../evidence/EvidenceInlineSource.js";
import { MermaidDiagram } from "./MermaidDiagram.js";
import type { LessonAssetView, LessonSectionView } from "../view/lesson-view.js";
import { WordAnchor, type VocabularyStage } from "../language/WordPopover.js";
import { remarkLanguageAnchors } from "../language/remark-language-anchors.js";
import {
  remarkEvidenceAnchors,
  remarkLessonLinks,
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
  const caption = asset.caption ?? (typeof children === "string" ? children : undefined);
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
        {caption ? <span>{caption}</span> : null}
        {asset.capture ? (
          <small>
            来源 {asset.sourceCommit?.slice(0, 12)} · {asset.capture.route} · {asset.capture.locale}{" "}
            · {asset.capture.viewport.width}×{asset.capture.viewport.height}
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
  vocabularyStages,
  onStageWord,
  inline = false,
  lessonLinks,
  onFollowLink,
  evidenceAnchors,
  evidenceBasePath,
  onOpenEvidence,
  assets = [],
  sections = [],
  detailMode = "standard",
}: {
  readonly children: string;
  readonly language?: LanguageLayer;
  readonly englishEnabled?: boolean;
  readonly vocabularyStages?: ReadonlyMap<string, string>;
  readonly onStageWord?: (senseId: string, stage: VocabularyStage) => void;
  readonly lessonLinks?: readonly LessonLinkRange[];
  readonly onFollowLink?: (target: LessonLinkTarget) => void;
  readonly evidenceAnchors?: readonly EvidenceAnchorRange[];
  readonly evidenceBasePath?: string;
  readonly onOpenEvidence?: (index: number, trigger: HTMLElement) => void;
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

  const lexicon = useMemo(
    () => new Map((active?.lexicon ?? []).map((entry) => [entry.senseId, entry])),
    [active],
  );
  const assetsById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const sectionsByTitle = useMemo(
    () => new Map(sections.map((section) => [section.title, section.id])),
    [sections],
  );

  const components = useMemo<Components>(
    () => ({
      ...markdownComponents,
      h2({ children, node: _node, ...props }) {
        const sectionId = sectionsByTitle.get(markdownText(children));
        return (
          <h2 {...props} {...(sectionId ? { "data-section-id": sectionId } : {})}>
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
        if (evidenceIndex !== null && evidenceBasePath) {
          return (
            <EvidenceInlineSource
              index={evidenceIndex}
              basePath={evidenceBasePath}
              sourcePath={sourcePath}
              lines={lines}
              onOpenEvidence={onOpenEvidence}
            />
          );
        }
        // An older API response without an approved index remains copyable, but
        // cannot open an arbitrary path. The server is the only source of truth
        // for source-sheet locations.
        return (
          <button
            type="button"
            className="evidence-anchor"
            title="复制位置，到编辑器里打开"
            onClick={() => void navigator.clipboard?.writeText(location)}
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
          title: typeof children === "string" ? children : "",
          ...(typeof properties.targetSectionId === "string"
            ? { targetSectionId: properties.targetSectionId }
            : {}),
        };
        return (
          <button
            type="button"
            className="lesson-link"
            onClick={() => onFollowLink?.(target)}
            disabled={!onFollowLink}
          >
            {children}
            <span aria-hidden="true"> ↗</span>
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
      onOpenEvidence,
      assetsById,
      sectionsByTitle,
      detailMode,
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
    return list;
  }, [active, lessonLinks, evidenceAnchors]);

  return (
    <ReactMarkdown components={components} remarkPlugins={plugins as never}>
      {children}
    </ReactMarkdown>
  );
}
