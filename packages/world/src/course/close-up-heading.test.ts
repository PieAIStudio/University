import { describe, expect, it } from "vitest";

import { chooseCloseUpHeading } from "./close-up-heading.js";

describe("the close-up heading", () => {
  const look = { x: 0, z: 0 };
  const subjects = [
    { x: -1, z: 0 },
    { x: 1, z: 0 },
  ];

  it("looks side-on to the two subjects from the map's side when nothing is in the way", () => {
    const heading = chooseCloseUpHeading({
      home: { x: 0, z: 1 },
      look,
      reach: 7,
      subjects,
      obstacles: [],
    });
    expect(heading.x).toBeCloseTo(0, 6);
    expect(heading.z).toBeCloseTo(1, 6);
  });

  it("turns the least it has to past a tent between the eye and the learner", () => {
    const tent = { x: -0.6, z: 3.5, r: 1.2 };
    const heading = chooseCloseUpHeading({
      home: { x: 0, z: 1 },
      look,
      reach: 7,
      subjects,
      obstacles: [tent],
    });
    expect(Math.abs(Math.atan2(heading.x, heading.z))).toBeGreaterThan(0.1);
    expect(Math.abs(Math.atan2(heading.x, heading.z))).toBeLessThanOrEqual(
      (50 * Math.PI) / 180 + 1e-9,
    );
  });

  it("ignores flowers and pebbles", () => {
    const heading = chooseCloseUpHeading({
      home: { x: 0, z: 1 },
      look,
      reach: 7,
      subjects,
      obstacles: [{ x: 0, z: 3.5, r: 0.5 }],
    });
    expect(heading.z).toBeCloseTo(1, 6);
  });
});
