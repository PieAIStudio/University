import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { createSupabasePaymentRemote, UNIVERSITY_PAYMENT_APP_ID } from "./payment.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";

function fakeClient(
  calls: Array<{ readonly name: string; readonly args: Record<string, unknown> }>,
) {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return {
        data: [
          {
            available_power_units: "900",
            balance_power_units: "1000",
            reserved_power_units: "100",
          },
        ],
        error: null,
      };
    },
  } as unknown as SupabaseClient;
}

describe("createSupabasePaymentRemote", () => {
  it("uses the shared balance RPC and no browser-side wallet mutation", async () => {
    const calls: Array<{ readonly name: string; readonly args: Record<string, unknown> }> = [];
    const remote = createSupabasePaymentRemote(fakeClient(calls));

    await expect(remote.readBalance?.(USER_ID)).resolves.toEqual({
      availablePowerUnits: "900",
      balancePowerUnits: "1000",
      reservedPowerUnits: "100",
    });
    expect(calls).toEqual([
      {
        name: "wallet_get_balance",
        args: { p_app_id: UNIVERSITY_PAYMENT_APP_ID, p_user_id: USER_ID },
      },
    ]);
    expect(
      calls.every(
        ({ name }) =>
          !["wallet_grant", "wallet_reserve", "wallet_commit", "wallet_refund"].includes(name),
      ),
    ).toBe(true);
  });
});
