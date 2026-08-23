import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCursorThrottle,
  createMemoryPresencePort,
  createRealtimePresencePort,
  CURSOR_BROADCAST_INTERVAL_MS,
  type PresenceCursor,
  type PresenceRealtimeChannel,
} from "./presence.js";

const here = dirname(fileURLToPath(import.meta.url));

const ADA = { userId: "ada", displayName: "Ada" };
const GRACE = { userId: "grace", displayName: "Grace" };
const LIN = { userId: "lin", displayName: "Lin" };

const AT_LESSON = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  lessonId: "you-already-know-apps",
};

const CURSOR: PresenceCursor = { x: 0.4, y: 0.5, viewKey: "world" };

describe("PresencePort", () => {
  it("is a pure contract: no React, no filesystem, no network library", () => {
    const src = readFileSync(join(here, "presence.ts"), "utf8");
    expect(src).not.toMatch(/from ["']react["']/);
    expect(src).not.toMatch(/from ["']node:fs["']/);
    expect(src).not.toMatch(/from ["']@supabase\//);
    expect(src).not.toMatch(/\bfetch\s*\(/);
  });
});

describe("createMemoryPresencePort", () => {
  it("lets a group-mate see where the other stopped, including while offline", () => {
    const ada = createMemoryPresencePort({
      self: ADA,
      seeAs: { grace: "group" },
    });
    const grace = createMemoryPresencePort({
      self: GRACE,
      bus: ada.bus,
      seeAs: { ada: "group" },
    });

    ada.publishLocation(AT_LESSON);
    ada.goOffline();

    const seen = grace.snapshot().peers.find((peer) => peer.userId === "ada");
    expect(seen).toEqual({
      userId: "ada",
      displayName: "Ada",
      relation: "group",
      online: false,
      location: AT_LESSON,
      cursor: null,
    });
  });

  it("shows a friend only online-or-not and which course, never the lesson or the cursor", () => {
    const ada = createMemoryPresencePort({
      self: ADA,
      seeAs: { lin: "friend" },
    });
    const lin = createMemoryPresencePort({
      self: LIN,
      bus: ada.bus,
      seeAs: { ada: "group" },
    });

    lin.publishLocation(AT_LESSON);
    lin.publishCursor(CURSOR);

    const seen = ada.snapshot().peers.find((peer) => peer.userId === "lin");
    expect(seen?.online).toBe(true);
    expect(seen?.location).toEqual({
      studyId: AT_LESSON.studyId,
      courseId: AT_LESSON.courseId,
      lessonId: null,
    });
    expect(seen?.cursor).toBeNull();
  });

  it("shows a group-mate's cursor only while they are online on the same view", () => {
    let clock = 0;
    const ada = createMemoryPresencePort({
      self: ADA,
      seeAs: { grace: "group" },
      now: () => clock,
    });
    const grace = createMemoryPresencePort({
      self: GRACE,
      bus: ada.bus,
      seeAs: { ada: "group" },
      now: () => clock,
    });

    grace.publishLocation(AT_LESSON);
    grace.publishCursor(CURSOR);
    expect(ada.snapshot().peers[0]?.cursor).toEqual(CURSOR);

    // Same-screen filtering is a view concern: the port reports the cursor
    // with its viewKey and does not know what the observer is looking at.
    clock += CURSOR_BROADCAST_INTERVAL_MS;
    grace.publishCursor({ ...CURSOR, viewKey: "course:other/other" });
    expect(ada.snapshot().peers[0]?.cursor?.viewKey).toBe("course:other/other");

    clock += CURSOR_BROADCAST_INTERVAL_MS;
    grace.publishCursor(CURSOR);
    grace.goOffline();
    expect(ada.snapshot().peers[0]?.cursor).toBeNull();
  });

  it("stops broadcasting when sharesPresence is turned off, and the other side loses the peer", () => {
    const ada = createMemoryPresencePort({
      self: ADA,
      seeAs: { grace: "group" },
    });
    const grace = createMemoryPresencePort({
      self: GRACE,
      bus: ada.bus,
      seeAs: { ada: "group" },
    });

    ada.publishLocation(AT_LESSON);
    expect(grace.snapshot().peers).toHaveLength(1);

    ada.setSharesPresence(false);
    expect(ada.snapshot().sharesPresence).toBe(false);
    expect(grace.snapshot().peers).toHaveLength(0);

    const cursorsBefore = ada.bus.cursorSends;
    ada.publishCursor(CURSOR);
    ada.publishLocation({
      studyId: "buzz",
      courseId: "buzz-orientation",
      lessonId: "channel-membership-gate",
    });
    expect(ada.bus.cursorSends).toBe(cursorsBefore);
    expect(ada.sent.cursors).toBe(0);
    expect(grace.snapshot().peers).toHaveLength(0);
  });

  it("throttles cursor publishes to 20 Hz so a 10s fling stays under 250 messages", () => {
    vi.useFakeTimers();
    const ada = createMemoryPresencePort({
      self: ADA,
      now: () => Date.now(),
    });
    const frames = Math.round(10_000 / 16);
    for (let i = 0; i < frames; i += 1) {
      ada.publishCursor({ x: i / frames, y: 0.5, viewKey: "world" });
      vi.advanceTimersByTime(16);
    }
    expect(ada.bus.cursorSends).toBeLessThan(250);
    expect(ada.bus.cursorSends).toBeGreaterThan(150);
    vi.useRealTimers();
  });
});

describe("createCursorThrottle", () => {
  it("keeps a trailing send so the cursor does not freeze short of the last point", () => {
    let now = 0;
    const sent: PresenceCursor[] = [];
    const scheduled: Array<{ at: number; fn: () => void }> = [];
    const throttle = createCursorThrottle({
      now: () => now,
      schedule: (fn, wait) => {
        scheduled.push({ at: now + wait, fn });
        return () => undefined;
      },
      send: (cursor) => sent.push(cursor),
    });

    throttle.offer({ x: 0, y: 0, viewKey: "world" });
    expect(sent).toHaveLength(1);
    now = 20;
    throttle.offer({ x: 0.5, y: 0.5, viewKey: "world" });
    expect(sent).toHaveLength(1);
    now = CURSOR_BROADCAST_INTERVAL_MS;
    const flushed = scheduled[0];
    expect(flushed).toBeDefined();
    flushed?.fn();
    expect(sent).toEqual([
      { x: 0, y: 0, viewKey: "world" },
      { x: 0.5, y: 0.5, viewKey: "world" },
    ]);
  });
});

describe("createRealtimePresencePort", () => {
  it("treats a missing channel as unconfigured and never talks to the network", () => {
    const port = createRealtimePresencePort(null);
    expect(port.snapshot()).toEqual({
      sharesPresence: true,
      self: null,
      peers: [],
    });
    port.publishLocation(AT_LESSON);
    port.publishCursor(CURSOR);
    port.setSharesPresence(false);
    expect(port.snapshot().peers).toEqual([]);
  });

  it("tracks location with Presence and sends the cursor with Broadcast, never the other way around", async () => {
    const channel = fakeChannel();
    const port = createRealtimePresencePort({
      channel,
      self: ADA,
      seeAs: () => "group",
      now: () => Date.now(),
    });

    await vi.waitFor(() => expect(channel.subscribed).toBe(true));

    port.publishLocation(AT_LESSON);
    await vi.waitFor(() => expect(channel.tracks.length).toBeGreaterThan(0));
    expect(channel.tracks.at(-1)).toMatchObject({
      studyId: AT_LESSON.studyId,
      courseId: AT_LESSON.courseId,
      lessonId: AT_LESSON.lessonId,
    });

    port.publishCursor(CURSOR);
    await vi.waitFor(() => expect(channel.broadcasts.length).toBeGreaterThan(0));
    expect(channel.broadcasts.at(-1)).toEqual({
      type: "broadcast",
      event: "cursor",
      payload: { userId: "ada", ...CURSOR },
    });
    expect(channel.tracks.every((track) => !("x" in track) && !("y" in track))).toBe(true);

    port.setSharesPresence(false);
    await vi.waitFor(() => expect(channel.untracks).toBeGreaterThan(0));
    const broadcasts = channel.broadcasts.length;
    const tracks = channel.tracks.length;
    port.publishCursor(CURSOR);
    port.publishLocation(AT_LESSON);
    expect(channel.broadcasts).toHaveLength(broadcasts);
    expect(channel.tracks).toHaveLength(tracks);
  });
});

function fakeChannel(): PresenceRealtimeChannel & {
  subscribed: boolean;
  tracks: Record<string, unknown>[];
  broadcasts: Array<{ type: string; event: string; payload: unknown }>;
  untracks: number;
} {
  const presenceListeners = new Set<() => void>();
  const broadcastListeners = new Set<(payload: unknown) => void>();
  const tracks: Record<string, unknown>[] = [];
  const broadcasts: Array<{ type: string; event: string; payload: unknown }> = [];
  let untracks = 0;
  let subscribed = false;
  let presence: Record<string, unknown> | null = null;

  const channel: PresenceRealtimeChannel & {
    subscribed: boolean;
    tracks: Record<string, unknown>[];
    broadcasts: Array<{ type: string; event: string; payload: unknown }>;
    untracks: number;
  } = {
    get subscribed() {
      return subscribed;
    },
    tracks,
    broadcasts,
    get untracks() {
      return untracks;
    },
    async track(state) {
      presence = { ...state };
      tracks.push({ ...state });
      for (const listener of presenceListeners) listener();
    },
    async untrack() {
      presence = null;
      untracks += 1;
      for (const listener of presenceListeners) listener();
    },
    presenceState() {
      if (!presence) return {};
      return { ada: [presence] };
    },
    on(type, filter, callback) {
      if (type === "presence" && filter.event === "sync") {
        presenceListeners.add(callback as () => void);
      }
      if (type === "broadcast" && filter.event === "cursor") {
        broadcastListeners.add((payload) => (callback as (message: unknown) => void)(payload));
      }
      return channel;
    },
    async send(args) {
      broadcasts.push(args);
      for (const listener of broadcastListeners) listener({ payload: args.payload });
      return "ok";
    },
    subscribe(callback) {
      subscribed = true;
      callback?.("SUBSCRIBED");
      return channel;
    },
    async unsubscribe() {
      subscribed = false;
    },
  };
  return channel;
}
