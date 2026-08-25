/** FNV-1a, normalised to [0, 1). Stable across JavaScript runtimes. */
export function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  // Divide by 2^32, not the largest uint32. The latter can return exactly 1
  // and turn `Math.floor(hash * items.length)` into an out-of-range index.
  return (value >>> 0) / 0x100000000;
}

/** A deterministic stream in [0, 1), derived from a stable id. */
export function seeded(seed: string): () => number {
  let step = 0;
  return () => hash(`${seed}#${(step += 1)}`);
}
