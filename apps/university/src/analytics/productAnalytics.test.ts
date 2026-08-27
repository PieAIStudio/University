import {
  createMemoryIdentityPort,
  createPaymentPort,
  RECAP_CARD_ID,
  type ProgressPort,
  type RecapCardInput,
} from "@pieai/university-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  initProductAnalytics,
  setAnalyticsClientForTesting,
  trackEvent,
  withProductAnalyticsIdentity,
  withProductAnalyticsPayment,
  withProductAnalyticsProgress,
  withProductAnalyticsReview,
} from "./productAnalytics";

const posthogCapture = vi.hoisted(() => vi.fn());
const posthogIdentify = vi.hoisted(() => vi.fn());
const posthogInit = vi.hoisted(() => vi.fn());
const posthogRegister = vi.hoisted(() => vi.fn());

vi.mock("posthog-js", () => ({
  default: {
    capture: posthogCapture,
    identify: posthogIdentify,
    init: posthogInit,
  },
}));

describe("product analytics", () => {
  beforeEach(() => {
    posthogCapture.mockReset();
    posthogIdentify.mockReset();
    posthogInit.mockReset();
    posthogRegister.mockReset();
    setAnalyticsClientForTesting(null);
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://example.test");
    vi.stubEnv("VITE_ENABLE_POSTHOG", "true");
  });

  afterEach(() => {
    setAnalyticsClientForTesting(null);
    vi.unstubAllEnvs();
  });

  it("drops fields outside the event allowlist", () => {
    setAnalyticsClientForTesting({ capture: posthogCapture });

    trackEvent({
      name: "lesson_opened",
      studyId: "study-1",
      courseId: "course-1",
      lessonId: "lesson-1",
      answerText: "private answer must stay local",
      lessonText: "private lesson prose must stay local",
    } as never);

    expect(posthogCapture).toHaveBeenCalledWith("lesson_opened", {
      studyId: "study-1",
      courseId: "course-1",
      lessonId: "lesson-1",
    });
    expect(posthogCapture.mock.calls[0]?.[1]).not.toHaveProperty("answerText");
    expect(posthogCapture.mock.calls[0]?.[1]).not.toHaveProperty("lessonText");
  });

  it("keeps account and purchase payloads free of private fields", async () => {
    setAnalyticsClientForTesting({ capture: posthogCapture });
    const identity = withProductAnalyticsIdentity(createMemoryIdentityPort());
    const payment = withProductAnalyticsPayment(
      createPaymentPort({
        identity: createMemoryIdentityPort({ id: "user-1", email: "learner@example.com" }),
        transport: null,
      }),
    );

    await identity.signUpWithEmail("learner@example.com", "password12");
    await identity.signInWithEmail("learner@example.com", "password12");
    await payment.initiatePurchase({ offerId: "starter-monthly" });

    expect(posthogCapture.mock.calls).toEqual([
      ["account_sign_up_started", {}],
      ["account_sign_up_completed", {}],
      ["account_sign_in", {}],
      ["purchase_requested", { offerId: "starter-monthly" }],
    ]);
    expect(JSON.stringify(posthogCapture.mock.calls)).not.toContain("learner@example.com");
    expect(JSON.stringify(posthogCapture.mock.calls)).not.toContain("password12");
  });

  it("identifies anonymous and formal sessions by auth user id, never email", async () => {
    setAnalyticsClientForTesting({ capture: posthogCapture, identify: posthogIdentify });
    const anonymous = createMemoryIdentityPort();
    const analyticsAnonymous = withProductAnalyticsIdentity(anonymous);

    await analyticsAnonymous.signInAnonymously();

    const formal = createMemoryIdentityPort({
      id: "00000000-0000-4000-8000-000000000001",
      email: "learner@example.com",
    });
    withProductAnalyticsIdentity(formal);

    expect(posthogIdentify.mock.calls).toEqual([
      ["memory:anonymous"],
      ["00000000-0000-4000-8000-000000000001"],
    ]);
    expect(JSON.stringify(posthogIdentify.mock.calls)).not.toContain("learner@example.com");
  });

  it("queues the auth user id until PostHog is ready", async () => {
    const identity = createMemoryIdentityPort({
      id: "00000000-0000-4000-8000-000000000003",
      email: "queued@example.com",
    });
    withProductAnalyticsIdentity(identity);

    posthogInit.mockImplementation((_key: string, options: unknown) => {
      const loaded = (
        options as { loaded?: (posthog: { register: typeof posthogRegister }) => void }
      ).loaded;
      loaded?.({ register: posthogRegister });
    });

    await initProductAnalytics();

    expect(posthogIdentify).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000003");
    expect(JSON.stringify(posthogIdentify.mock.calls)).not.toContain("queued@example.com");
  });

  it("reports a review only after the rating is saved", async () => {
    setAnalyticsClientForTesting({ capture: posthogCapture });
    let saved = false;
    const review = withProductAnalyticsReview(
      {
        async reveal() {
          return { back: null };
        },
        async rate() {
          saved = true;
          return { dueAt: "2026-08-28T00:00:00.000Z" };
        },
      },
      () => 3,
    );

    await review.rate(
      {
        kind: "course-card",
        studyId: "study-1",
        courseId: "course-1",
        unitId: "unit-1",
        lessonId: "lesson-1",
        cardId: "card-1",
        front: "private card front",
        contentRevision: 1,
      },
      3,
    );

    expect(saved).toBe(true);
    expect(posthogCapture).toHaveBeenCalledWith("review_graded", {
      rating: "good",
      cardCount: 3,
      cardKind: "course-card",
    });
  });

  it("separates a returning teach-back card from every other returning card", async () => {
    setAnalyticsClientForTesting({ capture: posthogCapture });
    const review = withProductAnalyticsReview(
      {
        async reveal() {
          return { back: null };
        },
        async rate() {
          return { dueAt: "2026-08-28T00:00:00.000Z" };
        },
      },
      () => 1,
    );

    await review.rate(
      {
        kind: "recap-card",
        studyId: "study-1",
        courseId: "course-1",
        unitId: "unit-1",
        lessonId: "lesson-1",
        cardId: RECAP_CARD_ID,
        front: "the unit capability sentence",
        contentRevision: 1,
      },
      3,
    );

    expect(posthogCapture).toHaveBeenCalledWith("review_graded", {
      rating: "good",
      cardCount: 1,
      cardKind: "recap-card",
    });
  });

  it("reports a teach-back save once, and never its text", () => {
    setAnalyticsClientForTesting({ capture: posthogCapture });
    const locator = {
      studyId: "study-1",
      courseId: "course-1",
      unitId: "unit-1",
      lessonId: "lesson-1",
    };
    let stored: string | undefined;
    // Only the two methods the wrapper touches. A full port here would be a
    // second implementation of the store, which is what the wrapper exists to
    // avoid needing.
    const progress = withProductAnalyticsProgress({
      createRecapCard(input: RecapCardInput) {
        stored = input.answer;
      },
      recapCard: () => (stored === undefined ? undefined : ({ answer: stored } as never)),
    } as unknown as ProgressPort);

    progress.createRecapCard({
      locator,
      contentRevision: 1,
      commandId: "command-1",
      answer: "在我自己的话里，这一单元讲的是……",
    });
    progress.createRecapCard({
      locator,
      contentRevision: 1,
      commandId: "command-2",
      answer: "第二次保存不该再算一次",
    });

    const saves = posthogCapture.mock.calls.filter(([name]) => name === "recap_saved");
    expect(saves).toHaveLength(1);
    expect(saves[0]?.[1]).toEqual({
      studyId: "study-1",
      courseId: "course-1",
      lessonId: "lesson-1",
    });
  });

  it("lazy-loads PostHog, registers the surface, and flushes queued events", async () => {
    posthogInit.mockImplementation((_key: string, options: unknown) => {
      const loaded = (
        options as { loaded?: (posthog: { register: typeof posthogRegister }) => void }
      ).loaded;
      loaded?.({ register: posthogRegister });
    });

    const initializing = initProductAnalytics();
    trackEvent({ name: "course_opened", studyId: "study-1", courseId: "course-1" });
    await initializing;

    expect(posthogInit).toHaveBeenCalledWith(
      "phc_test_key",
      expect.objectContaining({
        api_host: "https://example.test",
        autocapture: false,
        capture_pageview: true,
        disable_session_recording: true,
      }),
    );
    expect(posthogRegister).toHaveBeenCalledWith({
      product: "university",
      surface: "delivery",
    });
    expect(posthogCapture).toHaveBeenCalledWith("course_opened", {
      studyId: "study-1",
      courseId: "course-1",
    });
  });

  it("caps the pending queue at 24 events", async () => {
    posthogInit.mockImplementation((_key: string, options: unknown) => {
      const loaded = (
        options as { loaded?: (posthog: { register: typeof posthogRegister }) => void }
      ).loaded;
      loaded?.({ register: posthogRegister });
    });

    for (let index = 0; index < 30; index += 1) trackEvent({ name: "app_open" });
    await initProductAnalytics();

    expect(posthogCapture).toHaveBeenCalledTimes(24);
  });

  it("does nothing quietly when no key is configured", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await initProductAnalytics();
    trackEvent({ name: "app_open" });

    expect(posthogInit).not.toHaveBeenCalled();
    expect(posthogCapture).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
