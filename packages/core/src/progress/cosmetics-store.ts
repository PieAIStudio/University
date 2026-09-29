import {
  CosmeticActionSchema,
  CosmeticCommandSchema,
  CosmeticFailure,
  CosmeticStateSchema,
  readCosmeticReceipt,
  type CosmeticAction,
  type CosmeticCommand,
  type CosmeticFailureKind,
  type CosmeticResult,
  type CosmeticState,
  type CosmeticsRemote,
} from "../ports/cosmetics.js";

/** A stopped network may still commit remotely; a deadline only unlocks an
 * explicit retry of the persisted operation, never starts another draw. */
const REQUEST_DEADLINE_MS = 20_000;
export type CosmeticsSchedule = (callback: () => void, delayMs: number) => () => void;
function boundedRequest<T>(work: Promise<T>, schedule: CosmeticsSchedule): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cancel = schedule(() => reject(new CosmeticFailure("network")), REQUEST_DEADLINE_MS);
    work.then(
      (value) => {
        cancel();
        resolve(value);
      },
      (reason: unknown) => {
        cancel();
        reject(reason);
      },
    );
  });
}

export interface CosmeticsPersistence {
  read(owner: string, kind: "pending" | "state"): string | null;
  write(owner: string, kind: "pending" | "state", value: string): void;
  removePending(owner: string): void;
}
export interface CosmeticsSnapshot {
  readonly owner: string | null;
  readonly phase: "closed" | "guest" | "loading" | "ready" | "failed";
  readonly data: CosmeticState | null;
  readonly busy: boolean;
  readonly pending: CosmeticCommand | null;
  readonly error: CosmeticFailureKind | null;
  readonly result: CosmeticResult | null;
  /** A previous verified response is useful offline, but is not a fresh balance. */
  readonly cached: boolean;
}
export interface CosmeticsStore {
  snapshot(): CosmeticsSnapshot;
  subscribe(listener: () => void): () => void;
  bind(owner: string | null): void;
  refresh(): Promise<void>;
  act(action: CosmeticAction): Promise<void>;
  retry(): Promise<void>;
  dismissResult(): void;
  dispose(): void;
}

/** One owner-scoped cache/outbox around the server contract. A persisted command
 * identity precedes every mutation; uncertain requests reuse it forever, never
 * roll again locally. A cache can paint offline, but cannot authorize a draw. */
export function createCosmeticsStore(options: {
  readonly remote: CosmeticsRemote | null;
  readonly persistence: CosmeticsPersistence;
  readonly currentOwner: () => string | null;
  readonly beforeClaim: () => Promise<void>;
  readonly uuid: () => string;
  /** Host timers, keeping the core independent of DOM/Node globals. */
  readonly schedule: CosmeticsSchedule;
}): CosmeticsStore {
  let generation = 0;
  let disposed = false;
  let bound = false;
  let storageBlocked = false;
  const listeners = new Set<() => void>();
  let state: CosmeticsSnapshot = {
    owner: null,
    phase: options.remote ? "guest" : "closed",
    data: null,
    busy: false,
    pending: null,
    error: null,
    result: null,
    cached: false,
  };
  const publish = (patch: Partial<CosmeticsSnapshot>) => {
    if (disposed) return;
    state = Object.freeze({ ...state, ...patch });
    // A subscriber may unsubscribe/re-subscribe while notified; it must not
    // extend this dispatch or cause an unbounded live-Set traversal.
    const currentListeners = [...listeners];
    for (const listener of currentListeners) {
      try {
        listener();
      } catch {
        /* A view observer cannot break a server receipt. */
      }
    }
  };
  const current = (owner: string, version: number) =>
    !disposed &&
    generation === version &&
    state.owner === owner &&
    options.currentOwner() === owner;
  const failure = (reason: unknown) =>
    reason instanceof CosmeticFailure ? reason : new CosmeticFailure("network");
  function saveState(data: CosmeticState) {
    // Failure of this disposable read cache does not turn a server commit into
    // a failed draw. The pending operation has its own mandatory durable write.
    try {
      options.persistence.write(data.userId, "state", JSON.stringify(data));
    } catch {
      /* Server remains authoritative. */
    }
  }
  function clearPending(owner: string): boolean {
    try {
      options.persistence.removePending(owner);
      storageBlocked = false;
      return true;
    } catch {
      storageBlocked = true;
      return false;
    }
  }
  async function refresh() {
    const owner = state.owner;
    if (!owner || !options.remote || state.busy || disposed) return;
    const version = generation;
    if (!current(owner, version)) return;
    publish({ phase: state.data ? state.phase : "loading", busy: true, error: null });
    try {
      const receipt = readCosmeticReceipt(
        await boundedRequest(options.remote.read(owner), options.schedule),
        owner,
      );
      if (!current(owner, version)) return;
      const data =
        !state.data || receipt.state.revision >= state.data.revision ? receipt.state : state.data;
      saveState(data);
      publish({
        data,
        phase: "ready",
        busy: false,
        cached: false,
        error: storageBlocked ? "storage" : null,
      });
    } catch (reason) {
      if (current(owner, version))
        publish({
          phase: "failed",
          busy: false,
          error: failure(reason).kind,
          cached: Boolean(state.data),
        });
    }
  }
  async function execute(command: CosmeticCommand) {
    const owner = state.owner;
    const version = generation;
    if (
      !owner ||
      !options.remote ||
      state.busy ||
      command.owner !== owner ||
      !current(owner, version)
    )
      return;
    publish({ busy: true, error: null, pending: command, result: null });
    try {
      if (command.action.kind === "claim")
        await boundedRequest(options.beforeClaim(), options.schedule);
      if (!current(owner, version)) return;
      const receipt = readCosmeticReceipt(
        await boundedRequest(options.remote.execute(command), options.schedule),
        owner,
        command.action,
      );
      if (!current(owner, version)) return;
      const data =
        !state.data || receipt.state.revision >= state.data.revision ? receipt.state : state.data;
      saveState(data);
      const cleared = clearPending(owner);
      publish({
        data,
        result: receipt.result,
        phase: "ready",
        cached: false,
        busy: false,
        pending: cleared ? null : command,
        error: cleared ? null : "storage",
      });
    } catch (reason) {
      if (!current(owner, version)) return;
      const error = failure(reason);
      const cleared = error.definitive && clearPending(owner);
      publish({
        phase: "failed",
        busy: false,
        pending: cleared ? null : command,
        error: storageBlocked ? "storage" : error.kind,
        cached: Boolean(state.data),
      });
    }
  }
  return {
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    bind(owner) {
      if (disposed || (bound && state.owner === owner)) return;
      bound = true;
      generation++;
      storageBlocked = false;
      let pending: CosmeticCommand | null = null;
      let data: CosmeticState | null = null;
      if (owner) {
        try {
          const value = options.persistence.read(owner, "pending");
          if (value) {
            pending = CosmeticCommandSchema.parse(JSON.parse(value));
            if (pending.owner !== owner) throw new Error("wrong owner");
          }
        } catch {
          storageBlocked = true;
        }
        try {
          const value = options.persistence.read(owner, "state");
          if (value) {
            const cached = CosmeticStateSchema.parse(JSON.parse(value));
            if (cached.userId === owner) data = cached;
          }
        } catch {
          /* A bad read cache is discarded; a pending command is not. */
        }
      }
      publish({
        owner,
        data,
        pending,
        cached: Boolean(data),
        result: null,
        busy: false,
        phase: !options.remote ? "closed" : !owner ? "guest" : "loading",
        error: storageBlocked ? "storage" : null,
      });
      if (owner && options.remote) void refresh();
    },
    refresh,
    async act(value) {
      const owner = state.owner;
      if (
        disposed ||
        !owner ||
        !options.remote ||
        state.busy ||
        state.pending ||
        storageBlocked ||
        options.currentOwner() !== owner
      )
        return;
      let command: CosmeticCommand;
      try {
        command = CosmeticCommandSchema.parse({
          version: 1,
          owner,
          operationId: options.uuid(),
          action: CosmeticActionSchema.parse(value),
        });
        options.persistence.write(owner, "pending", JSON.stringify(command));
      } catch {
        storageBlocked = true;
        publish({ error: "storage", phase: "failed" });
        return;
      }
      await execute(command);
    },
    async retry() {
      if (state.busy || disposed) return;
      if (state.pending) await execute(state.pending);
      else await refresh();
    },
    dismissResult() {
      publish({ result: null });
    },
    dispose() {
      generation++;
      disposed = true;
      listeners.clear();
    },
  };
}
