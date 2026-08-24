/**
 * The delivery shell's ReaderPort: published packages plus the progress
 * document already on this machine.
 *
 * Marks now live in the same ProgressDocument as cards and words. The old
 * sidecar remains a one-time offline migration/cache for existing browser
 * profiles; it is not the cross-device source of truth. New marks are written
 * to the shared ProgressDocument first.
 */
import {
  lessonRefKey,
  type EvidenceSnippet,
  type LessonRef,
  type ProgressPort,
  type ReaderPort,
} from "@pieai/university-core";
import type { ReaderMark } from "@pieai/university-core/domain/reader-marks.js";

import { isRepositoryAnchor } from "../content/library";
import type { Lesson } from "../content/library";

export const READER_MARKS_STORAGE_KEY = "university.reader-marks.v1";

type MarkStore = Record<string, ReaderMark[]>;

function readStore(): MarkStore {
  try {
    const raw = localStorage.getItem(READER_MARKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MarkStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: MarkStore): void {
  try {
    localStorage.setItem(READER_MARKS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private browsing, or a full quota. Losing a mark is survivable;
    // throwing in the middle of a lesson is not.
  }
}

export function createOnlineReaderPort(options: {
  readonly progress: ProgressPort;
  readonly lesson: Lesson;
  readonly onComplete: (locator: LessonRef) => void;
}): ReaderPort {
  const { progress, lesson, onComplete } = options;

  return {
    async listVocabulary() {
      return { states: progress.vocabularyStates() };
    },

    async recordPresented() {
      // Appearance counting feeds the authoring shell's new-word budget.
      // Delivery has no such budget yet, and inventing one here would be a
      // second scheduler. The call stays so the shared reader can fire it.
    },

    async listMarks(studyId) {
      // Migrate marks created before the cloud document learned about reader
      // annotations. A later cloud merge can then carry them to another
      // computer instead of leaving them trapped in this browser profile.
      for (const mark of readStore()[studyId] ?? []) progress.saveReaderMark(mark);
      return progress.readerMarks(studyId);
    },

    async writeMark(locator, draft) {
      const mark: ReaderMark = {
        markId:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `mark-${Date.now()}`,
        lessonKey: `${locator.studyId}/${locator.courseId}/${locator.unitId}/${locator.lessonId}`,
        contentRevision: draft.contentRevision,
        kind: draft.kind,
        quote: draft.quote,
        sectionTitle: draft.sectionTitle ?? null,
        note: null,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };
      progress.saveReaderMark(mark);
      const store = readStore();
      store[locator.studyId] = [...(store[locator.studyId] ?? []), mark];
      writeStore(store);
      return mark;
    },

    async resolveMark(studyId, markId) {
      const store = readStore();
      const marks = store[studyId] ?? [];
      const at = marks.findIndex((item) => item.markId === markId && item.resolvedAt === null);
      if (at === -1) throw new Error("No such open mark");
      const current = marks[at]!;
      store[studyId] = marks.map((item, index) =>
        index === at ? { ...current, resolvedAt: new Date().toISOString() } : item,
      );
      writeStore(store);
      progress.resolveReaderMark(studyId, markId);
    },

    async deleteMark(studyId, markId) {
      const store = readStore();
      const marks = store[studyId] ?? [];
      if (!marks.some((item) => item.markId === markId)) throw new Error("No such mark");
      store[studyId] = marks.filter((item) => item.markId !== markId);
      writeStore(store);
      progress.deleteReaderMark(studyId, markId);
    },

    async stageWord(senseId, stage) {
      progress.stageWord(senseId, stage);
      return { senseId, stage };
    },

    async completeLesson(locator, input) {
      progress.confirmLessonRead(lessonRefKey(locator), input.contentRevision);
      onComplete(locator);
    },

    async loadEvidenceSnippet(_locator, index): Promise<EvidenceSnippet> {
      const anchor = lesson.evidence[index];
      // A public-page citation has no baked snippet and never will; the reader
      // renders it as a link rather than asking for one.
      const url = anchor && isRepositoryAnchor(anchor) ? anchor.snippetUrl : undefined;
      if (!url) throw new Error("这条证据没有烘焙源码");
      const response = await fetch(url);
      if (!response.ok) throw new Error(`无法读取固定源码（${response.status}）`);
      return (await response.json()) as EvidenceSnippet;
    },
  };
}
