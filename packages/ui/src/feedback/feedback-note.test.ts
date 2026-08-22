import { describe, expect, it } from "vitest";

import { feedbackNote } from "./FeedbackNote.js";

/**
 * The point of this note is the context nobody remembers to write down. If it
 * ever stops carrying the route, it becomes "something was wrong somewhere",
 * which is what it exists to replace.
 */
describe("feedbackNote", () => {
  const at = new Date("2026-08-23T04:00:00.000Z");

  it("carries where you were, not only what you said", () => {
    const note = feedbackNote({
      shell: "在线端",
      route: "#/turing-pact/foundations-before-zero",
      viewport: [375, 812],
      theme: "night",
      at,
      said: "这块面板挡住了地图",
    });
    expect(note).toContain("这块面板挡住了地图");
    expect(note).toContain("#/turing-pact/foundations-before-zero");
    expect(note).toContain("375×812");
    expect(note).toContain("night");
    expect(note).toContain("在线端");
  });

  it("still produces a usable note when nothing was typed", () => {
    const note = feedbackNote({
      shell: "本地端",
      route: "#/",
      viewport: [1440, 900],
      theme: "night",
      at,
      said: "   ",
    });
    // An empty note is a mis-click, and it should read as one rather than as a
    // heading with nothing under it.
    expect(note).toContain("(没写内容)");
    expect(note).toContain("#/");
  });
});
