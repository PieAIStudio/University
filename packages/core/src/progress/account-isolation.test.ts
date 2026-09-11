import { describe, expect, it } from "vitest";
import { createProgressPort } from "./port.js";
import { createMemoryPersistence, createMemoryRemoteStore } from "./memory.js";
import { lessonKey } from "./document.js";

describe("account-bound local cache", () => {
  it("A1 switching identities never carries another account's answers or progress", async () => {
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });
    const a = lessonKey("s", "c", "a");
    await port.bindAccount("alice", null);
    port.advanceLesson(a, 1);
    await port.bindAccount("bob", null);
    expect(port.lessonState(a).progress).toBe(0);
    await port.bindAccount(null, null);
    expect(port.lessonState(a).progress).toBe(0);
    await port.bindAccount("alice", null);
    expect(port.lessonState(a).progress).toBe(1);
    const reloaded = createProgressPort({ persistence });
    expect(reloaded.lessonState(a).progress).toBe(0);
    await reloaded.bindAccount("alice", null);
    expect(reloaded.lessonState(a).progress).toBe(1);
  });
  it("A2 adopting a guest session is explicit, retains its work and does not leak it on logout", async () => {
    const port = createProgressPort({ persistence: createMemoryPersistence() });
    const key = lessonKey("s", "c", "guest");
    port.advanceLesson(key, 0.5);
    await port.bindAccount("existing-account", null);
    expect(port.lessonState(key).progress).toBe(0);
    await port.bindAccount(null, null);
    expect(port.lessonState(key).progress).toBe(0.5);
    await port.bindAccount("new-anonymous-account", null, { adoptGuest: true });
    expect(port.lessonState(key).progress).toBe(0.5);
    await port.bindAccount(null, null);
    expect(port.lessonState(key).progress).toBe(0);
  });
  it("A3 a delayed former-account read cannot enter or upload through a new account", async () => {
    const remote = createMemoryRemoteStore();
    const a = createProgressPort({ persistence: createMemoryPersistence() });
    await a.bindAccount("alice", remote);
    a.advanceLesson(lessonKey("s", "c", "private"), 1);
    await a.flush();
    let finish!: () => void;
    const wait = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const port = createProgressPort({ persistence: createMemoryPersistence() });
    const first = port.bindAccount("alice", {
      ...remote,
      load: async (id) => {
        await wait;
        return remote.load(id);
      },
    });
    const second = port.bindAccount("bob", remote);
    finish();
    await Promise.all([first, second]);
    await port.flush();
    expect(port.lessonState(lessonKey("s", "c", "private")).progress).toBe(0);
    expect(Object.keys(remote.records.get("bob")?.lessons ?? {})).toEqual([]);
  });
});
