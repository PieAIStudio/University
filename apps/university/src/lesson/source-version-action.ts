/**
 * The authoring shell's opt-in action for `LessonSourceVersion`.
 *
 * The shared reader owns the presentation and state, while this build-owned
 * callback owns the loopback route. Delivery never passes this callback, so a
 * customer cannot click an action whose server does not exist.
 */
import { readJson } from "@pieai/university-ui/api/client.js";
import type { LessonSourceVersionAction, LessonSourceVersionCheckout } from "@pieai/university-ui";

export const localSourceVersionAction: LessonSourceVersionAction = async (method, input) => {
  const endpoint = `/api/studies/${encodeURIComponent(input.studyId)}/checkout?sourceCommit=${encodeURIComponent(input.sourceCommit)}`;
  const httpMethod = method === "open" ? "POST" : "DELETE";
  const response = await fetch(endpoint, { method: httpMethod });
  if (method === "close") {
    await readJson<unknown>(response);
    return null;
  }
  return readJson<LessonSourceVersionCheckout>(response);
};
