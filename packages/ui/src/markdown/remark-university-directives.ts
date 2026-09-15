import type { Root } from "mdast";
import type { Node } from "unist";
import { SKIP, visit } from "unist-util-visit";

const ALLOWED = new Set(["detail", "figure", "video", "play"]);

interface DirectiveNode extends Node {
  readonly type: "containerDirective" | "leafDirective" | "textDirective";
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
 * No raw HTML plugin is enabled: a lesson can only create the four components
 * the reader knows how to render, with attributes copied one by one.
 */
export function remarkUniversityDirectives() {
  return (tree: Root, file: { toString(): string }): void => {
    const source = String(file);
    visit(
      tree,
      (node) => {
        const candidate = node as Partial<DirectiveNode>;
        return (
          candidate.type === "containerDirective" ||
          candidate.type === "leafDirective" ||
          candidate.type === "textDirective"
        );
      },
      (node, index, parent) => {
        const directive = node as unknown as DirectiveNode;
        // This teaching vocabulary has block directives only. remark-directive
        // also parses the :00 in 10:00 and the :9 in 16:9 as inline directives.
        // Leaving those unhandled silently removes the digits and emits a div
        // inside a paragraph. Restore their exact source as inert prose instead.
        if (directive.type === "textDirective") {
          if (parent && index !== undefined) {
            const start = directive.position?.start.offset;
            const end = directive.position?.end.offset;
            parent.children[index] = {
              type: "text",
              value:
                start !== undefined && end !== undefined
                  ? source.slice(start, end)
                  : `:${directive.name ?? ""}${(directive.children ?? []).map(textOf).join("")}`,
              ...(directive.position ? { position: directive.position } : {}),
            };
          }
          return SKIP;
        }
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
        /*
          `::play{#some-activity}` points at an activity, not an asset, so the
          target is chosen by directive name rather than by attribute — both
          spell the reference `id`, and a play block arriving with an `assetId`
          that names no asset would miss quietly instead of failing.

          The `{#id}` shorthand, not `{id=…}`: measured, `{id=x}` parses in this
          pipeline as a single valueless attribute literally named `id=x`, and
          `{id="x"}` stops parsing as a directive at all. The one figure
          directive written in the courses so far is `::figure[路径图]{#local-diagram}`,
          which is the same shorthand. The `asset`/`poster`/`subtitles` reads
          below are the `key=value` form and therefore cannot fire today; they
          are left alone because removing them is a separate change from adding
          this one.
        */
        if (name === "play") {
          if (typeof attributes.id === "string") properties.activityId = attributes.id;
        } else if (typeof attributes.asset === "string") properties.assetId = attributes.asset;
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
