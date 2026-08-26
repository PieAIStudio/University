import { randomRecipe } from "@pieai/swimmer-avatar-kit";
import { describe, expect, it } from "vitest";

import { avatarRecipeForAccount, avatarRecipeFromAccount } from "./account-recipe.js";

describe("account avatar recipes", () => {
  it("round-trips the kit's versioned recipe envelope", () => {
    const recipe = randomRecipe("avatar-account-test");
    expect(avatarRecipeFromAccount(avatarRecipeForAccount(recipe))).toEqual(recipe);
  });

  it("falls back cleanly when account data is absent or malformed", () => {
    expect(avatarRecipeFromAccount(null)).toBeNull();
    expect(avatarRecipeFromAccount("not-a-recipe")).toBeNull();
  });
});
