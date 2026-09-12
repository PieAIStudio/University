/** Vertical envelopes measured from the TWO actual tree meshes. Different
 * growth tiers can stand beside one another without comparing both crowns at
 * their maximum radius, or permitting intersecting opaque leaf volumes.
 * CPU samples only; source geometries are disposed immediately after sampling.
 */
import { createMiniatureAsset } from "./miniature-assets.js";
import { hash } from "./random.js";
export type CourseTreeForm = "fir" | "broadleaf";
export function courseTreeIsFir(shapeSeed: string, x: number, z: number): boolean {
  // Keep the forest conifer-led, but let the rounded broadleaf form read as a
  // real second storey in open clearings. The old 62/38 split made the two
  // real course trees look like an almost uniform fir wall in long lessons.
  return hash(`${shapeSeed}/tree-form/${x.toFixed(3)}/${z.toFixed(3)}`) < 0.56;
}
const BANDS = 32;
const envelopes = new Map<CourseTreeForm, Float32Array>();
function envelope(form: CourseTreeForm): Float32Array {
  const cached = envelopes.get(form);
  if (cached) return cached;
  const geometry = createMiniatureAsset(form, "course");
  const bands = new Float32Array(BANDS);
  try {
    const p = geometry.getAttribute("position"),
      ids = geometry.index!;
    for (let i = 0; i < ids.count; i += 3) {
      const indices = [ids.getX(i), ids.getX(i + 1), ids.getX(i + 2)];
      const low = Math.max(0, Math.floor(Math.min(...indices.map((j) => p.getY(j))) * BANDS));
      const high = Math.min(
        BANDS - 1,
        Math.floor(Math.max(...indices.map((j) => p.getY(j))) * BANDS),
      );
      const radius = Math.max(...indices.map((j) => Math.hypot(p.getX(j), p.getZ(j)))) + 1e-6;
      for (let b = low; b <= high; b++) bands[b] = Math.max(bands[b]!, radius);
    }
  } finally {
    geometry.dispose();
  }
  envelopes.set(form, bands);
  return bands;
}
export interface TreeEnvelopePose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly height: number;
  readonly form: CourseTreeForm;
}
export function courseTreeEnvelopesClear(a: TreeEnvelopePose, b: TreeEnvelopePose): boolean {
  const distance = Math.hypot(a.x - b.x, a.z - b.z);
  if (distance > (a.height + b.height) * 0.45 + 0.04) return true;
  const ea = envelope(a.form),
    eb = envelope(b.form);
  for (let i = 0; i < BANDS; i++) {
    const low = a.y + (i * a.height) / BANDS,
      high = low + a.height / BANDS;
    const start = Math.max(0, Math.floor(((low - b.y) / b.height) * BANDS));
    const end = Math.min(BANDS - 1, Math.floor(((high - b.y) / b.height) * BANDS));
    for (let j = start; j <= end; j++) {
      if (distance < ea[i]! * a.height + eb[j]! * b.height + 0.04) return false;
    }
  }
  return true;
}
