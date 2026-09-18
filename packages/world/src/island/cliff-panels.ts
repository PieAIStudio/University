/** A bevelled mineral panel replaces, rather than overlays, a piece of the
 * closed cliff. Its outer boundary is exactly the existing loft boundary.
 * Neighbouring panels therefore meet without cracks or hidden duplicate faces.
 */
import * as THREE from "three";

export interface CliffPanelVertex {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly colour: THREE.Color;
}

export const CLIFF_STONE_PANELS = 16;
/** The unsplit world costs 1,312; actual headland/bay splits add counted faces.
 * Worst-case one panel per contour interval:
 * 352 meadow + 64 sod + 32 panels × 3 bands × 12 + 32 cap = 1,600.
 */
export const JOINTED_WORLD_TERRAIN_TRIANGLES = 1600;

export interface CliffPanelStats {
  bevelled: number;
  divided: number;
  plain: number;
}

export interface CliffTopology {
  readonly ringIndices: readonly (readonly number[])[];
  readonly bottomIndex: number;
  readonly bottomStart: number;
  readonly gardenFaces: readonly number[];
  readonly panelCount: number;
  readonly panelStats: CliffPanelStats;
}

interface ChartPoint {
  x: number;
  y: number;
}

/** Kernel of a clockwise planar boundary. A centroid is not
 * necessarily inside all wedges of a notched, non-convex mineral panel.
 */
function panelKernel(points: readonly ChartPoint[], character: number): ChartPoint | null {
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  let polygon: ChartPoint[] = [
    { x: Math.min(...xs), y: Math.min(...ys) },
    { x: Math.max(...xs), y: Math.min(...ys) },
    { x: Math.max(...xs), y: Math.max(...ys) },
    { x: Math.min(...xs), y: Math.max(...ys) },
  ];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!,
      b = points[(i + 1) % points.length]!;
    const signed = (p: ChartPoint) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const next: ChartPoint[] = [];
    for (let j = 0; j < polygon.length; j++) {
      const p = polygon[j]!,
        q = polygon[(j + 1) % polygon.length]!;
      const dp = signed(p),
        dq = signed(q),
        pin = dp <= 1e-12,
        qin = dq <= 1e-12;
      if (pin) next.push(p);
      if (pin !== qin) {
        const t = dp / (dp - dq);
        next.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    }
    polygon = next;
  }
  if (polygon.length < 3) return null;
  const corner = polygon[Math.min(polygon.length - 1, Math.floor(character * polygon.length))]!;
  // A convex combination stays strictly inside the visibility kernel. An
  // off-centre fracture leaves a broad primary plane instead of a stamped
  // pyramid on every block; the boundary and all shared joints stay exact.
  const bias = 0.32;
  return {
    x: (polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length) * (1 - bias) + corner.x * bias,
    y: (polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length) * (1 - bias) + corner.y * bias,
  };
}

/** Returns actual emitted outer-boundary indices, used by the topology probe.
 * All shading vertices are local: a shallow crowned cap and its bevels each
 * own actual face normals, rather than a normal-map imitation of a rock.
 */
export function appendCliffPanel(
  boundary: readonly CliffPanelVertex[],
  colour: THREE.Color,
  scale: number,
  positions: number[],
  colors: number[],
  indices: number[],
  axis: { readonly x: number; readonly z: number },
  gardenFaces: number[],
  stats: CliffPanelStats,
  moss?: THREE.Color,
  character = 0.5,
): number[] {
  const outer = boundary.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const center = outer
    .reduce((sum, p) => sum.add(p), new THREE.Vector3())
    .divideScalar(outer.length);
  const plane = new THREE.Vector3();
  for (let i = 0; i < outer.length; i++)
    plane.add(
      outer[i]!.clone()
        .sub(center)
        .cross(outer[(i + 1) % outer.length]!.clone().sub(center)),
    );
  plane.normalize();
  // At an inward coastline notch Newell's horizontal normal can be almost
  // tangential to the root axis. A radial ray would intersect that plane far
  // outside the island. Mineral caps use the local radial strike with only
  // a bounded share of coastline turn; the original boundary stays exact.
  const radial = new THREE.Vector3(center.x - axis.x, 0, center.z - axis.z).normalize();
  const horizontalNormal = new THREE.Vector3(plane.x, 0, plane.z).normalize();
  const strike = radial.lerp(horizontalNormal, 0.18).normalize();
  const lean = THREE.MathUtils.clamp(plane.y + (character - 0.5) * 0.16, -0.72, 0.4);
  plane.set(strike.x * Math.sqrt(1 - lean * lean), lean, strike.z * Math.sqrt(1 - lean * lean));
  const panelWidth = outer[0]!.distanceTo(outer[outer.length / 2 - 1]!);
  const lift = panelWidth * (0.025 + character * 0.035);
  const planePoint = center.clone().addScaledVector(plane, lift);
  // Inset in the cliff's angular/height chart, THEN intersect the mineral
  // plane. Orthogonal projection first can swap angular neighbours in a bay
  // and fold a bevel inward. This preserves their chart order at both LODs.
  const centerAngle = Math.atan2(center.z - axis.z, center.x - axis.x);
  const planeDistance = plane.dot(planePoint);
  const chart = outer.map((p) => {
    const a = Math.atan2(p.z - axis.z, p.x - axis.x) - centerAngle;
    return { x: Math.atan2(Math.sin(a), Math.cos(a)), y: p.y };
  });
  const upper = chart.slice(0, chart.length / 2);
  const lower = chart.slice(chart.length / 2).reverse();
  const middleAngle =
    (Math.max(upper[0]!.x, lower[0]!.x) +
      Math.min(upper[upper.length - 1]!.x, lower[lower.length - 1]!.x)) /
    2;
  const heightAt = (edge: readonly ChartPoint[], angle: number) => {
    for (let i = 0; i < edge.length - 1; i++) {
      const a = edge[i]!,
        b = edge[i + 1]!;
      if (angle > b.x && i < edge.length - 2) continue;
      const t = THREE.MathUtils.clamp((angle - a.x) / (b.x - a.x), 0, 1);
      return a.y + (b.y - a.y) * t;
    }
    return edge[edge.length - 1]!.y;
  };
  const onPlane = (p: ChartPoint) => {
    const angle = centerAngle + p.x,
      y = p.y;
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    const radius =
      (planeDistance - plane.y * y - plane.x * axis.x - plane.z * axis.z) /
      (plane.x * cos + plane.z * sin);
    return new THREE.Vector3(axis.x + cos * radius, y, axis.z + sin * radius);
  };
  const horizontal = new THREE.Vector3(-plane.z, 0, plane.x).normalize();
  const vertical = horizontal.clone().cross(plane).normalize();
  const outward = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const bx = b.x - a.x,
      by = b.y - a.y,
      bz = b.z - a.z;
    const cx = c.x - a.x,
      cy = c.y - a.y,
      cz = c.z - a.z;
    const crossX = by * cz - bz * cy,
      crossZ = bx * cy - by * cx;
    const x = (a.x + b.x + c.x) / 3 - axis.x;
    const z = (a.z + b.z + c.z) / 3 - axis.z;
    return (crossX * x + crossZ * z) / Math.hypot(x, z) > 1e-7 / (scale * scale);
  };
  let inset: THREE.Vector3[] = [],
    capCenter = planePoint.clone(),
    safe = false;
  // A wide headland must not turn into one billboard-sized mineral slab.
  // Split using the existing contour samples, just like a difficult bay.
  // This angular limit is shared by both projections and stays within the
  // already-counted worst case of one panel per contour interval.
  const broadHeadland =
    Math.max(...chart.map((p) => p.x)) - Math.min(...chart.map((p) => p.x)) > Math.PI / 7 &&
    boundary.length > 4;
  // Unequal coastal relief can need a wider bevel at one notch. This bounded
  // geometric fit tests the actual triangles, not just their 2D chart. Most
  // faces retain the first narrow bevel; no boundary point or winding is moved.
  for (let fit = 0; fit < 6 && !safe && !broadHeadland; fit++) {
    const margin = 0.08 + character * 0.035 + fit * 0.06;
    inset = chart.map((p, i) => {
      const x = middleAngle + (p.x - middleAngle) * (0.89 - character * 0.05 - fit * 0.035);
      const high = heightAt(upper, x),
        low = heightAt(lower, x);
      const half = chart.length / 2;
      const across = (i < half ? i : chart.length - 1 - i) / (half - 1);
      // Clip the shoulders of the inner mineral face, not the shared outer
      // seam. Broad clipped corners break the rectangular concrete-panel cue.
      // A geological break is not a machined octagon: left/right shoulders
      // and upper/lower heels have different bounded cuts. Keeping the same
      // symmetric corner on every cap made the wall read as bevelled columns.
      // Only the inner cap changes; both neighbours retain the exact seam.
      const upperEdge = i < half;
      const leftCut = upperEdge ? 0.055 + character * 0.18 : 0.2 - character * 0.12;
      const rightCut = upperEdge ? 0.17 - character * 0.11 : 0.075 + character * 0.13;
      const corner =
        Math.pow(Math.abs(across * 2 - 1), 3) * (leftCut * (1 - across) + rightCut * across);
      const localMargin = Math.min(0.44, margin + corner);
      return onPlane({
        x,
        y:
          i < chart.length / 2
            ? high * (1 - localMargin) + low * localMargin
            : low * (1 - localMargin) + high * localMargin,
      });
    });
    const kernel = panelKernel(
      inset.map((p) => {
        const offset = p.clone().sub(planePoint);
        return { x: offset.dot(horizontal), y: offset.dot(vertical) };
      }),
      character,
    );
    if (!kernel) continue;
    capCenter = planePoint
      .clone()
      .addScaledVector(horizontal, kernel.x)
      .addScaledVector(vertical, kernel.y)
      // A restrained asymmetric crown creates actual mineral fracture planes
      // inside a broad mass. Without it a wide cap reads as a sheet of concrete.
      // Reuse the same vertices and validate the displaced faces below.
      .addScaledVector(plane, panelWidth * (0.01 + character * 0.015));
    safe = outer.every((p, i) => {
      const j = (i + 1) % outer.length;
      return (
        outward(p, outer[j]!, inset[i]!) &&
        outward(outer[j]!, inset[j]!, inset[i]!) &&
        outward(inset[i]!, inset[j]!, capCenter)
      );
    });
  }
  const seam = colour.clone().multiplyScalar(0.87);
  const emit = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    shades: readonly THREE.Color[],
  ) => {
    const start = positions.length / 3;
    for (const [i, p] of [a, b, c].entries()) {
      positions.push(p.x * scale, p.y * scale, p.z * scale);
      colors.push(shades[i]!.r, shades[i]!.g, shades[i]!.b);
    }
    indices.push(start, start + 1, start + 2);
    return start;
  };
  if (!safe) {
    const half = boundary.length / 2;
    if (half > 2) {
      // Split only a genuinely unfit coast bay. Both children reuse its exact
      // existing cross section, so the split adds neither a T-junction nor an
      // independently positioned rock. Each split has a fixed six-triangle cost.
      stats.divided++;
      const mid = Math.floor((half - 1) / 2);
      const result = Array<number>(boundary.length);
      for (const [start, end] of [
        [0, mid],
        [mid, half - 1],
      ]) {
        const ids = [
          ...Array.from({ length: end! - start! + 1 }, (_, i) => start! + i),
          ...Array.from({ length: end! - start! + 1 }, (_, i) => boundary.length - 1 - end! + i),
        ];
        const emitted = appendCliffPanel(
          ids.map((i) => boundary[i]!),
          colour,
          scale,
          positions,
          colors,
          indices,
          axis,
          gardenFaces,
          stats,
          moss,
          character,
        );
        ids.forEach((id, i) => {
          result[id] = emitted[i]!;
        });
      }
      return result;
    }
    // An exceptionally twisted single coastal cell has no planar inset.
    // Keep its two proven outward mineral planes, not an inverted bevel or a
    // hole. This is a bounded geometry fallback, counted explicitly in evidence.
    if (!outward(outer[0]!, outer[1]!, outer[3]!) || !outward(outer[1]!, outer[2]!, outer[3]!))
      throw new Error("Invalid source cliff winding");
    stats.plain++;
    const first = emit(outer[0]!, outer[1]!, outer[3]!, [colour, colour, colour]);
    const second = emit(outer[1]!, outer[2]!, outer[3]!, [colour, colour, colour]);
    return [first, first + 1, second + 1, first + 2];
  }
  stats.bevelled++;
  const outerIndices: number[] = [];
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    if (i < outer.length / 2 - 1) gardenFaces.push(indices.length, indices.length + 3);
    const crest = i < outer.length / 2 - 1;
    const rim = crest && moss ? moss : seam;
    const inner = crest && moss ? colour.clone().lerp(moss, character < 0.4 ? 0.46 : 0.18) : colour;
    outerIndices.push(emit(outer[i]!, outer[j]!, inset[i]!, [rim, rim, inner]));
    emit(outer[j]!, inset[j]!, inset[i]!, [rim, inner, inner]);
    emit(inset[i]!, inset[j]!, capCenter, [colour, colour, colour]);
  }
  return outerIndices;
}
