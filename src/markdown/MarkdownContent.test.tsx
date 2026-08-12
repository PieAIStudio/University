// @vitest-environment jsdom

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearEvidenceSnippetCache } from "../evidence/load-evidence-snippet.js";
import type { LessonAssetView, LessonSectionView } from "../view/lesson-view.js";
import { isLocalUrl, MarkdownContent } from "./MarkdownContent.js";

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}));

vi.mock("mermaid", () => ({ default: mermaidMock }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  mermaidMock.initialize.mockClear();
  mermaidMock.render.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  clearEvidenceSnippetCache();
  vi.unstubAllGlobals();
});

async function renderMarkdown(
  markdown: string,
  props: Partial<ComponentProps<typeof MarkdownContent>> = {},
) {
  await act(async () => {
    root.render(<MarkdownContent {...props}>{markdown}</MarkdownContent>);
  });
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  });
}

const diagramAsset: LessonAssetView = {
  id: "local-diagram",
  kind: "diagram",
  mime: "image/svg+xml",
  url: "/api/local-diagram",
  alt: "A local diagram",
  caption: "The local route map.",
};

const section: LessonSectionView = { id: "foundation", title: "Foundation" };

async function waitFor(assertion: () => void) {
  await act(async () => {
    await vi.waitFor(assertion);
  });
}

describe("MarkdownContent Mermaid rendering", () => {
  it("leaves ordinary fenced code unchanged without loading Mermaid", async () => {
    await renderMarkdown("```typescript\nconst answer = 42;\n```");

    const code = container.querySelector("pre > code.language-typescript");
    expect(code?.textContent).toBe("const answer = 42;\n");
    expect(mermaidMock.initialize).not.toHaveBeenCalled();
    expect(mermaidMock.render).not.toHaveBeenCalled();
  });

  it("rejects external addresses before Mermaid can create temporary DOM", async () => {
    await renderMarkdown(
      "```mermaid\nflowchart LR\n  A[Local] --> B[https://example.com/private]\n```",
    );
    await waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());

    expect(container.textContent).toContain("只渲染纯本地关系图");
    expect(mermaidMock.initialize).not.toHaveBeenCalled();
    expect(mermaidMock.render).not.toHaveBeenCalled();
  });

  it("rejects oversized diagrams before invoking Mermaid", async () => {
    const source = ["flowchart LR", ...Array.from({ length: 301 }, () => "  A --> B")].join("\n");
    await renderMarkdown(`\`\`\`mermaid\n${source}\n\`\`\``);
    await waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());

    expect(container.textContent).toContain("300 行");
    expect(mermaidMock.render).not.toHaveBeenCalled();
  });

  it("rejects a single extremely long diagram before invoking Mermaid", async () => {
    const source = `flowchart LR\n  A[${"x".repeat(32_001)}]`;
    await renderMarkdown(`\`\`\`mermaid\n${source}\n\`\`\``);
    await waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());

    expect(container.textContent).toContain("字符的本地上限");
    expect(mermaidMock.render).not.toHaveBeenCalled();
  });

  it("loads Mermaid on demand with strict settings and never binds interactions", async () => {
    const bindFunctions = vi.fn();
    mermaidMock.render.mockResolvedValue({
      svg: '<svg data-diagram="current"><text>登录边界</text></svg>',
      bindFunctions,
    });

    await renderMarkdown("```mermaid\nflowchart LR\n  A[浏览器] --> B[API]\n```");
    await waitFor(() => expect(container.querySelector("svg")).not.toBeNull());

    expect(mermaidMock.initialize).toHaveBeenCalledWith({
      securityLevel: "antiscript",
      startOnLoad: false,
      suppressErrorRendering: true,
      theme: "dark",
      flowchart: {
        htmlLabels: true,
        useMaxWidth: true,
      },
    });
    expect(mermaidMock.render).toHaveBeenCalledWith(
      expect.stringMatching(/^university-mermaid-[a-zA-Z0-9_-]+-render-1$/),
      "flowchart LR\n  A[浏览器] --> B[API]",
    );
    expect(bindFunctions).not.toHaveBeenCalled();
    expect(container.querySelector("figure.mermaid-diagram")?.id).toMatch(
      /^university-mermaid-[a-zA-Z0-9_-]+$/,
    );
  });

  it("keeps readable source when Mermaid rejects invalid syntax", async () => {
    mermaidMock.render.mockRejectedValue(new Error("Parse error"));
    const source = 'flowchart LR\n  A["<script>"] -->';

    await renderMarkdown(`\`\`\`mermaid\n${source}\n\`\`\``);
    await waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());

    expect(container.textContent).toContain("原始 Mermaid 源码已保留");
    expect(container.querySelector("code.language-mermaid")?.textContent).toBe(source);
    expect(container.querySelector("script")).toBeNull();
  });

  it("removes remote-capable SVG content while preserving local fragment references", async () => {
    mermaidMock.render.mockResolvedValue({
      svg: [
        '<svg xmlns="http://www.w3.org/2000/svg" onload="steal()">',
        '<defs><path id="local-marker" d="M0 0" /></defs>',
        '<image href="https://example.com/track.png" />',
        '<a href="https://example.com/private"><text>external</text></a>',
        '<use href="#local-marker" />',
        '<rect data-safe="yes" style="fill: url(https://example.com/fill.svg)" />',
        "</svg>",
      ].join(""),
    });

    await renderMarkdown("```mermaid\nflowchart LR\n  Safe --> Local\n```");
    await waitFor(() => expect(container.querySelector("svg")).not.toBeNull());

    const svg = container.querySelector("svg");
    expect(svg?.hasAttribute("onload")).toBe(false);
    expect(svg?.querySelector("image")).toBeNull();
    expect(svg?.querySelector("a")?.hasAttribute("href")).toBe(false);
    expect(svg?.querySelector("use")?.getAttribute("href")).toBe("#local-marker");
    expect(svg?.querySelector('[data-safe="yes"]')?.hasAttribute("style")).toBe(false);
  });

  it("removes SMIL animation that could rewrite an attribute after sanitising", async () => {
    mermaidMock.render.mockResolvedValue({
      svg: [
        '<svg xmlns="http://www.w3.org/2000/svg">',
        '<defs><marker id="arrow"><path d="M0 0" /></marker></defs>',
        // Mermaid's own output shapes, which must survive.
        '<foreignObject width="80" height="20"><div>Local label</div></foreignObject>',
        '<use href="#arrow" />',
        // The bypass: rewrite href to something the attribute pass never saw.
        '<a href="#local"><set attributeName="href" to="https://evil.example" /><text>x</text></a>',
        '<rect><animate attributeName="fill" to="url(https://evil.example/x)" /></rect>',
        "</svg>",
      ].join(""),
    });

    await renderMarkdown("```mermaid\nflowchart LR\n  Safe --> Local\n```");
    await waitFor(() => expect(container.querySelector("svg")).not.toBeNull());

    const svg = container.querySelector("svg");
    expect(svg?.querySelector("set")).toBeNull();
    expect(svg?.querySelector("animate")).toBeNull();
    // Diagram content Mermaid actually produces is untouched.
    expect(svg?.querySelector("foreignObject")?.textContent).toBe("Local label");
    expect(svg?.querySelector("use")?.getAttribute("href")).toBe("#arrow");
  });

  it("ignores a stale render after the source changes quickly", async () => {
    let resolveOldRender: ((value: { svg: string }) => void) | undefined;
    const oldRender = new Promise<{ svg: string }>((resolve) => {
      resolveOldRender = resolve;
    });
    mermaidMock.render
      .mockImplementationOnce(() => oldRender)
      .mockResolvedValueOnce({ svg: '<svg data-diagram="new"></svg>' });

    await renderMarkdown("```mermaid\nflowchart LR\n  Old --> Result\n```");
    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));
    const stableId = container.querySelector("figure.mermaid-diagram")?.id;

    await renderMarkdown("```mermaid\nflowchart LR\n  New --> Result\n```");
    await waitFor(() => expect(container.querySelector('[data-diagram="new"]')).not.toBeNull());

    expect(container.querySelector("figure.mermaid-diagram")?.id).toBe(stableId);
    expect(mermaidMock.render.mock.calls[0]?.[0]).not.toBe(mermaidMock.render.mock.calls[1]?.[0]);

    resolveOldRender?.({ svg: '<svg data-diagram="old"></svg>' });
    await act(async () => {
      await oldRender;
    });

    expect(container.querySelector('[data-diagram="new"]')).not.toBeNull();
    expect(container.querySelector('[data-diagram="old"]')).toBeNull();
  });

  it("assigns a distinct stable container id to each diagram", async () => {
    mermaidMock.render.mockImplementation((id: string) =>
      Promise.resolve({ svg: `<svg data-render-id="${id}"></svg>` }),
    );

    await renderMarkdown(
      [
        "```mermaid",
        "flowchart LR",
        "  A --> B",
        "```",
        "",
        "```mermaid",
        "stateDiagram-v2",
        "  [*] --> Ready",
        "```",
      ].join("\n"),
    );
    await waitFor(() => expect(container.querySelectorAll("svg")).toHaveLength(2));

    const ids = [...container.querySelectorAll("figure.mermaid-diagram")].map(({ id }) => id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("local-only link and image policy", () => {
  it("classifies URLs by whether rendering them can leave the machine", () => {
    for (const local of [
      "",
      "#section",
      "/api/studies/supaluv",
      "./notes/a.md",
      "notes/a.md",
      "http://127.0.0.1:4317/api/health",
      "http://localhost:9999/x.png",
    ]) {
      expect(isLocalUrl(local), local).toBe(true);
    }

    for (const remote of [
      "//evil.example/track.png",
      "https://evil.example/track.png",
      "http://192.168.1.10/x.png",
      "https://localhost.evil.example/x.png",
      "ftp://example.com/x",
    ]) {
      expect(isLocalUrl(remote), remote).toBe(false);
    }
  });

  it("does not render an external image, and says what it blocked", async () => {
    await renderMarkdown("![tracking pixel](https://evil.example/track.png)\n");

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("外部图片已拦截");
    expect(container.textContent).toContain("https://evil.example/track.png");
  });

  it("still renders a relative image", async () => {
    await renderMarkdown("![diagram](./diagram.png)\n");

    expect(container.querySelector("img")?.getAttribute("src")).toBe("./diagram.png");
  });

  it("marks an external link and withholds the referrer", async () => {
    await renderMarkdown("[docs](https://example.com/docs)\n");
    const link = container.querySelector("a");

    expect(link?.getAttribute("href")).toBe("https://example.com/docs");
    expect(link?.getAttribute("rel")).toContain("noreferrer");
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  it("leaves an in-page link untouched", async () => {
    await renderMarkdown("[top](#top)\n");
    const link = container.querySelector("a");

    expect(link?.getAttribute("target")).toBeNull();
    expect(link?.getAttribute("rel")).toBeNull();
  });

  it("renders approved directives, stable section ids, and progressive detail", async () => {
    await renderMarkdown(
      [
        "## Foundation",
        "",
        ":::detail[先补一个概念]{.foundation}",
        "",
        "只有需要时才展开的说明。",
        ":::",
        "",
        ":::figure[路径图]{#local-diagram}",
        "",
        "课程作者的本地图。",
        ":::",
        "",
        ":::unknown[不支持]",
        "",
        "这段仍要显式报错。",
        ":::",
      ].join("\n"),
      { assets: [diagramAsset], sections: [section] },
    );

    expect(container.querySelector("h2")?.dataset.sectionId).toBe("foundation");
    expect(container.querySelector("details")?.open).toBe(false);
    expect(container.querySelector("summary")?.textContent).toContain("先补一个概念");
    expect(container.querySelector('img[src="/api/local-diagram"]')?.getAttribute("alt")).toBe(
      "A local diagram",
    );
    expect(container.querySelector(".lesson-directive-unsupported")?.textContent).toContain(
      "unknown",
    );

    await renderMarkdown(":::detail[全部细节]{.deep-dive}\n\n现在展开。\n\n:::", {
      detailMode: "all",
    });
    expect(container.querySelector("details")?.open).toBe(true);
  });

  it("renders fetched pinned source inline via the approved evidence index", async () => {
    const markdown = "证据：[[evidence:src/app.ts:4-5]]";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          sourcePath: "src/app.ts",
          sourceCommit: "a".repeat(40),
          startLine: 4,
          endLine: 5,
          highlightStartLine: 4,
          highlightEndLine: 5,
          language: "typescript",
          code: "const first = true;\nconst second = false;\n",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const onOpenEvidence = vi.fn();
    await renderMarkdown(markdown, {
      evidenceBasePath: "/api/lesson",
      onOpenEvidence,
      evidenceAnchors: [
        {
          start: markdown.indexOf("[["),
          end: markdown.length,
          sourcePath: "src/app.ts",
          lineStart: 4,
          lineEnd: 5,
          resolved: true,
          evidenceIndex: 0,
        },
      ],
    });
    await waitFor(() =>
      expect(
        container.querySelector(".evidence-inline-source .evidence-code")?.textContent,
      ).toContain("const first"),
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/lesson/evidence/0");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".evidence-inline-source__path")?.textContent).toBe(
      "src/app.ts",
    );
    expect(container.textContent).toContain("L4–5");
    expect(container.querySelector(".evidence-code__line--highlighted")).not.toBeNull();

    const openButton = container.querySelector<HTMLButtonElement>(
      'button[data-evidence-trigger="inline"]',
    );
    expect(openButton?.textContent).toContain("看完整文件");
    expect(openButton?.getAttribute("data-evidence-index")).toBe("0");
    expect(openButton?.getAttribute("data-evidence-trigger-id")).toBeTruthy();
  });

  it("keeps the source panel out of the paragraph, so the browser does not regroup the prose", async () => {
    // `<p><div>…<pre>…</pre></div></p>` is invalid, and a browser repairs it by
    // closing the paragraph early — silently changing how the surrounding text
    // is grouped. The anchor has to become a sibling of the prose, not a child.
    const markdown = "前面一句。\n\n[[evidence:src/app.ts:4-5]]\n\n后面一句。";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            sourcePath: "src/app.ts",
            sourceCommit: "a".repeat(40),
            startLine: 4,
            endLine: 5,
            highlightStartLine: 4,
            highlightEndLine: 5,
            language: "typescript",
            code: "const first = true;\n",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const start = markdown.indexOf("[[");
    await renderMarkdown(markdown, {
      evidenceBasePath: "/api/lesson",
      evidenceAnchors: [
        {
          start,
          end: start + "[[evidence:src/app.ts:4-5]]".length,
          sourcePath: "src/app.ts",
          lineStart: 4,
          lineEnd: 5,
          resolved: true,
          evidenceIndex: 0,
        },
      ],
    });
    await waitFor(() => expect(container.querySelector(".evidence-inline-source")).not.toBeNull());

    expect(container.querySelector("p .evidence-inline-source")).toBeNull();
    expect(container.querySelector("p pre")).toBeNull();
    // The prose either side survives as its own paragraph rather than being
    // absorbed into whatever the parser salvaged.
    const paragraphs = [...container.querySelectorAll("p")].map((node) => node.textContent);
    expect(paragraphs).toEqual(["前面一句。", "后面一句。"]);
  });

  it("splits a paragraph that holds an anchor mid-sentence, leaving no empty paragraph", async () => {
    const markdown = "前面。[[evidence:src/app.ts:1-1]] 后面。";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "not needed" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const start = markdown.indexOf("[[");
    await renderMarkdown(markdown, {
      evidenceBasePath: "/api/lesson",
      evidenceAnchors: [
        {
          start,
          end: start + "[[evidence:src/app.ts:1-1]]".length,
          sourcePath: "src/app.ts",
          lineStart: 1,
          lineEnd: 1,
          resolved: true,
          evidenceIndex: 0,
        },
      ],
    });

    // Prose paragraphs only — the panel renders its own `<p>` for the failure
    // message, and that one is not part of the lesson text.
    const paragraphs = [...container.querySelectorAll("p")]
      .filter((node) => !node.closest(".evidence-inline-source"))
      .map((node) => node.textContent);
    expect(paragraphs).toEqual(["前面。", " 后面。"]);
  });

  it("degrades quietly when the pinned source cannot be read", async () => {
    const markdown = "证据：[[evidence:src/missing.ts:10-12]]";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Lesson evidence index does not exist" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await renderMarkdown(markdown, {
      evidenceBasePath: "/api/lesson",
      evidenceAnchors: [
        {
          start: markdown.indexOf("[["),
          end: markdown.length,
          sourcePath: "src/missing.ts",
          lineStart: 10,
          lineEnd: 12,
          resolved: true,
          evidenceIndex: 3,
        },
      ],
    });
    await waitFor(() =>
      expect(container.querySelector(".evidence-inline-source__error")).not.toBeNull(),
    );

    const error = container.querySelector(".evidence-inline-source__error");
    expect(error?.textContent).toContain("无法读取固定源码");
    expect(error?.textContent).toContain("src/missing.ts");
    expect(error?.textContent).toContain("L10–12");
    expect(container.querySelector(".evidence-code")).toBeNull();
    // Header + open control still present so the rest of the lesson can read
    // and the reader can try the full-file sheet if offered.
    expect(container.querySelector(".evidence-inline-source__path")?.textContent).toBe(
      "src/missing.ts",
    );
  });

  it("loads the same evidence index only once when cited twice", async () => {
    const first = "[[evidence:src/app.ts:1-2]]";
    const second = "[[evidence:src/app.ts:1-2]]";
    const markdown = `先看 ${first} 再看 ${second}`;
    const firstStart = markdown.indexOf(first);
    const secondStart = markdown.indexOf(second, firstStart + 1);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          sourcePath: "src/app.ts",
          sourceCommit: "a".repeat(40),
          startLine: 1,
          endLine: 2,
          highlightStartLine: 1,
          highlightEndLine: 2,
          language: "typescript",
          code: "export const a = 1;\nexport const b = 2;\n",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await renderMarkdown(markdown, {
      evidenceBasePath: "/api/lesson",
      evidenceAnchors: [
        {
          start: firstStart,
          end: firstStart + first.length,
          sourcePath: "src/app.ts",
          lineStart: 1,
          lineEnd: 2,
          resolved: true,
          evidenceIndex: 0,
        },
        {
          start: secondStart,
          end: secondStart + second.length,
          sourcePath: "src/app.ts",
          lineStart: 1,
          lineEnd: 2,
          resolved: true,
          evidenceIndex: 0,
        },
      ],
    });
    await waitFor(() =>
      expect(container.querySelectorAll(".evidence-inline-source .evidence-code")).toHaveLength(2),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/lesson/evidence/0");
  });
});
