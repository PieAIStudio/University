import type { ProgressPort, ReaderPort } from "@pieai/university-core";
import { lessonKeyOf, progressSourceOf } from "@pieai/university-core";
import { translate } from "@pieai/university-ui/i18n.js";
import {
  readPersonalJson,
  PERSONAL_STUDY_ID,
  personalContentId,
  personalAccountScope,
  type PersonalRecord,
} from "./api.js";

export function createPersonalReaderPort(base: ReaderPort, progress: ProgressPort): ReaderPort {
  return {
    ...base,
    async completeLesson(locator, input) {
      if (locator.studyId !== PERSONAL_STUDY_ID) return base.completeLesson(locator, input);
      const account = personalAccountScope();
      if (
        !progressSourceOf(progress).completionOf(locator, {
          contentRevision: input.contentRevision,
          exerciseIds: ["personal-need-exercise"],
        }).exercisesPassed
      )
        throw new Error(translate("mapNodes.personal.makeFirst"));
      const record = await readPersonalJson<PersonalRecord>("/complete", account, {
        method: "POST",
        body: JSON.stringify({
          contentId: personalContentId(locator.courseId),
          commandId: input.commandId,
        }),
      });
      if (account !== personalAccountScope())
        throw new Error("Account changed; no progress was written");
      progress.confirmLessonRead(lessonKeyOf(locator), input.contentRevision);
      progress.dropCards(locator.studyId, locator.courseId, locator.lessonId, record.cardIds);
      if (progress.localSaveState?.() === "failed")
        throw new Error(translate("mapNodes.personal.saveFailed"));
    },
    async loadEvidenceSnippet(locator, index) {
      if (locator.studyId !== PERSONAL_STUDY_ID) return base.loadEvidenceSnippet(locator, index);
      return { kind: "locator-only" };
    },
  };
}
