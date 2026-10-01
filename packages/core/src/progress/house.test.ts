import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCOUNT_PREFERENCES,
  mergeAccountPreferences,
  parseAccountData,
} from "../ports/account-data.js";
import {
  answerUsed,
  chooseMarkStyle,
  hasAnsweredUsed,
  mergeHouseState,
  parseHouseState,
  placeItem,
  usedDays,
} from "./house.js";

const t = (minute: number) => new Date(Date.UTC(2026, 9, 1, 12, minute)).toISOString();

describe("the house merges per item, not per house", () => {
  it("keeps two devices' moves of different things", () => {
    const phone = placeItem(undefined, "plane", 0.2, 0.3, t(1));
    const laptop = placeItem(undefined, "jar", 0.7, 0.3, t(2));
    const merged = mergeHouseState(phone, laptop)!;
    expect(merged.placements.plane).toMatchObject({ x: 0.2, y: 0.3 });
    expect(merged.placements.jar).toMatchObject({ x: 0.7, y: 0.3 });
  });

  it("takes the later move of the same thing, whichever side it came from", () => {
    const early = placeItem(undefined, "plane", 0.1, 0.1, t(1));
    const late = placeItem(undefined, "plane", 0.9, 0.9, t(5));
    expect(mergeHouseState(early, late)!.placements.plane).toMatchObject({ x: 0.9 });
    expect(mergeHouseState(late, early)!.placements.plane).toMatchObject({ x: 0.9 });
  });

  it("keeps a position inside the room", () => {
    expect(placeItem(undefined, "plane", -3, 7, t(1)).placements.plane).toMatchObject({
      x: 0,
      y: 1,
    });
  });
});

describe("the wall comes from the learner's own answers", () => {
  it("marks a day once however many lessons were used that day, and never a 'not yet'", () => {
    let house = answerUsed(undefined, "s/c/u/a", "used", "2026-10-01", t(1));
    house = answerUsed(house, "s/c/u/b", "used", "2026-10-01", t(2));
    house = answerUsed(house, "s/c/u/c", "not-yet", "2026-10-02", t(3));
    expect(usedDays(house)).toEqual(["2026-10-01"]);
    expect(hasAnsweredUsed(house, "s/c/u/c")).toBe(true);
    expect(hasAnsweredUsed(house, "s/c/u/d")).toBe(false);
  });

  it("lets a later 'used' replace an earlier 'not yet' for the same lesson", () => {
    const first = answerUsed(undefined, "k", "not-yet", "2026-10-01", t(1));
    const second = answerUsed(first, "k", "used", "2026-10-03", t(9));
    expect(usedDays(second)).toEqual(["2026-10-03"]);
  });

  it("keeps the newer mark style", () => {
    const a = chooseMarkStyle(undefined, "tally", t(1));
    const b = chooseMarkStyle(undefined, "sticker", t(2));
    expect(mergeHouseState(a, b)!.markStyle?.style).toBe("sticker");
    expect(mergeHouseState(b, a)!.markStyle?.style).toBe("sticker");
  });
});

describe("parsing never trusts the document", () => {
  it("drops malformed entries and keeps the rest", () => {
    const parsed = parseHouseState({
      placements: { plane: { x: 0.5, y: 0.5, at: t(1) }, bad: { x: 2, y: 0, at: t(1) }, "<x>": {} },
      used: {
        k: { answer: "used", day: "2026-10-01", at: t(1) },
        j: { answer: "yes", day: "x", at: 1 },
      },
      markStyle: { style: "glitter", at: t(1) },
    })!;
    expect(Object.keys(parsed.placements)).toEqual(["plane"]);
    expect(Object.keys(parsed.used)).toEqual(["k"]);
    expect(parsed.markStyle).toBeUndefined();
  });

  it("round-trips through JSON", () => {
    const house = answerUsed(
      placeItem(undefined, "plane", 0.4, 0.6, t(1)),
      "k",
      "used",
      "2026-10-01",
      t(2),
    );
    expect(parseHouseState(JSON.parse(JSON.stringify(house)))).toEqual(house);
  });

  it("reads absence as absence", () => {
    expect(parseHouseState(undefined)).toBeUndefined();
    expect(mergeHouseState(undefined, undefined)).toBeUndefined();
  });
});

describe("the house travels with the account", () => {
  it("survives parsing the account document and merging two devices", () => {
    const on = (house: unknown) =>
      parseAccountData({ preferences: { ...DEFAULT_ACCOUNT_PREFERENCES, house } }).preferences;
    const phone = on(placeItem(undefined, "plane", 0.2, 0.3, t(1)));
    const laptop = on(answerUsed(undefined, "k", "used", "2026-10-01", t(2)));
    const merged = mergeAccountPreferences(phone, laptop).house!;
    expect(merged.placements.plane).toMatchObject({ x: 0.2, y: 0.3 });
    expect(usedDays(merged)).toEqual(["2026-10-01"]);
  });

  it("leaves an account without a house without one", () => {
    expect(parseAccountData({ preferences: DEFAULT_ACCOUNT_PREFERENCES }).preferences.house).toBe(
      undefined,
    );
  });
});
