/**
 * What a lesson reader has to ask, regardless of which shell is showing it.
 *
 * The shared reader used to call fetch against `/api/…` nine times — vocabulary,
 * marks, evidence, staging a word, confirming a read. Those URLs belong to the
 * authoring shell's loopback server on 4317. The delivery shell has no such
 * server, and grew a second, thinner reader rather than unplug the first.
 *
 * This port is the plug. `packages/core` only names the questions. The
 * authoring shell answers them over HTTP; the delivery shell answers them
 * from a published package and the progress document on the machine. Neither
 * answer lives here: this file has no React, no filesystem, and no network.
 */

import type { ReaderMark, ReaderMarkKind, TextQuote } from "../domain/reader-marks.js";
import type { VocabularyState } from "../language/layer.js";
import type { LessonRef } from "../progress/contract.js";

/** Windowed inline snippet, or the full file the source sheet shows. */
export type EvidenceSnippetViewKind = "windowed" | "full";

/**
 * A cited source range, as the reader displays it.
 *
 * Matches the authoring API's evidence payload and the delivery shell's baked
 * JSON, so a component that already rendered one can render the other.
 */
export interface EvidenceSnippet {
  readonly sourcePath: string;
  readonly sourceCommit: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly highlightStartLine: number | null;
  readonly highlightEndLine: number | null;
  readonly language: string;
  readonly code: string;
  readonly truncatedBefore?: boolean;
  readonly truncatedAfter?: boolean;
  readonly attribution?: string;
}

/** The citation is valid, but this shell does not carry the source bytes. */
export interface LocatorOnlyEvidence {
  readonly kind: "locator-only";
}

export type EvidenceSnippetResult = EvidenceSnippet | LocatorOnlyEvidence;

export interface ReaderMarkDraft {
  readonly contentRevision: number;
  readonly kind: ReaderMarkKind;
  readonly quote: TextQuote;
  readonly sectionTitle?: string;
}

export interface LessonCompleteInput {
  readonly commandId: string;
  readonly contentRevision: number;
}

export interface VocabularyStageResult {
  readonly senseId: string;
  readonly stage: string;
}

export interface ReaderPort {
  listVocabulary(): Promise<{
    readonly states: readonly Pick<VocabularyState, "senseId" | "stage">[];
  }>;
  /**
   * Recording that words appeared is fire-and-forget at the call site. The
   * authoring server counts one appearance per word per lesson per day however
   * many times this fires; a delivery implementation may no-op.
   */
  recordPresented(input: {
    readonly studyId: string;
    readonly lessonId: string;
    readonly senseIds: readonly string[];
  }): Promise<void>;
  listMarks(studyId: string): Promise<readonly ReaderMark[]>;
  writeMark(locator: LessonRef, draft: ReaderMarkDraft): Promise<ReaderMark>;
  resolveMark(studyId: string, markId: string): Promise<void>;
  deleteMark(studyId: string, markId: string): Promise<void>;
  stageWord(
    senseId: string,
    stage: "learning" | "familiar" | "paused",
  ): Promise<VocabularyStageResult>;
  completeLesson(locator: LessonRef, input: LessonCompleteInput): Promise<void>;
  loadEvidenceSnippet(
    locator: LessonRef,
    index: number,
    view?: EvidenceSnippetViewKind,
  ): Promise<EvidenceSnippetResult>;
}

export interface MemoryReaderPort extends ReaderPort {
  readonly marks: ReaderMark[];
  readonly stages: Map<string, string>;
  readonly presented: { studyId: string; lessonId: string; senseIds: readonly string[] }[];
  readonly completed: { locator: LessonRef; input: LessonCompleteInput }[];
}

/** In-process fake, for tests that should not stand up a server. */
export function createMemoryReaderPort(options?: {
  readonly snippets?: ReadonlyMap<number, EvidenceSnippet>;
}): MemoryReaderPort {
  const marks: ReaderMark[] = [];
  const stages = new Map<string, string>();
  const presented: MemoryReaderPort["presented"] = [];
  const completed: MemoryReaderPort["completed"] = [];
  const snippets = options?.snippets ?? new Map();

  const port: MemoryReaderPort = {
    marks,
    stages,
    presented,
    completed,
    async listVocabulary() {
      return {
        states: [...stages].map(([senseId, stage]) => ({
          senseId,
          stage: stage as VocabularyState["stage"],
        })),
      };
    },
    async recordPresented(input) {
      presented.push(input);
    },
    async listMarks() {
      return [...marks];
    },
    async writeMark(locator, draft) {
      const mark: ReaderMark = {
        markId: `memory:${marks.length + 1}`,
        lessonKey: `${locator.studyId}/${locator.courseId}/${locator.unitId}/${locator.lessonId}`,
        contentRevision: draft.contentRevision,
        kind: draft.kind,
        quote: draft.quote,
        sectionTitle: draft.sectionTitle ?? null,
        note: null,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };
      marks.push(mark);
      return mark;
    },
    async resolveMark(_studyId, markId) {
      const mark = marks.find((item) => item.markId === markId);
      if (!mark) throw new Error("No such open mark");
      (mark as { resolvedAt: string }).resolvedAt = new Date().toISOString();
    },
    async deleteMark(_studyId, markId) {
      const at = marks.findIndex((item) => item.markId === markId);
      if (at === -1) throw new Error("No such mark");
      marks.splice(at, 1);
    },
    async stageWord(senseId, stage) {
      stages.set(senseId, stage);
      return { senseId, stage };
    },
    async completeLesson(locator, input) {
      completed.push({ locator, input });
    },
    async loadEvidenceSnippet(_locator, index) {
      const snippet = snippets.get(index);
      return snippet ?? { kind: "locator-only" };
    },
  };
  return port;
}
