import type { SupabaseClient } from "@supabase/supabase-js";
import { type FeedbackSubmission, type LessonRef } from "@pieai/university-core";
import { describe, expect, it } from "vitest";

import { createSupabaseFeedbackPort, FEEDBACK_COLUMNS } from "./feedback.js";

const LOCATOR: LessonRef = {
  studyId: "university",
  courseId: "foundations",
  unitId: "first-steps",
  lessonId: "hello-world",
};

const INPUT: FeedbackSubmission = {
  message: "这一节我没看懂",
  context: {
    locator: LOCATOR,
    contentRevision: 3,
    exerciseAttemptCount: 4,
    signedIn: true,
    route: "#/lesson/university/foundations/first-steps/hello-world",
    viewport: [390, 844],
  },
};

function fakeClient(options?: {
  readonly rows?: readonly unknown[];
  readonly calls?: Array<Record<string, unknown>>;
}) {
  const calls = options?.calls ?? [];
  const rows = [...(options?.rows ?? [])];
  const builder = {
    select(columns: string) {
      calls.push({ kind: "select", columns });
      return builder;
    },
    eq(column: string, value: string) {
      calls.push({ kind: "eq", column, value });
      return builder;
    },
    order(column: string, options: { readonly ascending: boolean }) {
      calls.push({ kind: "order", column, options });
      return Promise.resolve({ data: rows, error: null });
    },
    insert(values: Record<string, unknown>) {
      calls.push({ kind: "insert", values });
      return Promise.resolve({ data: null, error: null });
    },
  };
  const client = {
    schema(schema: string) {
      calls.push({ kind: "schema", schema });
      return {
        from(table: string) {
          calls.push({ kind: "from", table });
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("Supabase feedback port", () => {
  it("inserts only the allowlisted feedback context", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const { client } = fakeClient({ calls });
    const port = createSupabaseFeedbackPort(client, { readUserId: () => "user-1" });

    await port.submit(INPUT);

    expect(calls).toContainEqual({
      kind: "insert",
      values: {
        message: INPUT.message,
        study_id: "university",
        course_id: "foundations",
        unit_id: "first-steps",
        lesson_id: "hello-world",
        content_revision: 3,
        exercise_attempt_count: 4,
        signed_in: true,
        route: INPUT.context.route,
        viewport_width: 390,
        viewport_height: 844,
      },
    });
  });

  it("does not forward answer text, lesson prose, or email", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const { client } = fakeClient({ calls });
    const port = createSupabaseFeedbackPort(client, { readUserId: () => "user-1" });
    const unsafeCallerObject = {
      ...INPUT,
      answer: "答案原文不应外发",
      lessonBody: "课文正文不应外发",
      email: "learner@example.com",
    } as FeedbackSubmission;

    await port.submit(unsafeCallerObject);

    const inserted = calls.find((call) => call.kind === "insert")?.values;
    expect(inserted).toBeTruthy();
    expect(JSON.stringify(inserted)).not.toContain("答案原文不应外发");
    expect(JSON.stringify(inserted)).not.toContain("课文正文不应外发");
    expect(JSON.stringify(inserted)).not.toContain("learner@example.com");
    expect(FEEDBACK_COLUMNS).not.toMatch(/answer|lesson.*body|email/i);
  });

  it("reads only the signed-in learner's safe fields", async () => {
    const row = {
      id: "feedback-1",
      message: INPUT.message,
      study_id: LOCATOR.studyId,
      course_id: LOCATOR.courseId,
      unit_id: LOCATOR.unitId,
      lesson_id: LOCATOR.lessonId,
      content_revision: 3,
      exercise_attempt_count: 4,
      signed_in: true,
      route: INPUT.context.route,
      viewport_width: 390,
      viewport_height: 844,
      created_at: "2026-08-27T06:00:00.000Z",
      user_id: "user-1",
      email: "learner@example.com",
    };
    const calls: Array<Record<string, unknown>> = [];
    const { client } = fakeClient({ calls, rows: [row] });
    const port = createSupabaseFeedbackPort(client, { readUserId: () => "user-1" });

    await expect(port.readMine()).resolves.toEqual([
      {
        id: "feedback-1",
        message: INPUT.message,
        context: INPUT.context,
        createdAt: row.created_at,
      },
    ]);
    expect(JSON.stringify(calls)).not.toContain("learner@example.com");
    expect(calls).toContainEqual({ kind: "eq", column: "user_id", value: "user-1" });
  });
});
