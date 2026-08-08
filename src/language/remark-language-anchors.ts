import type { Root, Text } from "mdast";
import { visit } from "unist-util-visit";

import type { LanguageRange } from "../domain/lesson-marks.js";

export type { LanguageRange } from "../domain/lesson-marks.js";

/**
 * A word the reader can tap, standing exactly where the author put it.
 *
 * mdast has no node type for this, so one is invented — but inventing the node
 * is only half the job. `react-markdown` maps *HTML tag names* to components,
 * not mdast types, and an unknown mdast node is flattened to plain text on the
 * way to HTML. `data.hName` is the unified ecosystem's contract for this: it
 * tells the mdast→hast step which element the node becomes, and that element
 * name is what the component map can catch. This is still safer than emitting
 * raw HTML, which would require the one setting that turns generated lesson
 * text into a script-injection surface.
 */
const WORD_ANCHOR_TAG = "word-anchor";

interface LanguageAnchorNode {
  readonly type: "languageAnchor";
  readonly value: string;
  readonly senseId: string;
  readonly data: {
    readonly hName: typeof WORD_ANCHOR_TAG;
    readonly hProperties: { readonly senseId: string };
    /** Explicit, because how a valued unknown node's text survives the hast
     * conversion is exactly the kind of detail not worth depending on. */
    readonly hChildren: readonly { readonly type: "text"; readonly value: string }[];
  };
}

declare module "mdast" {
  interface RootContentMap {
    languageAnchor: LanguageAnchorNode;
  }
  interface PhrasingContentMap {
    languageAnchor: LanguageAnchorNode;
  }
}

/**
 * Splits text nodes so the annotated stretches become their own nodes.
 *
 * The ranges are offsets into the original Markdown, and every mdast node
 * carries the offsets it came from — so the mapping is exact rather than a
 * second search through the rendered text, which would find matches the author
 * never chose.
 *
 * Only `text` nodes are visited. Code blocks and inline code keep their content
 * in `value` on nodes of another type, so they are untouchable here by
 * construction rather than by a rule someone has to remember. The server-side
 * resolver refuses those regions too; this is the second of the two locks.
 */
export function remarkLanguageAnchors(options: { readonly ranges: readonly LanguageRange[] }) {
  const sorted = [...options.ranges].sort((left, right) => left.start - right.start);
  return (tree: Root): void => {
    if (sorted.length === 0) return;
    visit(tree, "text", (node: Text, index, parent) => {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start === undefined || end === undefined || parent === undefined || index === undefined) {
        return;
      }
      const hits = sorted.filter((range) => range.start >= start && range.end <= end);
      if (hits.length === 0) return;

      const replacement: (Text | LanguageAnchorNode)[] = [];
      let cursor = start;
      for (const hit of hits) {
        if (hit.start > cursor) {
          replacement.push({
            type: "text",
            value: node.value.slice(cursor - start, hit.start - start),
          });
        }
        replacement.push({
          type: "languageAnchor",
          value: node.value.slice(hit.start - start, hit.end - start),
          senseId: hit.senseId,
          data: {
            hName: WORD_ANCHOR_TAG,
            hProperties: { senseId: hit.senseId },
            hChildren: [
              { type: "text", value: node.value.slice(hit.start - start, hit.end - start) },
            ],
          },
        });
        cursor = hit.end;
      }
      if (cursor < end) {
        replacement.push({ type: "text", value: node.value.slice(cursor - start) });
      }
      parent.children.splice(index, 1, ...replacement);
      // Skip what was just inserted: revisiting it would try to split nodes
      // that are already exactly one range each.
      return index + replacement.length;
    });
  };
}
