/**
 * Wire shapes for marks the server resolves into a lesson payload and the
 * browser renders. Shared so producer and consumer cannot drift in silence.
 *
 * Policy (how a token is found, whether a target exists, whether a line is
 * cited, whether an overlay hash matches) stays on the server. Rendering
 * (remark plugins that split text nodes) stays in the browser. Only the
 * shape crosses.
 */

export interface LessonLinkTarget {
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
  readonly title: string;
}

export interface EvidenceAnchorRange {
  readonly start: number;
  readonly end: number;
  readonly sourcePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  /** `null` when no cited evidence covers it — rendered as visibly broken. */
  readonly resolved: boolean;
}

export interface LanguageRange {
  readonly start: number;
  readonly end: number;
  readonly senseId: string;
}
