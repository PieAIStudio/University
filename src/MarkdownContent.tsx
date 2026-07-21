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

const markdownComponents: Components = {
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
