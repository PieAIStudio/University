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
