import { describe, expect, it } from "vitest";

import { LexiconEntrySchema, type LexiconEntry } from "../domain/schemas.js";
import { createLexiconIndex, searchLexicon, searchLexiconIndex } from "./search.js";

function entry(
  overrides: Partial<LexiconEntry> & Pick<LexiconEntry, "senseId" | "headword">,
): LexiconEntry {
  return {
    phonetic: "/x/",
    partOfSpeech: "noun",
    gloss: `${overrides.headword} 的意思`,
    usage: `${overrides.headword} 的用法`,
    track: "technical",
    ...overrides,
  };
}

const ABSORB = entry({
  senseId: "absorb.failure",
  headword: "absorb",
  gloss: "吸收失败：不往外抛，在本地变成返回值或静默跳过",
  usage: "读到「吸收」策略时问：调用方还能从返回值看出失败吗？",
});

const APP = entry({
  senseId: "app.program",
  headword: "app",
  gloss: "应用：用户点开图标就能用的那个成品",
  usage: "App 是 application 的口语缩写。",
});

const ALLOW = entry({
  senseId: "allow.permit",
  headword: "allow",
  gloss: "允许：放开某种行为或访问",
  usage: "allow access 在权限说明里极常见。",
  track: "general",
});

const HOVER = entry({
  senseId: "hover.state",
  headword: "hover",
  gloss: "悬停：指针停在上面时的状态",
  usage: "Use hover for non-destructive hints.",
  colloquial: ["鼠标放上去变色"],
});

const LEXICON = [ABSORB, APP, ALLOW, HOVER];

describe("lexicon search index", () => {
  it("groups an empty query by track and counts each group", () => {
    const result = searchLexicon(LEXICON, "  ");

    expect(result.query).toBe("");
    expect(result.total).toBe(4);
    expect(result.groups.map((group) => group.track)).toEqual(["technical", "general"]);
    expect(result.groups[0]).toMatchObject({ track: "technical", count: 3 });
    expect(result.groups[1]).toMatchObject({ track: "general", count: 1 });
    expect(result.groups[0]?.entries).toEqual([ABSORB, APP, HOVER]);
  });

  it("matches a Latin headword without regard to case", () => {
    const result = searchLexicon(LEXICON, "AbSoRb");

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.entries.map((item) => item.senseId)).toEqual(["absorb.failure"]);
  });

  it("matches a Chinese substring that lives only in the gloss", () => {
    const result = searchLexicon(LEXICON, "不往外抛");

    expect(result.total).toBe(1);
    expect(result.groups[0]?.entries[0]?.senseId).toBe("absorb.failure");
  });

  it("matches a query that lives only in a colloquial phrasing", () => {
    const result = searchLexicon(LEXICON, "鼠标放上去变色");

    expect(result.total).toBe(1);
    expect(result.groups[0]?.entries[0]?.headword).toBe("hover");
  });

  it("matches on any phrasing, which is why the field is a list", () => {
    // Two people describing the same thing do not choose the same words, and
    // a search field only helps the one whose words it happens to hold.
    const many = [
      entry({
        senseId: "cold.start",
        headword: "cold start",
        gloss: "冷启动：第一次会更慢",
        colloquial: ["很久没跑，第一次会慢很多", "刚开机第一次点开特别慢"],
      }),
    ];
    expect(searchLexicon(many, "刚开机").total).toBe(1);
    expect(searchLexicon(many, "很久没跑").total).toBe(1);
  });

  it("does not invent a hit when nothing indexed contains the query", () => {
    const result = searchLexicon(LEXICON, "zzzqqq");

    expect(result.query).toBe("zzzqqq");
    expect(result.total).toBe(0);
    expect(result.groups).toEqual([]);
  });

  it("omits a track that has no hits rather than reporting a zero group", () => {
    const result = searchLexicon(LEXICON, "允许");

    expect(result.groups.map((group) => group.track)).toEqual(["general"]);
    expect(result.groups[0]?.count).toBe(1);
  });

  it("reuses a built index rather than walking raw entries twice", () => {
    const index = createLexiconIndex(LEXICON);
    const first = searchLexiconIndex(index, "应用");
    const second = searchLexiconIndex(index, "应用");

    expect(first.groups[0]?.entries[0]).toBe(APP);
    expect(second.groups[0]?.entries[0]).toBe(first.groups[0]?.entries[0]);
  });

  it("lets a lexicon entry omit colloquial and still parse", () => {
    const parsed = LexiconEntrySchema.parse({
      senseId: "app.program",
      headword: "app",
      phonetic: "/æp/",
      partOfSpeech: "noun",
      gloss: "应用：用户点开图标就能用的那个成品",
      usage: "App 是 application 的口语缩写。",
      track: "technical",
    });
    expect(parsed.colloquial).toBeUndefined();
    expect(
      LexiconEntrySchema.parse({
        ...parsed,
        colloquial: ["点开图标就能用的那个成品"],
      }).colloquial,
    ).toEqual(["点开图标就能用的那个成品"]);
  });
});
