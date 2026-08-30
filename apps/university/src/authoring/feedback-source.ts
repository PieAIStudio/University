import { translate } from "@pieai/university-ui/i18n.js";
import { createSupabaseFeedbackReviewSource } from "@pieai/university-backend";
import type { FeedbackReviewSource } from "@pieai/university-core";

import { swimmerBackendClient } from "../account/identity";

const unavailableFeedbackReviewSource: FeedbackReviewSource = {
  async listAll() {
    throw new Error(translate("app.authoring.feedbacksource.copy.SwimmerBackend-反馈表还没有接好"));
  },
  async listAnswerAggregates() {
    throw new Error(
      translate("app.authoring.feedbacksource.copy.SwimmerBackend-答题汇总接口还没有接好"),
    );
  },
};

/** Studio reads through the same assembled client; it never creates a second backend. */
export const feedbackReviewSource: FeedbackReviewSource = swimmerBackendClient
  ? createSupabaseFeedbackReviewSource(swimmerBackendClient)
  : unavailableFeedbackReviewSource;
