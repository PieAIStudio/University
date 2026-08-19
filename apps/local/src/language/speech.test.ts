import { describe, expect, it } from "vitest";

import { isNoveltyVoice, selectVoice } from "./speech.js";

function voice(name: string, overrides: Partial<SpeechSynthesisVoice> = {}): SpeechSynthesisVoice {
  return {
    name,
    lang: "en-US",
    localService: true,
    default: false,
    voiceURI: name,
    ...overrides,
  } as SpeechSynthesisVoice;
}

describe("English voice selection", () => {
  it("rejects the macOS novelty voices that sort to the front of the list", () => {
    // This is the whole bug: `getVoices()` comes back alphabetically, and the
    // 1980s MacinTalk joke voices own the start of the alphabet. Reading a
    // vocabulary word in Albert does not sound like a bad voice, it sounds
    // like a broken product.
    expect(isNoveltyVoice(voice("Albert"))).toBe(true);
    expect(isNoveltyVoice(voice("Bad News"))).toBe(true);
    expect(isNoveltyVoice(voice("Bahh"))).toBe(true);
    expect(isNoveltyVoice(voice("Zarvox"))).toBe(true);
  });

  it("keeps the real system voices", () => {
    expect(isNoveltyVoice(voice("Samantha"))).toBe(false);
    expect(isNoveltyVoice(voice("Daniel", { lang: "en-GB" }))).toBe(false);
    expect(isNoveltyVoice(voice("Microsoft Aria"))).toBe(false);
  });

  it("matches on the bare name, so Apple's qualified variants are judged the same", () => {
    expect(isNoveltyVoice(voice("Albert (English (United States))"))).toBe(true);
    expect(isNoveltyVoice(voice("Samantha (Enhanced)"))).toBe(false);
  });

  it("honours a remembered pick over the ranking", () => {
    const voices = [voice("Samantha"), voice("Daniel", { lang: "en-GB" })];

    expect(selectVoice(voices, "Daniel")?.name).toBe("Daniel");
  });

  it("falls back to the best-ranked voice when the remembered one is gone", () => {
    // Voices are a property of the machine: an uninstalled voice must not
    // leave the button mute, it must quietly hand back to the default.
    const voices = [voice("Samantha"), voice("Daniel", { lang: "en-GB" })];

    expect(selectVoice(voices, "Ava (Premium)")?.name).toBe("Samantha");
    expect(selectVoice([], "Samantha")).toBeNull();
  });
});
