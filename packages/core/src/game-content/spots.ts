import { choiceRoundsFromLesson } from "./choices.js";
import type { GameLesson } from "./rounds.js";

/** The same authored graded choice, shown as a 打地鼠 round. No new answer key. */
export interface SpotSentence {
  readonly id: string;
  readonly text: string;
  readonly target: boolean;
  readonly why: string;
}
export interface SpotRound {
  readonly id: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly question: string;
  readonly source?: string;
  readonly items: readonly SpotSentence[];
}
export const SPOT_SENTENCE_MAX_WIDTH = 48;
export function spotRoundsFromLesson(lesson: GameLesson): readonly SpotRound[] {
  return choiceRoundsFromLesson(lesson).flatMap((round) =>
    round.items.flatMap((item): SpotRound[] => {
      if (item.options.length < 3) return [];
      return [
        {
          id: `${round.id}/${item.id}`,
          lessonId: round.lessonId,
          lessonTitle: round.lessonTitle,
          question: item.text,
          items: item.options.map((option) => ({
            id: option.id,
            text: option.label,
            target: option.id === item.bestId,
            why: option.id === item.bestId ? item.why : item.whyNot[option.id]!,
          })),
        },
      ];
    }),
  );
}
