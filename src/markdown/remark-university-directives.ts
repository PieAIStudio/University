import type { Root } from "mdast";
import { visit } from "unist-util-visit";

const ALLOWED = new Set(["detail", "figure", "video"]);

interface DirectiveNode {
  readonly type: "containerDirective" | "leafDirective";
  readonly name?: string;
  readonly attributes?: Record<string, string | null>;
  children?: DirectiveChild[];
  data?: {
    hName?: string;
    hProperties?: Record<string, string>;
  };
}

interface DirectiveChild {
  readonly type?: string;
  readonly value?: string;
  readonly data?: { readonly directiveLabel?: boolean };
  readonly children?: readonly DirectiveChild[];
}

function textOf(node: DirectiveChild): string {
  return node.value ?? (node.children ?? []).map(textOf).join("");
}

/**
 * Maps remark-directive's small authoring vocabulary to inert custom elements.
 * No raw HTML plugin is enabled: a lesson can only create the three components
 * the reader knows how to render, with attributes copied one by one.
 */
export function remarkUniversityDirectives() {
  return (tree: Root): void => {
    visit(
      tree,
      (node) => {
        const candidate = node as Partial<DirectiveNode>;
        return candidate.type === "containerDirective" || candidate.type === "leafDirective";
      },
      (node) => {
        const directive = node as unknown as DirectiveNode;
        const name = directive.name ?? "unknown";
        const attributes = directive.attributes ?? {};
        const properties: Record<string, string> = {};
        const label = directive.children?.find((child) => child.data?.directiveLabel);
        if (label) {
          properties.title = textOf(label);
          directive.children = directive.children?.filter((child) => child !== label);
        } else if (typeof attributes.title === "string") {
          properties.title = attributes.title;
        }
        if (typeof attributes.kind === "string") properties.kind = attributes.kind;
        else if (typeof attributes.class === "string") properties.kind = attributes.class;
        if (typeof attributes.asset === "string") properties.assetId = attributes.asset;
        else if (typeof attributes.id === "string") properties.assetId = attributes.id;
        if (typeof attributes.poster === "string") properties.posterId = attributes.poster;
        if (typeof attributes.subtitles === "string") properties.subtitlesId = attributes.subtitles;

        directive.data = {
          hName: ALLOWED.has(name) ? `lesson-${name}` : "lesson-directive-unsupported",
          hProperties: {
            ...properties,
            ...(ALLOWED.has(name) ? {} : { name }),
          },
        };
      },
    );
  };
}
