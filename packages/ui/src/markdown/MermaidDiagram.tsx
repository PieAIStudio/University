import { formatNumber, translate } from "../i18n/index.js";
import { useEffect, useId, useRef, useState } from "react";

type MermaidRenderer = Pick<(typeof import("mermaid"))["default"], "initialize" | "render">;

type DiagramState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly svg: string }
  | { readonly status: "error"; readonly message: string };

const MAX_MERMAID_SOURCE_CHARS = 32_000;
const MAX_MERMAID_NONEMPTY_LINES = 300;
const MERMAID_RENDER_DEBOUNCE_MS = 80;
const UNSAFE_SOURCE_URI = /(?:https?|data|javascript|file|blob):|(?:^|[\s"'(=])\/\/[^\s]/i;
// Removed before the SVG is injected. The SMIL animation elements are the
// addition: `<set attributeName="href" to="javascript:…">` rewrites an
// attribute after this sanitiser has already inspected it, which is a known
// way past attribute-level filtering. Mermaid never emits them.
//
// Deliberately NOT removed: `foreignObject` and `use`. Mermaid renders node
// labels inside foreignObject and arrow markers with `<use href="#…">`, so
// stripping either would silently delete the content of every diagram.
// They are covered by the rules below instead — nested `script`/`iframe`/…
// are removed wherever they appear, every `on*` handler is dropped, and any
// `href`/`src`/`srcset` that is not a local `#fragment` is removed.
const REMOTE_CAPABLE_ELEMENTS =
  "script, iframe, object, embed, image, audio, video, source, track, link, feImage, set, animate, animateTransform, animateMotion";

let mermaidRendererPromise: Promise<MermaidRenderer> | undefined;

async function loadMermaidRenderer(): Promise<MermaidRenderer> {
  mermaidRendererPromise ??= import("mermaid")
    .then(({ default: mermaid }) => {
      mermaid.initialize({
        // antiscript: allow HTML labels (<br/>) that flowcharts need, still block scripts.
        securityLevel: "antiscript",
        startOnLoad: false,
        suppressErrorRendering: true,
        theme: "dark",
        /*
          Mermaid's own stack is `"trebuchet ms", verdana, arial, sans-serif`,
          and not one of those fonts has a Chinese glyph in it. On a machine
          whose generic `sans-serif` is not a CJK face — a stripped Linux
          container, plenty of Windows installs — every label in every diagram
          renders as tofu while the text sits correctly in the DOM. It fails
          exactly where nobody testing on a Mac would ever see it.

          The token rather than a copy of the stack: mermaid writes this into a
          `<style>` inside the SVG, the SVG is in the document, and custom
          properties cascade into `foreignObject`. Measured — the label font
          resolves to the same 「Geist Variable, Noto Sans SC, …」 the prose
          around it uses, so a diagram cannot drift away from its page.
        */
        fontFamily: "var(--game-ui-font-body)",
        flowchart: {
          htmlLabels: true,
          useMaxWidth: true,
        },
      });
      return mermaid;
    })
    .catch((error: unknown) => {
      mermaidRendererPromise = undefined;
      throw error;
    });

  return mermaidRendererPromise;
}

function safeDiagramId(reactId: string): string {
  const stableSuffix = reactId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `university-mermaid-${stableSuffix || "diagram"}`;
}

function validateSource(source: string): string | undefined {
  if (source.length > MAX_MERMAID_SOURCE_CHARS) {
    return translate("ui.markdown.mermaidDiagram.copy.关系图源码超过-value0-个字符的本地上限", {
      value0: formatNumber(MAX_MERMAID_SOURCE_CHARS),
    });
  }
  const nonemptyLines = source.split(/\r?\n/).filter((line) => line.trim() !== "").length;
  if (nonemptyLines > MAX_MERMAID_NONEMPTY_LINES) {
    return translate(
      "ui.markdown.mermaidDiagram.copy.关系图超过-value0-行的本地上限-请拆成几张小图",
      { value0: MAX_MERMAID_NONEMPTY_LINES },
    );
  }
  if (UNSAFE_SOURCE_URI.test(source)) {
    return translate(
      "ui.markdown.mermaidDiagram.copy.关系图包含外部或可执行地址-UniversityLocal-只渲染纯本地关系图",
    );
  }
  return undefined;
}

function containsUnsafeCss(css: string): boolean {
  if (/@import/i.test(css)) return true;
  const targets = [...css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].map((match) =>
    (match[2] ?? "").trim(),
  );
  return targets.some((target) => !target.startsWith("#"));
}

/**
 * Mermaid 11 flowchart SVGs embed HTML labels (`foreignObject` + real tags).
 * That markup is not well-formed XML, so `image/svg+xml` DOMParser fails with
 * "unexpected close tag" and the whole diagram falls back to source. Parse as
 * HTML instead, then extract the root `<svg>`.
 */
function sanitizeRenderedSvg(svg: string): string {
  const htmlDocument = new DOMParser().parseFromString(
    `<div id="university-mermaid-root">${svg}</div>`,
    "text/html",
  );
  const root = htmlDocument.querySelector("#university-mermaid-root > svg");
  if (!root) {
    throw new Error("Mermaid returned an invalid SVG document");
  }

  root.querySelectorAll(REMOTE_CAPABLE_ELEMENTS).forEach((element) => element.remove());
  root.querySelectorAll("style").forEach((element) => {
    if (containsUnsafeCss(element.textContent ?? "")) element.remove();
  });

  [root, ...root.querySelectorAll("*")].forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const localName = attribute.localName.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (["href", "src", "srcset", "xlink:href"].includes(localName) && !value.startsWith("#")) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if ((name === "style" || /url\(/i.test(value)) && containsUnsafeCss(value)) {
        element.removeAttribute(attribute.name);
      }
    }
  });

  return root.outerHTML;
}

export function MermaidDiagram({ source }: { readonly source: string }) {
  const reactId = useId();
  const diagramId = safeDiagramId(reactId);
  const renderVersion = useRef(0);
  const [state, setState] = useState<DiagramState>({ status: "loading" });

  useEffect(() => {
    const version = renderVersion.current + 1;
    renderVersion.current = version;
    let cancelled = false;

    const sourceError = validateSource(source);
    if (sourceError) {
      setState({ status: "error", message: sourceError });
      return () => {
        cancelled = true;
      };
    }

    setState({ status: "loading" });

    async function renderDiagram() {
      try {
        const mermaid = await loadMermaidRenderer();
        if (cancelled || version !== renderVersion.current) return;

        const renderId = `${diagramId}-render-${version}`;
        const rendered = await mermaid.render(renderId, source);
        if (cancelled || version !== renderVersion.current) return;

        setState({ status: "ready", svg: sanitizeRenderedSvg(rendered.svg) });
      } catch (error) {
        if (cancelled || version !== renderVersion.current) return;
        const detail = error instanceof Error ? error.message : "unknown error";
        setState({
          status: "error",
          message: translate(
            "ui.markdown.mermaidDiagram.copy.这张关系图暂时无法渲染-value0-原始-Mermaid-源码已保留-可以继续阅读或修复",
            { value0: detail },
          ),
        });
      }
    }

    const timer = window.setTimeout(() => void renderDiagram(), MERMAID_RENDER_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [diagramId, source]);

  if (state.status === "error") {
    return (
      <figure className="mermaid-diagram mermaid-diagram--error" id={diagramId}>
        <figcaption role="alert">{state.message}</figcaption>
        <pre>
          <code className="language-mermaid">{source}</code>
        </pre>
      </figure>
    );
  }

  if (state.status === "loading") {
    return (
      <figure
        aria-busy="true"
        aria-live="polite"
        className="mermaid-diagram mermaid-diagram--loading"
        id={diagramId}
      >
        <figcaption>{translate("ui.markdown.mermaidDiagram.copy.正在绘制关系图")}</figcaption>
      </figure>
    );
  }

  return (
    <figure className="mermaid-diagram" id={diagramId}>
      <div
        className="mermaid-diagram__canvas"
        // Mermaid runs with securityLevel=strict; interactive bindFunctions are intentionally unused.
        dangerouslySetInnerHTML={{ __html: state.svg }}
      />
    </figure>
  );
}
