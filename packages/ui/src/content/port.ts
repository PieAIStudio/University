/**
 * Where a lesson's text comes from.
 *
 * One of exactly two differences between the campuses. The authoring campus
 * asks a loopback server that reads the disk, so what was saved a second ago is
 * on screen now; the delivery campus reads a published package, so what a
 * customer sees was frozen and shipped on purpose. Everything above this line —
 * the reader, the review card, the vocabulary panel — is one implementation and
 * must stay that way.
 *
 * The interface is written down once, here, rather than agreed by coincidence
 * between two app files. It lives in `packages/ui` rather than in
 * `packages/core` because it names this package's read models (`LessonView`,
 * the review locators) and `core` may not depend on them — the same reason
 * `ReviewCardPort` is next door. No fetching, no React, no state: this file is
 * the shape of the question.
 */

import type { LessonRef } from "@pieai/university-core";

import type { CourseReviewCardLocator, LessonView } from "../view/lesson-view.js";

/** Both sides of one card, at the revision the shelf currently holds. */
export interface CardBody {
  readonly front: string;
  readonly back: string;
  readonly contentRevision: number;
}

export interface ContentPort {
  /**
   * One lesson, as the shared reader renders it.
   *
   * Rejects rather than returning null: a lesson that cannot be read is
   * something the learner has to be told about, and both campuses already have
   * a retry affordance for it. The signal is part of the contract rather than
   * a constructor option because the thing being abandoned is one navigation,
   * not the shelf.
   */
  lesson(locator: LessonRef, options?: { readonly signal?: AbortSignal }): Promise<LessonView>;
  /**
   * One review card's two sides.
   *
   * Only course cards. A knowledge card is answered by the note that produced
   * it, and no campus schedules one yet — see `KnowledgeReviewCardLocator`.
   */
  card(card: CourseReviewCardLocator): Promise<CardBody>;
}
