/**
 * Choosing which of the machine's voices reads an English word out loud.
 *
 * This exists because "the first local English voice" is a trap. macOS ships
 * ~40 English voices and returns them alphabetically, and the alphabet puts the
 * 1980s MacinTalk novelty set first: Albert, Bad News, Bahh, Bells, Boing,
 * Bubbles, Cellos. So the obvious `voices.find(isEnglish)` picks **Albert** — a
 * cartoon croak — while Samantha, the actual system voice, sits at index 31 and
 * is never reached. A learner hearing a vocabulary word in Albert does not
 * conclude "this machine has bad voices"; they conclude the product is broken.
 *
 * Nothing here reaches the network. Chrome lists cloud voices next to local
 * ones and speaking through one ships the text to a server, which this project
 * does not do — see `listEnglishVoices`.
 */
import { useEffect, useState } from "react";

/**
 * Voices that exist to be funny, sung, or robotic. Never a reasonable default,
 * whatever else is missing — silence explains itself and Bahh does not.
 * These are stable macOS names; the list is closed, not a heuristic.
 */
const NOVELTY_VOICES = new Set([
  "albert",
  "bad news",
  "bahh",
  "bells",
  "boing",
  "bubbles",
  "cellos",
  "deranged",
  "good news",
  "hysterical",
  "jester",
  "organ",
  "pipe organ",
  "superstar",
  "trinoids",
  "whisper",
  "wobble",
  "zarvox",
  // Intelligible, but 1990s formant synthesis — a robot reading a word the
  // learner is trying to hear the shape of.
  "fred",
  "junior",
  "kathy",
  "ralph",
  "princess",
  "bruce",
  "agnes",
  "victoria",
]);

/**
 * The voice each platform actually ships as its default speaker. Matched on the
 * leading name so macOS's "Samantha (Enhanced)" and plain "Samantha" both hit.
 */
const PREFERRED_VOICES = [
  // macOS / iOS
  "samantha",
  "alex",
  "ava",
  "allison",
  "susan",
  "tom",
  "nicky",
  "aaron",
  "zoe",
  "evan",
  "joelle",
  "noelle",
  "daniel",
  "serena",
  "karen",
  "moira",
  "tessa",
  "rishi",
  // Windows
  "microsoft aria",
  "microsoft jenny",
  "microsoft guy",
  "microsoft zira",
  "microsoft david",
  "microsoft mark",
];

/** Apple's higher-quality downloads, and the only reliable quality signal in the API. */
const QUALITY_MARKERS = ["premium", "enhanced", "neural"];

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** The name with Apple's parenthesised qualifiers stripped: "Flo (English (UK))" → "flo". */
function baseName(name: string): string {
  const normalized = normalize(name);
  const cut = normalized.indexOf("(");
  return cut === -1 ? normalized : normalized.slice(0, cut).trim();
}

export function isNoveltyVoice(voice: SpeechSynthesisVoice): boolean {
  return NOVELTY_VOICES.has(baseName(voice.name));
}

/**
 * Every English voice that speaks from this machine.
 *
 * `localService` is the whole filter, not a preference: a cloud voice would
 * send the word to someone else's server, which is the same boundary that
 * blocks external images in lessons. A missing voice is a visible, explainable
 * gap; a voice that quietly phoned home would not be.
 */
export function listEnglishVoices(): readonly SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.localService && /^en(-|$)/i.test(voice.lang));
}

/**
 * How much this voice deserves to be the one a learner hears.
 *
 * Ranked rather than hardcoded because the available set is a property of the
 * machine, not of this app: a fresh macOS install, a Windows box, and a Linux
 * box with espeak share no voice names at all. Novelty voices are removed
 * before scoring — they are not a low score, they are not an option.
 */
function scoreVoice(voice: SpeechSynthesisVoice): number {
  const normalized = normalize(voice.name);
  let score = 0;
  if (QUALITY_MARKERS.some((marker) => normalized.includes(marker))) score += 40;
  const preferredIndex = PREFERRED_VOICES.indexOf(baseName(voice.name));
  if (preferredIndex !== -1) score += 30 - preferredIndex * 0.1;
  const lang = voice.lang.toLowerCase();
  if (lang.startsWith("en-us")) score += 6;
  else if (lang.startsWith("en-gb")) score += 4;
  else score += 2;
  if (voice.default) score += 1;
  return score;
}

/** English voices worth offering, best first. */
export function rankEnglishVoices(): readonly SpeechSynthesisVoice[] {
  return listEnglishVoices()
    .filter((voice) => !isNoveltyVoice(voice))
    .sort((left, right) => scoreVoice(right) - scoreVoice(left));
}

const VOICE_PREFERENCE_KEY = "university-local:speech-voice";

/**
 * The learner's own pick, if they made one.
 *
 * No ranking can be right on every machine, and the person listening is the
 * only one who can hear the result. The preference stores `voiceURI` rather
 * than an index because the voice list's order is not stable across sessions.
 */
export function readVoicePreference(): string | null {
  try {
    return window.localStorage.getItem(VOICE_PREFERENCE_KEY);
  } catch {
    return null;
  }
}

export function writeVoicePreference(voiceURI: string | null): void {
  try {
    if (voiceURI === null) window.localStorage.removeItem(VOICE_PREFERENCE_KEY);
    else window.localStorage.setItem(VOICE_PREFERENCE_KEY, voiceURI);
  } catch {
    // A blocked localStorage costs the remembered pick, not the ability to speak.
  }
}

/**
 * The voice to speak with: the learner's pick when it is still installed,
 * otherwise the best-ranked one.
 */
export function selectVoice(
  voices: readonly SpeechSynthesisVoice[],
  preferredURI: string | null,
): SpeechSynthesisVoice | null {
  if (preferredURI) {
    const chosen = voices.find((voice) => voice.voiceURI === preferredURI);
    if (chosen) return chosen;
  }
  return voices[0] ?? null;
}

/**
 * The ranked voice list, once the browser has actually produced it.
 *
 * `getVoices()` returns an empty array on the first call in every engine and
 * fills in asynchronously, so a component that reads it once during render
 * concludes the machine is mute.
 */
export function useEnglishVoices(): readonly SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<readonly SpeechSynthesisVoice[]>(rankEnglishVoices);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
    const update = () => setVoices(rankEnglishVoices());
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);
  return voices;
}

export function speakWord(word: string, voice: SpeechSynthesisVoice): void {
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  // A single word out of context gives the ear no sentence rhythm to lean on,
  // and the learner is here precisely because they cannot yet hear its shape.
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
