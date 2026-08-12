import { describe, expect, it } from "vitest";

import { layoutNotes } from "./LessonMargin.js";
import type { ReaderMark } from "../domain/reader-marks.js";

function mark(id: string): ReaderMark {
  return {
    markId: id,
    lessonKey: "c/u/l",
    contentRevision: 1,
    kind: "question",
    quote: { exact: id, prefix: "", suffix: "" },
    sectionTitle: null,
    note: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    resolvedAt: null,
  };
}

describe("layoutNotes", () => {
  it("leaves a note level with its passage when nothing is in the way", () => {
    const placed = layoutNotes([{ mark: mark("a"), anchorTop: 400, height: 60 }]);
    expect(placed[0]!.top).toBe(400);
  });

  it("pushes an overlapping note down instead of letting them collide", () => {
    const placed = layoutNotes([
      { mark: mark("a"), anchorTop: 100, height: 50 },
      { mark: mark("b"), anchorTop: 110, height: 50 },
    ]);
    expect(placed[0]!.top).toBe(100);
    // 100 + 50 + gap: below the first note, not on top of it.
    expect(placed[1]!.top).toBe(158);
  });

  it("never lifts a note above its own passage", () => {
    const placed = layoutNotes([
      { mark: mark("a"), anchorTop: 100, height: 50 },
      { mark: mark("b"), anchorTop: 900, height: 50 },
    ]);
    // The second has room, so it stays level rather than being packed upward.
    expect(placed[1]!.top).toBe(900);
    for (const note of placed) expect(note.top).toBeGreaterThanOrEqual(note.anchorTop);
  });

  it("orders by position on the page, not by when the mark was made", () => {
    const placed = layoutNotes([
      { mark: mark("later-in-page"), anchorTop: 800, height: 40 },
      { mark: mark("earlier-in-page"), anchorTop: 200, height: 40 },
    ]);
    expect(placed.map((note) => note.mark.markId)).toEqual(["earlier-in-page", "later-in-page"]);
  });

  it("keeps a mark whose passage is gone, stacked after the anchored ones", () => {
    const placed = layoutNotes([
      { mark: mark("gone"), anchorTop: null, height: 40 },
      { mark: mark("found"), anchorTop: 300, height: 40 },
    ]);
    expect(placed.map((note) => note.mark.markId)).toEqual(["found", "gone"]);
    expect(placed[1]!.orphaned).toBe(true);
    expect(placed[1]!.top).toBe(348);
  });
});
