import type { Grade } from "ts-fsrs";

import {
  VOCABULARY_DUE_LIMIT,
  VocabularyGradeSchema,
  VocabularyPresentedSchema,
  VocabularyStageSchema,
} from "../request-schemas.js";
import { readJsonBody, requireMutationAccess, sendJson } from "../wire.js";
import { selectLexicon } from "../../language/lexicon.js";
import type { Handler } from "./types.js";

/**
 * The five `/api/vocabulary*` routes. Vocabulary is not scoped to a study: one
 * word, one state, wherever it was met. These routes therefore sit outside
 * /api/studies/:id.
 */
export const handleVocabulary: Handler = async (ctx, request, response, url) => {
  if (request.method === "GET" && url.pathname === "/api/vocabulary") {
    const vocabulary = ctx.getVocabulary();
    const due = vocabulary.listDue(VOCABULARY_DUE_LIMIT);
    // A due row is a schedule, not a word: it carries a senseId and nothing
    // a learner could read. The entry is attached here because a review
    // screen that has to fetch each word separately is a review screen that
    // shows blank cards while it waits.
    const entries = new Map(
      selectLexicon(due.map((state) => state.senseId)).map((entry) => [entry.senseId, entry]),
    );
    sendJson(response, 200, {
      budget: vocabulary.budget(),
      due: due.flatMap((state) => {
        const entry = entries.get(state.senseId);
        // A word dropped from the lexicon keeps its state — the learner may
        // have known it for months — but it cannot be asked, so it is not
        // offered for review.
        return entry ? [{ ...state, entry }] : [];
      }),
      states: vocabulary.listStates(),
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/vocabulary/presented") {
    requireMutationAccess(request, ctx.requestToken);
    const body = VocabularyPresentedSchema.parse(await readJsonBody(request));
    ctx.getVocabulary().recordPresented(body.senseIds, {
      studyId: body.studyId,
      lessonId: body.lessonId,
    });
    sendJson(response, 202, { recorded: body.senseIds.length });
    return true;
  }

  const vocabularyStageRoute = /^\/api\/vocabulary\/([^/]+)\/stage$/.exec(url.pathname);
  if (request.method === "POST" && vocabularyStageRoute) {
    requireMutationAccess(request, ctx.requestToken);
    const body = VocabularyStageSchema.parse(await readJsonBody(request));
    const senseId = decodeURIComponent(vocabularyStageRoute[1]!);
    ctx.assertKnownSense(senseId);
    sendJson(response, 200, { state: ctx.getVocabulary().setStage(senseId, body.stage) });
    return true;
  }

  const vocabularyGradeRoute = /^\/api\/vocabulary\/([^/]+)\/grade$/.exec(url.pathname);
  if (request.method === "POST" && vocabularyGradeRoute) {
    requireMutationAccess(request, ctx.requestToken);
    const body = VocabularyGradeSchema.parse(await readJsonBody(request));
    const senseId = decodeURIComponent(vocabularyGradeRoute[1]!);
    ctx.assertKnownSense(senseId);
    sendJson(response, 200, {
      state: ctx.getVocabulary().grade(senseId, body.rating as Grade),
    });
    return true;
  }

  return false;
};
