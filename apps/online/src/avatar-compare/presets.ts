/** Fixed seeds used for the visual evidence set. Species is pinned so each
 *  screenshot covers a different silhouette rather than hoping the cast
 *  table deals one. */
export const COMPARE_PRESETS = [
  { seed: "ak1-bear", species: "bear" },
  { seed: "ak1-bunny", species: "bunny" },
  { seed: "ak1-cat", species: "cat" },
  { seed: "ak1-robot", species: "robot" },
  { seed: "ak1-slime", species: "slime" },
  { seed: "ak1-humanoid", species: "humanoid" },
] as const;

export type CompareSolo = "ours" | "kit";

export type CompareQuery = {
  seed: string;
  species: string | null;
  solo: CompareSolo | null;
  gaze: boolean;
  orbit: boolean;
};

export const DEFAULT_COMPARE_QUERY: CompareQuery = {
  seed: COMPARE_PRESETS[0].seed,
  species: COMPARE_PRESETS[0].species,
  solo: null,
  gaze: true,
  orbit: true,
};

export function parseCompareHash(hash: string): CompareQuery {
  const qIndex = hash.indexOf("?");
  const params = new URLSearchParams(qIndex >= 0 ? hash.slice(qIndex + 1) : "");
  const seed = params.get("seed")?.trim() || DEFAULT_COMPARE_QUERY.seed;
  const speciesRaw = params.get("species")?.trim() ?? DEFAULT_COMPARE_QUERY.species;
  const soloRaw = params.get("solo");
  const solo: CompareSolo | null = soloRaw === "ours" || soloRaw === "kit" ? soloRaw : null;
  return {
    seed,
    species: speciesRaw ? speciesRaw : null,
    solo,
    gaze: params.get("gaze") !== "0",
    orbit: params.get("orbit") !== "0",
  };
}

export function toCompareHash(query: CompareQuery): string {
  const params = new URLSearchParams();
  params.set("seed", query.seed);
  if (query.species) params.set("species", query.species);
  if (query.solo) params.set("solo", query.solo);
  if (!query.gaze) params.set("gaze", "0");
  if (!query.orbit) params.set("orbit", "0");
  return `#/avatar-compare?${params.toString()}`;
}
