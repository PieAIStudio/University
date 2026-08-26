import { describe, expect, it } from "vitest";

import {
  COURSE_PATH,
  COURSE_STEP,
  courseIslandExtent,
  layoutCourse,
  layoutCourseRoad,
  layoutPath,
  layoutStudyRoad,
  STUDY_PATH,
} from "./layout";

describe("layoutPath", () => {
  it("advances by one step per node", () => {
    const placed = layoutPath(8, COURSE_PATH);
    expect(placed).toHaveLength(8);
    expect(placed[0]!.z - placed[1]!.z).toBeCloseTo(COURSE_STEP, 5);
  });

  /*
    Both callers measure the extent of what comes back to size something — the
    sea ring at study level, the island at course level. A road running from 0
    to −222 has its centroid a hundred units from its own origin, and every
    such measurement is then wrong by half the road.
  */
  it("centres the road on the origin so extents mean something", () => {
    for (const count of [1, 2, 12, 41]) {
      const placed = layoutPath(count, STUDY_PATH);
      const mid = (placed[0]!.z + placed[count - 1]!.z) / 2;
      expect(mid).toBeCloseTo(0, 6);
    }
  });

  it("is flat — the rise moved into the island's own dome", () => {
    expect(layoutPath(20, COURSE_PATH).every((point) => point.y === 0)).toBe(true);
  });

  /*
    The swing has to read as a road, not as a zigzag and not as a ruler. Lateral
    travel per step above roughly 1.5× the forward step is a switchback; below
    about a fifth of it the curve is invisible and the thing looks straight.
  */
  it("leans enough to read as a curve and not so much as to switch back", () => {
    for (const shape of [STUDY_PATH, COURSE_PATH]) {
      const placed = layoutPath(24, shape);
      const sideways = placed.slice(1).map((point, index) => Math.abs(point.x - placed[index]!.x));
      expect(Math.max(...sideways)).toBeLessThan(shape.step * 1.5);
      expect(Math.max(...sideways)).toBeGreaterThan(shape.step * 0.2);
    }
  });

  /*
    93 of the 146 units are exactly four lessons. A period that divides four
    puts every unit boundary at the same point in the swing, and the road
    visibly repeats — the first draft of this shape used 8 and this assertion
    is what caught it.
  */
  it("never repeats the swing on a unit boundary", () => {
    for (const shape of [STUDY_PATH, COURSE_PATH]) {
      for (const commonUnitSize of [2, 3, 4]) {
        expect(shape.period % commonUnitSize).not.toBe(0);
      }
    }
  });
});

describe("layoutStudyRoad", () => {
  it("keeps the order it is given", () => {
    const placed = layoutStudyRoad(["a", "b", "c", "d"]);
    const z = ["a", "b", "c", "d"].map((id) => placed.get(id)!.z);
    for (let index = 1; index < z.length; index += 1) {
      expect(z[index]!).toBeLessThan(z[index - 1]!);
    }
  });

  /*
    Stability is the property, not just determinism. A layout keyed to content
    would be deterministic and still wrong: an author fixing one typo would
    rearrange a learner's whole world overnight.
  */
  it("puts a course in the same place every time", () => {
    const once = layoutStudyRoad(["alpha", "beta", "gamma"]);
    const twice = layoutStudyRoad(["alpha", "beta", "gamma"]);
    expect([...once.entries()]).toEqual([...twice.entries()]);
  });

  it("sways off the ruler without breaking the road", () => {
    const placed = layoutStudyRoad(["one", "two", "three", "four", "five", "six", "seven"]);
    const sway = [...placed.values()].map((point) => point.x);
    expect(new Set(sway).size).toBe(sway.length);
    expect(Math.max(...sway.map(Math.abs))).toBeLessThan(STUDY_PATH.amplitude * 1.2);
  });
});

describe("layoutCourse", () => {
  it("lays every lesson of every unit on one road", () => {
    const placed = layoutCourse([4, 4, 3]);
    expect(placed).toHaveLength(11);
    expect(placed.map((point) => point.depth)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2]);
  });

  it("places teaching order from the top of the path toward the viewer", () => {
    const placed = layoutCourse([4, 4, 3]);
    expect(placed[0]!.z).toBeLessThan(placed.at(-1)!.z);
  });

  /*
    A unit boundary used to be a shelf in the terrain. The stones lie on one
    island now, and a floor that steps up under every fourth stone is a
    staircase, not ground. The unit is a heading; a heading does not move the
    floor.
  */
  it("does not step up at a unit boundary any more", () => {
    const placed = layoutCourse([4, 4]);
    expect(placed[4]!.y).toBe(placed[3]!.y);
  });

  it("spends a long course across a compact, evenly spaced meander", () => {
    const placed = layoutCourseRoad(41);
    const gaps = placed
      .slice(1)
      .map((point, index) => Math.hypot(point.x - placed[index]!.x, point.z - placed[index]!.z));
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.15);
    expect(Math.max(...placed.map((point) => Math.abs(point.z)))).toBeLessThan(
      ((41 - 1) * COURSE_STEP) / 3,
    );
  });
});

describe("courseIslandExtent", () => {
  it("always contains its own road", () => {
    for (const lessons of [1, 4, 12, 41]) {
      const extent = courseIslandExtent(lessons);
      for (const point of layoutCourse([lessons])) {
        expect(Math.abs(point.x)).toBeLessThan(extent.x);
        expect(Math.abs(point.z)).toBeLessThan(extent.z);
      }
    }
  });

  /*
    A one-lesson course is a real course — nine of the fifty-two are under four
    lessons. Its island still has to be land rather than a disc the size of the
    marker standing on it.
  */
  it("gives a one-lesson course an island, not a coin", () => {
    const extent = courseIslandExtent(1);
    expect(Math.min(extent.x, extent.z)).toBeGreaterThan(COURSE_PATH.step * 1.5);
  });

  it("keeps a 41-lesson island broad enough to read as land, not a strip", () => {
    const extent = courseIslandExtent(41);
    expect(extent.z / extent.x).toBeLessThan(2.5);
  });
});
