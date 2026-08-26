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
 * The payload decides the boundary, not whether the voice lives on this
 * machine. A product-selected English word is product material, so sending
 * that one word through a browser's cloud voice is allowed. The learner's own
 * writing, speech, and private-repository text are their data and stay local
 * by default.
 *
 * That permission is deliberately narrow: it is for reading one word to the
 * learner, not for collecting the learner's explanation. A learner speaking
 * their own understanding — possibly about a private codebase — needs a
 * separate, explicit opt-in. Opening cloud TTS must never open that path by
 * implication.
 */
import type { SpeechQuality } from "@pieai/university-core";
import { useEffect, useState } from "react";

export type { SpeechQuality };

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
 * Every English voice this browser offers to the product.
 *
 * `localService` tells us which tier a voice belongs to; it is not the
 * candidate filter anymore. A browser cloud voice may read a product-selected
 * word, while novelty rejection and ranking still apply after local and cloud
 * candidates are collected.
 */
function listEnglishVoices(): readonly SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const synthesis = window.speechSynthesis;
  if (!synthesis || typeof synthesis.getVoices !== "function") return [];
  return synthesis.getVoices().filter((voice) => /^en(-|$)/i.test(voice.lang));
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
function rankEnglishVoices(): readonly SpeechSynthesisVoice[] {
  return listEnglishVoices()
    .filter((voice) => !isNoveltyVoice(voice))
    .sort((left, right) => scoreVoice(right) - scoreVoice(left));
}

export type SpeechTier = Exclude<SpeechQuality, "auto">;

export const SPEECH_QUALITY_OPTIONS = [
  { id: "auto", label: "自动" },
  { id: "local", label: "本机" },
  { id: "online", label: "在线" },
  { id: "premium", label: "高品质" },
] as const satisfies readonly { readonly id: SpeechQuality; readonly label: string }[];

const SPEECH_TIER_LABELS: Readonly<Record<SpeechTier, string>> = {
  local: "本机语音",
  online: "在线语音",
  premium: "高品质语音",
};

const SPEECH_TIER_ORDER: readonly SpeechTier[] = ["premium", "online", "local"];

export interface SpeechAvailability {
  readonly premium: boolean;
  readonly online: boolean;
  readonly local: boolean;
}

export interface SpeechResolution {
  readonly requested: SpeechQuality;
  readonly tier: SpeechTier | null;
  /** The manually requested tier when resolution had to step down. */
  readonly fallbackFrom: SpeechTier | null;
}

/** The label used in settings and in the visible explanation of a fallback. */
export function speechTierLabel(tier: SpeechTier): string {
  return SPEECH_TIER_LABELS[tier];
}

/**
 * Resolve a request against what this runtime can actually provide.
 *
 * `auto` is intentionally left as a request, not rewritten into storage. It
 * gets the first available tier on every call, so an entitlement or a newly
 * exposed browser cloud voice can take effect without a second settings write.
 * Manual requests only walk downward: choosing local never silently opts the
 * learner into a network voice.
 */
export function resolveSpeechTier(
  requested: SpeechQuality,
  available: SpeechAvailability,
): SpeechResolution {
  const first = requested === "auto" ? 0 : SPEECH_TIER_ORDER.indexOf(requested);
  const tier = SPEECH_TIER_ORDER.slice(first).find((candidate) => available[candidate]) ?? null;
  return {
    requested,
    tier,
    fallbackFrom: requested !== "auto" && tier !== requested ? requested : null,
  };
}

/** Browser voices are already ranked; this only divides them into quality shelves. */
export function voicesForSpeechTier(
  voices: readonly SpeechSynthesisVoice[],
  tier: SpeechTier,
): readonly SpeechSynthesisVoice[] {
  if (tier === "premium") return [];
  return voices
    .filter((voice) => !isNoveltyVoice(voice))
    .filter((voice) => (tier === "local" ? voice.localService : !voice.localService));
}

export function speechAvailabilityOf(
  voices: readonly SpeechSynthesisVoice[],
  hasPremiumEntitlement = false,
): SpeechAvailability {
  return {
    premium: hasPremiumEntitlement,
    online: voicesForSpeechTier(voices, "online").length > 0,
    local: voicesForSpeechTier(voices, "local").length > 0,
  };
}

export interface SpeechVoiceSelection extends SpeechResolution {
  readonly voices: readonly SpeechSynthesisVoice[];
  readonly voice: SpeechSynthesisVoice | null;
}

/** Resolve the tier and then pick the learner's remembered voice within it. */
export function selectSpeechVoice(
  voices: readonly SpeechSynthesisVoice[],
  requested: SpeechQuality,
  preferredURI: string | null,
  hasPremiumEntitlement = false,
): SpeechVoiceSelection {
  const candidates = voices.filter((voice) => !isNoveltyVoice(voice));
  const resolution = resolveSpeechTier(
    requested,
    speechAvailabilityOf(candidates, hasPremiumEntitlement),
  );
  const tierVoices = resolution.tier ? voicesForSpeechTier(candidates, resolution.tier) : [];
  return {
    ...resolution,
    voices: tierVoices,
    voice: selectVoice(tierVoices, preferredURI),
  };
}

function unavailableSpeechTierReason(tier: SpeechTier): string {
  switch (tier) {
    case "premium":
      return "高品质语音还没有开放，钱包和付费权益尚未接入";
    case "online":
      return "浏览器没有提供云端英语语音";
    case "local":
      return "设备没有可用的本机英语语音";
  }
}

/** Copy that makes an automatic choice or a manual fallback visible. */
export function explainSpeechResolution(
  resolution: SpeechResolution,
  available: SpeechAvailability,
): string {
  if (resolution.requested === "auto") {
    const current = resolution.tier && available[resolution.tier] ? resolution.tier : null;
    return current ? `自动当前使用${speechTierLabel(current)}。` : "自动当前没有可用的英语语音。";
  }

  const requestedLabel = speechTierLabel(resolution.requested);
  if (resolution.tier === resolution.requested && available[resolution.requested]) {
    return `当前使用${requestedLabel}。`;
  }

  const reason = unavailableSpeechTierReason(resolution.requested);
  if (!resolution.tier) {
    return `你选的${requestedLabel}当前拿不到（${reason}），现在没有可用的英语语音。`;
  }
  return `你选的${requestedLabel}当前拿不到（${reason}），已退到${speechTierLabel(resolution.tier)}。`;
}

const VOICE_PREFERENCE_KEY = "university-local:speech-voice";
const SPEECH_QUALITY_PREFERENCE_KEY = "university-local:speech-quality";

function isSpeechQuality(value: string | null): value is SpeechQuality {
  return value === "auto" || value === "local" || value === "online" || value === "premium";
}

/** Local fallback for guests and for the first boot before the account loads. */
export function readSpeechQualityPreference(): SpeechQuality {
  try {
    const value = window.localStorage.getItem(SPEECH_QUALITY_PREFERENCE_KEY);
    return isSpeechQuality(value) ? value : "auto";
  } catch {
    return "auto";
  }
}

export function writeSpeechQualityPreference(value: SpeechQuality): void {
  try {
    window.localStorage.setItem(SPEECH_QUALITY_PREFERENCE_KEY, value);
  } catch {
    // A blocked localStorage costs the guest fallback, not the ability to speak.
  }
}

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
  const acceptable = voices.filter((voice) => !isNoveltyVoice(voice));
  if (preferredURI) {
    const chosen = acceptable.find((voice) => voice.voiceURI === preferredURI);
    if (chosen) return chosen;
  }
  return acceptable[0] ?? null;
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
    const synthesis = window.speechSynthesis;
    if (!synthesis || typeof synthesis.addEventListener !== "function") return undefined;
    const update = () => setVoices(rankEnglishVoices());
    update();
    synthesis.addEventListener("voiceschanged", update);
    return () => synthesis.removeEventListener("voiceschanged", update);
  }, []);
  return voices;
}

export function speakWord(word: string, voice: SpeechSynthesisVoice): void {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    !window.speechSynthesis ||
    typeof window.speechSynthesis.speak !== "function" ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    return;
  }
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  // A single word out of context gives the ear no sentence rhythm to lean on,
  // and the learner is here precisely because they cannot yet hear its shape.
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
