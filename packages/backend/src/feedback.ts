import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FeedbackContext,
  FeedbackPort,
  FeedbackReceipt,
  FeedbackRecord,
  FeedbackReviewSource,
  FeedbackSubmission,
} from "@pieai/university-core";

/** The only columns the browser is allowed to read back. `user_id` stays server-side. */
export const FEEDBACK_COLUMNS =
  "id, message, study_id, course_id, unit_id, lesson_id, content_revision, exercise_attempt_count, signed_in, route, viewport_width, viewport_height, created_at";

export interface SupabaseFeedbackPortOptions {
  /** Returns the auth id without returning or forwarding the account email. */
  readonly readUserId: () => string | null | Promise<string | null>;
}

type FeedbackRow = {
  readonly id: string;
  readonly message: string;
  readonly study_id: string | null;
  readonly course_id: string | null;
  readonly unit_id: string | null;
  readonly lesson_id: string | null;
  readonly content_revision: number | null;
  readonly exercise_attempt_count: number;
  readonly signed_in: boolean;
  readonly route: string;
  readonly viewport_width: number;
  readonly viewport_height: number;
  readonly created_at: string;
};

function feedbackTable(client: SupabaseClient) {
  return client.schema("university").from("feedback");
}

function rowFor(input: FeedbackSubmission): Record<string, unknown> {
  const context = input.context;
  const locator = context.locator;
  return {
    message: input.message,
    study_id: locator?.studyId ?? null,
    course_id: locator?.courseId ?? null,
    unit_id: locator?.unitId ?? null,
    lesson_id: locator?.lessonId ?? null,
    content_revision: context.contentRevision,
    exercise_attempt_count: context.exerciseAttemptCount,
    signed_in: context.signedIn,
    route: context.route,
    viewport_width: context.viewport[0],
    viewport_height: context.viewport[1],
  };
}

function recordOf(row: FeedbackRow): FeedbackRecord {
  const locator = locatorOf(row);
  const context: FeedbackContext = {
    locator,
    contentRevision: row.content_revision,
    exerciseAttemptCount: row.exercise_attempt_count,
    signedIn: row.signed_in,
    route: row.route,
    viewport: [row.viewport_width, row.viewport_height],
  };
  return {
    id: row.id,
    message: row.message,
    context,
    createdAt: row.created_at,
  };
}

function locatorOf(row: FeedbackRow): FeedbackContext["locator"] {
  if (!row.study_id || !row.course_id || !row.unit_id || !row.lesson_id) return null;
  return {
    studyId: row.study_id,
    courseId: row.course_id,
    unitId: row.unit_id,
    lessonId: row.lesson_id,
  };
}

async function recordsFrom(query: PromiseLike<{ data: unknown; error: Error | null }>) {
  const { data, error } = await query;
  if (error) throw error;
  if (!Array.isArray(data)) return [] as readonly FeedbackRecord[];
  return data.map((row) => recordOf(row as FeedbackRow));
}

export function createSupabaseFeedbackPort(
  client: SupabaseClient,
  options: SupabaseFeedbackPortOptions,
): FeedbackPort {
  return {
    transport: "swimmer-backend",

    async submit(input): Promise<FeedbackReceipt> {
      // Do not use `.insert(input)` here. The allowlist is the privacy boundary:
      // an exercise answer, lesson body, or email cannot cross this adapter by
      // being added to a wider caller object.
      const { error } = await feedbackTable(client).insert(rowFor(input));
      if (error) throw error;
      return {
        id: null,
        submittedAt: new Date().toISOString(),
        transport: "swimmer-backend",
      };
    },

    async readMine() {
      const userId = await options.readUserId();
      if (!userId) return [];
      return recordsFrom(
        feedbackTable(client)
          .select(FEEDBACK_COLUMNS)
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      );
    },
  };
}

/** The studio's all-feedback read is a separate capability from learner history. */
export function createSupabaseFeedbackReviewSource(client: SupabaseClient): FeedbackReviewSource {
  return {
    listAll() {
      return recordsFrom(
        feedbackTable(client).select(FEEDBACK_COLUMNS).order("created_at", { ascending: false }),
      );
    },
    async listAnswerAggregates(_studyId: string) {
      // The existing progress row is one learner's document. Do not query all
      // raw documents from a browser and call that an owner dashboard. The
      // backend must expose an owner-only aggregate view/RPC first.
      throw new Error("SwimmerBackend 的答题汇总接口还没有接好。");
    },
  };
}
