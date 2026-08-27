/**
 * Typed, privacy-bounded PostHog adapter for the University browser app.
 *
 * The event payload is the boundary. It contains only stable ids, enums and
 * counts; learner answers, lesson prose, marks, email addresses and source
 * text never enter this module. PostHog is loaded only after the app has a
 * configured key, so analytics cannot make the product pay its startup cost or
 * become a required service.
 */

import type { IdentityPort, IdentityStatus, PaymentPort } from "@pieai/university-core";
import type { ReviewCardPort } from "@pieai/university-ui/review/ports.js";

import { AUTHORING } from "../mode";

export type AnalyticsExerciseTier = "tier-1" | "tier-2";
export type AnalyticsReviewRating = "again" | "hard" | "good" | "easy";

export type AnalyticsEvent =
  | { name: "app_open" }
  | { name: "course_opened"; studyId: string; courseId: string }
  | { name: "lesson_opened"; studyId: string; courseId: string; lessonId: string }
  | { name: "lesson_read_confirmed"; studyId: string; courseId: string; lessonId: string }
  | {
      name: "exercise_submitted";
      studyId: string;
      courseId: string;
      lessonId: string;
      tier: AnalyticsExerciseTier;
    }
  | {
      name: "exercise_result";
      studyId: string;
      courseId: string;
      lessonId: string;
      passed: boolean;
      attemptCount: number;
    }
  | {
      name: "settlement_shown";
      studyId: string;
      courseId: string;
      lessonId: string;
    }
  | { name: "review_due_opened"; cardCount: number }
  | { name: "review_graded"; rating: AnalyticsReviewRating; cardCount: number }
  | { name: "account_sign_up_started" }
  | { name: "account_sign_up_completed" }
  | { name: "account_sign_in" }
  | { name: "plans_opened" }
  | { name: "purchase_requested"; offerId: string };

type AnalyticsEventName = AnalyticsEvent["name"];

/** Runtime enforcement for callers that bypass TypeScript at a boundary. */
const ALLOWLIST: Record<AnalyticsEventName, readonly string[]> = {
  app_open: [],
  course_opened: ["studyId", "courseId"],
  lesson_opened: ["studyId", "courseId", "lessonId"],
  lesson_read_confirmed: ["studyId", "courseId", "lessonId"],
  exercise_submitted: ["studyId", "courseId", "lessonId", "tier"],
  exercise_result: ["studyId", "courseId", "lessonId", "passed", "attemptCount"],
  settlement_shown: ["studyId", "courseId", "lessonId"],
  review_due_opened: ["cardCount"],
  review_graded: ["rating", "cardCount"],
  account_sign_up_started: [],
  account_sign_up_completed: [],
  account_sign_in: [],
  plans_opened: [],
  purchase_requested: ["offerId"],
};

interface PostHogLike {
  capture: (name: string, properties?: Record<string, unknown>) => void;
  identify?: (distinctId: string) => void;
}

let client: PostHogLike | null = null;
let state: "idle" | "loading" | "ready" | "disabled" = "idle";
const pending: Array<{ name: string; properties: Record<string, unknown> }> = [];
const MAX_PENDING = 24;
let pendingIdentityId: string | null = null;
let identifiedUserId: string | null = null;

function identifyUser(userId: string): void {
  if (!userId || (identifiedUserId === userId && pendingIdentityId === null)) return;
  identifiedUserId = userId;
  if (!client) {
    if (state !== "disabled") pendingIdentityId = userId;
    return;
  }
  pendingIdentityId = null;
  try {
    client.identify?.(userId);
  } catch {
    // Analytics must never break a learning action or surface an error.
  }
}

function identifyStatus(status: IdentityStatus): void {
  if (status.kind === "anonymous" || status.kind === "signed_in") {
    identifyUser(status.user.id);
  }
}

function flushPendingIdentity(): void {
  if (!client || !pendingIdentityId) return;
  const userId = pendingIdentityId;
  pendingIdentityId = null;
  try {
    client.identify?.(userId);
  } catch {
    // Analytics must never break a learning action or surface an error.
  }
}

/** Map the UI's numeric FSRS control to the stable product enum. */
export function reviewRatingOf(rating: 1 | 2 | 3 | 4): AnalyticsReviewRating {
  return ["again", "hard", "good", "easy"][rating - 1] as AnalyticsReviewRating;
}

export async function initProductAnalytics(): Promise<void> {
  const key = import.meta.env.VITE_POSTHOG_KEY?.trim();
  const enabled = import.meta.env.VITE_ENABLE_POSTHOG !== "false";
  if (!key || !enabled) {
    state = "disabled";
    pendingIdentityId = null;
    return;
  }

  state = "loading";
  try {
    const { default: posthog } = await import("posthog-js");
    posthog.init(key, {
      api_host: import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
      autocapture: false,
      capture_pageview: true,
      disable_session_recording: true,
      persistence: "localStorage",
      loaded: (ph) => {
        ph.register({
          product: "university",
          surface: AUTHORING ? "authoring" : "delivery",
        });
      },
    });
    client = posthog;
    state = "ready";
    flushPendingIdentity();
    while (pending.length > 0) {
      const item = pending.shift();
      if (item) client.capture(item.name, item.properties);
    }
  } catch {
    client = null;
    state = "disabled";
    pending.length = 0;
    pendingIdentityId = null;
  }
}

export function trackEvent(event: AnalyticsEvent): void {
  try {
    const allowed = ALLOWLIST[event.name];
    if (!allowed) return;
    const properties: Record<string, unknown> = {};
    const raw = event as unknown as Record<string, unknown>;
    for (const key of allowed) {
      if (raw[key] !== undefined) properties[key] = raw[key];
    }
    if (!client) {
      if (state === "disabled") return;
      if (pending.length < MAX_PENDING) pending.push({ name: event.name, properties });
      return;
    }
    client.capture(event.name, properties);
  } catch {
    // Analytics must never break a learning action or surface an error to a learner.
  }
}

/** Keep account actions observable without exposing the email argument. */
export function withProductAnalyticsIdentity(identity: IdentityPort): IdentityPort {
  const identifyCurrent = () => identifyStatus(identity.status());
  identity.subscribe(identifyCurrent);
  identifyCurrent();

  return {
    ...identity,
    subscribe(listener) {
      return identity.subscribe(() => {
        identifyCurrent();
        listener();
      });
    },
    async signInAnonymously(options) {
      await identity.signInAnonymously(options);
      identifyCurrent();
    },
    async signInWithEmail(email, password) {
      await identity.signInWithEmail(email, password);
      identifyCurrent();
      if (identity.status().kind === "signed_in") trackEvent({ name: "account_sign_in" });
    },
    async signUpWithEmail(email, password) {
      trackEvent({ name: "account_sign_up_started" });
      const result = await identity.signUpWithEmail(email, password);
      identifyCurrent();
      if (result.confirmationRequired || identity.status().kind === "signed_in") {
        trackEvent({ name: "account_sign_up_completed" });
      }
      return result;
    },
    async linkEmail(email, password) {
      await identity.linkEmail(email, password);
      identifyCurrent();
    },
    async signOut() {
      await identity.signOut();
      identifyCurrent();
    },
  };
}

/** Keep the purchase offer id observable without sending payment details. */
export function withProductAnalyticsPayment(payment: PaymentPort): PaymentPort {
  return {
    ...payment,
    async initiatePurchase(input) {
      trackEvent({ name: "purchase_requested", offerId: input.offerId });
      return payment.initiatePurchase(input);
    },
  };
}

/** Keep every shared review surface on the same post-commit analytics path. */
export function withProductAnalyticsReview(
  review: ReviewCardPort,
  cardCountOf: () => number,
): ReviewCardPort {
  return {
    ...review,
    async rate(card, rating) {
      const cardCount = cardCountOf();
      const result = await review.rate(card, rating);
      trackEvent({ name: "review_graded", rating: reviewRatingOf(rating), cardCount });
      return result;
    },
  };
}

/** Test seam. It also clears queued events between isolated tests. */
export function setAnalyticsClientForTesting(next: PostHogLike | null): void {
  client = next;
  state = next ? "ready" : "idle";
  pending.length = 0;
  pendingIdentityId = null;
  identifiedUserId = null;
}
