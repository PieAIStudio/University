import { describe, expect, it } from "vitest";

import { GUEST_AVATAR_SEED, guestAvatarRecipe } from "./default-recipe.js";

describe("the guest avatar", () => {
  /*
    The whole point of pinning a seed. A default that rerolls is not a
    character: somebody who saw a bear this morning and a slime this afternoon
    has not met anyone, and swapping it for their own avatar stops being an
    event they notice.
  */
  it("is the same creature on every call", () => {
    expect(guestAvatarRecipe()).toEqual(guestAvatarRecipe());
    expect(guestAvatarRecipe().seed).toBe(guestAvatarRecipe().seed);
  });

  /*
    It spends most of its life facing away, so the silhouette has to survive
    being seen from behind. Ears are what does that — a bear and a cat are the
    same round shape from the back.
  */
  it("is a bunny, and has the ears that make it readable from behind", () => {
    const recipe = guestAvatarRecipe();
    expect(recipe.species).toBe("bunny");
    const crest = recipe.parts.crest?.params as Record<string, unknown> | undefined;
    expect(crest?.["style"]).toBe("bunny");
  });

  it("is complete enough to build without further filling", () => {
    const recipe = guestAvatarRecipe();
    for (const part of ["body", "eyes", "mouth", "crest"]) {
      expect(recipe.parts[part]).toBeDefined();
    }
  });

  it("names its seed so changing the guest is a visible edit", () => {
    expect(GUEST_AVATAR_SEED).toContain("guest");
  });
});
