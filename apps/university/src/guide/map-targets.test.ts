// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createTargetRegistry } from "@pieai/swimmer-nerve-kit/targets";
import {
  placedByEngine,
  reconcileTargets,
  releaseTargets,
  type RegisteredTarget,
} from "./map-targets.js";

describe("map targets keep their identity across renders and expire on replacement", () => {
  const label = (text: string) => {
    const element = document.createElement("button");
    element.textContent = text;
    return element;
  };

  it("an unchanged place keeps its registration; a changed one is a new object", () => {
    const registry = createTargetRegistry();
    const registered = new Map<string, RegisteredTarget>();
    const stone = label("开始");
    reconcileTargets(registry, registered, [{ id: "marker:l2", element: stone, label: "第二节" }]);
    const gesture = registry.capture("marker:l2")!;
    expect(gesture.contextElement?.()).toBe(stone);

    // An ordinary re-render: same element, same name. The gesture survives.
    expect(
      reconcileTargets(registry, registered, [{ id: "marker:l2", element: stone, label: "第二节" }])
        .size,
    ).toBe(0);
    expect(gesture.contextElement?.()).toBe(stone);

    // Same id, new facts: the old gesture does not follow the replacement.
    const changed = reconcileTargets(registry, registered, [
      { id: "marker:l2", element: stone, label: "第二节", description: "已完成" },
    ]);
    expect([...changed]).toEqual(["marker:l2"]);
    expect(gesture.contextElement?.()).toBeNull();
    expect(registry.capture("marker:l2")?.contextElement?.()).toBe(stone);

    // Gone from the map: unregistered.
    expect([...reconcileTargets(registry, registered, [])]).toEqual(["marker:l2"]);
    expect(registry.capture("marker:l2")).toBeNull();
  });

  it("a label the engine has not placed is unavailable, whatever the DOM says", () => {
    const registry = createTargetRegistry();
    const registered = new Map<string, RegisteredTarget>();
    const island = label("认识 AI");
    document.body.append(island);
    reconcileTargets(registry, registered, [
      { id: "marker:c1", element: island, label: "认识 AI", available: placedByEngine },
    ]);
    expect(registry.locate("marker:c1")).toBeNull();
    releaseTargets(registered);
    expect(registry.capture("marker:c1")).toBeNull();
    island.remove();
  });

  it("an id the registry refuses is skipped, not thrown into the map", () => {
    const registry = createTargetRegistry();
    const registered = new Map<string, RegisteredTarget>();
    expect(() =>
      reconcileTargets(registry, registered, [
        { id: " bad id", element: label("x"), label: "x" },
        { id: "marker:ok", element: label("y"), label: "y" },
      ]),
    ).not.toThrow();
    expect(registered.has("marker:ok")).toBe(true);
    expect(registered.has(" bad id")).toBe(false);
  });
});
