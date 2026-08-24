/**
 * The authoring shell's ReaderPort: the same nine loopback requests the
 * shared reader used to make itself.
 *
 * Behaviour is the contract. Changing a path, a header, or a body field here
 * is changing what 4317 has always answered, and that is a product change.
 */
import {
  lessonRefKey,
  type EvidenceSnippet,
  type LessonRef,
  type ProgressPort,
  type ReaderPort,
  type VocabularyState,
} from "@pieai/university-core";
import type { ReaderMark } from "@pieai/university-core/domain/reader-marks.js";
import { lessonPath, readJson } from "@pieai/university-ui/api/client.js";

export function createHttpReaderPort(options: {
  readonly requestToken: string;
  /** Shared cloud document; absent only in isolated unit tests. */
  readonly progress?: ProgressPort;
  /** Called after the local server confirms a lesson is complete. */
  readonly onLessonComplete?: (locator: LessonRef) => void;
}): ReaderPort {
  const tokenHeaders = {
    "Content-Type": "application/json",
    "X-University-Local-Token": options.requestToken,
  };

  return {
    async listVocabulary() {
      if (options.progress) {
        return {
          states: options.progress.vocabularyStates().map((state) => ({
            senseId: state.senseId,
            stage: state.stage,
          })),
        };
      }
      const body = await readJson<{
        readonly states: readonly Pick<VocabularyState, "senseId" | "stage">[];
      }>(await fetch("/api/vocabulary"));
      return { states: body.states };
    },

    async recordPresented(input) {
      // Appearance analytics are a local authoring cache. The learner's
      // stage/schedule is the cloud document; a telemetry write must not make
      // a lesson fail when the local database is unavailable.
      await fetch("/api/vocabulary/presented", {
        method: "POST",
        headers: tokenHeaders,
        body: JSON.stringify({
          studyId: input.studyId,
          lessonId: input.lessonId,
          senseIds: input.senseIds,
        }),
      }).catch(() => undefined);
    },

    async listMarks(studyId) {
      const body = await readJson<{ readonly marks: readonly ReaderMark[] }>(
        await fetch(`/api/studies/${encodeURIComponent(studyId)}/marks`),
      );
      for (const mark of body.marks) options.progress?.saveReaderMark(mark);
      return options.progress?.readerMarks(studyId) ?? body.marks;
    },

    async writeMark(locator: LessonRef, draft) {
      const body = await readJson<{ readonly mark: ReaderMark }>(
        await fetch(`${lessonPath(locator)}/marks`, {
          method: "POST",
          headers: tokenHeaders,
          body: JSON.stringify({
            contentRevision: draft.contentRevision,
            kind: draft.kind,
            exact: draft.quote.exact,
            prefix: draft.quote.prefix,
            suffix: draft.quote.suffix,
            ...(draft.sectionTitle ? { sectionTitle: draft.sectionTitle } : {}),
          }),
        }),
      );
      options.progress?.saveReaderMark(body.mark);
      return body.mark;
    },

    async resolveMark(studyId, markId) {
      await mutateMark(studyId, markId, "POST", tokenHeaders);
      options.progress?.resolveReaderMark(studyId, markId);
    },

    async deleteMark(studyId, markId) {
      await mutateMark(studyId, markId, "DELETE", tokenHeaders);
      options.progress?.deleteReaderMark(studyId, markId);
    },

    async stageWord(senseId, stage) {
      options.progress?.stageWord(senseId, stage);
      try {
        const body = await readJson<{
          readonly state: { readonly senseId: string; readonly stage: string };
        }>(
          await fetch(`/api/vocabulary/${encodeURIComponent(senseId)}/stage`, {
            method: "POST",
            headers: tokenHeaders,
            body: JSON.stringify({ stage }),
          }),
        );
        return { senseId: body.state.senseId, stage: body.state.stage };
      } catch {
        return { senseId, stage };
      }
    },

    async completeLesson(locator, input) {
      const body = await readJson<{ readonly lessonComplete?: boolean }>(
        await fetch(`${lessonPath(locator)}/complete`, {
          method: "POST",
          headers: tokenHeaders,
          body: JSON.stringify({
            commandId: input.commandId,
            contentRevision: input.contentRevision,
          }),
        }),
      );
      options.progress?.confirmLessonRead(lessonRefKey(locator), input.contentRevision);
      if (body.lessonComplete) options.onLessonComplete?.(locator);
    },

    async loadEvidenceSnippet(locator, index, view) {
      const suffix = view === "full" ? "?view=full" : "";
      return readJson<EvidenceSnippet>(
        await fetch(`${lessonPath(locator)}/evidence/${index}${suffix}`),
      );
    },
  };
}

async function mutateMark(
  studyId: string,
  markId: string,
  method: "POST" | "DELETE",
  headers: { readonly "Content-Type": string; readonly "X-University-Local-Token": string },
): Promise<void> {
  const response = await fetch(
    `/api/studies/${encodeURIComponent(studyId)}/marks/${encodeURIComponent(markId)}`,
    {
      method,
      // Bodyless, but the server requires this on every state-changing
      // request: a form-encoded POST is the shape a cross-site form can
      // send without a preflight, so demanding JSON is part of what keeps
      // the loopback API from being driven by a page in another tab.
      headers,
    },
  );
  if (!response.ok) throw new Error("标记没有更新");
}
