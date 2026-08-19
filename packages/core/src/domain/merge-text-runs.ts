interface PositionLike {
  readonly start: unknown;
  readonly end: unknown;
}

interface NodeLike {
  type?: string;
  name?: string;
  attributes?: Record<string, string | null | undefined>;
  value?: string;
  position?: PositionLike;
  children?: NodeLike[];
}

function literalText(node: NodeLike): string {
  if (node.type === "text") return node.value ?? "";
  if (node.type !== "textDirective") return "";
  const label = (node.children ?? []).map(literalText).join("");
  const attributes = Object.entries(node.attributes ?? {})
    .map(([key, value]) => (value === "" || value == null ? key : `${key}="${value}"`))
    .join(" ");
  return `:${node.name ?? "unknown"}${label ? `[${label}]` : ""}${attributes ? `{${attributes}}` : ""}`;
}

/**
 * GFM can split one prose token into adjacent text nodes (a slash or colon in
 * a repository path is enough). Range marks are measured against the original
 * Markdown, so join only adjacent text siblings before resolving them. Inline
 * nodes, code, and links remain boundaries and cannot be swallowed.
 */
export function mergeAdjacentTextNodes(root: unknown): void {
  const visit = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== "object") return;
    const node = candidate as NodeLike;
    const children = node.children;
    if (!children) return;

    const normalizedChildren = children.map((child) =>
      child.type === "textDirective"
        ? { type: "text", value: literalText(child), position: child.position }
        : child,
    );
    const merged: NodeLike[] = [];
    for (const child of normalizedChildren) {
      const previous = merged[merged.length - 1];
      if (child.type === "text" && previous?.type === "text") {
        previous.value = `${previous.value ?? ""}${child.value ?? ""}`;
        if (previous.position && child.position) {
          previous.position = { start: previous.position.start, end: child.position.end };
        }
      } else {
        merged.push(child);
      }
      if (child.type !== "text") visit(child);
    }
    node.children = merged;
  };

  visit(root);
}
