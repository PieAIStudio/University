import { describe, expect, it } from "vitest";

import type { CourseView, StudySummary, StudyView } from "@pieai/university-ui/view/lesson-view.js";

import {
  courseNodesFromCatalog,
  courseProgressOf,
  lessonsDoneOf,
  resumeOf,
} from "./world-graph.js";

function lesson(
  id: string,
  progress: CourseView["units"][number]["lessons"][number]["progress"],
): CourseView["units"][number]["lessons"][number] {
  return {
    id,
    title: id,
    status: "active",
    contentRevision: 1,
    cardCount: 0,
    exerciseCount: 0,
    progress,
  };
}

function course(id: string, extra: Partial<CourseView> = {}): CourseView {
  return {
    id,
    title: id,
    description: "",
    audience: "",
    objectives: [],
    status: "active",
    isDefault: false,
    units: [
      {
        id: "u",
        title: "U",
        objective: "",
        status: "active",
        lessons: [
          lesson("a", {
            contentRevision: 1,
            status: "completed",
            progress: 1,
            updatedAt: "2026-08-01T00:00:00.000Z",
            readConfirmed: true,
          }),
          lesson("b", null),
        ],
      },
    ],
    ...extra,
  };
}

const summary = (id: string): StudySummary =>
  ({
    id,
    title: id,
    description: "",
    goals: [],
    defaultCourseId: null,
    sourceRegistered: true,
    snapshotCount: 0,
    uaAnalysisCount: 0,
    readyUaAnalysisCount: 0,
    courseCount: 1,
    activeCourseCount: 1,
    defaultCourse: null,
    hasLearningDatabase: true,
    lastActivityAt: null,
  }) as StudySummary;

describe("world-graph", () => {
  it("counts progress against the current revision and resumes at the first unfinished lesson", () => {
    const viewed = course("foundations");
    expect(courseProgressOf(viewed)).toBe(0.5);
    expect(lessonsDoneOf(viewed)).toBe(1);
    expect(resumeOf(viewed)).toEqual({ unitId: "u", lessonId: "b" });
  });

  it("reads prerequisites off the study payload and computes depth", () => {
    const first = course("first");
    const second = course("second");
    (second as CourseView & { prerequisiteCourseIds: readonly string[] }).prerequisiteCourseIds = [
      "first",
    ];
    const view: StudyView = {
      study: { id: "pact", title: "Pact", description: "", goals: [], defaultCourseId: null },
      courses: [first, second],
      notes: [],
    };
    const nodes = courseNodesFromCatalog([summary("pact")], new Map([["pact", view]]));
    expect(nodes).toHaveLength(2);
    expect(nodes.find((node) => node.courseId === "first")?.depth).toBe(0);
    expect(nodes.find((node) => node.courseId === "second")?.depth).toBe(1);
    expect(nodes.find((node) => node.courseId === "second")?.prerequisiteCourseIds).toEqual([
      "first",
    ]);
  });
});
