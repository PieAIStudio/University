// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONCEPT_HEADS, type ConceptHead } from "@pieai/university-core";

import { LoadingTrivia } from "./LoadingTrivia.js";
import { pickLoadingConcept } from "./pick-loading-concept.js";
import {
  MAP_COVER_GIVE_UP_MS,
  MAP_COVER_REOPEN_MS,
  useMapCover,
  useMapCoverState,
} from "./use-map-cover.js";

const SAMPLE: ConceptHead = {
  id: "frontend",
  zh: "前端",
  en: "Frontend",
  category: "frontend",
  group: "网页基础",
  tagline: "你在网页上看到、点到、填进去的那一层。",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.useFakeTimers();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function CoverProbe({ busy }: { readonly busy: boolean }) {
  const cover = useMapCover(busy);
  return <span data-cover={cover ? "yes" : "no"} />;
}

function RecoveryCoverProbe({
  busy,
  attempt = 0,
}: {
  readonly busy: boolean;
  readonly attempt?: number;
}) {
  const state = useMapCoverState(busy, attempt);
  return (
    <span data-cover={state.cover ? "yes" : "no"} data-timeout={state.timedOut ? "yes" : "no"} />
  );
}

describe("pickLoadingConcept", () => {
  it("returns a real catalogue head, never a placeholder", () => {
    const head = pickLoadingConcept(CONCEPT_HEADS, () => 0);
    expect(head).not.toBeNull();
    expect(head?.zh).toBe(CONCEPT_HEADS[0]?.zh);
    expect(head?.tagline.length).toBeGreaterThan(0);
  });

  it("returns null when the catalogue is empty rather than inventing a line", () => {
    expect(pickLoadingConcept([], () => 0.5)).toBeNull();
  });
});

describe("LoadingTrivia", () => {
  it("prints the concept in the DOM, not as a skeleton", async () => {
    await act(async () => {
      root.render(<LoadingTrivia concept={SAMPLE} />);
    });
    const status = container.querySelector("[role=status]");
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-busy")).toBe("true");
    expect(status?.textContent).toContain("前端");
    expect(status?.textContent).toContain(SAMPLE.tagline);
    expect(status?.textContent).toContain("Frontend");
    expect(status?.textContent).not.toContain("骨架");
  });

  it("stays quiet about a missing catalogue rather than filling one in", async () => {
    await act(async () => {
      root.render(<LoadingTrivia concept={null} />);
    });
    expect(container.textContent).toContain("地图正在打开");
    expect(container.textContent).not.toContain("前端");
  });
});

describe("useMapCover", () => {
  it("covers on the first busy tick and unmounts the moment it is not", async () => {
    await act(async () => {
      root.render(<CoverProbe busy />);
    });
    expect(container.querySelector("[data-cover]")?.getAttribute("data-cover")).toBe("yes");

    await act(async () => {
      root.render(<CoverProbe busy={false} />);
    });
    expect(container.querySelector("[data-cover]")?.getAttribute("data-cover")).toBe("no");
  });

  it("does not flash on a later busy shorter than the reopen delay", async () => {
    await act(async () => {
      root.render(<CoverProbe busy />);
    });
    await act(async () => {
      root.render(<CoverProbe busy={false} />);
    });
    await act(async () => {
      root.render(<CoverProbe busy />);
    });
    expect(container.querySelector("[data-cover]")?.getAttribute("data-cover")).toBe("no");

    await act(async () => {
      vi.advanceTimersByTime(MAP_COVER_REOPEN_MS - 1);
    });
    expect(container.querySelector("[data-cover]")?.getAttribute("data-cover")).toBe("no");

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelector("[data-cover]")?.getAttribute("data-cover")).toBe("yes");
  });

  it("gives up rather than staying up forever", async () => {
    await act(async () => {
      root.render(<CoverProbe busy />);
    });
    await act(async () => {
      vi.advanceTimersByTime(MAP_COVER_GIVE_UP_MS);
    });
    expect(container.querySelector("[data-cover]")?.getAttribute("data-cover")).toBe("no");
  });

  it("reports a timeout separately so the caller can explain the next action", async () => {
    await act(async () => {
      root.render(<RecoveryCoverProbe busy />);
    });
    await act(async () => {
      vi.advanceTimersByTime(MAP_COVER_GIVE_UP_MS);
    });
    const probe = container.querySelector("[data-timeout]");
    expect(probe?.getAttribute("data-cover")).toBe("no");
    expect(probe?.getAttribute("data-timeout")).toBe("yes");
  });

  it("restarts the cover immediately for a new scene attempt", async () => {
    await act(async () => {
      root.render(<RecoveryCoverProbe busy />);
    });
    await act(async () => {
      root.render(<RecoveryCoverProbe busy={false} />);
    });
    await act(async () => {
      root.render(<RecoveryCoverProbe busy attempt={1} />);
    });
    expect(container.querySelector("[data-cover]")?.getAttribute("data-cover")).toBe("yes");
  });
});
