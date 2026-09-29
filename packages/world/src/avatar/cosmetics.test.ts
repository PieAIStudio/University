import { expect, it } from "vitest";
import { cosmeticAvatarRecipe } from "./cosmetics.js";
import { guestAvatarRecipe } from "./default-recipe.js";

it.each([
  ["avatar-flower", "flower"],
  ["avatar-bow", "bow"],
  ["avatar-beanie", "beanie"],
  ["avatar-crown", "crown"],
  ["avatar-set-band", "band"],
])("%s uses the published kit while preserving every other part", (id, style) => {
  const base = guestAvatarRecipe();
  const saved = JSON.stringify(base);
  const dressed = cosmeticAvatarRecipe(base, id)!;
  expect(dressed.parts.hat?.params).toMatchObject({ style });
  expect(dressed.species).toBe(base.species);
  expect(dressed.seed).toBe(base.seed);
  expect(dressed.palette).toBe(base.palette);
  for (const [part, value] of Object.entries(base.parts))
    if (part !== "hat") expect(dressed.parts[part]).toEqual(value);
  expect(JSON.stringify(base)).toBe(saved);
  expect(cosmeticAvatarRecipe(base)).toBe(base);
});
it("an unknown or cleared entitlement does not replace a user recipe", () => {
  const base = guestAvatarRecipe();
  expect(cosmeticAvatarRecipe(base, "unknown")).toBe(base);
  expect(cosmeticAvatarRecipe(null)).toBeNull();
  expect(cosmeticAvatarRecipe(null, "avatar-crown")?.parts.hat?.params).toMatchObject({
    style: "crown",
  });
});
