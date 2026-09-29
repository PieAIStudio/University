import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => vi.useRealTimers());
const schedule = (callback: () => void, delayMs: number) => {
  const timer = setTimeout(callback, delayMs);
  return () => clearTimeout(timer);
};
import { createCosmeticsStore, type CosmeticsPersistence } from "./cosmetics-store.js";
import {
  CosmeticFailure,
  readCosmeticReceipt,
  type CosmeticCommand,
  type CosmeticState,
} from "../ports/cosmetics.js";

const A = "00000000-0000-4000-8000-000000000011";
const B = "00000000-0000-4000-8000-000000000012";
const ID = "00000000-0000-4000-8000-000000000013";
const state = (owner = A, revision = 0): CosmeticState => ({
  version: 1,
  userId: owner,
  revision,
  availablePacks: 1,
  openedPacks: 0,
  sinceEpic: 0,
  sinceLegendary: 0,
  fragments: 0,
  inventory: {},
  equipped: {},
  rulesReady: true,
  catalog: [
    {
      id: "avatar-flower",
      slot: "avatar",
      rarity: 0,
      duplicateFragments: 5,
      redeemCost: 50,
      inPacks: true,
    },
  ],
});
const opened = () => ({
  state: {
    ...state(A, 1),
    availablePacks: 0,
    openedPacks: 1,
    fragments: 10,
    inventory: { "avatar-flower": true },
  },
  result: {
    kind: "open",
    packNumber: 1,
    items: [
      { id: "avatar-flower", rarity: 0, duplicate: false, fragments: 0 },
      { id: "avatar-flower", rarity: 0, duplicate: true, fragments: 5 },
      { id: "avatar-flower", rarity: 0, duplicate: true, fragments: 5 },
    ],
  },
});
function persistence() {
  const saved = new Map<string, string>();
  const io: CosmeticsPersistence = {
    read: (owner, kind) => saved.get(`${owner}:${kind}`) ?? null,
    write: (owner, kind, value) => {
      saved.set(`${owner}:${kind}`, value);
    },
    removePending: (owner) => {
      saved.delete(`${owner}:pending`);
    },
  };
  return { saved, io };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
async function fixture(
  overrides: {
    persistence?: CosmeticsPersistence;
    execute?: (command: CosmeticCommand) => Promise<unknown>;
  } = {},
) {
  let owner: string | null = A;
  const memory = persistence();
  const execute = vi.fn(overrides.execute ?? (async () => opened()));
  const read = vi.fn(async (user: string) => ({ state: state(user), result: null }));
  const beforeClaim = vi.fn(async () => {});
  const uuid = vi.fn(() => ID);
  const store = createCosmeticsStore({
    schedule,
    remote: { read, execute },
    persistence: overrides.persistence ?? memory.io,
    beforeClaim,
    uuid,
    currentOwner: () => owner,
  });
  store.bind(A);
  await vi.waitFor(() => expect(store.snapshot().phase).toBe("ready"));
  return {
    store,
    read,
    execute,
    beforeClaim,
    uuid,
    memory,
    switchOwner(next: string | null) {
      owner = next;
      store.bind(next);
    },
  };
}

describe("cosmetic outbox, never a browser lottery", () => {
  it("closed and guest surfaces make no request and invent no inventory", async () => {
    const io = persistence();
    const currentOwner = () => A;
    const store = createCosmeticsStore({
      schedule,
      remote: null,
      persistence: io.io,
      currentOwner,
      beforeClaim: async () => {},
      uuid: () => ID,
    });
    store.bind(A);
    await store.act({ kind: "open" });
    expect(store.snapshot()).toMatchObject({ phase: "closed", data: null, pending: null });
    expect(io.saved.size).toBe(0);
    store.dispose();
  });
  it("persists one command before invoking the server, then adopts only its receipt", async () => {
    const f = await fixture();
    f.execute.mockImplementation(async (command) => {
      expect(JSON.parse(f.memory.io.read(A, "pending")!)).toEqual(command);
      return opened();
    });
    await f.store.act({ kind: "open" });
    expect(f.execute).toHaveBeenCalledOnce();
    expect(f.execute.mock.calls[0]![0]).toEqual({
      version: 1,
      owner: A,
      operationId: ID,
      action: { kind: "open" },
    });
    expect(f.store.snapshot()).toMatchObject({
      phase: "ready",
      pending: null,
      data: { openedPacks: 1, fragments: 10 },
    });
    expect(f.memory.io.read(A, "pending")).toBeNull();
    f.store.dispose();
  });
  it("a lost response blocks new actions and retries the exact persisted command after reload", async () => {
    const f = await fixture({
      execute: async () => {
        throw new Error("response lost");
      },
    });
    await f.store.act({ kind: "open" });
    const command = f.execute.mock.calls[0]![0];
    await f.store.act({ kind: "open" });
    expect(f.execute).toHaveBeenCalledOnce();
    expect(f.store.snapshot().pending).toEqual(command);
    f.store.dispose();
    const recovered = await fixture({ persistence: f.memory.io });
    await recovered.store.retry();
    expect(recovered.execute.mock.calls[0]![0]).toEqual(command);
    expect(recovered.uuid).not.toHaveBeenCalled();
    expect(recovered.store.snapshot().pending).toBeNull();
    recovered.store.dispose();
  });
  it("cannot execute a draw whose command could not be durably stored", async () => {
    const memory = persistence();
    const f = await fixture({
      persistence: {
        ...memory.io,
        write(owner, kind, raw) {
          if (kind === "pending") throw new Error("full");
          memory.io.write(owner, kind, raw);
        },
      },
    });
    await f.store.act({ kind: "open" });
    expect(f.execute).not.toHaveBeenCalled();
    expect(f.store.snapshot().error).toBe("storage");
    f.store.dispose();
  });
  it("keeps an answered command when pending cleanup fails; another click cannot reroll", async () => {
    const memory = persistence();
    let fail = true;
    const f = await fixture({
      persistence: {
        ...memory.io,
        removePending(owner) {
          if (fail) throw new Error("storage");
          memory.io.removePending(owner);
        },
      },
    });
    await f.store.act({ kind: "open" });
    expect(f.store.snapshot()).toMatchObject({
      error: "storage",
      data: { openedPacks: 1 },
      pending: { operationId: ID },
    });
    await f.store.act({ kind: "open" });
    expect(f.execute).toHaveBeenCalledOnce();
    fail = false;
    await f.store.retry();
    expect(f.execute.mock.calls[1]![0].operationId).toBe(ID);
    expect(f.store.snapshot().pending).toBeNull();
    f.store.dispose();
  });
  it("rejects malformed outcomes and retains the uncertain command", async () => {
    const f = await fixture({
      execute: async () => ({ ...opened(), result: { ...opened().result, items: [] } }),
    });
    await f.store.act({ kind: "open" });
    expect(f.store.snapshot()).toMatchObject({
      error: "invalid-response",
      pending: { operationId: ID },
      data: { openedPacks: 0 },
    });
    f.store.dispose();
  });
  it("does not import a previous account's late result or pending command", async () => {
    const d = deferred<unknown>();
    const f = await fixture({ execute: () => d.promise });
    const work = f.store.act({ kind: "open" });
    f.switchOwner(B);
    await vi.waitFor(() => expect(f.store.snapshot().data?.userId).toBe(B));
    d.resolve(opened());
    await work;
    expect(f.store.snapshot()).toMatchObject({
      owner: B,
      pending: null,
      result: null,
      data: { userId: B, openedPacks: 0 },
    });
    expect(f.memory.io.read(A, "pending")).not.toBeNull();
    expect(f.memory.io.read(B, "pending")).toBeNull();
    f.store.dispose();
  });
  it("ignores a previous load after a scope switch and does not mutate after dispose", async () => {
    const old = deferred<unknown>();
    let owner = A;
    const execute = vi.fn(async () => opened());
    const store = createCosmeticsStore({
      schedule,
      remote: {
        read: async (user) => (user === A ? old.promise : { state: state(B), result: null }),
        execute,
      },
      persistence: persistence().io,
      currentOwner: () => owner,
      beforeClaim: async () => {},
      uuid: () => ID,
    });
    store.bind(A);
    owner = B;
    store.bind(B);
    await vi.waitFor(() => expect(store.snapshot().data?.userId).toBe(B));
    old.resolve({ state: state(A, 999), result: null });
    await Promise.resolve();
    expect(store.snapshot().data?.userId).toBe(B);
    store.dispose();
    await store.act({ kind: "open" });
    expect(execute).not.toHaveBeenCalled();
  });
  it("waits for progress synchronization before asking the server to claim", async () => {
    const f = await fixture({
      execute: async () => ({ state: state(), result: { kind: "claim", packs: 0, items: [] } }),
    });
    f.beforeClaim.mockRejectedValue(new CosmeticFailure("save-first", true));
    await f.store.act({ kind: "claim" });
    expect(f.execute).not.toHaveBeenCalled();
    expect(f.store.snapshot()).toMatchObject({ error: "save-first", pending: null });
    f.store.dispose();
  });
  it("blocks unreadable pending bytes rather than erasing proof of a possibly completed draw", async () => {
    const memory = persistence();
    memory.io.write(A, "pending", "{broken");
    const f = await fixture({ persistence: memory.io });
    await f.store.act({ kind: "open" });
    expect(f.execute).not.toHaveBeenCalled();
    expect(f.store.snapshot().error).toBe("storage");
    expect(memory.io.read(A, "pending")).toBe("{broken");
    f.store.dispose();
  });
  it("a hung response releases busy only for recovery of that exact operation", async () => {
    const delayed = deferred<unknown>();
    const f = await fixture({ execute: () => delayed.promise });
    vi.useFakeTimers();
    const original = f.store.act({ kind: "open" });
    expect(f.store.snapshot().busy).toBe(true);
    await vi.advanceTimersByTimeAsync(20_000);
    await original;
    expect(f.store.snapshot()).toMatchObject({
      busy: false,
      error: "network",
      pending: { operationId: ID },
    });
    await f.store.act({ kind: "open" });
    expect(f.execute).toHaveBeenCalledTimes(1);
    f.execute.mockResolvedValueOnce(opened());
    await f.store.retry();
    expect(f.execute.mock.calls[1]![0]).toEqual(f.execute.mock.calls[0]![0]);
    delayed.resolve(opened());
    await Promise.resolve();
    expect(f.store.snapshot()).toMatchObject({
      busy: false,
      pending: null,
      data: { openedPacks: 1 },
    });
    f.store.dispose();
  });
  it("rejects a receipt naming a future pack or unowned claimed item", () => {
    expect(() =>
      readCosmeticReceipt({ ...opened(), result: { ...opened().result, packNumber: 2 } }, A, {
        kind: "open",
      }),
    ).toThrow();
    expect(() =>
      readCosmeticReceipt(
        { state: state(), result: { kind: "claim", packs: 0, items: ["avatar-flower"] } },
        A,
        { kind: "claim" },
      ),
    ).toThrow();
  });
  it("denies unknown ownership, duplicate catalog entries and client-selected rarity", () => {
    expect(() =>
      readCosmeticReceipt(
        { state: { ...state(), equipped: { avatar: "avatar-flower" } }, result: null },
        A,
      ),
    ).toThrow();
    expect(() =>
      readCosmeticReceipt(
        { state: { ...state(), catalog: [...state().catalog, ...state().catalog] }, result: null },
        A,
      ),
    ).toThrow();
    expect(() => readCosmeticReceipt(opened(), B)).toThrow();
    expect(() =>
      readCosmeticReceipt(
        {
          ...opened(),
          result: {
            ...opened().result,
            items: opened().result.items.map((x) => ({ ...x, rarity: 3 })),
          },
        },
        A,
        { kind: "open" },
      ),
    ).toThrow();
  });
});
