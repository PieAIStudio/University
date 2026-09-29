import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CosmeticCommandSchema,
  CosmeticFailure,
  type CosmeticsRemote,
} from "@pieai/university-core";

/** The sole Data API adapter; the app decides when the separately released
 * service is available. Server errors carry no raw learner data into the UI. */
export function createSupabaseCosmeticsRemote(client: SupabaseClient): CosmeticsRemote {
  async function request(
    action: string,
    operationId: string | null,
    payload: object,
    owner: string,
  ) {
    const { data, error } = await client.schema("university").rpc("cosmetics", {
      p_action: action,
      p_operation_id: operationId,
      p_payload: payload,
      p_expected_user_id: owner,
    });
    if (error) {
      if (error.code === "PGRST202" || error.code === "42883")
        throw new CosmeticFailure("unavailable", true);
      if (error.code === "PT401") throw new CosmeticFailure("identity", true);
      if (error.code === "PT429") throw new CosmeticFailure("capacity", true);
      if (error.code === "PT409" && error.message === "no earned pack")
        throw new CosmeticFailure("no-pack", true);
      if (error.code === "PT409" && error.message === "not enough fragments")
        throw new CosmeticFailure("fragments", true);
      if (["PT400", "PT403", "PT409"].includes(error.code))
        throw new CosmeticFailure("request", true);
      // A timeout or proxy failure does not prove the transaction rolled back.
      throw new CosmeticFailure("network");
    }
    return data;
  }
  return {
    read: (owner) => request("read", null, {}, owner),
    execute: async (value) => {
      const checked = CosmeticCommandSchema.safeParse(value);
      if (!checked.success) throw new CosmeticFailure("request", true);
      const { action, owner, operationId } = checked.data;
      const { kind, ...payload } = action;
      return request(kind, operationId, payload, owner);
    },
  };
}
