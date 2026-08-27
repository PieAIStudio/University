import type { FeedbackPort } from "@pieai/university-core";

/** Keep the learner control visible while the backend capability is absent. */
export function createUnavailableFeedbackPort(reason: string): FeedbackPort {
  const unavailable = async (): Promise<never> => {
    throw new Error(reason);
  };
  return {
    transport: "unavailable",
    submit: unavailable,
    readMine: unavailable,
  };
}
