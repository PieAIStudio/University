import { describe, it, expect } from "vitest";
import { matchesAssetMime, sniffAssetMime } from "./asset-bytes.js";
describe("real audio asset recognition", () => {
  it("accepts WAV only when RIFF identifies WAVE, not an image renamed as audio", () => {
    const wav = Buffer.from("RIFF0000WAVEfmt ");
    expect(matchesAssetMime(wav, "audio/wav")).toBe(true);
    expect(sniffAssetMime(wav)).toBe("audio/wav");
    expect(matchesAssetMime(Buffer.from("RIFF0000WEBP"), "audio/wav")).toBe(false);
  });
  it("recognizes ID3 and MPEG frame starts without treating arbitrary text as audio", () => {
    expect(matchesAssetMime(Buffer.from("ID3abc"), "audio/mpeg")).toBe(true);
    expect(matchesAssetMime(Buffer.from([0xff, 0xfb, 0x90]), "audio/mpeg")).toBe(true);
    expect(matchesAssetMime(Buffer.from("a transcript"), "audio/mpeg")).toBe(false);
  });
});
