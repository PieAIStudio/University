import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIBRARY_TABS } from "@pieai/university-core";

import { LibrarySurface, REFERENCE_TABS } from "./LibrarySurface.js";
import type { FavouritesStore } from "../favourites/storage.js";

const STORE = {
  entries: () => [],
  has: () => false,
  add: () => undefined,
  remove: () => undefined,
  subscribe: () => () => undefined,
} as unknown as FavouritesStore;

const surface = (activeTab: (typeof REFERENCE_TABS)[number]) =>
  renderToStaticMarkup(
    <LibrarySurface
      activeTab={activeTab}
      concepts={[]}
      terms={[]}
      antiPatterns={[]}
      favourites={STORE}
      notes={[]}
      notesBasePathOf={() => "/nowhere"}
      onBack={() => undefined}
      onTabChange={() => undefined}
      onOpenConcept={() => undefined}
      onOpenTerm={() => undefined}
      onOpenAntiPattern={() => undefined}
    />,
  );

describe("the library's tabs", () => {
  it("draws exactly the tabs the router can address", () => {
    /*
      There were two lists of these strings — this component's and the address
      parser's — so a fifth collection was two edits, and getting one of them
      wrong means either a tab no URL reaches or a URL that resolves to a tab
      nobody drew. They are the same list now, and this is the assertion that
      says so out loud rather than leaving it to whoever reads both files.
    */
    expect(REFERENCE_TABS).toEqual(LIBRARY_TABS);
    expect(REFERENCE_TABS).toContain("notes");
  });

  it("carries the learner's own collection beside the three catalogues", () => {
    const markup = surface("notes");
    expect(markup).toContain("课堂笔记");
    // Empty until the export pipeline ships notes with a package. Saying so is
    // the point: a blank panel reads as broken, an empty state reads as empty.
    expect(markup).toContain("还没有课堂笔记");
  });

  it("still opens on the concepts index", () => {
    expect(surface("concepts")).toContain("课堂笔记");
  });
});
