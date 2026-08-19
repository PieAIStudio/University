import type { PhrasingContent, Root, RootContent, Text } from "mdast";
import { visit } from "unist-util-visit";

import type {
  EvidenceAnchorRange,
  LessonLinkRange,
} from "@pieai/university-core/domain/lesson-marks.js";
import { mergeAdjacentTextNodes } from "@pieai/university-core/domain/merge-text-runs.js";

export type {
  EvidenceAnchorRange,
  LessonLinkRange,
  LessonLinkTarget,
} from "@pieai/university-core/domain/lesson-marks.js";

/**
 * Same trick as the word anchor: react-markdown dispatches on the HTML element
 * name `data.hName` produces, never on the mdast node type.
 */
const LESSON_LINK_TAG = "lesson-link";
const EVIDENCE_ANCHOR_TAG = "evidence-anchor";

interface LessonLinkNode {
  readonly type: "lessonLink";
  readonly value: string;
  readonly data: {
    readonly hName: typeof LESSON_LINK_TAG;
    readonly hProperties: {
      readonly courseId?: string;
      readonly unitId?: string;
      readonly lessonId?: string;
      readonly targetSectionId?: string;
      readonly broken?: string;
    };
    readonly hChildren: readonly { readonly type: "text"; readonly value: string }[];
  };
}

interface EvidenceAnchorNode {
  readonly type: "evidenceAnchor";
  readonly value: string;
  readonly data: {
    readonly hName: typeof EVIDENCE_ANCHOR_TAG;
    readonly hProperties: {
      readonly sourcePath: string;
      readonly lines: string;
      readonly evidenceIndex?: number;
      readonly broken?: string;
    };
    readonly hChildren: readonly { readonly type: "text"; readonly value: string }[];
  };
}

declare module "mdast" {
  interface RootContentMap {
    lessonLink: LessonLinkNode;
    evidenceAnchor: EvidenceAnchorNode;
  }
  interface PhrasingContentMap {
    lessonLink: LessonLinkNode;
    evidenceAnchor: EvidenceAnchorNode;
  }
}

/**
 * Turns `[[evidence:path:lines]]` into a marker beside the claim it supports.
 *
 * Same text-node-only traversal as the lesson links, for the same reason: a
 * lesson teaching this syntax has to be able to show it.
 */
export function remarkEvidenceAnchors(options: {
  readonly ranges: readonly EvidenceAnchorRange[];
}) {
  const sorted = [...options.ranges].sort((left, right) => left.start - right.start);
  return (tree: Root): void => {
    if (sorted.length === 0) return;
    mergeAdjacentTextNodes(tree);
    visit(tree, "text", (node: Text, index, parent) => {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start === undefined || end === undefined || parent === undefined || index === undefined) {
        return;
      }
      const hits = sorted.filter((range) => range.start >= start && range.end <= end);
      if (hits.length === 0) return;

      const replacement: (Text | EvidenceAnchorNode)[] = [];
      let cursor = start;
      for (const hit of hits) {
        if (hit.start > cursor) {
          replacement.push({
            type: "text",
            value: node.value.slice(cursor - start, hit.start - start),
          });
        }
        const lines =
          hit.lineStart === hit.lineEnd ? `${hit.lineStart}` : `${hit.lineStart}-${hit.lineEnd}`;
        const label = `${hit.sourcePath}:${lines}`;
        replacement.push({
          type: "evidenceAnchor",
          value: label,
          data: {
            hName: EVIDENCE_ANCHOR_TAG,
            hProperties: {
              sourcePath: hit.sourcePath,
              lines,
              ...(hit.evidenceIndex === null || hit.evidenceIndex === undefined
                ? {}
                : { evidenceIndex: hit.evidenceIndex }),
              ...(hit.resolved ? {} : { broken: "true" }),
            },
            hChildren: [{ type: "text", value: label }],
          },
        });
        cursor = hit.end;
      }
      if (cursor < end) {
        replacement.push({ type: "text", value: node.value.slice(cursor - start) });
      }
      parent.children.splice(index, 1, ...replacement);
      return index + replacement.length;
    });
    hoistEvidenceAnchors(tree);
  };
}

/**
 * Lifts evidence anchors out of the paragraphs they were parsed into.
 *
 * A resolved anchor renders as the pinned source: a panel with a header and a
 * `<pre>`. Both are block content, and Markdown had wrapped the anchor in a
 * `<p>` — so the page emitted `<p><div>…<pre>…</pre></div></p>`, which is
 * invalid. Browsers do not reject that; they *repair* it, closing the paragraph
 * early and leaving the rest as a sibling. That silently regroups the text
 * around the panel, which is the kind of layout drift nobody can trace back to
 * its cause.
 *
 * Splitting rather than merely unwrapping, because both shapes occur: across
 * the shelf 1,735 anchors sit alone on their line and 14 sit mid-paragraph
 * between two sentences. Cutting the paragraph at the anchor handles both with
 * one rule, and gives the second case the block treatment its rendering was
 * always going to take anyway.
 */
function hoistEvidenceAnchors(tree: Root): void {
  visit(tree, "paragraph", (node, index, parent) => {
    if (parent === undefined || index === undefined) return;
    if (!node.children.some((child) => child.type === "evidenceAnchor")) return;

    const pieces: RootContent[] = [];
    let run: PhrasingContent[] = [];
    const flush = () => {
      // A run of nothing but whitespace is what sat between an anchor and its
      // neighbours; keeping it would emit an empty paragraph.
      if (run.some((child) => child.type !== "text" || child.value.trim() !== "")) {
        pieces.push({ type: "paragraph", children: run });
      }
      run = [];
    };
    for (const child of node.children) {
      if (child.type === "evidenceAnchor") {
        flush();
        pieces.push(child);
        continue;
      }
      run.push(child);
    }
    flush();

    parent.children.splice(index, 1, ...pieces);
    // Continue past what was just inserted: revisiting it would walk the
    // paragraphs this pass created, which by construction hold no anchors.
    return index + pieces.length;
  });
}

/**
 * Turns `[[lesson:…]]` tokens into nodes the reader can follow.
 *
 * Ranges come from the server, which is the only side that knows whether a
 * target exists. A link the server could not resolve is still rendered — as
 * visibly broken rather than as a working link that goes nowhere, and never as
 * the raw `[[lesson:x]]` text, which would look like a rendering failure and
 * teach the reader to distrust the page.
 *
 * Only `text` nodes are visited, so a lesson that *shows* this syntax inside a
 * code fence keeps it literal.
 */
export function remarkLessonLinks(options: { readonly ranges: readonly LessonLinkRange[] }) {
  const sorted = [...options.ranges].sort((left, right) => left.start - right.start);
  return (tree: Root): void => {
    if (sorted.length === 0) return;
    mergeAdjacentTextNodes(tree);
    visit(tree, "text", (node: Text, index, parent) => {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start === undefined || end === undefined || parent === undefined || index === undefined) {
        return;
      }
      const hits = sorted.filter((range) => range.start >= start && range.end <= end);
      if (hits.length === 0) return;

      const replacement: (Text | LessonLinkNode)[] = [];
      let cursor = start;
      for (const hit of hits) {
        if (hit.start > cursor) {
          replacement.push({
            type: "text",
            value: node.value.slice(cursor - start, hit.start - start),
          });
        }
        // The label if the author wrote one, otherwise the target's real title
        // — never the raw id, which means nothing to a reader.
        const text = hit.label ?? hit.target?.title ?? "这一课还不存在";
        replacement.push({
          type: "lessonLink",
          value: text,
          data: {
            hName: LESSON_LINK_TAG,
            hProperties: hit.target
              ? {
                  courseId: hit.target.courseId,
                  unitId: hit.target.unitId,
                  lessonId: hit.target.lessonId,
                  ...(hit.target.targetSectionId
                    ? { targetSectionId: hit.target.targetSectionId }
                    : {}),
                }
              : { broken: "true" },
            hChildren: [{ type: "text", value: text }],
          },
        });
        cursor = hit.end;
      }
      if (cursor < end) {
        replacement.push({ type: "text", value: node.value.slice(cursor - start) });
      }
      parent.children.splice(index, 1, ...replacement);
      return index + replacement.length;
    });
  };
}
