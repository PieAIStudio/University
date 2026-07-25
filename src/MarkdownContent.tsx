import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { MermaidDiagram } from "./MermaidDiagram.js";

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

export function MarkdownContent({ children }: { readonly children: string }) {
  return (
    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
      {children}
    </ReactMarkdown>
  );
}
