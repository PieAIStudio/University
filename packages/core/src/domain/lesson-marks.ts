/**
 * Wire shapes for marks the server resolves into a lesson payload and the
 * browser renders. Shared so producer and consumer cannot drift in silence.
 *
 * Policy (how a token is found, whether a target exists, whether a line is
 * cited, whether an overlay hash matches) stays on the server. Rendering
 * (remark plugins that split text nodes) stays in the browser. Only the
 * shape crosses.
 */

import type { LexiconEntry } from "./schemas.js";

export interface LessonLinkTarget {
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
  readonly title: string;
  /** Present only when the author declared and the server validated a stable section. */
  readonly targetSectionId?: string;
}

export interface LessonLinkRange {
  readonly start: number;
  readonly end: number;
  readonly label: string | null;
  /** `null` when the server could not resolve it. */
  readonly target: LessonLinkTarget | null;
}

export interface EvidenceAnchorRange {
  readonly start: number;
  readonly end: number;
  readonly sourcePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  /** `null` when no cited evidence covers it — rendered as visibly broken. */
  readonly resolved: boolean;
  /** Approved lesson evidence index; the browser never submits a raw path. */
  readonly evidenceIndex: number | null;
}

export interface LanguageRange {
  readonly start: number;
  readonly end: number;
  readonly senseId: string;
}

export interface TermRange {
  readonly start: number;
  readonly end: number;
  readonly senseId: string;
  readonly label: string | null;
  /** `null` when the sense is not in the lexicon. */
  readonly entry: LexiconEntry | null;
}

/**
 * Foreign-language overlay on a lesson payload: ranges, lexicon entries those
 * ranges use, and optional per-sense reasons. The browser decides whether to
 * show it; the shape is fixed here so the API and the reader cannot drift.
 */
export interface LanguageLayer {
  readonly status: "annotated" | "not-annotated" | "stale";
  readonly ranges: readonly LanguageRange[];
  readonly lexicon: readonly LexiconEntry[];
  /** senseId → why the word is on the page. Absent on older responses. */
  readonly reasons?: Readonly<Record<string, "new" | "learning" | "familiar">>;
}
