import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseCosmeticsRemote } from "./cosmetics.js";

const owner = "00000000-0000-4000-8000-000000000011";
const operationId = "00000000-0000-4000-8000-000000000012";
const command = { version: 1 as const, owner, operationId, action: { kind: "open" as const } };
function client(result: unknown) {
  const rpc = vi.fn(async () => result);
  const schema = vi.fn(() => ({ rpc }));
  return {
    rpc,
    schema,
    adapter: createSupabaseCosmeticsRemote({ schema } as unknown as SupabaseClient),
  };
}
it("addresses only the University RPC with exact owner, operation and allowed action data", async () => {
  const f = client({ data: { marker: "server" }, error: null });
  expect(await f.adapter.read(owner)).toEqual({ marker: "server" });
  await f.adapter.execute(command);
  expect(f.schema).toHaveBeenCalledWith("university");
  expect(f.rpc.mock.calls).toEqual([
    [
      "cosmetics",
      { p_action: "read", p_operation_id: null, p_payload: {}, p_expected_user_id: owner },
    ],
    [
      "cosmetics",
      { p_action: "open", p_operation_id: operationId, p_payload: {}, p_expected_user_id: owner },
    ],
  ]);
});
it("refuses injected client outcomes before any network call", async () => {
  const f = client({ data: null, error: null });
  await expect(
    f.adapter.execute({
      ...command,
      action: { ...command.action, outcomes: ["legendary"] },
    } as typeof command),
  ).rejects.toMatchObject({ kind: "request", definitive: true });
  expect(f.rpc).not.toHaveBeenCalled();
});
it.each([
  ["PT401", "account identity changed", "identity", true],
  ["PT409", "no earned pack", "no-pack", true],
  ["PT409", "not enough fragments", "fragments", true],
  ["PT409", "operation payload changed", "request", true],
  ["PT429", "capacity", "capacity", true],
  ["PGRST202", "missing", "unavailable", true],
  ["57014", "statement interrupted", "network", false],
  ["", "Failed to fetch", "network", false],
])(
  "classifies %s without erasing an uncertain command",
  async (code, message, kind, definitive) => {
    const f = client({ data: null, error: { code, message } });
    await expect(f.adapter.execute(command)).rejects.toMatchObject({ kind, definitive });
  },
);
