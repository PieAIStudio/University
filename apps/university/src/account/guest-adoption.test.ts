import { describe, expect, it, vi } from "vitest";
import {
  createIdentityPort,
  createMemoryPersistence,
  createProgressPort,
  lessonKey,
} from "@pieai/university-core";
import { bindProgressToIdentity } from "./session.js";
import { createGuestAdoption } from "./guest-adoption.js";

type IdentityAuthSession = NonNullable<
  Awaited<ReturnType<NonNullable<Parameters<typeof createIdentityPort>[0]>["getSession"]>>
>;

const session = (id: string, anonymous = true): IdentityAuthSession => ({
  user: { id, is_anonymous: anonymous },
});
function setup() {
  let event: (session: IdentityAuthSession | null) => void = () => {};
  let finish: (session: IdentityAuthSession | null) => void = () => {};
  const identity = createIdentityPort({
    getSession: async () => null,
    getAccessToken: async () => null,
    onAuthStateChange: (listener) => {
      event = listener;
      return { unsubscribe() {} };
    },
    signInAnonymously: vi.fn(
      () =>
        new Promise<IdentityAuthSession | null>((resolve) => {
          finish = resolve;
        }),
    ),
    signInWithEmail: async () => session("email", false),
    signUpWithEmail: async () => session("email", false),
    requestMagicLink: async () => {},
    linkEmail: async () => session("email", false),
    signOut: async () => {},
  });
  const progress = createProgressPort({ persistence: createMemoryPersistence() });
  const adoption = createGuestAdoption(identity, progress);
  const stopAdoption = adoption.connect();
  const stopBinding = bindProgressToIdentity(progress, identity, null);
  progress.confirmLessonRead(lessonKey("s", "c", "l"), 1);
  progress.addXp("earned-on-device", 25);
  return {
    identity,
    progress,
    adoption,
    event: (value: IdentityAuthSession | null) => event(value),
    finish: (value: IdentityAuthSession | null) => finish(value),
    close: () => {
      stopBinding();
      stopAdoption();
    },
  };
}
describe("explicit guest adoption is the only account transition preserving presentation", () => {
  it("keeps one scope through the actual SDK event and verified creation result, without mistaking the empty cache for a completed transfer", async () => {
    const f = setup();
    const scope = f.adoption.getSnapshot().scope;
    const job = f.adoption.create();
    f.event(session("new-guest"));
    expect(f.progress.syncState().userId).toBe("new-guest");
    expect(f.adoption.getSnapshot().scope).toBe(scope);
    expect(f.adoption.getSnapshot().ready).toBe(false);
    expect(f.progress.snapshot().totalXp).toBe(0);
    f.finish(session("new-guest"));
    await job;
    expect(f.adoption.getSnapshot().scope).toBe(scope);
    expect(f.adoption.getSnapshot().ready).toBe(true);
    expect(f.progress.snapshot().xpEvents["earned-on-device"]).toBe(25);
    expect(f.progress.snapshot().lessons["s/c/l"].readConfirmed).toBe(true);
    f.close();
  });
  it("a restored anonymous account receives neither guest data nor the guest's scope", () => {
    const f = setup();
    const scope = f.adoption.getSnapshot().scope;
    f.event(session("restored"));
    expect(f.adoption.getSnapshot().scope).not.toBe(scope);
    expect(f.progress.snapshot().totalXp).toBe(0);
    f.close();
  });
  it("an unrelated anonymous SDK event cannot borrow the creation response to import the old guest", async () => {
    const f = setup();
    const scope = f.adoption.getSnapshot().scope;
    const job = f.adoption.create();
    f.event(session("unrelated"));
    f.finish(session("created"));
    await job;
    expect(f.adoption.getSnapshot().scope).not.toBe(scope);
    expect(f.progress.snapshot().totalXp).toBe(0);
    f.close();
  });
  it("switching to an email account during creation cancels the grant, including a late response", async () => {
    const f = setup();
    const scope = f.adoption.getSnapshot().scope;
    const job = f.adoption.create();
    f.event(session("email", false));
    f.finish(session("new-guest"));
    await job;
    expect(f.adoption.getSnapshot().scope).not.toBe(scope);
    expect(f.progress.syncState().userId).toBe("email");
    expect(f.progress.snapshot().totalXp).toBe(0);
    f.close();
  });
  it("failed optional creation keeps offline progress and its original scope", async () => {
    const f = setup();
    const scope = f.adoption.getSnapshot().scope;
    const job = f.adoption.create();
    f.finish(null);
    await job;
    expect(f.adoption.getSnapshot().scope).toBe(scope);
    expect(f.adoption.getSnapshot().ready).toBe(true);
    expect(f.progress.snapshot().xpEvents["earned-on-device"]).toBe(25);
    f.close();
  });
  it("logout and return to the same UUID do not resurrect an old presentation", async () => {
    const f = setup();
    const scope = f.adoption.getSnapshot().scope;
    const job = f.adoption.create();
    f.event(session("new-guest"));
    f.finish(session("new-guest"));
    await job;
    f.event(null);
    f.event(session("new-guest"));
    expect(f.adoption.getSnapshot().scope).not.toBe(scope);
    f.close();
  });
});
