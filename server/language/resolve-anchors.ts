import type { LanguageAnchor } from "../../src/domain/schemas.js";

/**
 * Turns anchors into character ranges in one lesson's Markdown.
 *
 * Everything about English mode depends on this being exact. An anchor that
 * lands one character off does not fail loudly — it quietly rewrites a word the
 * author never chose, inside teaching material the learner is trusting.
 *
 * Two rules keep it exact:
 *
 * 1. **Never inside code.** A fenced block, an inline span, a link target, or
 *    an HTML tag can all contain the same characters as prose, and replacing
 *    text there changes what the code *does* rather than how it reads. These
 *    regions are found first and treated as if they were not there.
 * 2. **Never overlapping.** Two anchors that claim the same characters cannot
 *    both be honoured, and honouring one silently would make the rendering
 *    depend on array order. The later one is dropped and reported.
 */

export interface ResolvedAnchor {
  readonly anchor: LanguageAnchor;
  readonly start: number;
  readonly end: number;
}

export interface AnchorResolution {
  readonly resolved: readonly ResolvedAnchor[];
  readonly unresolved: readonly UnresolvedAnchor[];
}

export interface UnresolvedAnchor {
  readonly anchor: LanguageAnchor;
  readonly reason: "not-found" | "occurrence-missing" | "inside-code" | "overlaps";
}

export interface Region {
  readonly start: number;
  readonly end: number;
}

/**
 * Regions whose characters belong to machines rather than to the reader.
 *
 * Fenced blocks are matched first and greedily so that prose-looking text
 * inside them cannot be picked up by the later, narrower patterns.
 */
const PROTECTED_PATTERNS: readonly RegExp[] = [
  /^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[ \t]*$/gm,
  /`[^`\n]+`/g,
  /\]\([^)\n]*\)/g,
  /<[^>\n]+>/g,
  /^[ \t]*\|.*\|[ \t]*$/gm,
];

/**
 * Exported so the detector can skip these stretches too.
 *
 * Sharing the function rather than the rule: a detector with its own copy of
 * "what counts as code" would drift from this one, and the symptom would be
 * anchors that are silently dropped at read time with nothing to point at.
 */
export function findProtectedRegions(content: string): readonly Region[] {
  const regions: Region[] = [];
  for (const pattern of PROTECTED_PATTERNS) {
    for (const match of content.matchAll(pattern)) {
      if (match.index === undefined) continue;
      regions.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return regions.sort((left, right) => left.start - right.start);
}

function overlaps(region: Region, candidate: Region): boolean {
  return candidate.start < region.end && region.start < candidate.end;
}

export function resolveAnchors(
  content: string,
  anchors: readonly LanguageAnchor[],
): AnchorResolution {
  const protectedRegions = findProtectedRegions(content);
  const resolved: ResolvedAnchor[] = [];
  const unresolved: UnresolvedAnchor[] = [];
  const claimed: Region[] = [];

  for (const anchor of anchors) {
    const positions: number[] = [];
    let from = 0;
    for (;;) {
      const index = content.indexOf(anchor.quote, from);
      if (index < 0) break;
      positions.push(index);
      from = index + 1;
    }
    if (positions.length === 0) {
      unresolved.push({ anchor, reason: "not-found" });
      continue;
    }
    const start = positions[anchor.occurrence - 1];
    if (start === undefined) {
      unresolved.push({ anchor, reason: "occurrence-missing" });
      continue;
    }
    const candidate = { start, end: start + anchor.quote.length };
    if (protectedRegions.some((region) => overlaps(region, candidate))) {
      unresolved.push({ anchor, reason: "inside-code" });
      continue;
    }
    if (claimed.some((region) => overlaps(region, candidate))) {
      unresolved.push({ anchor, reason: "overlaps" });
      continue;
    }
    claimed.push(candidate);
    resolved.push({ anchor, start: candidate.start, end: candidate.end });
  }

  return {
    resolved: resolved.sort((left, right) => left.start - right.start),
    unresolved,
  };
}

export interface RenderedSegment {
  readonly text: string;
  readonly senseId: string | null;
}

/**
 * Cuts the lesson into plain stretches and annotated ones.
 *
 * The renderer needs positions, not a rewritten document: producing new
 * Markdown here would mean the browser renders text nobody stored, and the one
 * guarantee worth keeping is that what is displayed is the lesson plus labels,
 * never the lesson altered.
 */
export function segmentContent(
  content: string,
  resolved: readonly ResolvedAnchor[],
): readonly RenderedSegment[] {
  const segments: RenderedSegment[] = [];
  let cursor = 0;
  for (const item of resolved) {
    if (item.start > cursor) {
      segments.push({ text: content.slice(cursor, item.start), senseId: null });
    }
    segments.push({
      text: content.slice(item.start, item.end),
      senseId: item.anchor.senseId,
    });
    cursor = item.end;
  }
  if (cursor < content.length) {
    segments.push({ text: content.slice(cursor), senseId: null });
  }
  return segments;
}
