/**
 * The clock every 3D learning game runs on (ADR-0011, rules layer).
 *
 * A game is a pure simulation: the renderer hands it seconds, input hands it
 * actions, and nothing here touches a timer, the DOM, a renderer or an
 * account. It steps at a fixed 60 Hz so a slow frame never changes an outcome,
 * holds still while suspended (hidden tab, open panel, lost focus) with no
 * catch-up afterwards, and publishes a snapshot for React at 10 Hz; the render
 * loop reads the live state directly for positions.
 */
export const STEP_SECONDS = 1 / 60;
const PUBLISH_SECONDS = 0.1;
/** A frame longer than this is a stall, not time the learner spent playing. */
const LONGEST_FRAME = 0.1;

export abstract class GameSession<State extends { readonly phase: string }, Action> {
  protected state: State;
  private snapshot: State;
  private readonly listeners = new Set<() => void>();
  private carry = 0;
  private publishIn = 0;
  private suspended = false;

  constructor(initial: State) {
    this.state = initial;
    this.snapshot = structuredClone(initial);
  }

  /** Live state for the render loop. Read it; never write it. */
  getState = (): Readonly<State> => this.state;
  /** The state as of the last publish, for React. */
  getSnapshot = (): State => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  protected publish() {
    this.snapshot = structuredClone(this.state);
    for (const listener of this.listeners) listener();
  }

  /** Whether time currently moves the simulation, by phase. */
  protected abstract running(state: State): boolean;
  protected abstract step(seconds: number): void;
  protected abstract apply(action: Action): void;

  act = (action: Action) => {
    this.apply(action);
    this.publish();
  };

  setSuspended = (value: boolean) => {
    this.suspended = value;
    if (value) this.carry = 0;
  };

  isSuspended = () => this.suspended;

  advance = (seconds: number) => {
    if (this.suspended || !Number.isFinite(seconds) || seconds <= 0) return;
    if (!this.running(this.state)) return;
    const phase = this.state.phase;
    this.carry += Math.min(seconds, LONGEST_FRAME);
    while (this.carry + 1e-9 >= STEP_SECONDS && this.running(this.state)) {
      this.step(STEP_SECONDS);
      this.carry -= STEP_SECONDS;
    }
    this.publishIn -= seconds;
    if (this.publishIn <= 0 || this.state.phase !== phase) {
      this.publishIn = PUBLISH_SECONDS;
      this.publish();
    }
  };
}

/** A seeded generator, so a run can be replayed and tested exactly. */
export function seededRandom(seed: number): () => number {
  let value = seed >>> 0 || 1;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
