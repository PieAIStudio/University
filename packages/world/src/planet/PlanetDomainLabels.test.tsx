// @vitest-environment jsdom

import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { PlanetDomainLabels } from "./PlanetDomainLabels.js";
import type { PlanetStudy } from "./planet-copy.js";

describe("domain labels", () => {
  it("marks only empty domains unpublished and removes the status when real studies arrive", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const domainCatalog = [
      { id: "programming", title: "AI 与编程" },
      { id: "ai-foundations", title: "AI 基础" },
      { id: "ai-media", title: "AI 媒体创作" },
    ];
    const real: PlanetStudy = {
      id: "actual-study",
      title: "实际系列",
      domain: domainCatalog[0],
      courseCount: 1,
      lessonCount: 3,
      lessonsDone: 0,
      courses: [{ id: "actual-course", title: "实际课程", lessonCount: 3, depth: 0 }],
      courseTitles: ["实际课程"],
    };
    const container = document.createElement("div");
    const root = createRoot(container);
    const nodes = new Map<string, HTMLElement>();
    try {
      await act(async () =>
        root.render(
          <StrictMode>
            <PlanetDomainLabels
              studies={[real]}
              domainCatalog={domainCatalog}
              selectedId={real.id}
              selectedDomainId="ai-media"
              nodes={nodes}
            />
          </StrictMode>,
        ),
      );
      expect([...nodes.keys()].sort()).toEqual(["ai-foundations", "ai-media", "programming"]);
      expect(nodes.get("programming")?.textContent).toBe("AI 与编程");
      expect(nodes.get("ai-foundations")?.textContent).toContain("暂未发布");
      expect(nodes.get("ai-media")?.textContent).toContain("暂未发布");
      expect(nodes.get("ai-media")?.dataset.active).toBe("true");
      await act(async () =>
        root.render(
          <PlanetDomainLabels
            studies={[real, { ...real, id: "new-real-study", domain: domainCatalog[1] }]}
            domainCatalog={domainCatalog}
            selectedId="new-real-study"
            selectedDomainId="ai-foundations"
            nodes={nodes}
          />,
        ),
      );
      expect(nodes.get("ai-foundations")?.textContent).toBe("AI 基础");
      expect(nodes.get("ai-foundations")?.dataset.active).toBe("true");
      expect(nodes.get("ai-media")?.textContent).toContain("暂未发布");
    } finally {
      await act(async () => root.unmount());
    }
    expect(nodes.size).toBe(0);
  });
});
