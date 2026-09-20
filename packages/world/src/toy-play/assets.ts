import manifest from "../island/kenney-r01-assets.json";

/** References the existing checked-in asset ledger, never its fallback aliases. */
export const TOY_DONORS = ["stall", "cart", "lantern", "rock_smallA"] as const;
export type ToyDonor = (typeof TOY_DONORS)[number];
export function toyAsset(id: ToyDonor) {
  const asset = manifest.assets.find((entry) => entry.assetId === id);
  if (!asset) throw new Error(`Toy donor not in the portable manifest: ${id}`);
  return asset;
}
