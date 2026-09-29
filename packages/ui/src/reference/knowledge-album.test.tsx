// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONCEPT_ENTRIES,
  badgesFor,
  emptyProgress,
  knowledgeAlbum,
  type KnowledgeAlbumCard,
} from "@pieai/university-core";
import { InterfaceLanguageProvider } from "../i18n/react.js";
import { ConceptIndex } from "./ConceptIndex.js";
import { KnowledgeReveal } from "./KnowledgeReveal.js";
import { BadgeWall } from "../navigation/screens/BadgeWall.js";
import { LibrarySurface } from "./LibrarySurface.js";

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
const album = knowledgeAlbum(
  CONCEPT_ENTRIES.map((entry) => entry.head),
  [],
  { completionOf: () => ({ readConfirmed: false, exercisesPassed: false }) },
  emptyProgress(),
);
async function show(node: React.ReactNode, locale = "zh-CN") {
  await act(async () =>
    root.render(<InterfaceLanguageProvider locale={locale}>{node}</InterfaceLanguageProvider>),
  );
}

describe("the same collection index becomes the learner's album", () => {
  it("opens on the learning domain with two gifts and expands to every real concept in one action", async () => {
    await show(
      <ConceptIndex
        entries={CONCEPT_ENTRIES}
        album={album}
        domain={{ id: "ai-foundations", label: "AI" }}
      />,
    );
    expect(host.querySelector('[data-album-scope="ai-foundations"]')).not.toBeNull();
    const count = CONCEPT_ENTRIES.filter((entry) => entry.head.category === "ai").length;
    expect(host.querySelectorAll("[data-concept-card]")).toHaveLength(count);
    expect(host.querySelectorAll('[data-collected="true"]')).toHaveLength(2);
    expect(
      [...host.querySelectorAll("[data-concept-card]")]
        .slice(0, 2)
        .every((node) => node.getAttribute("data-collected") === "true"),
    ).toBe(true);
    expect(host.querySelectorAll('[role="radio"]')).toHaveLength(2);
    await act(async () => host.querySelector<HTMLButtonElement>("[data-album-expand]")!.click());
    expect(host.querySelector('[data-album-scope="all"]')).not.toBeNull();
    expect(host.querySelectorAll("[data-concept-card]")).toHaveLength(CONCEPT_ENTRIES.length);
    expect(
      new Set(
        [...host.querySelectorAll("[data-concept-card]")].map((node) =>
          node.getAttribute("data-concept-card"),
        ),
      ).size,
    ).toBe(CONCEPT_ENTRIES.length);
  });
  it("keeps uncollected concepts readable rather than turning a glossary into locked content", async () => {
    const open = vi.fn();
    await show(<ConceptIndex entries={CONCEPT_ENTRIES} album={album} onOpen={open} />, "en");
    const tile = host.querySelector('[data-collected="false"]')!;
    const read = tile.querySelector<HTMLButtonElement>("button[aria-label]")!;
    expect(read.getAttribute("aria-label")).toMatch(/^Read concept: /);
    await act(async () => read.click());
    expect(open).toHaveBeenCalledOnce();
    expect(
      host
        .querySelector('[data-collected="true"] .game-ui-collect-card')
        ?.getAttribute("aria-label"),
    ).toContain("Tap to turn");
  });
  it("filters only the writing-tips tab outside programming, retaining courseware and notes", async () => {
    await show(
      <LibrarySurface
        activeTab="flavour"
        concepts={[]}
        terms={[]}
        antiPatterns={[]}
        favourites={{ read: () => ({ version: 1, items: [] }), write: () => undefined }}
        notes={[]}
        notesBasePathOf={() => "/notes"}
        onBack={() => undefined}
        onTabChange={() => undefined}
        onOpenConcept={() => undefined}
        onOpenTerm={() => undefined}
        onOpenAntiPattern={() => undefined}
        showAntiPatterns={false}
      />,
      "en",
    );
    expect(
      [...host.querySelectorAll("button")].some(
        (button) => button.textContent === "Interactive lessons",
      ),
    ).toBe(true);
    expect(host.textContent).toContain("My notes");
    expect(host.textContent).toContain("Writing tips are in the app-building domain");
  });
  it("draws all seventeen badge names and conditions in English without changing their derivation", async () => {
    const document = emptyProgress();
    const before = JSON.stringify(document);
    await show(<BadgeWall document={document} />, "en");
    expect(host.querySelectorAll(".badge-tile")).toHaveLength(17);
    const names = [...host.querySelectorAll(".badge-tile__name")].map(
      (node) => node.textContent ?? "",
    );
    const conditions = [...host.querySelectorAll(".badge-tile__how")].map(
      (node) => node.textContent ?? "",
    );
    expect(names.every((text) => !/[\u3400-\u9FFF]/.test(text))).toBe(true);
    expect(conditions.every((text) => !/[\u3400-\u9FFF]/.test(text))).toBe(true);
    expect(host.querySelectorAll(".badge-tile--earned")).toHaveLength(
      badgesFor(document).filter((badge) => badge.earned).length,
    );
    expect(JSON.stringify(document)).toBe(before);
  });
});

describe("the finite knowledge reveal", () => {
  const cards: readonly KnowledgeAlbumCard[] = [
    { ...album.cards[0]!, tier: "shining", collected: true },
    { ...album.cards[1]!, tier: "new", collected: true },
    { ...album.cards[2]!, tier: "known", collected: true },
  ];
  it("turns one card at a time, rarest last, and reports completion only once", async () => {
    vi.useFakeTimers();
    const complete = vi.fn();
    await show(<KnowledgeReveal cards={cards} reducedMotion={false} onComplete={complete} />);
    const order = [...host.querySelectorAll("[data-reveal-card]")].map((node) =>
      node.getAttribute("data-reveal-card"),
    );
    expect(order).toEqual([cards[1]!.head.id, cards[2]!.head.id, cards[0]!.head.id]);
    expect(complete).not.toHaveBeenCalled();
    for (let count = 1; count <= 3; count++) {
      await act(async () => vi.advanceTimersByTimeAsync(600));
      expect(host.querySelectorAll('[data-revealed="true"]')).toHaveLength(count);
    }
    expect(host.querySelectorAll(".game-ui-collect-card--spotlight")).toHaveLength(1);
    expect(complete).toHaveBeenCalledOnce();
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(complete).toHaveBeenCalledOnce();
  });
  it("lets a revealed card really turn over and back without granting or replaying rewards", async () => {
    const complete = vi.fn();
    await show(<KnowledgeReveal cards={cards} reducedMotion onComplete={complete} />);
    const card = host.querySelector<HTMLButtonElement>("[data-reveal-card] .game-ui-collect-card")!;
    expect(card.getAttribute("aria-pressed")).toBe("false");
    await act(async () => card.click());
    expect(card.getAttribute("aria-pressed")).toBe("true");
    await act(async () => card.click());
    expect(card.getAttribute("aria-pressed")).toBe("false");
    expect(complete).toHaveBeenCalledOnce();
  });
  it("shows all cards without shine under reduced motion", async () => {
    const complete = vi.fn();
    await show(<KnowledgeReveal cards={cards} reducedMotion onComplete={complete} />);
    expect(host.querySelectorAll('[data-revealed="true"]')).toHaveLength(3);
    expect(host.querySelector(".game-ui-collect-card--spotlight")).toBeNull();
    expect(complete).toHaveBeenCalledOnce();
  });
  it("keeps waiting cards inert and follows the revealed card without taking focus", async () => {
    vi.useFakeTimers();
    const complete = vi.fn();
    await show(<KnowledgeReveal cards={cards} reducedMotion={false} onComplete={complete} />);
    expect(host.querySelectorAll("[data-reveal-card][inert]")).toHaveLength(3);
    await act(async () => vi.advanceTimersByTimeAsync(600));
    expect(host.querySelectorAll("[data-reveal-card][inert]")).toHaveLength(2);
    expect(host.querySelector("[data-reveal-active]")?.getAttribute("data-reveal-active")).toBe(
      cards[1]!.head.id,
    );
    for (let step = 0; step < 2; step++) await act(async () => vi.advanceTimersByTimeAsync(600));
    expect(host.querySelector("[data-reveal-active]")?.getAttribute("data-reveal-active")).toBe(
      cards[0]!.head.id,
    );
    expect(host.querySelectorAll("[data-reveal-card][inert]")).toHaveLength(0);
    await act(async () => host.querySelector<HTMLButtonElement>("[data-reveal-previous]")!.click());
    expect(host.querySelector("[data-reveal-active]")?.getAttribute("data-reveal-active")).toBe(
      cards[2]!.head.id,
    );
    expect(complete).toHaveBeenCalledOnce();
  });
  it("cancels a reveal abandoned before its last card", async () => {
    vi.useFakeTimers();
    const complete = vi.fn();
    await show(<KnowledgeReveal cards={cards} reducedMotion={false} onComplete={complete} />);
    await act(async () => vi.advanceTimersByTimeAsync(600));
    await show(<div />);
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(complete).not.toHaveBeenCalled();
  });
});
