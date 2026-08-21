import { GameButton } from "@pieai/swimmer-ui-kit";

import {
  readVoicePreference,
  selectVoice,
  speakWord,
  useEnglishVoices,
} from "../language/speech.js";

/**
 * C4. Speaks the English headword, never the Chinese gloss.
 *
 * The point is to make a learner dare to say the word out loud in a meeting.
 * A gloss they already read in Chinese does not help with that; the English
 * shape of the word does. Hidden when this machine has no `speechSynthesis` or
 * no local English voice, rather than offering a button that does nothing.
 *
 * Voice picking lives in `language/speech.ts` so this button and the lesson
 * word card cannot disagree about Albert vs Samantha.
 */
export function PronunciationButton({ word }: { readonly word: string }) {
  const voices = useEnglishVoices();
  const voice = selectVoice(voices, readVoicePreference());
  if (!voice) return null;

  return (
    <span className="entry-head__speak">
      <GameButton
        type="button"
        variant="ghost"
        static
        aria-label={`听 ${word} 的英文发音`}
        onClick={() => speakWord(word, voice)}
      >
        听发音
      </GameButton>
    </span>
  );
}
