import { choiceRoundsFromLesson, type ChoiceRound } from "./choices.js";
import { linkRoundsFromLesson, type LinkRound } from "./links.js";
import {
  gameRoundsFromLesson,
  roundsForSegment,
  type GameLesson,
  type GameRound,
} from "./rounds.js";
import { sequenceRoundsFromLesson, type SequenceRound } from "./sequences.js";
import { spotRoundsFromLesson, type SpotRound } from "./spots.js";

/**
 * Which island game a challenge node plays (ADR-0011).
 *
 * Every game draws on one kind of judgement the lessons teach; a node plays
 * one whose kind the learner's practised lessons give enough rounds for. When
 * several do, nodes take turns in a fixed order, so the island does not ask
 * for the same game everywhere and the same node asks for the same game every
 * visit. Nothing here widens which lessons count: the host passes only the
 * lessons the learner completed or proved.
 */
export const ISLAND_GAMES = ["courtyard", "links", "snake", "moles", "runner", "blocks"] as const;
export type IslandGame = (typeof ISLAND_GAMES)[number];

/** Fewer rounds than this is a warm-up, not a game. */
export const MIN_ISLAND_ROUNDS = 2;

export interface IslandRounds {
  readonly courtyard: readonly GameRound[];
  readonly links: readonly LinkRound[];
  readonly snake: readonly SequenceRound[];
  readonly moles: readonly SpotRound[];
  readonly runner: readonly ChoiceRound[];
  /** 俄罗斯方块 plays the same sorts as 庭院拦截, in a different shape. */
  readonly blocks: readonly GameRound[];
}

export type IslandPick = {
  [G in IslandGame]: { readonly game: G; readonly rounds: IslandRounds[G] };
}[IslandGame];

export function islandRoundsForSegment(
  lessons: readonly GameLesson[],
  segmentLessonIds: readonly string[],
): IslandRounds {
  const sorts = roundsForSegment(gameRoundsFromLesson, lessons, segmentLessonIds);
  return {
    courtyard: sorts,
    links: roundsForSegment(linkRoundsFromLesson, lessons, segmentLessonIds),
    snake: roundsForSegment(sequenceRoundsFromLesson, lessons, segmentLessonIds),
    moles: roundsForSegment(spotRoundsFromLesson, lessons, segmentLessonIds),
    runner: roundsForSegment(choiceRoundsFromLesson, lessons, segmentLessonIds),
    blocks: sorts,
  };
}

/** The game for the challenge node with this ordinal, or null when none has enough rounds. */
export function pickIslandGame(rounds: IslandRounds, nodeOrdinal: number): IslandPick | null {
  const playable = ISLAND_GAMES.filter((game) => rounds[game].length >= MIN_ISLAND_ROUNDS);
  if (!playable.length) return null;
  const turn = Math.max(0, Math.floor(nodeOrdinal / 2));
  const game = playable[turn % playable.length]!;
  return { game, rounds: rounds[game] } as IslandPick;
}
