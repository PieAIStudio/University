import { afterEach, describe, expect, it, vi } from "vitest";

import { createIdentityPort, createMemoryIdentityPort } from "../ports/identity.js";
import { emptyProgress, lessonKey, parseProgress } from "./document.js";
import { createMemoryPersistence, createMemoryRemoteStore } from "./memory.js";
import { createProgressPort } from "./port.js";

const LESSON = lessonKey("turing-pact", "foundations-before-zero", "you-already-know-apps");
const CARDS = ["what-is-an-app", "files-on-a-screen"] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

function learnOneLesson(port: ReturnType<typeof createProgressPort>) {
  port.advanceLesson(LESSON, 1);
  port.dropCards("turing-pact", "foundations-before-zero", "you-already-know-apps", CARDS);
}

function spyConsole() {
  return {
    log: vi.spyOn(console, "log").mockImplementation(() => undefined),
    info: vi.spyOn(console, "info").mockImplementation(() => undefined),
    warn: vi.spyOn(console, "warn").mockImplementation(() => undefined),
    error: vi.spyOn(console, "error").mockImplementation(() => undefined),
    debug: vi.spyOn(console, "debug").mockImplementation(() => undefined),
  };
}

function expectConsoleClean(spies: ReturnType<typeof spyConsole>) {
  expect(spies.log).not.toHaveBeenCalled();
  expect(spies.info).not.toHaveBeenCalled();
  expect(spies.warn).not.toHaveBeenCalled();
  expect(spies.error).not.toHaveBeenCalled();
  expect(spies.debug).not.toHaveBeenCalled();
}

describe("account is optional, progress is local-first", () => {
  it("1. no backend configured: a lesson still saves locally and the console stays quiet", async () => {
    const spies = spyConsole();
    const identity = createIdentityPort(null);
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });

    expect(identity.status().kind).toBe("unconfigured");
    learnOneLesson(port);

    const stored = parseProgress(persistence.raw());
    expect(stored.lessons[LESSON]?.progress).toBe(1);
    expect(stored.lessons[LESSON]?.completedAt).not.toBeNull();
    expect(Object.keys(stored.cards)).toHaveLength(2);
    expect(identity.status().kind).toBe("unconfigured");
    expect(port.syncState().userId).toBeNull();
    expectConsoleClean(spies);

    await identity.signInWithEmail("nobody@example.com", "not-a-real-password");
    expect(identity.status().kind).toBe("unconfigured");
    expect(await identity.readAccessToken()).toBeNull();
    expectConsoleClean(spies);
  });

  it("2. backend configured but nobody signed in: identical to the unconfigured path", () => {
    const spies = spyConsole();
    const identity = createMemoryIdentityPort();
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });

    expect(identity.status().kind).toBe("signed_out");
    learnOneLesson(port);

    expect(parseProgress(persistence.raw()).lessons[LESSON]?.progress).toBe(1);
    expect(port.syncState().userId).toBeNull();
    expect(port.snapshot()).toEqual(parseProgress(persistence.raw()));
    expectConsoleClean(spies);
  });

  it("3. sign-in uploads local progress instead of overwriting it", async () => {
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });
    const identity = createMemoryIdentityPort();
    const remote = createMemoryRemoteStore();

    learnOneLesson(port);
    const localBefore = structuredClone(port.snapshot());

    remote.records.set("memory:ada@example.com", emptyProgress());
    await identity.signInWithEmail("ada@example.com", "password12");
    const status = identity.status();
    expect(status.kind).toBe("signed_in");
    if (status.kind !== "signed_in") throw new Error("expected signed_in");

    await port.bindAccount(status.user.id, remote);

    expect(port.snapshot().lessons[LESSON]?.progress).toBe(1);
    expect(remote.records.get(status.user.id)?.lessons[LESSON]?.progress).toBe(1);
    expect(Object.keys(port.snapshot().cards)).toEqual(Object.keys(localBefore.cards));
    expect(port.snapshot().lessons[LESSON]?.completedAt).toBe(
      localBefore.lessons[LESSON]?.completedAt,
    );
  });

  it("4. two machines that forked merge by the documented rules", async () => {
    const remote = createMemoryRemoteStore();
    const userId = "memory:ada@example.com";

    const phone = createProgressPort({ persistence: createMemoryPersistence() });
    phone.advanceLesson(LESSON, 1);
    phone.dropCards("turing-pact", "foundations-before-zero", "you-already-know-apps", [
      "only-on-phone",
    ]);
    await phone.bindAccount(userId, remote);

    const laptop = createProgressPort({ persistence: createMemoryPersistence() });
    const other = lessonKey("turing-pact", "foundations-before-zero", "app-is-a-pile-of-files");
    laptop.advanceLesson(other, 1);
    laptop.dropCards("turing-pact", "foundations-before-zero", "app-is-a-pile-of-files", [
      "only-on-laptop",
    ]);
    laptop.advanceLesson(LESSON, 0.4);
    await laptop.bindAccount(userId, remote);

    const merged = laptop.snapshot();
    expect(merged.lessons[LESSON]?.progress).toBe(1);
    expect(merged.lessons[other]?.progress).toBe(1);
    expect(
      merged.cards["turing-pact/foundations-before-zero/you-already-know-apps/only-on-phone"],
    ).toBeDefined();
    expect(
      merged.cards["turing-pact/foundations-before-zero/app-is-a-pile-of-files/only-on-laptop"],
    ).toBeDefined();
    expect(remote.records.get(userId)?.lessons[LESSON]?.progress).toBe(1);
  });

  it("5. signed in and offline, a lesson still saves, and coming back online pushes it", async () => {
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });
    const remote = createMemoryRemoteStore();
    const userId = "memory:ada@example.com";

    remote.goOffline();
    await port.bindAccount(userId, remote);

    learnOneLesson(port);
    await port.flush();

    expect(port.snapshot().lessons[LESSON]?.progress).toBe(1);
    expect(parseProgress(persistence.raw()).lessons[LESSON]?.progress).toBe(1);
    expect(remote.records.get(userId)?.lessons[LESSON]).toBeUndefined();
    expect(port.syncState().status).toBe("offline");
    expect(port.syncState().dirty).toBe(true);

    remote.goOnline();
    await port.flush();

    expect(port.syncState().status).toBe("idle");
    expect(port.syncState().dirty).toBe(false);
    expect(remote.records.get(userId)?.lessons[LESSON]?.progress).toBe(1);
  });

  it("6. sign-out keeps local progress: wiping it would throw away the lesson they just finished", async () => {
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });
    const identity = createMemoryIdentityPort();
    const remote = createMemoryRemoteStore();

    await identity.signInWithEmail("ada@example.com", "password12");
    const status = identity.status();
    if (status.kind !== "signed_in") throw new Error("expected signed_in");
    await port.bindAccount(status.user.id, remote);
    learnOneLesson(port);
    await port.flush();

    await identity.signOut();
    await port.bindAccount(null, null);

    expect(identity.status().kind).toBe("signed_out");
    expect(port.snapshot().lessons[LESSON]?.progress).toBe(1);
    expect(parseProgress(persistence.raw()).lessons[LESSON]?.progress).toBe(1);
    expect(port.syncState().userId).toBeNull();
    expect(port.syncState().status).toBe("idle");
    expect(remote.records.get(status.user.id)?.lessons[LESSON]?.progress).toBe(1);
  });
});
