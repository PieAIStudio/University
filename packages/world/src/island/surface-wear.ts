/** Tile-local surface grain only. These fixed authored scales are not a
 * terrain, climate or placement field. All material channels read this one
 * wear cause. Wrapped value grids avoid the old sine swatch's diagonal waves.
 */
const octaves = [
  { cells: 4, gain: 0.22 },
  { cells: 7, gain: 0.065 },
  { cells: 13, gain: 0.018 },
].map(({ cells, gain }) => ({
  cells,
  gain,
  values: Array.from({ length: cells * cells }, (_, i) => {
    let h = Math.imul(i + 1, 374761393) ^ Math.imul(cells, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (((h ^ (h >>> 16)) >>> 0) / 0xffffffff) * 2 - 1;
  }),
}));
const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export function surfaceWearAt(u: number, v: number): number {
  const wrapU = u - Math.floor(u),
    wrapV = v - Math.floor(v);
  let wear = 0.5;
  for (const { cells, gain, values } of octaves) {
    const x = wrapU * cells,
      y = wrapV * cells;
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const fx = ease(x - ix),
      fy = ease(y - iy);
    const a = values[iy * cells + ix]!;
    const b = values[iy * cells + ((ix + 1) % cells)]!;
    const c = values[((iy + 1) % cells) * cells + ix]!;
    const d = values[((iy + 1) % cells) * cells + ((ix + 1) % cells)]!;
    wear += (a + (b - a) * fx + (c - a + (d - c - b + a) * fx) * fy) * gain;
  }
  return wear;
}
