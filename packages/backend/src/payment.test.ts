import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  createSupabasePaymentRemote,
  UNIVERSITY_PAYMENT_APP_ID,
  UNIVERSITY_PLAN_GRANT_READ_RPC,
} from "./payment.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";

function fakeClient(
  calls: Array<{ readonly name: string; readonly args: Record<string, unknown> }>,
  schemaCalls: string[] = [],
  entitlementRow: Record<string, unknown> = {
    plan_id: "free",
    valid_from: null,
    valid_until: null,
  },
) {
  const rpc = async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === UNIVERSITY_PLAN_GRANT_READ_RPC) {
      return { data: [entitlementRow], error: null };
    }
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
  };
  return {
    rpc,
    schema: (name: string) => {
      schemaCalls.push(name);
      return { rpc };
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

  it("reads a non-member from the shared University plan-grant RPC", async () => {
    const calls: Array<{ readonly name: string; readonly args: Record<string, unknown> }> = [];
    const schemaCalls: string[] = [];
    const remote = createSupabasePaymentRemote(fakeClient(calls, schemaCalls));

    await expect(remote.readEntitlement?.(USER_ID)).resolves.toEqual({ planId: "free" });
    expect(schemaCalls).toEqual(["university"]);
    expect(calls).toContainEqual({
      name: UNIVERSITY_PLAN_GRANT_READ_RPC,
      args: { p_user_id: USER_ID },
    });
  });

  it("keeps the plan-grant read account-bound instead of returning another user's grant", async () => {
    const calls: Array<{ readonly name: string; readonly args: Record<string, unknown> }> = [];
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === UNIVERSITY_PLAN_GRANT_READ_RPC && args.p_user_id !== USER_ID) {
        return { data: null, error: new Error("plan grant is not visible to this account") };
      }
      return {
        data: [
          {
            plan_id: "member",
            valid_from: "2026-08-30T00:00:00.000Z",
            valid_until: null,
          },
        ],
        error: null,
      };
    });
    const client = {
      rpc,
      schema: () => ({ rpc }),
    } as unknown as SupabaseClient;
    const remote = createSupabasePaymentRemote(client);

    await expect(remote.readEntitlement?.(USER_ID)).resolves.toEqual({ planId: "member" });
    await expect(remote.readEntitlement?.(OTHER_USER_ID)).rejects.toThrow(
      "plan grant is not visible to this account",
    );
    expect(calls).toEqual([
      { name: UNIVERSITY_PLAN_GRANT_READ_RPC, args: { p_user_id: USER_ID } },
      { name: UNIVERSITY_PLAN_GRANT_READ_RPC, args: { p_user_id: OTHER_USER_ID } },
    ]);
  });
});
