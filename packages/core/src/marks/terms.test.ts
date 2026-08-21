import { describe, expect, it } from "vitest";

import type { LexiconEntry } from "../domain/schemas.js";
import { parseLessonLinks } from "./references.js";
import { resolveTermLinks, termRangeOf } from "./terms.js";

const APP: LexiconEntry = {
  senseId: "app.program",
  headword: "app",
  phonetic: "/æp/",
  partOfSpeech: "noun",
  gloss: "应用：用户点开图标就能用的那个成品",
  usage: "App 是 application 的口语缩写。",
  track: "technical",
};

const LEXICON = new Map<string, LexiconEntry>([[APP.senseId, APP]]);

function resolve(content: string) {
  return resolveTermLinks(parseLessonLinks(content), LEXICON);
}

describe("resolving term links", () => {
  it("resolves a sense that exists, with and without a label", () => {
    const [bare, labelled] = resolve("一个 [[term:app.program]]，或者 [[term:app.program|应用]]。");

    expect(bare).toMatchObject({ kind: "resolved", senseId: "app.program", entry: APP });
    expect(labelled).toMatchObject({
      kind: "resolved",
      senseId: "app.program",
      link: { label: "应用" },
    });
  });

  it("reports a missing sense rather than throwing", () => {
    expect(resolve("[[term:does.not.exist]]")[0]).toMatchObject({
      kind: "broken",
      senseId: "does.not.exist",
      reason: "not-found",
    });
  });

  it("reports an empty target as malformed rather than throwing", () => {
    expect(resolve("[[term:]]")[0]).toMatchObject({
      kind: "broken",
      reason: "malformed",
    });
  });

  it("leaves lesson and evidence tokens to their own resolvers", () => {
    expect(resolve("[[lesson:other]] 和 [[evidence:index.html:30]]")).toEqual([]);
  });

  it("accepts a map of entries", () => {
    const [found] = resolveTermLinks(parseLessonLinks("[[term:app.program]]"), LEXICON);
    expect(found?.kind).toBe("resolved");
  });

  it("maps a broken resolution onto a range with a null entry", () => {
    const [found] = resolve("开头 [[term:missing.sense]] 结尾");
    expect(termRangeOf(found!)).toMatchObject({
      senseId: "missing.sense",
      label: null,
      entry: null,
    });
    expect(found!.link.rawTarget).toBe("term:missing.sense");
  });
});
