/**
 * Who else is learning, and whether they may see you.
 *
 * Two questions, two mechanisms, never mixed. Presence (`track`) is who is
 * online and which lesson they stopped on — it changes when a lesson does.
 * Broadcast is the mouse — tens of times a second. Supabase's own docs warn
 * that calling `track()` on every mousemove floods the channel
 * (https://supabase.com/docs/guides/realtime/presence) and the rate-limit
 * page names that exact anti-pattern as the cause of
 * `ClientPresenceRateLimitReached`. That warning is why this port names both
 * verbs instead of one `send` that a future adapter could implement with the
 * wrong one.
 *
 * This package does not open a socket. The shipping adapter is an in-memory
 * bus so the UI can be written and tested without `university.study_groups`,
 * which is written in SwimmerBackend (`work/university-schema`) but not
 * deployed. A Realtime channel is injected later the same way `IdentityAuth`
 * is injected into `IdentityPort`. Wiring it before the table exists would
 * look like "the feature is broken" rather than "the feature is not on yet".
 */

export type PresenceRelation = "group" | "friend";

export interface PresenceLocation {
  readonly studyId: string | null;
  readonly courseId: string | null;
  readonly lessonId: string | null;
}

export interface PresenceCursor {
  /** 0–1 of the viewport, not CSS pixels, so two windows of different size still agree. */
  readonly x: number;
  readonly y: number;
  /**
   * Same-screen is a view, not "online". A group-mate on a different course
   * still shows up next to their stone; their pointer does not follow you
   * around a map they are not looking at.
   */
  readonly viewKey: string;
}

export interface PresencePeer {
  readonly userId: string;
  readonly displayName: string;
  readonly relation: PresenceRelation;
  readonly online: boolean;
  readonly location: PresenceLocation | null;
  readonly cursor: PresenceCursor | null;
}

export interface PresenceSelf {
  readonly userId: string;
  readonly displayName: string;
}

export interface PresenceSnapshot {
  readonly sharesPresence: boolean;
  readonly self: PresenceSelf | null;
  readonly peers: readonly PresencePeer[];
}

export interface PresencePort {
  snapshot(): PresenceSnapshot;
  subscribe(listener: () => void): () => void;
  publishLocation(location: PresenceLocation | null): void;
  publishCursor(cursor: PresenceCursor | null): void;
  setSharesPresence(shares: boolean): void;
}

/**
 * 20 Hz, not 60. A person cannot tell a cursor updating at display refresh
 * from one updating twenty times a second; the Realtime bill and the
 * presence rate-limit can. V4 §07.4: 「鼠标位置每秒发 20 次足够」. The
 * ten-second fling test is `sends < 250` — 20 × 10 = 200, plus a trailing
 * send so the cursor does not freeze short of the last point.
 *
 * Liveblocks' own cursor tutorial defaults to 100 ms and treats 16 ms as
 * 60 fps animation, which is the game-grade path V4 explicitly refused.
 * We stay at 50 ms because we are not a game and we are not paying for one.
 */
export const CURSOR_BROADCAST_HZ = 20;
export const CURSOR_BROADCAST_INTERVAL_MS = 1000 / CURSOR_BROADCAST_HZ;

export interface CursorThrottleClock {
  now(): number;
  schedule(fn: () => void, wait: number): () => void;
  send(cursor: PresenceCursor): void;
}

/**
 * Leading + trailing throttle.
 *
 * A leading-only throttle would drop the last point of a movement that
 * ended between ticks, so the remote cursor would freeze short of where
 * the hand actually stopped. A trailing-only throttle would add a full
 * interval of lag to the first move. Both together is the same shape
 * lodash uses, applied here because the 50 ms budget is the product rule
 * rather than a library default.
 */
export function createCursorThrottle(clock: CursorThrottleClock): {
  offer(cursor: PresenceCursor): void;
  stop(): void;
} {
  let lastSent = -Infinity;
  let pending: PresenceCursor | null = null;
  let cancel: (() => void) | null = null;

  const emit = (cursor: PresenceCursor) => {
    lastSent = clock.now();
    pending = null;
    cancel?.();
    cancel = null;
    clock.send(cursor);
  };

  return {
    offer(cursor) {
      const elapsed = clock.now() - lastSent;
      if (elapsed >= CURSOR_BROADCAST_INTERVAL_MS) {
        emit(cursor);
        return;
      }
      pending = cursor;
      if (cancel) return;
      const wait = CURSOR_BROADCAST_INTERVAL_MS - elapsed;
      cancel = clock.schedule(() => {
        cancel = null;
        if (pending) emit(pending);
      }, wait);
    },
    stop() {
      cancel?.();
      cancel = null;
      pending = null;
    },
  };
}

export interface MemoryPresenceBus {
  readonly cursorSends: number;
}

export interface MemoryPresencePort extends PresencePort {
  readonly bus: MemoryPresenceBus;
  readonly sent: { locations: number; cursors: number };
  goOffline(): void;
  goOnline(): void;
}

interface MemoryMember {
  readonly userId: string;
  displayName: string;
  sharesPresence: boolean;
  online: boolean;
  location: PresenceLocation | null;
  cursor: PresenceCursor | null;
  seeAs: Map<string, PresenceRelation>;
}

interface MemoryBusInternal extends MemoryPresenceBus {
  readonly members: Map<string, MemoryMember>;
  readonly listeners: Set<() => void>;
  version: number;
  recordCursor(): void;
  notify(): void;
}

function createMemoryPresenceBus(): MemoryBusInternal {
  const members = new Map<string, MemoryMember>();
  const listeners = new Set<() => void>();
  let cursorSends = 0;
  return {
    members,
    listeners,
    version: 0,
    get cursorSends() {
      return cursorSends;
    },
    recordCursor() {
      cursorSends += 1;
    },
    notify() {
      this.version += 1;
      for (const listener of listeners) listener();
    },
  };
}

/**
 * In-memory presence for tests and for the UI while the University schema
 * is still undeployed. Not a stand-in for Supabase in production — a
 * production port is `createRealtimePresencePort({ channel, ... })` once
 * `university.study_groups` exists and RLS is on.
 *
 * Two ports share a bus the way two browsers will share a channel: that is
 * how the tests prove that turning the switch off actually stops sending,
 * rather than only hiding a chip on this machine.
 */
export function createMemoryPresencePort(options?: {
  readonly self?: PresenceSelf;
  readonly bus?: MemoryPresenceBus;
  readonly sharesPresence?: boolean;
  readonly seeAs?: Readonly<Record<string, PresenceRelation>>;
  readonly now?: () => number;
}): MemoryPresencePort {
  const bus = (options?.bus as MemoryBusInternal | undefined) ?? createMemoryPresenceBus();
  const self = options?.self ?? null;
  const seeAs = new Map(Object.entries(options?.seeAs ?? {}));
  const sent = { locations: 0, cursors: 0 };
  let sharesPresence = options?.sharesPresence ?? true;

  const member: MemoryMember | null = self
    ? {
        userId: self.userId,
        displayName: self.displayName,
        sharesPresence,
        online: true,
        location: null,
        cursor: null,
        seeAs,
      }
    : null;
  if (member) {
    bus.members.set(member.userId, member);
    bus.notify();
  }

  const now = options?.now ?? Date.now;
  const throttle = createCursorThrottle({
    now,
    schedule: defaultSchedule,
    send(cursor) {
      if (!member || !member.sharesPresence || !member.online) return;
      member.cursor = cursor;
      sent.cursors += 1;
      bus.recordCursor();
      bus.notify();
    },
  });

  let cached: PresenceSnapshot | null = null;
  let cachedVersion = -1;
  const snapshot = (): PresenceSnapshot => {
    if (cached && cachedVersion === bus.version) return cached;
    cached = {
      sharesPresence,
      self,
      peers: peersOf(bus, self?.userId ?? null, seeAs),
    };
    cachedVersion = bus.version;
    return cached;
  };

  return {
    bus,
    sent,
    snapshot,
    subscribe(listener) {
      bus.listeners.add(listener);
      return () => {
        bus.listeners.delete(listener);
      };
    },
    publishLocation(location) {
      if (!member || !member.sharesPresence) return;
      member.location = location;
      sent.locations += 1;
      bus.notify();
    },
    publishCursor(cursor) {
      if (!member || !member.sharesPresence || !member.online) return;
      if (!cursor) {
        member.cursor = null;
        throttle.stop();
        bus.notify();
        return;
      }
      throttle.offer(cursor);
    },
    setSharesPresence(shares) {
      sharesPresence = shares;
      if (member) member.sharesPresence = shares;
      if (!shares) {
        throttle.stop();
        if (member) member.cursor = null;
      }
      bus.notify();
    },
    goOffline() {
      if (!member) return;
      member.online = false;
      member.cursor = null;
      throttle.stop();
      bus.notify();
    },
    goOnline() {
      if (!member) return;
      member.online = true;
      bus.notify();
    },
  };
}

function peersOf(
  bus: MemoryBusInternal,
  selfId: string | null,
  seeAs: Map<string, PresenceRelation>,
): PresencePeer[] {
  const peers: PresencePeer[] = [];
  for (const member of bus.members.values()) {
    if (member.userId === selfId) continue;
    if (!member.sharesPresence) continue;
    const relation = seeAs.get(member.userId);
    if (!relation) continue;
    peers.push(projectPeer(member, relation));
  }
  return peers;
}

function projectPeer(member: MemoryMember, relation: PresenceRelation): PresencePeer {
  const location = member.location;
  if (relation === "friend") {
    return {
      userId: member.userId,
      displayName: member.displayName,
      relation,
      online: member.online,
      location: location
        ? { studyId: location.studyId, courseId: location.courseId, lessonId: null }
        : null,
      cursor: null,
    };
  }
  return {
    userId: member.userId,
    displayName: member.displayName,
    relation,
    online: member.online,
    location,
    cursor: member.online ? member.cursor : null,
  };
}

/**
 * The subset of a Supabase `RealtimeChannel` this port will call.
 *
 * Structural: a real channel assigns here without a wrapper. The adapter
 * still lives in this package because the *protocol* — track for location,
 * broadcast for cursor, never the reverse — is the product rule, not a
 * shell preference. The shells only construct the channel, and today they
 * must not: see `PRESENCE_WIRED` in the online account module.
 */
export interface PresenceRealtimeChannel {
  track(state: Record<string, unknown>): Promise<unknown>;
  untrack(): Promise<unknown>;
  presenceState(): Record<string, readonly unknown[] | unknown>;
  on(
    type: "presence" | "broadcast",
    filter: { event: string },
    callback: (payload: unknown) => void,
  ): PresenceRealtimeChannel;
  send(args: {
    type: "broadcast";
    event: string;
    payload: unknown;
  }): Promise<"ok" | "timed out" | "error" | unknown>;
  subscribe(callback?: (status: string) => void): PresenceRealtimeChannel;
  unsubscribe(): Promise<unknown>;
}

/**
 * Wrap an injected Realtime channel, or the absence of one.
 *
 * `options === null` is the unconfigured path: every method is a quiet
 * no-op, `peers` stays empty, and nothing is read from the network. Do
 * not log here. A missing table is the normal case until the boss
 * deploys `university.study_groups`.
 */
export function createRealtimePresencePort(
  options: {
    readonly channel: PresenceRealtimeChannel;
    readonly self: PresenceSelf;
    readonly seeAs?: (userId: string) => PresenceRelation | null;
    readonly now?: () => number;
  } | null,
): PresencePort {
  if (!options) return createUnconfiguredPresencePort();

  const { channel, self } = options;
  const seeAs = options.seeAs ?? (() => "group" as const);
  const listeners = new Set<() => void>();
  let sharesPresence = true;
  let location: PresenceLocation | null = null;
  const remote = new Map<string, PresencePeer>();
  const cursors = new Map<string, PresenceCursor>();
  let generation = 0;
  let cached: PresenceSnapshot | null = null;

  const notify = () => {
    generation += 1;
    cached = null;
    for (const listener of listeners) listener();
  };

  const trackLocation = () => {
    if (!sharesPresence) return;
    void channel.track({
      userId: self.userId,
      displayName: self.displayName,
      studyId: location?.studyId ?? null,
      courseId: location?.courseId ?? null,
      lessonId: location?.lessonId ?? null,
    });
  };

  const throttle = createCursorThrottle({
    now: options.now ?? Date.now,
    schedule: defaultSchedule,
    send(cursor) {
      if (!sharesPresence) return;
      void channel.send({
        type: "broadcast",
        event: "cursor",
        payload: { userId: self.userId, ...cursor },
      });
    },
  });

  const rebuildFromPresence = () => {
    remote.clear();
    const state = channel.presenceState();
    for (const entries of Object.values(state)) {
      const list = Array.isArray(entries) ? entries : [entries];
      for (const entry of list) {
        const parsed = parsePresenceEntry(entry);
        if (!parsed || parsed.userId === self.userId) continue;
        const relation = seeAs(parsed.userId);
        if (!relation) continue;
        remote.set(parsed.userId, projectPeer(parsed, relation));
      }
    }
    notify();
  };

  channel.on("presence", { event: "sync" }, rebuildFromPresence);
  channel.on("broadcast", { event: "cursor" }, (message) => {
    const payload = payloadOf(message);
    const cursor = parseCursorPayload(payload, self.userId);
    if (!cursor) return;
    const relation = seeAs(cursor.userId);
    if (relation !== "group") return;
    cursors.set(cursor.userId, cursor.cursor);
    const existing = remote.get(cursor.userId);
    if (existing?.online) {
      remote.set(cursor.userId, { ...existing, cursor: cursor.cursor });
      notify();
    }
  });
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") trackLocation();
  });

  const snapshotOf = (): PresenceSnapshot => ({
    sharesPresence,
    self,
    peers: [...remote.values()].map((peer) => {
      if (peer.relation !== "group" || !peer.online) return { ...peer, cursor: null };
      return { ...peer, cursor: cursors.get(peer.userId) ?? peer.cursor };
    }),
  });
  let cachedGeneration = -1;
  const snapshot = (): PresenceSnapshot => {
    if (cached && cachedGeneration === generation) return cached;
    cached = snapshotOf();
    cachedGeneration = generation;
    return cached;
  };

  return {
    snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publishLocation(next) {
      location = next;
      trackLocation();
    },
    publishCursor(cursor) {
      if (!sharesPresence) return;
      if (!cursor) {
        throttle.stop();
        return;
      }
      throttle.offer(cursor);
    },
    setSharesPresence(shares) {
      sharesPresence = shares;
      if (!shares) {
        throttle.stop();
        void channel.untrack();
      } else {
        trackLocation();
      }
      notify();
    },
  };
}

function createUnconfiguredPresencePort(): PresencePort {
  let sharesPresence = true;
  const listeners = new Set<() => void>();
  let cached: PresenceSnapshot = { sharesPresence, self: null, peers: [] };
  const notify = () => {
    cached = { sharesPresence, self: null, peers: [] };
    for (const listener of listeners) listener();
  };
  return {
    snapshot: () => cached,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publishLocation: () => undefined,
    publishCursor: () => undefined,
    setSharesPresence(shares) {
      sharesPresence = shares;
      notify();
    },
  };
}

function parsePresenceEntry(entry: unknown): MemoryMember | null {
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  const userId = typeof record.userId === "string" ? record.userId : null;
  const displayName = typeof record.displayName === "string" ? record.displayName : null;
  if (!userId || !displayName) return null;
  return {
    userId,
    displayName,
    sharesPresence: true,
    online: true,
    location: {
      studyId: stringOrNull(record.studyId),
      courseId: stringOrNull(record.courseId),
      lessonId: stringOrNull(record.lessonId),
    },
    cursor: null,
    seeAs: new Map(),
  };
}

function payloadOf(message: unknown): unknown {
  if (message && typeof message === "object" && "payload" in message) {
    return (message as { payload: unknown }).payload;
  }
  return message;
}

function parseCursorPayload(
  payload: unknown,
  selfId: string,
): { userId: string; cursor: PresenceCursor } | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const userId = typeof record.userId === "string" ? record.userId : null;
  if (!userId || userId === selfId) return null;
  if (typeof record.x !== "number" || typeof record.y !== "number") return null;
  if (typeof record.viewKey !== "string") return null;
  return { userId, cursor: { x: record.x, y: record.y, viewKey: record.viewKey } };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * `packages/core` has no DOM lib and no `@types/node`, because a type that
 * implied either would leak into the authoring server. Both runtimes still
 * have timers on `globalThis`; we talk to that, not to `window`.
 */
function defaultSchedule(fn: () => void, wait: number): () => void {
  const host = globalThis as typeof globalThis & {
    setTimeout(handler: () => void, timeout?: number): unknown;
    clearTimeout(id: unknown): void;
  };
  const id = host.setTimeout(fn, wait);
  return () => host.clearTimeout(id);
}
