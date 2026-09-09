import { describe, expect, it } from "vitest";

import { isValidProgramActivity, simulateProgram } from "./program.js";
import type { ProgramActivity, ProgramCommand } from "./types.js";

const delivery: ProgramActivity = {
  kind: "program",
  id: "delivery",
  title: "Delivery",
  brief: "",
  goal: "",
  takeaway: "",
  hint: "",
  source: { label: "", url: "" },
  width: 5,
  height: 5,
  start: { x: 0, y: 4, direction: "north" },
  goalCell: { x: 4, y: 0 },
  walls: [
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ],
  checkpoints: [
    { x: 0, y: 2 },
    { x: 3, y: 2 },
  ],
  maxCommands: 5,
  maxRepeat: 4,
};
const irrigation: ProgramActivity = {
  ...delivery,
  id: "irrigation",
  width: 6,
  start: { x: 0, y: 4, direction: "east" },
  goalCell: { x: 5, y: 0 },
  walls: [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 2 },
    { x: 5, y: 2 },
    { x: 3, y: 3 },
    { x: 4, y: 3 },
  ],
  checkpoints: [
    { x: 2, y: 4 },
    { x: 2, y: 1 },
    { x: 5, y: 1 },
  ],
  maxCommands: 7,
};
const forward = (repeat = 1): ProgramCommand => ({ op: "forward", repeat });
const left = (repeat = 1): ProgramCommand => ({ op: "left", repeat });
const right = (repeat = 1): ProgramCommand => ({ op: "right", repeat });
const deliveryRoute = [forward(2), right(), forward(4), left(), forward(2)];
const irrigationRoute = [forward(2), left(), forward(3), right(), forward(3), left(), forward()];

describe("simulateProgram", () => {
  it.each([
    [delivery, deliveryRoute, 10],
    [irrigation, irrigationRoute, 12],
  ] as const)("solves the %s map with a short repeated program", (activity, commands, steps) => {
    const result = simulateProgram(activity, commands);
    expect(result.outcome).toBe("success");
    expect(result.passed).toBe(true);
    expect(result.executedSteps).toBe(steps);
    expect(result.finalState?.position).toEqual(activity.goalCell);
    expect(result.finalState?.visitedCheckpoints).toEqual(
      activity.checkpoints.map((_, index) => index),
    );
  });

  it("makes repetition useful: spelling out the same delivery route exceeds its command budget", () => {
    const expanded = deliveryRoute.flatMap((command) =>
      Array.from({ length: command.repeat }, () => ({ ...command, repeat: 1 })),
    );
    const result = simulateProgram(delivery, expanded);
    expect(result.outcome).toBe("command-budget");
    expect(result.frames).toEqual([]);
    expect(result.finalState?.position).toEqual({ x: 0, y: 4 });
  });

  it("accepts another legal program rather than matching a single answer", () => {
    expect(
      simulateProgram(delivery, [forward(2), left(3), forward(4), right(3), forward(2)]).passed,
    ).toBe(true);
  });

  it("records every turn, movement and newly visited checkpoint without rewriting earlier frames", () => {
    const result = simulateProgram(delivery, deliveryRoute);
    expect(result.initialState).toEqual({
      position: { x: 0, y: 4 },
      direction: "north",
      visitedCheckpoints: [],
    });
    expect(result.frames[0]).toMatchObject({
      position: { x: 0, y: 3 },
      direction: "north",
      commandIndex: 0,
      repetition: 1,
      visitedCheckpoints: [],
    });
    expect(result.frames[1]).toMatchObject({
      position: { x: 0, y: 2 },
      direction: "north",
      repetition: 2,
      visitedCheckpoints: [0],
    });
    expect(result.frames[2]).toMatchObject({
      position: { x: 0, y: 2 },
      direction: "east",
      commandIndex: 1,
      repetition: 1,
    });
    expect(result.frames[0]?.visitedCheckpoints).toEqual([]);
  });

  it("stops on the first wall, preserves the last legal position and never runs later commands", () => {
    const result = simulateProgram(delivery, [forward(), right(), forward(3), left(), forward()]);
    expect(result.outcome).toBe("wall");
    expect(result.executedSteps).toBe(3);
    expect(result.finalState?.position).toEqual({ x: 0, y: 3 });
    expect(result.problem).toEqual({
      commandIndex: 2,
      repetition: 1,
      attemptedCell: { x: 1, y: 3 },
    });
    expect(result.frames.at(-1)?.collision).toBe("wall");
  });

  it("does not accept reaching the goal if later commands leave the grid", () => {
    const result = simulateProgram({ ...delivery, maxCommands: 6 }, [...deliveryRoute, forward(4)]);
    expect(result.outcome).toBe("bounds");
    expect(result.problem).toEqual({
      commandIndex: 5,
      repetition: 1,
      attemptedCell: { x: 4, y: -1 },
    });
    expect(result.finalState?.position).toEqual(delivery.goalCell);
    expect(result.passed).toBe(false);
  });

  it("stops a repeated move at the first step outside the grid", () => {
    const result = simulateProgram({ ...delivery, start: { x: 0, y: 1, direction: "north" } }, [
      forward(4),
    ]);
    expect(result.outcome).toBe("bounds");
    expect(result.executedSteps).toBe(2);
    expect(result.problem).toEqual({
      commandIndex: 0,
      repetition: 2,
      attemptedCell: { x: 0, y: -1 },
    });
    expect(result.finalState?.position).toEqual({ x: 0, y: 0 });
  });

  it("does not pass a goal reached without all checkpoints", () => {
    const result = simulateProgram(delivery, [forward(4), right(), forward(4)]);
    expect(result.outcome).toBe("missing-checkpoints");
    expect(result.finalState?.position).toEqual(delivery.goalCell);
    expect(result.finalState?.visitedCheckpoints).toEqual([0]);
  });

  it("requires the final cell, even after all checkpoints have been visited", () => {
    const result = simulateProgram(delivery, [forward(2), right(), forward(4)]);
    expect(result.outcome).toBe("not-at-goal");
    expect(result.finalState?.visitedCheckpoints).toEqual([0, 1]);
  });

  it("counts a checkpoint on the starting cell once", () => {
    const activity = { ...delivery, checkpoints: [{ x: 0, y: 4 }, ...delivery.checkpoints] };
    const result = simulateProgram(activity, deliveryRoute);
    expect(result.initialState?.visitedCheckpoints).toEqual([0]);
    expect(result.finalState?.visitedCheckpoints).toEqual([0, 1, 2]);
    expect(result.passed).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 5, Number.MAX_SAFE_INTEGER])(
    "rejects invalid repetition %s before any command runs",
    (repeat) => {
      const result = simulateProgram(delivery, [forward(), { op: "left", repeat }]);
      expect(result.outcome).toBe("invalid-command");
      expect(result.problem?.commandIndex).toBe(1);
      expect(result.frames).toEqual([]);
    },
  );

  it("handles empty, unknown, sparse and non-array programs without executing them", () => {
    const sparse: ProgramCommand[] = [];
    sparse.length = 2;
    expect(simulateProgram(delivery, []).outcome).toBe("empty");
    expect(
      simulateProgram(delivery, [{ op: "teleport", repeat: 1 }] as unknown as ProgramCommand[])
        .outcome,
    ).toBe("invalid-command");
    expect(simulateProgram(delivery, sparse).outcome).toBe("invalid-command");
    expect(simulateProgram(delivery, null as unknown as ProgramCommand[]).outcome).toBe(
      "invalid-command",
    );
  });

  it("keeps repeat expansion finite even for the largest allowed payload", () => {
    const activity = { ...delivery, maxCommands: 32, maxRepeat: 16, checkpoints: [] };
    const result = simulateProgram(
      activity,
      Array.from({ length: 32 }, () => left(16)),
    );
    expect(result.executedSteps).toBe(512);
    expect(result.outcome).toBe("not-at-goal");
  });

  it("never mutates activity data or the submitted commands", () => {
    const activity = structuredClone(delivery);
    const commands = structuredClone(deliveryRoute);
    const before = JSON.stringify({ activity, commands });
    simulateProgram(activity, commands);
    expect(JSON.stringify({ activity, commands })).toBe(before);
  });
});

describe("isValidProgramActivity", () => {
  it("rejects sparse cell arrays instead of counting invisible checkpoints", () => {
    const checkpoints: ProgramActivity["checkpoints"][number][] = [];
    checkpoints.length = 1;
    expect(isValidProgramActivity({ ...delivery, checkpoints })).toBe(false);
  });

  it.each([
    { width: Number.POSITIVE_INFINITY },
    { height: 0 },
    { width: 17 },
    { maxCommands: 33 },
    { maxCommands: 0 },
    { maxRepeat: 17 },
    { maxRepeat: Number.NaN },
    { start: { x: -1, y: 4, direction: "north" } },
    { goalCell: { x: 5, y: 0 } },
    { walls: [{ x: 0, y: 4 }] },
    { walls: [{ x: 4, y: 0 }] },
    { walls: [{ x: 0, y: 2 }] },
    {
      checkpoints: [
        { x: 0, y: 2 },
        { x: 0, y: 2 },
      ],
    },
    { start: { x: 0, y: 4, direction: "up" } },
    { walls: null },
  ])("rejects invalid geometry or execution limits: %j", (changes) => {
    const activity = { ...delivery, ...changes } as ProgramActivity;
    expect(isValidProgramActivity(activity)).toBe(false);
    expect(simulateProgram(activity, deliveryRoute)).toMatchObject({
      outcome: "invalid-activity",
      frames: [],
      finalState: null,
    });
  });
});
