// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as worldMaps from "@pieai/university-world/Maps.js";
import { useWorldMarkers, useWorldModel } from "./world-model.js";

afterEach(() => vi.restoreAllMocks());

describe("the planet's pointer path", () => {
  it("uses the shared rock-root caption without changing a course's identity, state or click action", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const node = {
      studyId: "caption-test",
      studyTitle: "Caption test",
      courseId: "course",
      title: "原课程",
      lessons: 6,
      depth: 0,
      prerequisiteCourseIds: [],
      trackId: null,
    };
    const world = worldMaps.placeStudyArchipelago([node], () => 0, node.studyId);
    const original = world.placements[0]!.position.clone();
    const picked = vi.fn();
    const onCoursePick = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    let markers: ReturnType<typeof useWorldMarkers> = [];
    function Probe() {
      markers = useWorldMarkers({
        world,
        lessons: [],
        view: { kind: "world" },
        labelNodes: { current: new Map() },
        setPathOverlay: vi.fn(),
        setPicked: picked,
        onCoursePick,
      });
      return null;
    }
    try {
      await act(async () => root.render(createElement(Probe)));
      expect(markers).toHaveLength(1);
      expect(markers[0]?.kind).toBe("course");
      expect(markers[0]?.id).toBe(node.courseId);
      expect(markers[0]?.text).toBe(node.title);
      expect(markers[0]?.courseState).toBe(world.placements[0]?.state);
      expect(markers[0]?.position).toEqual(
        worldMaps.worldIslandCaptionTarget(world.placements[0]!),
      );
      expect(markers[0]!.position.y).toBeLessThan(original.y);
      expect(world.placements[0]!.position).toEqual(original);
      markers[0]?.activate?.();
      expect(picked).toHaveBeenCalledExactlyOnceWith(node);
      expect(onCoursePick).toHaveBeenCalledOnce();
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("does not prepare a hidden series on selection; entering prepares that exact series", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const place = vi.spyOn(worldMaps, "placeStudyArchipelago");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let model: ReturnType<typeof useWorldModel> | undefined;
    const common = {
      nodes: [],
      studies: [
        { id: "buzz", title: "Buzz", courses: [] },
        { id: "turing-pact", title: "TuringPact", courses: [] },
      ],
      courseProgress: () => 0,
      lessonsDone: () => 0,
      todayNode: null,
    };
    function Probe(props: Parameters<typeof useWorldModel>[0]) {
      model = useWorldModel(props);
      return null;
    }
    try {
      for (const navigationFocus of ["turing-pact", "buzz"]) {
        await act(async () => {
          root.render(
            createElement(Probe, { ...common, navigationFocus, view: { kind: "planet" } }),
          );
        });
        expect(model?.world).toBeNull();
        expect(model?.focusedStudyId).toBe(navigationFocus);
        expect(model?.planetStudies.map((study) => study.id)).toEqual(["buzz", "turing-pact"]);
      }
      expect(place).not.toHaveBeenCalled();
      await act(async () => {
        root.render(
          createElement(Probe, { ...common, navigationFocus: "buzz", view: { kind: "world" } }),
        );
      });
      expect(place).toHaveBeenCalledExactlyOnceWith(common.nodes, common.courseProgress, "buzz");
      expect(model?.world).not.toBeNull();
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});

describe("a course whose prerequisites are not met", () => {
  /*
    Greyed and still clickable. The marker carries `locked` so the label can dim,
    and it keeps its activate handler, because locking the door would shut out
    exactly the learner this whole mechanism exists for — the one who already
    knows the earlier material and is trying to skip past it (V5 decision 12C).
  */
  it("is marked locked for dimming but keeps its click action", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const first = {
      studyId: "chain",
      studyTitle: "Chain",
      courseId: "first",
      title: "第一门",
      lessons: 6,
      depth: 0,
      prerequisiteCourseIds: [],
      trackId: null,
    };
    const second = { ...first, courseId: "second", title: "第二门", depth: 1 };
    const world = worldMaps.placeStudyArchipelago([first, second], () => 0, first.studyId);
    // The projection reads the placement's state; drive it directly so this test
    // is about the marker, not about how a listing decides a course is idle.
    const placements = world.placements.map((placement, index) => ({
      ...placement,
      state: index === 0 ? ("open" as const) : ("idle" as const),
    }));
    const container = document.createElement("div");
    const root = createRoot(container);
    let markers: ReturnType<typeof useWorldMarkers> = [];
    function Probe() {
      markers = useWorldMarkers({
        world: { ...world, placements },
        lessons: [],
        view: { kind: "world" },
        labelNodes: { current: new Map() },
        setPathOverlay: vi.fn(),
        setPicked: vi.fn(),
        onCoursePick: vi.fn(),
      });
      return null;
    }
    try {
      await act(async () => root.render(createElement(Probe)));
      const open = markers.find((marker) => marker.id === "first");
      const idle = markers.find((marker) => marker.id === "second");
      expect(open?.locked).toBe(false);
      expect(idle?.locked).toBe(true);
      expect(typeof idle?.activate).toBe("function");
    } finally {
      await act(async () => root.unmount());
    }
  });
});
