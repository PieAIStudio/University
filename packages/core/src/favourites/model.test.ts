import { describe, expect, it } from "vitest";

import type { LexiconEntry } from "../domain/schemas.js";
import {
  EMPTY_FAVOURITES,
  FAVOURITES_DOCUMENT_VERSION,
  addFavourite,
  hasFavourite,
  listByRecency,
  listGroupedByTrack,
  parseFavourites,
  removeFavourite,
  senseIdsOf,
  toggleFavourite,
} from "./model.js";

const T1 = "2026-08-21T10:00:00.000Z";
const T2 = "2026-08-21T11:00:00.000Z";
const T3 = "2026-08-21T12:00:00.000Z";

const APP: LexiconEntry = {
  senseId: "app.program",
  headword: "app",
  phonetic: "/æp/",
  partOfSpeech: "noun",
  gloss: "应用：用户点开图标就能用的那个成品",
  usage: "App 是 application 的口语缩写。",
  track: "technical",
};

const ALLOW: LexiconEntry = {
  senseId: "allow.permit",
  headword: "allow",
  phonetic: "/əˈlaʊ/",
  partOfSpeech: "verb",
  gloss: "允许：放开某种行为或访问",
  usage: "allow access 在权限说明里极常见。",
  track: "general",
};

const HOVER: LexiconEntry = {
  senseId: "hover.state",
  headword: "hover",
  phonetic: "/ˈhɒvə/",
  partOfSpeech: "verb",
  gloss: "悬停：指针停在上面时的状态",
  usage: "Use hover for non-destructive hints.",
  track: "technical",
};

const KNOWN = senseIdsOf([APP, ALLOW, HOVER]);

describe("senseIdsOf", () => {
  it("collects the ids a catalogue will accept", () => {
    expect(KNOWN).toEqual(new Set(["app.program", "allow.permit", "hover.state"]));
  });
});

describe("addFavourite", () => {
  it("appends a known sense with matching timestamps", () => {
    const next = addFavourite(EMPTY_FAVOURITES, APP.senseId, KNOWN, T1);
    expect(next).toEqual({
      version: FAVOURITES_DOCUMENT_VERSION,
      items: [{ senseId: APP.senseId, createdAt: T1, updatedAt: T1 }],
    });
  });

  it("rejects an unknown senseId rather than storing it", () => {
    const next = addFavourite(EMPTY_FAVOURITES, "does.not.exist", KNOWN, T1);
    expect(next).toBe(EMPTY_FAVOURITES);
    expect(next.items).toEqual([]);
  });

  it("rejects an empty id even if a caller stuffed it into the catalogue", () => {
    expect(addFavourite(EMPTY_FAVOURITES, "", new Set([""]), T1)).toBe(EMPTY_FAVOURITES);
  });

  it("updates updatedAt without duplicating when the id is already there", () => {
    const once = addFavourite(EMPTY_FAVOURITES, APP.senseId, KNOWN, T1);
    const twice = addFavourite(once, APP.senseId, KNOWN, T2);
    expect(twice.items).toEqual([{ senseId: APP.senseId, createdAt: T1, updatedAt: T2 }]);
    expect(twice.items).toHaveLength(1);
  });

  it("returns the same document when a refresh would not change updatedAt", () => {
    const once = addFavourite(EMPTY_FAVOURITES, APP.senseId, KNOWN, T1);
    expect(addFavourite(once, APP.senseId, KNOWN, T1)).toBe(once);
  });

  it("leaves a newer document untouched so a later migration still has it", () => {
    const future = { version: 2, items: [{ senseId: APP.senseId, createdAt: T1, updatedAt: T1 }] };
    expect(addFavourite(future, HOVER.senseId, KNOWN, T2)).toBe(future);
  });
});

describe("removeFavourite", () => {
  it("drops the matching row and canonicalises an empty list", () => {
    const once = addFavourite(EMPTY_FAVOURITES, APP.senseId, KNOWN, T1);
    expect(removeFavourite(once, APP.senseId)).toBe(EMPTY_FAVOURITES);
  });

  it("is a no-op when the id is not there", () => {
    const once = addFavourite(EMPTY_FAVOURITES, APP.senseId, KNOWN, T1);
    expect(removeFavourite(once, HOVER.senseId)).toBe(once);
  });
});

describe("toggleFavourite", () => {
  it("returns to empty when toggled twice", () => {
    const on = toggleFavourite(EMPTY_FAVOURITES, APP.senseId, KNOWN, T1);
    expect(hasFavourite(on, APP.senseId)).toBe(true);
    const off = toggleFavourite(on, APP.senseId, KNOWN, T2);
    expect(off).toEqual(EMPTY_FAVOURITES);
    expect(off.items).toHaveLength(0);
  });

  it("does not mint a row for an unknown id", () => {
    expect(toggleFavourite(EMPTY_FAVOURITES, "missing.sense", KNOWN, T1)).toBe(EMPTY_FAVOURITES);
  });
});

describe("listByRecency", () => {
  it("sorts by updatedAt, most recently touched first", () => {
    const withApp = addFavourite(EMPTY_FAVOURITES, APP.senseId, KNOWN, T1);
    const withHover = addFavourite(withApp, HOVER.senseId, KNOWN, T2);
    const refreshedApp = addFavourite(withHover, APP.senseId, KNOWN, T3);
    expect(listByRecency(refreshedApp).map((item) => item.senseId)).toEqual([
      APP.senseId,
      HOVER.senseId,
    ]);
  });

  it("does not mutate the stored insertion order", () => {
    const withApp = addFavourite(EMPTY_FAVOURITES, APP.senseId, KNOWN, T1);
    const stored = addFavourite(withApp, HOVER.senseId, KNOWN, T2);
    listByRecency(addFavourite(stored, APP.senseId, KNOWN, T3));
    expect(stored.items.map((item) => item.senseId)).toEqual([APP.senseId, HOVER.senseId]);
  });
});

describe("listGroupedByTrack", () => {
  it("groups by the lexicon entry's track, technical first, and counts each group", () => {
    const withApp = addFavourite(EMPTY_FAVOURITES, APP.senseId, KNOWN, T1);
    const withAllow = addFavourite(withApp, ALLOW.senseId, KNOWN, T2);
    const withHover = addFavourite(withAllow, HOVER.senseId, KNOWN, T3);
    const groups = listGroupedByTrack(withHover, [APP, ALLOW, HOVER]);
    expect(groups.map((group) => group.track)).toEqual(["technical", "general"]);
    expect(groups[0]).toMatchObject({ track: "technical", count: 2 });
    expect(groups[0]?.entries.map((entry) => entry.senseId)).toEqual([HOVER.senseId, APP.senseId]);
    expect(groups[1]).toMatchObject({ track: "general", count: 1 });
    expect(groups[1]?.entries.map((entry) => entry.senseId)).toEqual([ALLOW.senseId]);
  });

  it("omits a track that has no favourites rather than reporting a zero group", () => {
    const onlyApp = addFavourite(EMPTY_FAVOURITES, APP.senseId, KNOWN, T1);
    const groups = listGroupedByTrack(onlyApp, [APP, ALLOW]);
    expect(groups.map((group) => group.track)).toEqual(["technical"]);
  });

  it("omits a favourite whose sense is no longer in the lexicon", () => {
    const withApp = addFavourite(EMPTY_FAVOURITES, APP.senseId, KNOWN, T1);
    const withHover = addFavourite(withApp, HOVER.senseId, KNOWN, T2);
    const groups = listGroupedByTrack(withHover, [ALLOW]);
    expect(groups).toEqual([]);
  });
});

describe("parseFavourites", () => {
  it("reads a version-1 document", () => {
    expect(
      parseFavourites({
        version: 1,
        items: [{ senseId: APP.senseId, createdAt: T1, updatedAt: T2 }],
      }),
    ).toEqual({
      version: 1,
      items: [{ senseId: APP.senseId, createdAt: T1, updatedAt: T2 }],
    });
  });

  it("yields empty on garbage rather than throwing", () => {
    expect(parseFavourites(null)).toBe(EMPTY_FAVOURITES);
    expect(parseFavourites("nope")).toBe(EMPTY_FAVOURITES);
    expect(parseFavourites({ version: 1, items: "nope" })).toBe(EMPTY_FAVOURITES);
  });

  it("skips malformed items instead of discarding the whole list", () => {
    const parsed = parseFavourites({
      version: 1,
      items: [
        { senseId: APP.senseId, createdAt: T1, updatedAt: T1 },
        { senseId: "broken" },
        { senseId: "", createdAt: T1, updatedAt: T1 },
        { senseId: HOVER.senseId, createdAt: T2, updatedAt: T2 },
      ],
    });
    expect(parsed.items.map((item) => item.senseId)).toEqual([APP.senseId, HOVER.senseId]);
  });

  it("merges duplicate ids onto one row", () => {
    const parsed = parseFavourites({
      version: 1,
      items: [
        { senseId: APP.senseId, createdAt: T2, updatedAt: T2 },
        { senseId: APP.senseId, createdAt: T1, updatedAt: T3 },
      ],
    });
    expect(parsed.items).toEqual([{ senseId: APP.senseId, createdAt: T1, updatedAt: T3 }]);
  });

  it("keeps a newer version number and yields no items, so a write cannot clobber it as v1", () => {
    const parsed = parseFavourites({
      version: 2,
      items: [{ senseId: APP.senseId, createdAt: T1, updatedAt: T1 }],
    });
    expect(parsed).toEqual({ version: 2, items: [] });
    expect(toggleFavourite(parsed, APP.senseId, KNOWN, T2)).toBe(parsed);
  });
});
