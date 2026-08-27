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

    /*
      Every label in this diagram is Chinese, and mermaid's default stack —
      trebuchet ms, verdana, arial — contains no CJK glyph. Wherever the
      generic `sans-serif` is a Latin face, that renders as tofu boxes with
      the text sitting correctly in the DOM the whole time, so no assertion
      about content can catch it. Assert the font instead: the diagram must
      inherit the page's own token rather than a stack copied beside it.
    */
    const injected = host.querySelector("svg style")?.textContent ?? "";
    expect(injected).toContain("var(--game-ui-font-body)");
    expect(injected).not.toContain("trebuchet");

    root.unmount();
    host.remove();
    /*
      60s, not the 20s this file used to ask for. The budget is spent on
      `import("./MermaidDiagram.js")` pulling mermaid itself in, not on the
      assertions: run alone this whole test finishes in about six seconds,
      and the inner wait above can only ever spend 1.5s of it. Under
      `pnpm -r test`, which builds and tests four packages at once, that one
      import crossed 20s and killed the test at the clock instead of at an
      assertion — the same failure `vitest.config.ts` documents for
      `MarkdownContent.test.tsx`, arriving through a different door. A wrong
      assertion still fails immediately and says what it expected; only a busy
      machine needs the headroom.
    */
  }, 60000);
});
