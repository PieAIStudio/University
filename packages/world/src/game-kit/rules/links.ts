import { displayWidth, type LinkEdge, type LinkRound } from "@pieai/university-core";

import { RoundGame, type PlayRound, type RoundGameState } from "./round-game.js";
import { shuffled } from "./session.js";

/**
 * 连连看 — stepping stones in the courtyard pond (ADR-0011).
 *
 * Every node of a lesson's `connect` activity is a stone. Tap one stone, then
 * the stone it connects to, and a plank bridge springs between them; a link
 * the lesson does not have costs a heart and shows one link the first stone
 * really has. The tide is the clock: it refills with every bridge built, and
 * when it runs out one link is built for the learner and counted as missed.
 * Once every link stands, a marble walks the lesson's probes across them.
 */
export const SETTLE_SECONDS = 1.8;

export interface Stone {
  readonly id: string;
  /** Where in the pond, by the scene's slot order; shuffled per round. */
  readonly slot: number;
  /** Every link through it stands. */
  done: boolean;
}

export interface LinkBridge {
  readonly edgeId: string;
  /** How it came to stand: built right, built after a mistake, let go, or kept from before. */
  readonly how: "right" | "corrected" | "escaped" | "given";
}

export type LinksEvent =
  | { readonly id: number; readonly kind: "pick"; readonly nodeId: string }
  | {
      readonly id: number;
      readonly kind: "link";
      readonly edgeId: string;
      readonly points: number;
      readonly firstTry: boolean;
    }
  | {
      readonly id: number;
      readonly kind: "wrong";
      readonly from: string;
      readonly to: string;
      /** The link the first stone really has, now shown. */
      readonly shownEdgeId: string | null;
      readonly shielded: boolean;
    }
  | {
      readonly id: number;
      readonly kind: "escaped";
      readonly edgeId: string;
      readonly shielded: boolean;
    }
  | { readonly id: number; readonly kind: "linked" };

export interface LinksState extends RoundGameState<LinkRound, LinksEvent> {
  stones: Stone[];
  bridges: LinkBridge[];
  /** Links still to build in this pass, in the order the tide takes them. */
  open: string[];
  /** Links shown after a mistake; building one now is only "corrected". */
  revealed: string[];
  picked: string | null;
  /** Seconds before the tide takes a link; refilled by every bridge. */
  tide: number;
  /** A full tide this round. */
  window: number;
  /** The finished picture's moment before the round ends; 0 when not settling. */
  settle: number;
}

export type LinksAction = { readonly type: "pick"; readonly nodeId: string };

/** Reading room in CJK characters: an English letter is half of one. */
const chars = (text: string) => displayWidth(text) / 2;

/** Seconds for one link: long enough to read every stone once, shorter each round. */
export function linkSeconds(round: LinkRound, roundIndex: number, pace: number): number {
  const reading = round.nodes.reduce((sum, node) => sum + chars(node.label), 0);
  const seconds = Math.min(15, Math.max(7, 5 + 0.12 * reading));
  return (seconds * (1 / (1 + 0.06 * roundIndex))) / pace;
}

const between = (edge: LinkEdge, a: string, b: string) =>
  (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a);

export class LinksSession extends RoundGame<LinkRound, LinksEvent, LinksState, LinksAction> {
  constructor(rounds: readonly LinkRound[], seed = 1) {
    super(rounds, seed, {
      stones: [],
      bridges: [],
      open: [],
      revealed: [],
      picked: null,
      tide: 0,
      window: 0,
      settle: 0,
    });
  }

  edgeOf(edgeId: string): LinkEdge | null {
    return this.currentRound()?.round.items.find((edge) => edge.id === edgeId) ?? null;
  }

  protected setUp(current: PlayRound<LinkRound>) {
    const s = this.state;
    const { round } = current;
    const slots = shuffled(
      round.nodes.map((_, index) => index),
      this.random,
    );
    s.stones = round.nodes.map((node, index) => ({
      id: node.id,
      slot: slots[index]!,
      done: false,
    }));
    s.open = [...current.itemIds];
    // A review pass keeps the rest of the picture standing, so the links it
    // replays are read in the same context they were taught in.
    s.bridges = round.items
      .filter((edge) => !s.open.includes(edge.id))
      .map((edge) => ({ edgeId: edge.id, how: "given" as const }));
    s.revealed = [];
    s.picked = null;
    s.window = linkSeconds(round, s.roundIndex, this.pace());
    s.tide = s.window;
    s.settle = 0;
    this.markDone();
  }

  private markDone() {
    const s = this.state;
    const round = this.currentRound()!.round;
    for (const stone of s.stones)
      stone.done = !round.items.some(
        (edge) => s.open.includes(edge.id) && (edge.from === stone.id || edge.to === stone.id),
      );
  }

  protected input(action: LinksAction) {
    const s = this.state;
    const stone = s.stones.find((candidate) => candidate.id === action.nodeId);
    if (!stone || !s.open.length) return;
    if (!s.picked) {
      if (stone.done) return;
      s.picked = stone.id;
      this.emit({ kind: "pick", nodeId: stone.id });
      return;
    }
    const first = s.picked;
    s.picked = null;
    if (first === stone.id) return;
    const round = this.currentRound()!.round;
    const edge = round.items.find((candidate) => between(candidate, first, stone.id));
    if (edge && !s.open.includes(edge.id)) return; // already standing
    if (edge) {
      this.build(edge, !s.revealed.includes(edge.id));
      return;
    }
    const shown =
      this.firstOpenAt(first) ??
      this.firstOpenAt(stone.id) ??
      round.items.find((e) => s.open.includes(e.id))!;
    if (!s.revealed.includes(shown.id)) s.revealed.push(shown.id);
    const shielded = this.missed(shown.id, shown.why, "wrong");
    this.emit({ kind: "wrong", from: first, to: stone.id, shownEdgeId: shown.id, shielded });
  }

  private firstOpenAt(nodeId: string): LinkEdge | null {
    const s = this.state;
    const round = this.currentRound()!.round;
    return (
      round.items.find(
        (edge) => s.open.includes(edge.id) && (edge.from === nodeId || edge.to === nodeId),
      ) ?? null
    );
  }

  private build(edge: LinkEdge, firstTry: boolean) {
    const s = this.state;
    s.open = s.open.filter((id) => id !== edge.id);
    s.bridges.push({ edgeId: edge.id, how: firstTry ? "right" : "corrected" });
    const points = this.scored(edge.id, firstTry, edge.why);
    this.emit({ kind: "link", edgeId: edge.id, points, firstTry });
    this.afterBridge();
  }

  private afterBridge() {
    const s = this.state;
    this.markDone();
    s.tide = s.window;
    if (!s.open.length) {
      s.picked = null;
      s.settle = SETTLE_SECONDS;
      this.emit({ kind: "linked" });
    }
  }

  protected play(dt: number) {
    const s = this.state;
    if (!s.open.length) {
      s.settle = Math.max(0, s.settle - dt);
      return;
    }
    s.tide -= dt;
    if (s.tide > 0) return;
    // The tide takes a link that was already shown first, then the next in line.
    const round = this.currentRound()!.round;
    const edgeId = s.open.find((id) => s.revealed.includes(id)) ?? s.open[0]!;
    const edge = round.items.find((candidate) => candidate.id === edgeId)!;
    s.open = s.open.filter((id) => id !== edgeId);
    s.bridges.push({ edgeId, how: "escaped" });
    const shielded = this.missed(edge.id, edge.why, "escaped");
    this.emit({ kind: "escaped", edgeId, shielded });
    this.afterBridge();
    // A stone whose last link the tide just took has nothing left to pick for.
    if (s.picked && s.stones.find((stone) => stone.id === s.picked)?.done) s.picked = null;
  }

  protected roundDone() {
    return !this.state.open.length && this.state.settle <= 0;
  }
}
