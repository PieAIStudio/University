// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  const bbox = () =>
    ({
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      top: 0,
      left: 0,
      bottom: 20,
      right: 100,
      toJSON() {
        return this;
      },
    }) as DOMRect;
  (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = bbox;
  (SVGGraphicsElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = bbox;
});

describe("mermaid four-layer diagram end-to-end", () => {
  it("renders and survives HTML-label SVG sanitization", async () => {
    const { MermaidDiagram } = await import("./MermaidDiagram.js");
    const { createRoot } = await import("react-dom/client");
    const { act } = await import("react");
    const source = `flowchart TB
  subgraph hosts["完整工作环境 · 给人用的 AI 宿主"]
    direction LR
    GB["Grok Build<br/>日课宿主 · 订阅会话"]
    PI["pi coding-agent<br/>终端宿主 · /login OAuth"]
  end
  UL["UniversityLocal<br/>学习产品"]
  GB -->|"人在宿主里学/教<br/>会话不自动进 Web"| UL
  PI --> UL
`;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render((await import("react")).createElement(MermaidDiagram, { source }));
    });
    // wait for async render
    for (let i = 0; i < 30; i++) {
      if (host.querySelector("svg")) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(host.querySelector("svg")).not.toBeNull();
    expect(host.textContent).not.toContain("暂时无法渲染");
    root.unmount();
    host.remove();
  }, 20000);
});
