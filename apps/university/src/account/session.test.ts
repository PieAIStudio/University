import { describe, expect, it, vi } from "vitest";

import {
  createMemoryIdentityPort,
  createMemoryPersistence,
  createMemoryRemoteStore,
  createProgressPort,
  lessonKey,
} from "@pieai/university-core";

import { bindProgressToIdentity } from "./session";

const LESSON = lessonKey("turing-pact", "foundations-before-zero", "you-already-know-apps");

describe("bindProgressToIdentity", () => {
  it("uploads local progress when the learner signs in", async () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    const identity = createMemoryIdentityPort();
    const remote = createMemoryRemoteStore();
    progress.advanceLesson(LESSON, 1);

    const stop = bindProgressToIdentity(progress, identity, remote);
    await identity.signInWithEmail("ada@example.com", "password12");
    await vi.waitFor(() => {
      const status = identity.status();
      expect(status.kind).toBe("signed_in");
      if (status.kind !== "signed_in") throw new Error("expected signed_in");
      expect(progress.syncState().userId).toBe(status.user.id);
    });
    await progress.flush();

    const status = identity.status();
    expect(status.kind).toBe("signed_in");
    if (status.kind !== "signed_in") throw new Error("expected signed_in");
    expect(remote.records.get(status.user.id)?.lessons[LESSON]?.progress).toBe(1);
    stop();
  });

  it("keeps local progress after sign-out", async () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    const identity = createMemoryIdentityPort();
    const remote = createMemoryRemoteStore();
    const stop = bindProgressToIdentity(progress, identity, remote);

    await identity.signInWithEmail("ada@example.com", "password12");
    await vi.waitFor(() => expect(progress.syncState().userId).toBe("memory:ada@example.com"));
    progress.advanceLesson(LESSON, 1);
    await progress.flush();
    await identity.signOut();
    await vi.waitFor(() => expect(progress.syncState().userId).toBeNull());
    await progress.flush();

    expect(progress.snapshot().lessons[LESSON]?.progress).toBe(1);
    stop();
  });
});
