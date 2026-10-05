/**
 * Regions whose characters belong to machines or markup rather than to prose.
 *
 * Fenced blocks are matched first and greedily so that prose-looking text
 * inside them cannot be picked up by the later, narrower patterns. Wiki tokens
 * (`[[evidence:…]]`, `[[lesson:…]]`, and any future `[[kind:…]]`) are markup
 * the detector and resolver must leave intact — the same reason code is
 * protected — so they live here rather than only in the detector.
 */
const PROTECTED_PATTERNS = [
    /^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[ \t]*$/gm,
    /`[^`\n]+`/g,
    /\]\([^)\n]*\)/g,
    /<[^>\n]+>/g,
    /^[ \t]*\|.*\|[ \t]*$/gm,
    // Same shape as `parseLessonLinks`: optional `|label`, no newlines or `]`.
    /\[\[[^\]\n|]*(?:\|[^\]\n]*)?\]\]/g,
];
/**
 * Exported so the detector can skip these stretches too.
 *
 * Sharing the function rather than the rule: a detector with its own copy of
 * "what counts as code" would drift from this one, and the symptom would be
 * anchors that are silently dropped at read time with nothing to point at.
 */
export function findProtectedRegions(content) {
    const regions = [];
    for (const pattern of PROTECTED_PATTERNS) {
        for (const match of content.matchAll(pattern)) {
            if (match.index === undefined)
                continue;
            regions.push({ start: match.index, end: match.index + match[0].length });
        }
    }
    return regions.sort((left, right) => left.start - right.start);
}
function overlaps(region, candidate) {
    return candidate.start < region.end && region.start < candidate.end;
}
export function resolveAnchors(content, anchors) {
    const protectedRegions = findProtectedRegions(content);
    const resolved = [];
    const unresolved = [];
    const claimed = [];
    for (const anchor of anchors) {
        const positions = [];
        let from = 0;
        for (;;) {
            const index = content.indexOf(anchor.quote, from);
            if (index < 0)
                break;
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
/**
 * Cuts the lesson into plain stretches and annotated ones.
 *
 * The renderer needs positions, not a rewritten document: producing new
 * Markdown here would mean the browser renders text nobody stored, and the one
 * guarantee worth keeping is that what is displayed is the lesson plus labels,
 * never the lesson altered.
 */
export function segmentContent(content, resolved) {
    const segments = [];
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
//# sourceMappingURL=resolve-anchors.js.map