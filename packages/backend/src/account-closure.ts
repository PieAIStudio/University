import type { SupabaseClient } from "@supabase/supabase-js";

/** Product-data closure is a Backend RPC, not another authentication SDK. */
export const ACCOUNT_CLOSURE_CONFIRMATION = "REQUEST ACCOUNT DELETION";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AccountClosureResult = {
  readonly status: "review-required";
  readonly operationId: string;
};

export class AccountClosureError extends Error {
  constructor(
    readonly code: "confirmation-required" | "reauthentication-required" | "unavailable",
  ) {
    super(code);
    this.name = "AccountClosureError";
  }
}

export interface AccountClosurePort {
  request(
    expectedUserId: string,
    operationId: string,
    confirmation: string,
  ): Promise<AccountClosureResult>;
}

/**
 * The server resolves auth.uid(), live session and recent authentication.
 * expectedUserId is an equality precondition, never deletion authority: the
 * server must compare it with auth.uid(). It prevents a concurrent account
 * switch from applying an earlier person's confirmation to the new account.
 * An accepted review is not a completed account deletion.
 */
export function createAccountClosurePort(client: SupabaseClient): AccountClosurePort {
  return {
    async request(expectedUserId, operationId, confirmation) {
      if (
        !UUID.test(expectedUserId) ||
        !UUID.test(operationId) ||
        confirmation !== ACCOUNT_CLOSURE_CONFIRMATION
      ) {
        throw new AccountClosureError("confirmation-required");
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const { data, error } = await client
          .schema("university")
          .rpc("request_account_deletion", {
            p_operation_id: operationId,
            p_confirmation: confirmation,
            p_expected_user_id: expectedUserId,
          })
          .abortSignal(controller.signal);
        if (error) {
          throw new AccountClosureError(
            error.code === "PT401" || error.code === "28000"
              ? "reauthentication-required"
              : "unavailable",
          );
        }
        if (
          !data ||
          typeof data !== "object" ||
          Array.isArray(data) ||
          data.status !== "review-required" ||
          typeof data.operationId !== "string" ||
          !UUID.test(data.operationId)
        ) {
          throw new AccountClosureError("unavailable");
        }
        return { status: "review-required", operationId: data.operationId };
      } catch (error) {
        if (error instanceof AccountClosureError) throw error;
        // A timed-out reply is unconfirmed, not proof the request failed to
        // reach the server. The server returns the original request on retry.
        throw new AccountClosureError("unavailable");
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
