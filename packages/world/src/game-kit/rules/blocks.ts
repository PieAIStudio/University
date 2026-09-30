import {
  createSortState,
  displayWidth,
  placeSortItem,
  type GameRound,
  type SortState,
} from "@pieai/university-core";

import { RoundGame, type PlayRound, type RoundGameState } from "./round-game.js";

/**
 * 俄罗斯方块 — the falling-block sorter (ADR-0011), the second game for a
 * lesson's sort, after 庭院拦截.
 *
 * Each bin of the round is a column. One block at a time falls carrying one
 * item; move it into the right column and let it land (or drop it). A right
 * landing melts into the column's basket; a wrong one costs a heart with the
 * lesson's reason, and the block stays as a grey brick at the bottom of that
 * column, so the column gets shorter and the next block there lands sooner —
 * the pressure Tetris is known for, charged only for a wrong judgement.
 * Bricks clear when the round ends. The next block is always shown.
 *
 * The verdict is the lesson's own sort engine, exactly as in 庭院拦截.
 */
export const WELL_ROWS = 10;
/** Bricks a column can hold before a landing is already at the top. */
export const MAX_BRICKS = 4;
const LAND_SECONDS = 0.55;

export interface Falling {
  readonly id: number;
  readonly itemId: string;
  /** Column index, left to right in the round's bin order. */
  col: number;
  /** Rows fallen from the top, 0 to the column's floor. */
  y: number;
  /** Rows per second while falling on its own. */
  readonly speed: number;
  dropping: boolean;
  /** Set when it lands: right or wrong, and seconds since. */
  landed: { right: boolean; since: number } | null;
}

export type BlocksEvent =
  | { readonly id: number; readonly kind: "move"; readonly col: number }
  | {
      readonly id: number;
      readonly kind: "land";
      readonly col: number;
      readonly right: boolean;
      readonly points: number;
      readonly shielded: boolean;
    };

export interface BlocksState extends RoundGameState<GameRound, BlocksEvent> {
  queue: string[];
  block: Falling | null;
  /** Grey bricks at the bottom of each column. */
  bricks: number[];
}

export type BlocksAction =
  | { readonly type: "move"; readonly by: -1 | 1 }
  | { readonly type: "column"; readonly col: number }
  | { readonly type: "drop" };

const chars = (text: string) => displayWidth(text) / 2;

/** Rows per second: a fall takes about as long as reading the block, less each round. */
export function fallSpeed(text: string, roundIndex: number, pace: number): number {
  const reading = Math.min(11, Math.max(5, 4 + 0.16 * chars(text)));
  return (WELL_ROWS / reading) * (1 + 0.06 * roundIndex) * pace;
}

/** The row a block lands on in a column with this many bricks. */
export const floorOf = (bricks: number) => WELL_ROWS - 1 - Math.min(bricks, MAX_BRICKS);

export class BlocksSession extends RoundGame<GameRound, BlocksEvent, BlocksState, BlocksAction> {
  private readonly sorts = new Map<string, SortState>();

  constructor(rounds: readonly GameRound[], seed = 1) {
    super(rounds, seed, { queue: [], block: null, bricks: [] });
  }

  itemOf(itemId: string) {
    return this.currentRound()?.round.items.find((item) => item.id === itemId) ?? null;
  }

  /** The next block's item, shown before it falls. */
  nextItemId(): string | null {
    return this.state.queue[0] ?? null;
  }

  protected setUp(current: PlayRound<GameRound>) {
    const s = this.state;
    s.queue = [...current.itemIds];
    s.block = null;
    s.bricks = current.round.bins.map(() => 0);
    if (!this.sorts.has(current.round.id) || current.review)
      this.sorts.set(current.round.id, createSortState());
  }

  protected input(action: BlocksAction) {
    const s = this.state;
    const block = s.block;
    if (!block || block.landed) return;
    const cols = s.bricks.length;
    if (action.type === "drop") {
      block.dropping = true;
      return;
    }
    const col = action.type === "column" ? action.col : block.col + action.by;
    if (col < 0 || col >= cols || col === block.col) return;
    // A column already stacked above the block cannot be entered sideways.
    if (floorOf(s.bricks[col]!) < block.y) return;
    block.col = col;
    this.emit({ kind: "move", col });
  }

  protected play(dt: number) {
    const s = this.state;
    const block = s.block;
    if (!block) {
      if (s.queue.length) this.spawn();
      return;
    }
    if (block.landed) {
      block.landed.since += dt;
      if (block.landed.since >= LAND_SECONDS) s.block = null;
      return;
    }
    const speed = block.dropping ? WELL_ROWS * 3 : block.speed;
    block.y = Math.min(floorOf(s.bricks[block.col]!), block.y + speed * dt);
    if (block.y >= floorOf(s.bricks[block.col]!)) this.land(block);
  }

  private spawn() {
    const s = this.state;
    const itemId = s.queue.shift()!;
    const item = this.itemOf(itemId)!;
    s.block = {
      id: ++s.serial,
      itemId,
      // The middle column, or the left of the middle two.
      col: Math.floor((s.bricks.length - 1) / 2),
      y: 0,
      speed: fallSpeed(item.text, s.roundIndex, this.pace()),
      dropping: false,
      landed: null,
    };
  }

  private land(block: Falling) {
    const s = this.state;
    const round = this.currentRound()!.round;
    const item = this.itemOf(block.itemId)!;
    const binId = round.bins[block.col]!.id;
    const rules = {
      buckets: round.bins,
      items: round.items.map((candidate) => ({
        id: candidate.id,
        bucketId: candidate.binId,
        why: candidate.why,
        ...(candidate.tempting
          ? { tempting: { bucketId: candidate.tempting.binId, whyNot: candidate.tempting.whyNot } }
          : {}),
      })),
    };
    const verdict = placeSortItem(rules, this.sorts.get(round.id)!, item.id, binId);
    if (verdict.kind === "right") {
      this.sorts.set(round.id, verdict.state);
      block.landed = { right: true, since: 0 };
      const points = this.scored(item.id, true, item.why);
      this.emit({ kind: "land", col: block.col, right: true, points, shielded: false });
      return;
    }
    if (verdict.kind === "wrong") this.sorts.set(round.id, verdict.state);
    block.landed = { right: false, since: 0 };
    s.bricks[block.col] = Math.min(MAX_BRICKS, s.bricks[block.col]! + 1);
    const reason = verdict.kind === "wrong" ? (verdict.whyNot ?? item.why) : item.why;
    const shielded = this.missed(item.id, reason, "wrong");
    this.emit({ kind: "land", col: block.col, right: false, points: 0, shielded });
  }

  protected roundDone() {
    const s = this.state;
    return !s.queue.length && !s.block;
  }
}
