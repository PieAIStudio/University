import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyProgress } from "@pieai/university-core";
import { describe, expect, it } from "vitest";

import { createSupabaseProgressRemoteStore } from "./progress-remote";

type QueryBuilder = {
  select(columns: string): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  maybeSingle<T>(): Promise<{ data: T | null; error: Error | null }>;
  update(values: unknown): QueryBuilder;
  insert(values: unknown): Promise<{ error: Error | null }>;
};

function fakeClient(rows: unknown[]) {
  const calls: Array<Record<string, unknown>> = [];
  const builder: QueryBuilder = {
    select(columns) {
      calls.push({ kind: "select", columns });
      return builder;
    },
    eq(column, value) {
      calls.push({ kind: "eq", column, value });
      return builder;
    },
    maybeSingle() {
      calls.push({ kind: "maybeSingle" });
      return Promise.resolve({ data: (rows.shift() ?? null) as never, error: null });
    },
    update(values) {
      calls.push({ kind: "update", values });
      return builder;
    },
    insert(values) {
      calls.push({ kind: "insert", values });
      return Promise.resolve({ error: null });
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

describe("createSupabaseProgressRemoteStore", () => {
  it("loads and parses the document through the University schema", async () => {
    const document = emptyProgress();
    document.streak = { days: 3, lastDay: "2026-08-24" };
    const { client, calls } = fakeClient([{ document }]);
    const remote = createSupabaseProgressRemoteStore(client);

    await expect(remote.load("user-1")).resolves.toEqual(document);
    expect(calls).toEqual([
      { kind: "schema", schema: "university" },
      { kind: "from", table: "progress" },
      { kind: "select", columns: "document" },
      { kind: "eq", column: "user_id", value: "user-1" },
      { kind: "maybeSingle" },
    ]);
  });

  it("increments the server revision before saving the merged document", async () => {
    const document = emptyProgress();
    const { client, calls } = fakeClient([
      { document: emptyProgress(), revision: "4" },
      { revision: 5 },
    ]);
    const remote = createSupabaseProgressRemoteStore(client);

    await remote.save("user-1", document);

    expect(calls).toContainEqual({
      kind: "update",
      values: { document, revision: 5 },
    });
    expect(calls).toContainEqual({ kind: "eq", column: "revision", value: 4 });
  });
});
