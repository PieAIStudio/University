/**
 * The session state of one three-option question, without the DOM.
 *
 * The component is a renderer of this: which options have already been shown
 * to be wrong, whether the correct one has been picked, and which pick's
 * explanation is on screen. Putting it here means the pedagogical rules —
 * a wrong pick does not unlock next, a correct pick shows that option's own
 * explanation as the principle — can be tested without mounting a button.
 */

interface ChoiceBlockState {
  readonly wrongOptionIds: readonly string[];
  readonly lastPickId: string | null;
  readonly solved: boolean;
}

export const INITIAL_CHOICE_BLOCK_STATE: ChoiceBlockState = {
  wrongOptionIds: [],
  lastPickId: null,
  solved: false,
};

type ChoiceBlockFeedback =
  | { readonly kind: "correct"; readonly explanation: string }
  | { readonly kind: "wrong"; readonly explanation: string };

/**
 * Apply one pick. Already-solved sessions ignore further picks, because the
 * next-question affordance is the way forward and restating the principle is
 * not a new answer.
 */
export function applyChoicePick(
  state: ChoiceBlockState,
  pickedId: string,
  correctOptionId: string,
): ChoiceBlockState {
  if (state.solved) return state;
  if (pickedId === correctOptionId) {
    return { wrongOptionIds: state.wrongOptionIds, lastPickId: pickedId, solved: true };
  }
  return {
    wrongOptionIds: state.wrongOptionIds.includes(pickedId)
      ? state.wrongOptionIds
      : [...state.wrongOptionIds, pickedId],
    lastPickId: pickedId,
    solved: false,
  };
}

/**
 * The sentence currently on screen. A miss uses the option just picked; a
 * hit uses the correct option's explanation, which is the principle, even
 * if earlier misses are still marked on the list.
 */
export function choiceBlockFeedback(
  state: ChoiceBlockState,
  options: readonly { readonly id: string; readonly explanation: string }[],
  correctOptionId: string,
): ChoiceBlockFeedback | null {
  if (state.lastPickId === null) return null;
  if (state.solved) {
    const correct = options.find((option) => option.id === correctOptionId);
    return correct ? { kind: "correct", explanation: correct.explanation } : null;
  }
  const picked = options.find((option) => option.id === state.lastPickId);
  return picked ? { kind: "wrong", explanation: picked.explanation } : null;
}
