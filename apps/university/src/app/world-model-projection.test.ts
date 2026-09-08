// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as worldMaps from "@pieai/university-world/Maps.js";
import { useWorldModel } from "./world-model.js";

afterEach(() => vi.restoreAllMocks());

describe("the planet's pointer path", () => {
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
