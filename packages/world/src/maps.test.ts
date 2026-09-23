import { describe, expect, it } from "vitest";

import type { ProgressSource } from "@pieai/university-core";

import { placeCourse, placeWorld } from "./Maps.js";
import type { Course, CourseNode } from "./course/course.js";
import { islandGeometryProjection, sampleIslandSurface } from "./island/island-blueprint.js";
import { sampleIslandTerrainTop } from "./island/island-geometry.js";
import { courseMarkers } from "./course/course-map.js";

const source: ProgressSource = {
  completionOf: () => ({ exercisesPassed: false, readConfirmed: false }),
};

const course: Course = {
  id: "foundations-before-zero",
  units: [
    {
      id: "unit-one",
      title: "One",
      lessons: [
        {
          id: "lesson-one",
          title: "One",
          content: "one",
          contentRevision: 1,
          exerciseIds: [],
          exercises: [],
          cards: [],
        },
        {
          id: "lesson-two",
          title: "Two",
          content: "two",
          contentRevision: 1,
          exerciseIds: [],
          exercises: [],
          cards: [],
        },
      ],
    },
    {
      id: "unit-two",
      title: "Two",
      lessons: [
        {
          id: "lesson-three",
          title: "Three",
          content: "three",
          contentRevision: 1,
          exerciseIds: [],
          exercises: [],
          cards: [],
        },
      ],
    },
  ],
};

function makeCourse(id: string, lessonCount: number, unitCount = 2): Course {
  const perUnit = Math.ceil(lessonCount / Math.max(1, unitCount));
  const units: Course["units"][number][] = [];
  let remaining = lessonCount;
  for (let unitIndex = 0; unitIndex < unitCount && remaining > 0; unitIndex += 1) {
    const count = Math.min(perUnit, remaining);
    remaining -= count;
    const start = lessonCount - remaining - count;
    units.push({
      id: `${id}-unit-${unitIndex + 1}`,
      title: `Unit ${unitIndex + 1}`,
      lessons: Array.from({ length: count }, (_, slot) => ({
        id: `${id}-lesson-${start + slot + 1}`,
        title: `Lesson ${start + slot + 1}`,
        content: "x",
        contentRevision: 1,
        exerciseIds: [],
        exercises: [],
        cards: [],
      })),
    });
  }
  return { id, units };
}

function summaryNode(): CourseNode {
  return {
    courseId: course.id,
    title: course.id,
    lessons: 3,
    // What `courseNodesOf` records; it decides where the course's gates widen the road.
    unitLessonCounts: course.units.map((unit) => unit.lessons.length),
    studyId: "turing-pact",
    studyTitle: "TuringPact",
    depth: 0,
    prerequisiteCourseIds: [],
    trackId: null,
  };
}

describe("Maps  projection contract", () => {
  it("preserves four readable non-colour learning states independently of the unit sigil", () => {
    const states = ["live", "idle", "done", "locked"] as const;
    const lessons = placeCourse("turing-pact", makeCourse("state-cues", 4, 1), source).map(
      (lesson, index) => ({ ...lesson, state: states[index]! }),
    );
    const labels = courseMarkers(lessons, { onPick: () => undefined });
    const names = labels.filter((label) => label.kind === "lesson");
    expect(names.map((label) => label.lessonState)).toEqual(states);
    for (const [index, word] of ["当前关卡", "可学习", "已完成", "后续关卡"].entries()) {
      expect(names[index]?.label).toContain(word);
      expect(names[index]?.activate).toBeTypeOf("function");
    }
    expect(names[0]?.text).toBe("开始");
    const completedIcon = labels.find(
      (label) => label.kind === "icon" && label.lessonState === "done",
    );
    expect(completedIcon?.text).toBe("✓");
    expect(
      lessons.every((lesson) => lesson.visualToken.sigil === lessons[0]!.visualToken.sigil),
    ).toBe(true);
  });
  it("locks every lesson after the first one neither finished nor proven (V5 §12 C′)", () => {
    const five = makeCourse("lock-order", 5, 1);
    const ids = five.units[0]!.lessons.map((lesson) => lesson.id);
    const progress = (done: readonly string[], proven: readonly string[] = []): ProgressSource => ({
      completionOf: (ref) =>
        done.includes(ref.lessonId)
          ? { exercisesPassed: true, readConfirmed: true }
          : { exercisesPassed: false, readConfirmed: false },
      provenOf: (ref) => proven.includes(ref.lessonId),
    });
    const states = (source: ProgressSource) =>
      placeCourse("turing-pact", five, source).map((lesson) => lesson.state);

    // A newcomer can only start at the beginning.
    expect(states(progress([]))).toEqual(["live", "locked", "locked", "locked", "locked"]);
    // Finishing one opens the next, and only the next.
    expect(states(progress([ids[0]!]))).toEqual(["done", "live", "locked", "locked", "locked"]);
    // A proven stretch (the gate's test) opens what follows it without counting as learned.
    expect(states(progress([], [ids[0]!, ids[1]!]))).toEqual([
      "idle",
      "idle",
      "live",
      "locked",
      "locked",
    ]);
    // Old progress that finished a later lesson out of order keeps it open.
    expect(states(progress([ids[3]!]))).toEqual(["live", "locked", "locked", "done", "locked"]);
    // Everything finished: nothing is locked.
    expect(states(progress(ids))).toEqual(["done", "done", "done", "done", "done"]);
  });
  it("keeps real lesson and unit identities in one shared blueprint", () => {
    const lessons = placeCourse("turing-pact", course, source);
    const blueprint = lessons[0]?.blueprint;

    expect(lessons.map((lesson) => lesson.lessonId)).toEqual([
      "lesson-one",
      "lesson-two",
      "lesson-three",
    ]);
    expect(lessons.map((lesson) => lesson.unitId)).toEqual(["unit-one", "unit-one", "unit-two"]);
    expect(lessons.every((lesson) => lesson.blueprint === blueprint)).toBe(true);
    expect(blueprint?.nodes.map((node) => node.id)).toEqual([
      "lesson-one",
      "lesson-two",
      "lesson-three",
    ]);
    expect(lessons[0]?.visualToken).toEqual(lessons[1]?.visualToken);
    expect(lessons[0]?.visualToken).not.toEqual(lessons[2]?.visualToken);
    for (const [index, lesson] of lessons.entries()) {
      const node = blueprint!.nodes[index]!;
      const mesh = sampleIslandTerrainTop(blueprint!, "course", node.x, node.z);
      expect(lesson.lessonId).toBe(node.id);
      expect(lesson.position.x).toBe(node.x);
      expect(lesson.position.z).toBe(node.z);
      expect(lesson.position.y).toBeCloseTo(mesh.y, 8);
      expect(mesh.inside).toBe(true);
    }
  });

  it("places every lesson on the rendered terrain top across counts and seeds", () => {
    // Placement covers rendered height; route clearance is covered by blueprint tests.
    for (const lessonCount of [6, 12, 24, 41]) {
      for (const seed of ["alpha", "beta", "gamma"]) {
        const course = makeCourse(`continuous-${seed}`, lessonCount);
        const lessons = placeCourse("turing-pact", course, source);
        const blueprint = lessons[0]?.blueprint;
        const label = `${lessonCount}/${seed}`;
        expect(lessons, label).toHaveLength(lessonCount);
        expect(blueprint, label).toBeDefined();
        expect(
          lessons.every((lesson) => lesson.blueprint === blueprint),
          label,
        ).toBe(true);
        expect(
          lessons.map((lesson) => lesson.lessonId),
          label,
        ).toEqual(blueprint!.nodes.map((node) => node.id));
        for (const [index, lesson] of lessons.entries()) {
          const node = blueprint!.nodes[index]!;
          const mesh = sampleIslandTerrainTop(blueprint!, "course", node.x, node.z);
          const analytic = sampleIslandSurface(blueprint!, node.x, node.z);
          expect(lesson.position.x, `${label}/${lesson.lessonId}`).toBe(node.x);
          expect(lesson.position.z, `${label}/${lesson.lessonId}`).toBe(node.z);
          expect(lesson.position.y, `${label}/${lesson.lessonId}`).toBeCloseTo(mesh.y, 8);
          expect(mesh.inside, `${label}/${lesson.lessonId}`).toBe(true);
          expect(analytic.inside, `${label}/${lesson.lessonId}`).toBe(true);
        }
      }
    }
  });

  it("uses one complete geometry base and projects world/course semantics separately", () => {
    const courseLessons = placeCourse("turing-pact", course, source);
    const world = placeWorld([summaryNode()], () => 0, "turing-pact");
    const worldBlueprint = world.placements[0]?.blueprint;
    const courseBlueprint = courseLessons[0]?.blueprint;

    expect(worldBlueprint).toBeDefined();
    expect(courseBlueprint).toBeDefined();
    expect(islandGeometryProjection(worldBlueprint!)).toEqual(
      islandGeometryProjection(courseBlueprint!),
    );
    expect(worldBlueprint!.nodes.map((node) => node.id)).toEqual([
      "foundations-before-zero/fixture-lesson-1",
      "foundations-before-zero/fixture-lesson-2",
      "foundations-before-zero/fixture-lesson-3",
    ]);
    expect(courseBlueprint!.nodes.map((node) => node.id)).toEqual([
      "lesson-one",
      "lesson-two",
      "lesson-three",
    ]);
    expect(courseBlueprint!.nodes.map(({ index, t, x, y, z }) => ({ index, t, x, y, z }))).toEqual(
      courseBlueprint!.geometryNodes,
    );
  });
});
