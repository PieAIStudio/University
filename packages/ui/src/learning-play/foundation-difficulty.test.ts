import { describe, expect, it } from "vitest";
import {
  ACTIVITY_DIFFICULTIES,
  actOnBrief,
  assessHuntEvidence,
  checkConnections,
  BRIEF_UNLOCK,
  createBriefPreview,
  createDispatchState,
  evaluateBrief,
  evaluateHunt,
  simulateProgram,
  evaluateTuning,
  routeDispatch,
  selectActivityLevel,
  type ProgramCommand,
  type HuntObservation,
} from "@pieai/university-core";
import { getFoundationFamily } from "./foundation-difficulty.js";
import { getBaseExamples } from "./base-examples.js";
import { extraExamples } from "./extra-examples.js";
import { getProgramExamples } from "./program-examples.js";
import { getAIBriefExamples } from "./ai-brief-examples.js";

const families = () =>
  [...getBaseExamples(), ...extraExamples(), ...getProgramExamples(), ...getAIBriefExamples()].map(
    getFoundationFamily,
  );
const commands = (spec: readonly (readonly [ProgramCommand["op"], number])[]) =>
  spec.map(([op, repeat]) => ({ op, repeat }));
const paths = {
  "program-delivery": {
    intro: commands([["forward", 2]]),
    practice: commands([
      ["forward", 2],
      ["right", 1],
      ["forward", 4],
      ["left", 1],
      ["forward", 2],
    ]),
    challenge: commands([
      ["forward", 2],
      ["right", 1],
      ["forward", 4],
      ["right", 1],
      ["forward", 2],
      ["right", 2],
      ["forward", 4],
    ]),
  },
  "program-irrigation": {
    intro: commands([["forward", 2]]),
    practice: commands([
      ["forward", 2],
      ["left", 1],
      ["forward", 3],
      ["right", 1],
      ["forward", 3],
      ["left", 1],
      ["forward", 1],
    ]),
    challenge: commands([
      ["forward", 2],
      ["left", 1],
      ["forward", 4],
      ["right", 2],
      ["forward", 1],
      ["left", 1],
      ["forward", 3],
      ["left", 1],
      ["forward", 1],
    ]),
  },
};

describe("curated foundation difficulty tasks", () => {
  it.each(["intro", "practice", "challenge"] as const)(
    "%s has unique task identities and an actual solution for every case",
    (level) => {
      for (const family of families()) {
        const task = selectActivityLevel(family, level);
        expect(task.difficulty).toBe(level);
        switch (task.kind) {
          case "connect":
            expect(checkConnections(task, task.edges).passed).toBe(true);
            expect(checkConnections(task, []).passed).toBe(false);
            break;
          case "tune": {
            const image = task.visualization?.kind === "image-detail";
            const value: Record<string, number> = image
              ? level === "intro"
                ? { width: 840 }
                : level === "challenge"
                  ? { width: 1000, quality: 65 }
                  : { width: 840, quality: 80 }
              : level === "intro"
                ? { batch: 6 }
                : level === "challenge"
                  ? { batch: 5, workers: 3 }
                  : { batch: 6, workers: 2 };
            expect(evaluateTuning(task, value).passed, task.id).toBe(true);
            break;
          }
          case "hunt": {
            const b = task.model === "clamp" ? 0 : task.boundary;
            const rows = [b - 1, b, b + 1]
              .map((value) => evaluateHunt(task, value))
              .filter((row): row is HuntObservation => row.valid);
            expect(assessHuntEvidence(task, rows).passed).toBe(true);
            if (level === "challenge")
              expect(
                assessHuntEvidence(
                  task,
                  rows.filter((row) => row.counterexample),
                ).passed,
              ).toBe(false);
            break;
          }
          case "dispatch": {
            let state = createDispatchState();
            for (const card of task.cards) {
              const lane =
                card.cacheKey && state.warmedCacheKeys.includes(card.cacheKey)
                  ? task.cacheLaneId
                  : task.lanes
                      .filter((lane) => card.allowedLaneIds.includes(lane.id))
                      .sort((a, b) => a.cost - b.cost)[0]!.id;
              const move = routeDispatch(task, state, lane);
              expect(move.accepted, task.id).toBe(true);
              if (move.accepted) state = move.state;
            }
            expect(state.cursor).toBe(task.cards.length);
            expect(state.spent).toBeLessThanOrEqual(task.budget);
            break;
          }
          case "program": {
            const path = paths[family.id as keyof typeof paths][level];
            expect(simulateProgram(task, path).passed, task.id).toBe(true);
            if (level === "challenge")
              expect(
                simulateProgram(task, paths[family.id as keyof typeof paths].practice).passed,
              ).toBe(false);
            break;
          }
          case "ai-brief": {
            expect(evaluateBrief(task, task.initialChoices ?? {}, []).passed).toBe(false);
            let product = createBriefPreview();
            const observations = [];
            /*
              The walkthrough is derived from the payload rather than written
              out. It used to read `task.target.access === "account"` and name
              「submit」「login」「roster」 — a maintenance solution that only
              worked for a sign-up sheet, which is the same assumption the engine
              itself used to carry.
            */
            const ids = task.actions.map((action) => action.id);
            const gated = task.gate && task.target[task.gate.axis] === task.gate.requiresUnlock;
            for (const action of gated ? [ids[0]!, BRIEF_UNLOCK, ...ids] : ids) {
              const result = actOnBrief(task, task.target, product, action, 0);
              product = result.state;
              if (result.observation) observations.push(result.observation);
            }
            expect(evaluateBrief(task, task.target, observations).passed).toBe(true);
            break;
          }
        }
      }
    },
  );
  it("uses narrower tasks, independent constraints and changed cache keys rather than a difficulty multiplier", () => {
    for (const family of families()) {
      const a = family.levels.intro,
        b = family.levels.practice,
        c = family.levels.challenge;
      expect(new Set(ACTIVITY_DIFFICULTIES.map((level) => family.levels[level].id)).size).toBe(3);
      if (a.kind === "connect" && b.kind === "connect" && c.kind === "connect") {
        expect(a.edges.length).toBeLessThan(b.edges.length);
        expect(c.edges.length).toBeGreaterThan(b.edges.length);
      }
      if (a.kind === "tune" && b.kind === "tune")
        expect(a.controls.length).toBeLessThan(b.controls.length);
      if (a.kind === "dispatch" && c.kind === "dispatch")
        expect(c.cards.some((card) => card.cacheKey?.endsWith("-revised"))).toBe(true);
      if (a.kind === "ai-brief" && c.kind === "ai-brief") {
        expect(Object.keys(a.initialChoices ?? {})).toHaveLength(2);
        expect(a.followUp).toBeUndefined();
        expect(c.followUp).toBeDefined();
      }
    }
  });
  it("rejects a family that reuses an activity identity across difficulty", () => {
    const family = families()[0]!;
    expect(() =>
      selectActivityLevel(
        {
          ...family,
          levels: {
            ...family.levels,
            intro: { ...family.levels.intro, id: family.levels.practice.id },
          },
        } as typeof family,
        "intro",
      ),
    ).toThrow("Invalid learning activity family");
  });
});
