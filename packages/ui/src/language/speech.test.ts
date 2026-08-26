import { describe, expect, it } from "vitest";

import {
  explainSpeechResolution,
  isNoveltyVoice,
  resolveSpeechTier,
  selectSpeechVoice,
  selectVoice,
  speakWord,
  voicesForSpeechTier,
} from "./speech.js";

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

  it("keeps cloud voices in the online shelf while novelty voices stay excluded", () => {
    const cloud = voice("Browser Cloud English", { localService: false });
    const noveltyCloud = voice("Albert", { localService: false });
    const local = voice("Samantha");

    expect(voicesForSpeechTier([cloud, noveltyCloud, local], "online")).toEqual([cloud]);
    expect(voicesForSpeechTier([cloud, noveltyCloud, local], "local")).toEqual([local]);
    expect(selectSpeechVoice([cloud, noveltyCloud, local], "online", null).voice).toBe(cloud);
  });

  it("resolves auto to premium, then online, then local as availability changes", () => {
    expect(resolveSpeechTier("auto", { premium: true, online: true, local: true }).tier).toBe(
      "premium",
    );
    expect(resolveSpeechTier("auto", { premium: false, online: true, local: true }).tier).toBe(
      "online",
    );
    expect(resolveSpeechTier("auto", { premium: false, online: false, local: true }).tier).toBe(
      "local",
    );
  });

  it("steps a manual request down and says why", () => {
    const available = { premium: false, online: false, local: true } as const;
    const resolution = resolveSpeechTier("online", available);

    expect(resolution).toEqual({ requested: "online", tier: "local", fallbackFrom: "online" });
    expect(explainSpeechResolution(resolution, available)).toContain("退到本机语音");
    expect(explainSpeechResolution(resolution, available)).toContain("没有提供云端英语语音");
  });

  it("resolves the premium manual tier when that capability is present", () => {
    expect(resolveSpeechTier("premium", { premium: true, online: true, local: true }).tier).toBe(
      "premium",
    );
    expect(resolveSpeechTier("premium", { premium: false, online: true, local: true }).tier).toBe(
      "online",
    );
  });

  it("does not promote a manual local request to a network voice", () => {
    const available = { premium: false, online: true, local: false } as const;
    const resolution = resolveSpeechTier("local", available);

    expect(resolution.tier).toBeNull();
    expect(explainSpeechResolution(resolution, available)).toContain("没有可用的英语语音");
  });

  it("does not throw when speechSynthesis is absent", () => {
    expect(() => speakWord("word", voice("Samantha"))).not.toThrow();
  });
});
