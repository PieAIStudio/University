import { describe, it, expect } from "vitest";
import { LessonAssetSchema, PrimmPayloadSchema } from "../domain/schemas.js";
import { primmFixture } from "./fixtures/primm.js";
import { primmIssues } from "./primm.js";

describe("honest everyday PRIMM materials", () => {
  it("permits labelled authored practice without laundering an unrelated case source", () => {
    const practice = {
      ...primmFixture,
      materials: [
        { id: "button-note", kind: "practice", label: "练习通知", text: "虚构的练习安排。" },
      ],
    };
    const parsed = PrimmPayloadSchema.parse(practice);
    expect(primmIssues(parsed)).toEqual([]);
    expect(
      PrimmPayloadSchema.safeParse({
        ...practice,
        materials: [{ ...practice.materials[0], kind: "source-summary" }],
      }).success,
    ).toBe(false);
  });
  it("requires distinct attachment, request-builder and artifact contracts in the new experience", () => {
    expect(primmIssues({ ...primmFixture, experienceVersion: 2 })).toContain(
      "Everyday PRIMM requires attachment, request-building and independent-artifact operations",
    );
  });
  it("requires a synthetic-audio identity with attribution, duration and visible caption", () => {
    const asset = {
      id: "practice-voice",
      kind: "synthetic-audio",
      path: "assets/practice.wav",
      sha256: `sha256:${"a".repeat(64)}`,
      mime: "audio/wav",
      bytes: 100,
      durationMs: 1000,
      alt: "练习语音",
      caption: "电脑合成的练习语音",
      source: { attribution: "University practice script; eSpeak NG synthesis" },
    };
    expect(LessonAssetSchema.safeParse(asset).success).toBe(true);
    expect(LessonAssetSchema.safeParse({ ...asset, source: undefined }).success).toBe(false);
    expect(LessonAssetSchema.safeParse({ ...asset, mime: "image/png" }).success).toBe(false);
  });
});
