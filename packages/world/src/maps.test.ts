import { describe, expect, it } from "vitest";

import type { ProgressSource } from "@pieai/university-core";

import { placeCourse, placeWorld } from "./Maps.js";
import type { Course, CourseNode } from "./course/course.js";
import { islandGeometryProjection } from "./island/island-blueprint.js";

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

function summaryNode(): CourseNode {
  return {
    courseId: course.id,
    title: course.id,
    lessons: 3,
    studyId: "turing-pact",
    studyTitle: "TuringPact",
    depth: 0,
    prerequisiteCourseIds: [],
    trackId: null,
  };
}

describe("Maps  projection contract", () => {
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
