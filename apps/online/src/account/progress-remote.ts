import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseProgress,
  type ProgressDocument,
  type ProgressRemoteStore,
} from "@pieai/university-core";

type ProgressRow = {
  readonly document: unknown;
};

type RevisionRow = {
  readonly revision: number | string | null;
};

/**
 * University owns this product-schema adapter; SwimmerBackend owns the schema
 * and the cross-product Auth client. The document remains the unit of sync so
 * the local-first merge contract stays identical on both shells.
 */
export function createSupabaseProgressRemoteStore(client: SupabaseClient): ProgressRemoteStore {
  const table = () => client.schema("university").from("progress");

  return {
    async load(userId): Promise<ProgressDocument | null> {
      const { data, error } = await table()
        .select("document")
        .eq("user_id", userId)
        .maybeSingle<ProgressRow>();
      if (error) throw error;
      if (!data) return null;

      const raw = JSON.stringify(data.document);
      return parseProgress(raw ?? null);
    },

    async save(userId, document): Promise<void> {
      const { data: current, error: readError } = await table()
        .select("revision")
        .eq("user_id", userId)
        .maybeSingle<RevisionRow>();
      if (readError) throw readError;

      const currentRevision = current?.revision == null ? 0 : Number(current.revision);
      if (
        !Number.isSafeInteger(currentRevision) ||
        currentRevision < 0 ||
        currentRevision >= Number.MAX_SAFE_INTEGER
      ) {
        throw new Error("progress revision is outside the browser-safe integer range");
      }
      const revision = currentRevision + 1;
      const { error: saveError } = await table().upsert(
        {
          user_id: userId,
          document,
          revision,
        },
        { onConflict: "user_id" },
      );
      if (saveError) throw saveError;
    },
  };
}
