import { describe, expect, it } from "vitest";
import {
  checkConnections,
  evaluateTuning,
  simulateProgram,
  type ProgramCommand,
} from "@pieai/university-core";
import { getBaseExamples } from "./base-examples.js";
import { extraExamples } from "./extra-examples.js";
import { getProgramExamples } from "./program-examples.js";

describe("playground payloads are solvable", () => {
  it("has two distinct examples of each activity, with unique IDs", () => {
    const all = [...getBaseExamples(), ...extraExamples(), ...getProgramExamples()];
    expect(new Set(all.map((activity) => activity.id)).size).toBe(10);
    for (const kind of ["connect", "tune", "hunt", "dispatch", "program"])
      expect(all.filter((activity) => activity.kind === kind)).toHaveLength(2);
  });
  it("checks both causal branches and supports more than one tuning solution", () => {
    for (const activity of getBaseExamples()) {
      if (activity.kind === "connect")
        expect(checkConnections(activity, activity.edges).passed).toBe(true);
      else {
        const examples =
          activity.id === "tune-image"
            ? [
                { width: 1000, quality: 65 },
                { width: 840, quality: 80 },
              ]
            : [
                { batch: 4, workers: 3 },
                { batch: 6, workers: 2 },
              ];
        for (const input of examples) expect(evaluateTuning(activity, input).passed).toBe(true);
      }
    }
  });
  it("includes feasible programs for both boards", () => {
    const solutions: readonly (readonly ProgramCommand[])[] = [
      [
        { op: "forward", repeat: 2 },
        { op: "right", repeat: 1 },
        { op: "forward", repeat: 4 },
        { op: "left", repeat: 1 },
        { op: "forward", repeat: 2 },
      ],
      [
        { op: "forward", repeat: 2 },
        { op: "left", repeat: 1 },
        { op: "forward", repeat: 3 },
        { op: "right", repeat: 1 },
        { op: "forward", repeat: 3 },
        { op: "left", repeat: 1 },
        { op: "forward", repeat: 1 },
      ],
    ];
    getProgramExamples().forEach((activity, index) =>
      expect(simulateProgram(activity, solutions[index]!).outcome).toBe("success"),
    );
  });
});
