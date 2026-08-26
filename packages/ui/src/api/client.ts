import type { LessonRef, ReviewCardLocator } from "../view/lesson-view.js";

/**
 * How the page talks to the local API, and what it does when the answer is no.
 *
 * Only URL building and response unwrapping live here — no fetching, no state,
 * no React. Components own their own requests; what they share is the shape of
 * the address and the shape of the failure.
 */

/** Unwraps a JSON response, turning a non-2xx into the server's own message. */
export async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { readonly error?: string };
  if (!response.ok) throw new Error(body.error ?? `请求失败（${response.status}）`);
  return body;
}

export function lessonPath(locator: LessonRef): string {
  return `/api/studies/${locator.studyId}/courses/${locator.courseId}/units/${locator.unitId}/lessons/${locator.lessonId}`;
}

export function exerciseContentPath(locator: LessonRef, exerciseId: string): string {
  return `${lessonPath(locator)}/exercises/${encodeURIComponent(exerciseId)}`;
}

export function cardActionPath(card: ReviewCardLocator, action: "reveal" | "review"): string {
  if (card.kind === "knowledge-card") {
    return `/api/studies/${card.studyId}/notes/${card.noteId}/cards/${card.cardId}/${action}`;
  }
  if (card.kind === "recap-card") {
    return `${lessonPath(card)}/recap/${action}`;
  }
  return `${lessonPath(card)}/cards/${card.cardId}/${action}`;
}

export function cardContentPath(
  card: Extract<ReviewCardLocator, { readonly kind: "course-card" }>,
): string {
  return `${lessonPath(card)}/cards/${card.cardId}/content`;
}

/** Identity a card keeps across renders, including which revision it was asked at. */
export function reviewCardIdentity(card: ReviewCardLocator): string {
  if (card.kind === "knowledge-card") {
    return `knowledge/${card.studyId}/${card.noteId}/${card.cardId}@${card.contentRevision}`;
  }
  if (card.kind === "recap-card") {
    return `recap/${card.studyId}/${card.courseId}/${card.unitId}/${card.lessonId}@${card.contentRevision}`;
  }
  return `course/${card.studyId}/${card.courseId}/${card.unitId}/${card.lessonId}/${card.cardId}@${card.contentRevision}`;
}

/**
 * The API mints its request token once per process, so restarting it — which
 * `pnpm dev` does on every server edit — invalidates the token an already-open
 * tab is still sending. The raw 403 tells a learner nothing they can act on,
 * and the page looks broken until they think to reload it. Pulling a fresh
 * bootstrap puts a valid token back in place, so the repair is one more click.
 */
export const STALE_TOKEN_NOTICE = "本地服务重启过，安全令牌换新了。再点一次就能提交。";

export function isStaleTokenFailure(message: string): boolean {
  return /request token/i.test(message);
}
