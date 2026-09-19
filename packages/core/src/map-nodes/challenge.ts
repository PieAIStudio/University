import { checkConnections } from "../learning-play/connect.js";

export interface ChallengeCard {
  readonly id: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly front: string;
  readonly back: string;
  readonly contentRevision: number;
}

/** A board is only a projection of existing reviewed card content. It does not
 * author new facts, lessons or answer keys. Duplicate text is removed to avoid
 * penalizing two equally correct visible choices. */
export function challengeDeck(cards: readonly ChallengeCard[], random: () => number = Math.random) {
  const ids = new Set<string>();
  const fronts = new Set<string>();
  const backs = new Set<string>();
  const deck = cards.filter((card) => {
    const front = card.front.trim();
    const back = card.back.trim();
    if (
      !front ||
      !back ||
      front.length > 450 ||
      back.length > 650 ||
      ids.has(card.id) ||
      fronts.has(front) ||
      backs.has(back)
    )
      return false;
    ids.add(card.id);
    fronts.add(front);
    backs.add(back);
    return true;
  });
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const value = Math.min(0.999999, Math.max(0, random()));
    const j = Math.floor(value * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

/** Reuse the native connection engine; a correct pair is a real graph edge. */
export function isChallengePair(
  cards: readonly ChallengeCard[],
  fromId: string,
  toId: string,
): boolean {
  if (!cards.some((card) => card.id === fromId) || !cards.some((card) => card.id === toId))
    return false;
  const activity = { edges: cards.map((card) => ({ from: card.id, to: card.id, why: card.back })) };
  const verdict = checkConnections(activity, [{ from: fromId, to: toId }]);
  return verdict.extra.length === 0 && verdict.matched === 1;
}

export function challengeBoards(
  cards: readonly ChallengeCard[],
): readonly (readonly ChallengeCard[])[] {
  const boards: ChallengeCard[][] = [];
  for (let i = 0; i < cards.length; i += 3) boards.push(cards.slice(i, i + 3));
  if (boards.length > 1 && boards.at(-1)!.length === 1) {
    boards[boards.length - 2]!.push(...boards.pop()!);
  }
  return boards;
}
