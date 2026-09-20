// Material-scale short turf strokes: a periodic swatch, not a placement field.
// Coarse meadow/route identity always comes from the existing IslandField.
const turfCells = 8;
const turfRandom = (i: number) => {
  let h = Math.imul(i + 71, 374761393);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
};
const turfStrokes = Array.from({ length: turfCells * turfCells }, (_, i) => {
  const turn = turfRandom(i * 7) * Math.PI;
  return {
    x: 0.2 + turfRandom(i * 7 + 1) * 0.6,
    y: 0.2 + turfRandom(i * 7 + 2) * 0.6,
    cos: Math.cos(turn),
    sin: Math.sin(turn),
    length: 0.35 + turfRandom(i * 7 + 3) * 0.2,
    width: 0.075 + turfRandom(i * 7 + 4) * 0.045,
  };
});

/** Height of a few overlapping short leaf strokes within one turf cell.
 * Wrapped neighbours make the tile seamless, including around negative UVs.
 */
export function surfaceTurfAt(u: number, v: number): number {
  const x = (u - Math.floor(u)) * turfCells;
  const y = (v - Math.floor(v)) * turfCells;
  const ix = Math.floor(x),
    iy = Math.floor(y);
  let coverage = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx,
        cy = iy + dy;
      const stroke =
        turfStrokes[((cy + turfCells) % turfCells) * turfCells + ((cx + turfCells) % turfCells)]!;
      const px = x - cx - stroke.x,
        py = y - cy - stroke.y;
      const across = px * stroke.cos + py * stroke.sin;
      const along = -px * stroke.sin + py * stroke.cos;
      for (let blade = -1; blade <= 1; blade++) {
        const length = stroke.length * (blade === 0 ? 1 : 0.78);
        const t = (along + length * 0.5) / length;
        if (t <= 0 || t >= 1) continue;
        const width = stroke.width * (1 - t * 0.72);
        const d = Math.abs(across - blade * (0.06 + t * 0.07)) / width;
        if (d >= 1) continue;
        const edge = 1 - d * d * (3 - 2 * d);
        coverage = Math.max(coverage, edge * Math.sin(t * Math.PI));
      }
    }
  return 0.12 + coverage * 0.76;
}
