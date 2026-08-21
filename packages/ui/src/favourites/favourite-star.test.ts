import { describe, expect, it } from "vitest";

import { favouriteStarLabel, shouldPlayFavouriteSound } from "./favourite-star.js";
import {
  FAVOURITES_EMPTY_ACTION,
  FAVOURITES_EMPTY_DESCRIPTION,
  FAVOURITES_EMPTY_TITLE,
} from "./FavouritesEmpty.js";

describe("favouriteStarLabel", () => {
  it("names the headword so two stars on one page are distinguishable", () => {
    expect(favouriteStarLabel(false, "app")).toBe("收藏「app」");
    expect(favouriteStarLabel(true, "app")).toBe("取消收藏「app」");
  });

  it("falls back to 这个词义 when the caller has no headword yet", () => {
    expect(favouriteStarLabel(false)).toBe("收藏这个词义");
    expect(favouriteStarLabel(true, "  ")).toBe("取消收藏这个词义");
  });
});

describe("shouldPlayFavouriteSound", () => {
  it("sounds only when the sense is being added, not when it is being removed", () => {
    expect(shouldPlayFavouriteSound(true)).toBe(true);
    expect(shouldPlayFavouriteSound(false)).toBe(false);
  });
});

describe("favourites empty copy", () => {
  it("keeps VibeHub's empty title and speaks the rest in this product's voice", () => {
    expect(FAVOURITES_EMPTY_TITLE).toBe("还没有收藏术语");
    expect(FAVOURITES_EMPTY_ACTION).toBe("浏览词义");
    expect(FAVOURITES_EMPTY_DESCRIPTION).toContain("星标");
    expect(FAVOURITES_EMPTY_DESCRIPTION).toContain("词义");
  });
});
