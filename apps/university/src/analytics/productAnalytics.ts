/**
 * Typed, privacy-bounded PostHog adapter for the University browser app.
 *
 * The event payload is the boundary. It contains only stable ids, enums and
 * counts; learner answers, lesson prose, marks, email addresses and source
 * text never enter this module. PostHog is loaded only after the app has a
 * configured key, so analytics cannot make the product pay its startup cost or
 * become a required service.
 */

import type { AuthPort } from "@pieai/university-backend/browser.js";
import type {
  IdentityPort,
  IdentityStatus,
  PaymentPort,
  ProgressPort,
} from "@pieai/university-core";
import type { ReviewCardPort } from "@pieai/university-ui/review/ports.js";

import { AUTHORING } from "../mode";

export type AnalyticsExerciseTier = "tier-1" | "tier-2";
export type AnalyticsReviewRating = "again" | "hard" | "good" | "easy";
/**
 * Which shelf a graded card came from.
 *
 * `review_graded` counted every rating as one number, which cannot answer the
 * question the teach-back card exists to answer: a learner writes an
 * explanation in their own words on the promise that it comes back, and
 * without this discriminant a returning vocabulary card and a returning
 * teach-back card are the same event. The locator already carries `kind`, so
 * this adds a stable enum and no new learner content.
 */
export type AnalyticsCardKind = "course-card" | "recap-card" | "knowledge-card";

export type AnalyticsEvent =
  | { name: "welcome_shown" }
  | { name: "welcome_exited"; destination: "lesson" | "map" | "account" }
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
      passed: boolean | null;
      outcome?: "pass" | "fail" | "undecided";
      attemptCount: number;
    }
  | {
      name: "settlement_shown";
      studyId: string;
      courseId: string;
      lessonId: string;
    }
  | { name: "review_due_opened"; cardCount: number }
  | {
      name: "review_graded";
      rating: AnalyticsReviewRating;
      cardCount: number;
      cardKind: AnalyticsCardKind;
    }
  | { name: "recap_saved"; studyId: string; courseId: string; lessonId: string }
  | { name: "account_sign_up_started" }
  | { name: "account_sign_up_completed" }
  | { name: "account_sign_in" }
  | { name: "plans_opened" }
  | { name: "purchase_requested"; offerId: string };

type AnalyticsEventName = AnalyticsEvent["name"];

/** Runtime enforcement for callers that bypass TypeScript at a boundary. */
const ALLOWLIST: Record<AnalyticsEventName, readonly string[]> = {
  welcome_shown: [],
  welcome_exited: ["destination"],
  app_open: [],
  course_opened: ["studyId", "courseId"],
  lesson_opened: ["studyId", "courseId", "lessonId"],
  lesson_read_confirmed: ["studyId", "courseId", "lessonId"],
  exercise_submitted: ["studyId", "courseId", "lessonId", "tier"],
  exercise_result: ["studyId", "courseId", "lessonId", "passed", "outcome", "attemptCount"],
  settlement_shown: ["studyId", "courseId", "lessonId"],
  review_due_opened: ["cardCount"],
  review_graded: ["rating", "cardCount", "cardKind"],
  recap_saved: ["studyId", "courseId", "lessonId"],
  account_sign_up_started: [],
  account_sign_up_completed: [],
  account_sign_in: [],
  plans_opened: [],
  purchase_requested: ["offerId"],
};

interface PostHogLike {
  capture: (name: string, properties?: Record<string, unknown>) => void;
  identify?: (distinctId: string) => void;
  reset?: (resetDeviceId?: boolean) => void;
}

let client: PostHogLike | null = null;
let state: "idle" | "loading" | "ready" | "disabled" = "idle";
const pending: Array<{ name: string; properties: Record<string, unknown> }> = [];
const MAX_PENDING = 24;
let pendingIdentityId: string | null = null;
let identifiedUserId: string | null = null;

function clearIdentity(): void {
  if (!identifiedUserId && !pendingIdentityId) return;
  identifiedUserId = null;
  pendingIdentityId = null;
  pending.length = 0;
  try {
    client?.reset?.(true);
  } catch {
    // A measurement failure must not interrupt logout or account switching.
  }
}

function identifyUser(userId: string): void {
  if (!userId || (identifiedUserId === userId && pendingIdentityId === null)) return;
  if (identifiedUserId && identifiedUserId !== userId) clearIdentity();
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
  } else if (status.kind !== "pending") {
    clearIdentity();
  }
}

// The SDK adds properties after trackEvent. Filter at its final send boundary
// as well: an auth callback URL or nested initial referrer is not learner data.
const TRANSPORT_PROPERTIES = new Set([
  "token",
  "distinct_id",
  "$device_id",
  "$user_id",
  "$session_id",
  "$window_id",
  "$is_identified",
  "$anon_distinct_id",
  "$process_person_profile",
  "$lib",
  "$lib_version",
  "product",
  "surface",
]);

function boundedEvent<T extends { event: string; properties: Record<string, unknown> }>(
  event: T | null,
): T | null {
  if (!event) return null;
  const allowed = ALLOWLIST[event.event as AnalyticsEventName];
  if (!allowed && event.event !== "$identify") return null;
  const keys = new Set([...TRANSPORT_PROPERTIES, ...(allowed ?? [])]);
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event.properties)) {
    if (
      keys.has(key) &&
      (value === null || ["string", "number", "boolean"].includes(typeof value))
    ) {
      properties[key] = value;
    }
  }
  return { ...event, properties };
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
      capture_pageview: false,
      capture_pageleave: false,
      capture_dead_clicks: false,
      capture_performance: false,
      disable_surveys: true,
      disable_session_recording: true,
      before_send: boundedEvent,
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
/** Track kit `execute` results without serializing emails, tokens or passwords. */
export function withProductAnalyticsAuth(auth: AuthPort | null): AuthPort | null {
  if (!auth) return null;
  return {
    getSession: () => auth.getSession(),
    getCurrentUser: () => auth.getCurrentUser(),
    onAuthStateChange: (listener) => auth.onAuthStateChange(listener),
    async execute(action) {
      if (action.type === "sign-up") trackEvent({ name: "account_sign_up_started" });
      const result = await auth.execute(action);
      try {
        if (result.status === "authenticated") {
          if (action.type === "sign-up" || action.type === "link-email") {
            trackEvent({ name: "account_sign_up_completed" });
          } else if (action.type === "sign-in" || action.type === "verify-code") {
            trackEvent({ name: "account_sign_in" });
          }
        }
      } catch {
        // Analytics must not reclassify a completed account operation.
      }
      return result;
    },
  };
}

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
      trackEvent({
        name: "review_graded",
        rating: reviewRatingOf(rating),
        cardCount,
        cardKind: card.kind,
      });
      return result;
    },
  };
}

/**
 * Keep the one write that creates a teach-back card observable.
 *
 * The card is created by `RecapPrompt`, which `LessonReader` and
 * `SettlementHost` both render — so tracking at a call site would count one of
 * them and miss the other. The port is where the write actually happens, and
 * there is one of it.
 *
 * Only a card that did not exist before and does exist after is a save. The
 * port validates its input and returns without writing when it is malformed,
 * and re-saving is not something the prompt offers, so this reports first
 * saves and nothing else.
 */
export function withProductAnalyticsProgress(progress: ProgressPort): ProgressPort {
  return {
    ...progress,
    createRecapCard(input) {
      const existed = progress.recapCard(input.locator) !== undefined;
      progress.createRecapCard(input);
      if (existed || progress.recapCard(input.locator) === undefined) return;
      trackEvent({
        name: "recap_saved",
        studyId: input.locator.studyId,
        courseId: input.locator.courseId,
        lessonId: input.locator.lessonId,
      });
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
