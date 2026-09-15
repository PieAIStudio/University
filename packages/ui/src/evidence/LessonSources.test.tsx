// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { setActiveLocale } from "../i18n/index.js";
import type { UrlEvidenceView } from "../view/lesson-view.js";
import { LessonSources } from "./LessonSources.js";

let container: HTMLDivElement;

beforeEach(() => {
  setActiveLocale("zh-CN");
  container = document.createElement("div");
});

afterEach(() => {
  container.remove();
  setActiveLocale("zh-CN");
});

function renderSources(evidence: readonly UrlEvidenceView[]): void {
  container.innerHTML = renderToStaticMarkup(<LessonSources evidence={evidence} />);
}

const source: UrlEvidenceView = {
  kind: "fact",
  sourceUrl: "https://www.bemyeyes.com/blog/introducing-be-my-ai/",
  sourceTitle: "Introducing: Be My AI",
  sourceAuthority: "first-party",
  note: null,
  provenance: {
    type: "case-study",
    publisher: "Be My Eyes",
    publishedOn: "2023-08-07",
    accessedOn: "2026-09-14",
    locator: "How to Use Be My AI",
    supports: "A human volunteer remains available.",
    limitations: "This does not measure accuracy independently.",
  },
};

describe("inspectable real-world sources", () => {
  it("keeps publisher, dates, supported claim and limits next to the real source link", () => {
    renderSources([source]);
    expect(container.querySelector("a")?.getAttribute("href")).toBe(source.sourceUrl);
    expect(container.querySelector("a")?.textContent).toBe(source.sourceTitle);
    expect(container.textContent).toContain("A human volunteer remains available.");
    expect(container.textContent).toContain("This does not measure accuracy independently.");
    expect(container.querySelector("details")?.open).toBe(false);
    expect(container.querySelector('time[datetime="2023-08-07"]')).toBeTruthy();
    expect(container.querySelector('time[datetime="2026-09-14"]')).toBeTruthy();
  });

  it("deduplicates a URL without losing a separate inference or its limits", () => {
    const inference: UrlEvidenceView = {
      ...source,
      kind: "inference",
      provenance: {
        ...source.provenance!,
        supports: "A learner should retain a way to ask for human help.",
        limitations: "This is a teaching inference, not a measured outcome.",
      },
    };
    renderSources([source, source, inference]);
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.textContent?.split("A human volunteer remains available.")).toHaveLength(2);
    expect(container.textContent).toContain(inference.provenance!.supports);
    expect(container.textContent).toContain("由材料作出的推论");
  });

  it("keeps old URL citations readable and does not invent missing provenance", () => {
    const { provenance: _provenance, ...legacy } = source;
    renderSources([legacy]);
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector("time")).toBeNull();
  });
});
