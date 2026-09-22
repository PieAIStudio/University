// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { PrimmPayloadSchema, primmIssues } from "@pieai/university-core";
import { LessonActivitySchema } from "@pieai/university-core/domain/schemas.js";

import { PrimmGameLab } from "./PrimmGameLab.js";
import { localizeActivity } from "@pieai/university-core";
import { PRIMM_GAME_KINDS, primmGameAssets, primmGameExamples } from "./primm-game-examples.js";

/*
  The lab exists so the six investigate games can be judged by playing them.
  An example the lesson schema would refuse would be judging something no
  lesson can hold, so each one goes through the same parse and structural
  checks a stored lesson does, in both locales.
*/
describe("PRIMM investigate-game lab", () => {
  it("offers one lesson-valid example per game, translated the way a lesson is", () => {
    const examples = primmGameExamples();
    expect(examples.map((example) => example.kind)).toEqual([...PRIMM_GAME_KINDS]);
    for (const { kind, activity } of examples) {
      expect(activity.investigate.game.kind, kind).toBe(kind);
      const parsed = LessonActivitySchema.safeParse(activity);
      expect(parsed.success ? [] : parsed.error.issues.map((issue) => issue.message), kind).toEqual(
        [],
      );
      expect(primmIssues(PrimmPayloadSchema.parse(activity)), kind).toEqual([]);
      // Throws on a dictionary entry the text does not use, exactly as in a lesson.
      expect(() => localizeActivity(activity, "en"), kind).not.toThrow();
    }
  });

  it("draws the picture the image game points at, in both languages", () => {
    const game = primmGameExamples().find((example) => example.kind === "inspect-image")!.activity
      .investigate.game;
    for (const locale of ["zh-CN", "en"]) {
      const assets = primmGameAssets(locale);
      expect(
        game.kind === "inspect-image" && assets.some((asset) => asset.id === game.assetId),
      ).toBe(true);
    }
  });

  it("renders a switch for every game and starts incomplete", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<PrimmGameLab />));
    const switches = [...host.querySelectorAll("[data-primm-game]")].map((button) =>
      button.getAttribute("data-primm-game"),
    );
    expect(switches).toEqual([...PRIMM_GAME_KINDS]);
    expect(host.querySelector(".primm-lab__status")?.getAttribute("data-complete")).toBe("false");
    await act(async () => root.unmount());
    host.remove();
  });
});
