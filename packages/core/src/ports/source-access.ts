/**
 * How the learner can reach the repository behind the lesson.
 *
 * A published course can describe a private project without shipping that
 * project's checkout or its Understand Anything graph. The authoring shell
 * can reach both because its server owns them. This port keeps that answer at
 * the boundary: the reader gets an executable action or an explanation, never
 * an optional callback and never an absent control.
 *
 * This package deliberately knows no React, filesystem or network. The two
 * browser builds choose their implementations in `apps/university/src/ports`.
 */

export interface SourceCheckout {
  readonly snapshotId: string;
  readonly path: string;
  readonly created: boolean;
  readonly run: readonly string[];
}

export interface SourceCoverageLayer {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly fileCount: number;
  readonly citedFileCount: number;
  readonly citedFiles: readonly string[];
}

export interface SourceLayerCoverage {
  readonly analysisId: string;
  readonly sourceCommit: string;
  readonly nodeCount: number;
  readonly outputLanguage: string;
  readonly layers: readonly SourceCoverageLayer[];
  readonly uncharted: readonly string[];
}

/** What a learner should understand when this shell cannot execute an action. */
export interface SourceAccessExplanation {
  readonly kind: "explanation";
  readonly title: string;
  readonly whatItDoes: string;
  readonly whyUnavailable: string;
  readonly futureSupport: string;
}

/** An action is a value too, so the UI can render it without knowing its shell. */
export interface SourceAccessAction<Result> {
  readonly kind: "action";
  readonly run: () => Promise<Result>;
}

export type SourceAccess<Result> = SourceAccessAction<Result> | SourceAccessExplanation;

export interface SourceVersionInput {
  readonly studyId: string;
  readonly sourceCommit: string;
}

export interface SourceAccessPort {
  /** The action must be returned synchronously so a popup can open on the click. */
  lessonVersion(input: SourceVersionInput): SourceAccess<SourceCheckout>;
  closeLessonVersion(input: SourceVersionInput): SourceAccess<void>;
  /** The action must open its blank tab before its first awaited request. */
  uaDashboard(input: {
    readonly studyId: string;
    readonly nodeId?: string | null;
  }): SourceAccess<void>;
  /** Reading coverage may preflight the map and return an explanation for no map. */
  layerCoverage(input: { readonly studyId: string }): Promise<SourceAccess<SourceLayerCoverage>>;
}
